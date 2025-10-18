// Serverless function to provide environment variables securely
export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Aggressive cache prevention
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Use OPENAI_API_KEY if available, fallback to AZURE_OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY;

    // Return environment variables
    res.status(200).json({
        OPENAI_API_KEY: apiKey,
        AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_API_KEY: apiKey,
        AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
        AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
        AZURE_SPEECH_API_KEY: process.env.AZURE_SPEECH_API_KEY,
        AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
        AZURE_SPEECH_VOICE: process.env.AZURE_SPEECH_VOICE
    });
}
