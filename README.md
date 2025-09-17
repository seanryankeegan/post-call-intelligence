# Post-Call Intelligence Demo

Transform customer service call transcripts into structured business data using AI analysis with human oversight.

**Note**: This demo uses simulated transcripts to demonstrate the workflow. Production implementations would connect to Azure Communication Services or telephony APIs.

## What it does
![Post-Call Intelligence Demo Interface](https://github.com/user-attachments/assets/c7eb8428-9767-4ab0-9946-007c56b36a6a)

1. Select a customer service scenario
2. AI analyzes the conversation transcript
3. Human reviews and can edit the AI results
4. Structured data gets formatted for CRM integration
5. Customer follow-up email is generated

## Prerequisites

- Node.js 16+
- Azure OpenAI resource with a deployed model

## Quick Start

```bash
git clone https://github.com/seanryankeegan/post-call-intelligence
cd post-call-intelligence

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Azure OpenAI credentials

# Start the demo
npm start
```

Open `http://localhost:3000`

## Configuration

Add these values to your `.env` file:

```bash
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
AZURE_OPENAI_KEY="your_api_key"
AZURE_OPENAI_DEPLOYMENT="your_deployment_name"
```

## Key Features

- **AI-Powered Analysis**: Extracts sentiment, escalation risk, intent, and key information from customer conversations
- **Human Oversight**: Review and edit AI analysis before sending to CRM systems
- **CRM Integration**: Demonstrates structured data formatting for Dynamics 365 integration
- **Customer Follow-up**: Automated email generation based on conversation analysis
- **Professional UI**: Clean, business-ready interface suitable for demonstrations
- **Multiple Scenarios**: Four realistic customer service scenarios across different industries

## Demo Scenarios

- **Contoso Airlines** - Frustrated customer with billing dispute (high escalation risk)
- **Contoso Electronics** - Product defect requiring replacement (technical support) 
- **Contoso Cloud Services** - Happy customer requesting service upgrade (upsell opportunity)
- **Contoso Financial** - Account access issue requiring security verification

## Usage Costs

This demo uses real Azure services, so minimal usage-based costs may apply. We've designed it to be lightweight, but extended use will incur charges
- **Azure OpenAI**: Costs depend on the model used (e.g., GPT-4) and token volume. See the [Azure OpenAI Pricing page](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) for details.

## Troubleshooting

- **"Deployment not found"**: Verify your `AZURE_OPENAI_DEPLOYMENT` matches the exact name in Azure Portal → Model deployments
- **"Authentication failed"**: Check your API key is correct and the resource is active
- **Analysis fails**: Ensure your deployment supports the `2024-08-01-preview` API version
>>>>>>> a1996ba (Initial public release: Post-Call Intelligence demo)
