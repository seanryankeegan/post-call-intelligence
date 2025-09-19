# Post-Call Intelligence Demo

Transform customer service call transcripts into structured business data using AI analysis with human oversight.

**Note**: This demo uses simulated transcripts to demonstrate the workflow. Production implementations would connect to Azure Communication Services or telephony APIs.

## What it does
![Post-Call Intelligence Demo Interface](https://github.com/user-attachments/assets/c7eb8428-9767-4ab0-9946-007c56b36a6a)

1. Select a customer service scenario (4 realistic examples across airlines, electronics, cloud services, and financial sectors)
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

## Model Compatibility

This demo automatically detects and works with both GPT-4 and GPT-5 models:
- **GPT-4**: Fully supported with optimized parameters
- **GPT-5**: Supported with automatic parameter adjustment

No configuration needed - the demo detects your model type and uses appropriate API parameters.

## Usage Costs

This demo uses Azure OpenAI services with usage-based pricing. Costs depend on the model used (e.g., GPT-4) and token volume. See the [Azure OpenAI Pricing page](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) for details.

## Next Steps

For production implementations:
- Connect to [Azure Communication Services Call Automation APIs](https://learn.microsoft.com/en-us/azure/communication-services/how-tos/call-automation/real-time-transcription-tutorial) for live transcription
- Set up async processing queues for high call volumes  
- Integrate with your actual CRM system APIs
- Add authentication and user management
- Implement proper error handling and monitoring

## Troubleshooting

- **"Deployment not found"**: Verify your `AZURE_OPENAI_DEPLOYMENT` matches the exact name in Azure Portal → Model deployments
- **"Unsupported parameter" errors**: The demo automatically handles GPT-4/GPT-5 differences, but ensure your deployment name is correct
- **"Authentication failed"**: Check your API key is correct and the resource is active
- **Analysis fails**: Ensure your deployment supports the `2024-08-01-preview` API version

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.