// Serverless function to provide environment variables securely
export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Return environment variables
    res.status(200).json({
        AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
        AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
        AZURE_SPEECH_API_KEY: process.env.AZURE_SPEECH_API_KEY,
        AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
        AZURE_SPEECH_VOICE: process.env.AZURE_SPEECH_VOICE
    });
}
