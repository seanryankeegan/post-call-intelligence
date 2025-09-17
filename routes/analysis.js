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
        console.log(`🤖 Azure OpenAI initialized with deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT}`);
    }
}

// Helper to ensure the OpenAI client is available before making requests
function ensureOpenAIClient() {
    initializeOpenAI();
    if (!openaiClient) {
        const msg = 'Azure OpenAI client not configured. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY and AZURE_OPENAI_DEPLOYMENT.';
        const err = new Error(msg);
        err.code = 'OPENAI_NOT_CONFIGURED';
        throw err;
    }
}

// Analyze conversation endpoint
router.post('/analyze', async (req, res) => {
    try {
        const { transcription, scenarioId } = req.body;
        
        console.log(`🔍 Analyzing conversation for scenario: ${scenarioId}`);
        
        // Initialize OpenAI if not already done
        initializeOpenAI();
        
        // Get AI analysis
        const analysis = await getAIAnalysis(transcription);
        
        res.json({
            success: true,
            analysis,
            schema: customerServiceSchema, // Include schema for transparency
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to analyze conversation: ${error.message}`
        });
    }
});

// Finalize analysis endpoint (human-approved)
router.post('/finalize', async (req, res) => {
    try {
        const { analysis, scenarioId } = req.body;
        
        console.log(`✅ Finalizing analysis for scenario: ${scenarioId}`);
        
        // Create CRM record with human-approved data
        const crmRecord = await createMockCRMRecord(analysis, scenarioId);
        
        res.json({
            success: true,
            crmRecord,
            message: "Analysis finalized and sent to CRM",
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Finalization error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to finalize analysis: ${error.message}`
        });
    }
});

// Get available scenarios
router.get('/scenarios', (req, res) => {
    res.json(scenarios);
});

// Get specific scenario
router.get('/scenarios/:id', (req, res) => {
    const scenario = scenarios.find(s => s.id === req.params.id);
    if (!scenario) {
        return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(scenario);
});

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

    try {
        console.log('🤖 Sending request to Azure OpenAI...');
        
        const response = await openaiClient.chat.completions.create({
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
            temperature: 0.1,
            max_tokens: 1000,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "customer_service_analysis",
                    strict: true,
                    schema: customerServiceSchema
                }
            }
        });

        console.log('✅ Azure OpenAI response received');

        // Defensive parsing: ensure the response shape and content exist before parsing
        const rawContent = response?.choices?.[0]?.message?.content;
        if (!rawContent) {
            throw new Error('Unexpected OpenAI response format: missing content');
        }

        let analysis;
        try {
            analysis = JSON.parse(rawContent);
        } catch (parseErr) {
            console.error('Failed to parse OpenAI response JSON:', parseErr);
            throw new Error('Failed to parse AI response. Response was not valid JSON.');
        }
        
        return analysis;
        
    } catch (error) {
        console.error('💥 OpenAI API error:', error);
        
        // Map common error scenarios to friendlier messages
        if (error.code === 'OPENAI_NOT_CONFIGURED') {
            // Propagate as a 503-style error up the stack
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

async function createMockCRMRecord(analysis, scenarioId) {
    console.log('📊 Creating Dynamics 365 case...');
    
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