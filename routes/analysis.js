const express = require('express');
const { OpenAI } = require('openai');
const router = express.Router();

// Mock scenarios data
const scenarios = require('../data/scenarios.json');

// Customer Service Analysis Schema
const customerServiceSchema = {
    type: "object",
    properties: {
        sentiment: {
            type: "string",
            enum: ["positive", "neutral", "negative", "frustrated"],
            description: "Overall customer sentiment"
        },
        escalationRisk: {
            type: "string", 
            enum: ["low", "medium", "high"],
            description: "Risk of customer escalation"
        },
        primaryIntent: {
            type: "string",
            description: "Main reason for customer contact"
        },
        keyInformation: {
            type: "object",
            properties: {
                orderNumber: { type: "string", description: "Extracted order number" },
                customerEmail: { type: "string", description: "Customer email address" },
                productSKU: { type: "string", description: "Product mentioned" },
                issueDate: { type: "string", description: "When issue occurred" },
                customerPhone: { type: "string", description: "Customer phone number" }
            },
            required: ["orderNumber", "customerEmail", "productSKU", "issueDate", "customerPhone"],
            additionalProperties: false
        },
        suggestedActions: {
            type: "array",
            items: { type: "string" },
            description: "Recommended next steps"
        },
        commitments: {
            type: "array", 
            items: { type: "string" },
            description: "Promises made to customer"
        },
        confidenceScore: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Analysis confidence level"
        },
        summary: {
            type: "string",
            description: "Brief case summary for CRM"
        }
    },
    required: ["sentiment", "escalationRisk", "primaryIntent", "keyInformation", "suggestedActions", "commitments", "confidenceScore", "summary"],
    additionalProperties: false
};

// Initialize OpenAI client
let openaiClient = null;

function initializeOpenAI() {
    if (!openaiClient && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
        const cleanEndpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
        openaiClient = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_KEY,
            baseURL: `${cleanEndpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
            defaultQuery: { 'api-version': '2024-08-01-preview' },
            defaultHeaders: {
                'api-key': process.env.AZURE_OPENAI_KEY,
            }
        });
    }
}

function ensureOpenAIClient() {
    initializeOpenAI();
    if (!openaiClient) {
        const msg = 'Azure OpenAI client not configured. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY and AZURE_OPENAI_DEPLOYMENT.';
        const err = new Error(msg);
        err.code = 'OPENAI_NOT_CONFIGURED';
        throw err;
    }
}

// API Routes
router.post('/analyze', async (req, res) => {
    try {
        const { transcription, scenarioId } = req.body;
        
        initializeOpenAI();
        const analysis = await getAIAnalysis(transcription);
        
        res.json({
            success: true,
            analysis,
            schema: customerServiceSchema,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Analysis error:', error.message);
        res.status(500).json({
            success: false,
            error: `Failed to analyze conversation: ${error.message}`
        });
    }
});

router.post('/finalize', async (req, res) => {
    try {
        const { analysis, scenarioId } = req.body;
        const crmRecord = await createMockCRMRecord(analysis, scenarioId);
        
        res.json({
            success: true,
            crmRecord,
            message: "Analysis finalized and sent to CRM",
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Finalization error:', error.message);
        res.status(500).json({
            success: false,
            error: `Failed to finalize analysis: ${error.message}`
        });
    }
});

router.get('/scenarios', (req, res) => {
    res.json(scenarios);
});

router.get('/scenarios/:id', (req, res) => {
    const scenario = scenarios.find(s => s.id === req.params.id);
    if (!scenario) {
        return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(scenario);
});

// Core Analysis Function
async function getAIAnalysis(transcription) {
    ensureOpenAIClient();

    const prompt = `Analyze this customer service call transcript and extract structured information for our CRM system.

TRANSCRIPT:
${transcription}

Focus on:
- Customer sentiment and escalation risk
- Key information that should be recorded
- Specific commitments made to the customer
- Recommended next actions

Be precise and only extract information that's clearly stated in the conversation.`;

    const baseParams = {
        model: process.env.AZURE_OPENAI_DEPLOYMENT,
        messages: [
            {
                role: "system",
                content: "You are a customer service analysis expert. Extract accurate information from call transcripts to populate CRM systems. Follow the schema exactly."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "customer_service_analysis",
                strict: true,
                schema: customerServiceSchema
            }
        }
    };

    try {
        // Try GPT-4 parameters first, fallback to GPT-5 if needed
        let response;
        try {
            response = await openaiClient.chat.completions.create({
                ...baseParams,
                temperature: 0.1,
                max_tokens: 1000
            });
        } catch (gpt4Error) {
            if (gpt4Error.status === 400 && 
                (gpt4Error.message?.includes('max_tokens') || gpt4Error.message?.includes('temperature'))) {
                // Retry with GPT-5 compatible parameters
                response = await openaiClient.chat.completions.create({
                    ...baseParams,
                    max_completion_tokens: 2000
                });
            } else {
                throw gpt4Error;
            }
        }

        // Validate response
        if (response.choices[0].finish_reason === 'length') {
            throw new Error('Response was truncated due to token limit. The analysis may be incomplete.');
        }

        const rawContent = response?.choices?.[0]?.message?.content;
        if (!rawContent) {
            throw new Error('Unexpected OpenAI response format: missing content');
        }

        // Parse and return analysis
        try {
            return JSON.parse(rawContent);
        } catch (parseErr) {
            throw new Error('Failed to parse AI response. Response was not valid JSON.');
        }
        
    } catch (error) {
        if (error.code === 'OPENAI_NOT_CONFIGURED') {
            throw error;
        }

        const status = error?.response?.status || error?.status;
        if (status === 404) {
            throw new Error(`Deployment '${process.env.AZURE_OPENAI_DEPLOYMENT}' not found. Check your deployment name.`);
        } else if (status === 401) {
            throw new Error(`Authentication failed. Check your API key.`);
        }
        
        throw error;
    }
}

// Helper Functions
async function createMockCRMRecord(analysis, scenarioId) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
        caseId: `CASE-${Date.now()}`,
        title: `Customer Service Case - ${analysis.primaryIntent}`,
        priority: analysis.escalationRisk === 'high' ? 'High' : 
                 analysis.escalationRisk === 'medium' ? 'Medium' : 'Low',
        status: 'Active',
        assignedTo: 'Customer Service Team',
        category: analysis.primaryIntent,
        description: analysis.summary,
        sentiment: analysis.sentiment,
        customerInfo: analysis.keyInformation,
        nextActions: analysis.suggestedActions,
        commitments: analysis.commitments,
        createdAt: new Date().toISOString(),
        estimatedResolution: getEstimatedResolution(analysis.escalationRisk),
        confidenceScore: analysis.confidenceScore
    };
}

function getEstimatedResolution(riskLevel) {
    const now = new Date();
    const hours = riskLevel === 'high' ? 4 : riskLevel === 'medium' ? 24 : 72;
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

module.exports = router;