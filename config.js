// Azure AI Configuration
// Configuration will be loaded from environment variables

let AZURE_CONFIG = {
    // OpenAI API Configuration (for Realtime API)
    openai: {
        endpoint: window.ENV?.AZURE_OPENAI_ENDPOINT || '',
        apiKey: window.ENV?.OPENAI_API_KEY || window.ENV?.AZURE_OPENAI_API_KEY || '',
        deploymentName: window.ENV?.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        apiVersion: window.ENV?.AZURE_OPENAI_API_VERSION || '2024-12-01-preview'
    },

    // Azure Speech Service Configuration (fallback)
    speech: {
        apiKey: window.ENV?.AZURE_SPEECH_API_KEY || '',
        region: window.ENV?.AZURE_SPEECH_REGION || 'eastus2',
        voiceName: window.ENV?.AZURE_SPEECH_VOICE || 'he-IL-HilaNeural'
    }
};

// Promise to track configuration loading
let configReady = Promise.resolve();

// Load configuration from serverless function if not already set
if (!window.ENV) {
    configReady = fetch('/api/config')
        .then(response => response.json())
        .then(config => {
            AZURE_CONFIG.openai.endpoint = config.AZURE_OPENAI_ENDPOINT;
            AZURE_CONFIG.openai.apiKey = config.OPENAI_API_KEY || config.AZURE_OPENAI_API_KEY;
            AZURE_CONFIG.openai.deploymentName = config.AZURE_OPENAI_DEPLOYMENT;
            AZURE_CONFIG.openai.apiVersion = config.AZURE_OPENAI_API_VERSION;
            AZURE_CONFIG.speech.apiKey = config.AZURE_SPEECH_API_KEY;
            AZURE_CONFIG.speech.region = config.AZURE_SPEECH_REGION;
            AZURE_CONFIG.speech.voiceName = config.AZURE_SPEECH_VOICE;
            console.log('Configuration loaded from API');
        })
        .catch(error => {
            console.error('Failed to load configuration:', error);
        });
}

// System prompt for the Natali voice agent
const NATALI_SYSTEM_PROMPT = `אתה סוכן קולי חכם ומקצועי עבור חברת נטלי - החברה הגדולה והוותיקה ביותר לשירותי רפואה ביתיים בישראל.

מידע על נטלי:
- החברה הגדולה והוותיקה ביותר לשירותי רפואה ביתיים בישראל
- למעלה מ-30 שנות ניסיון
- מוקד חירום רפואי זמין 24/7
- מספר חירום: *3380
- טלפון למידע כללי: 03-6076111
- כתובת: רחוב החילזון 4, רמת גן 5231282

שירותי נטלי:
- מוקד חירום רפואי זמין 24 שעות ביממה, 7 ימים בשבוע
- שירותי טלרפואה מתקדמים
- טיפול סיעודי ביתי מקצועי
- תוכניות בריאות קהילתיות
- התקני מעקב רפואיים חכמים
- מערכות כפתור מצוקה מתקדמות
- צוותים רפואיים ארציים
- שירותים לחולים כרוניים וקשישים
- תמיכה משפחתית מקיפה

יתרונות נטלי:
- כיסוי ארצי מלא
- אלפי אנשי מקצוע רפואיים
- זמינות 24/7
- ניסיון של מעל 30 שנה
- שירות אמין ומקצועי
- טכנולוגיה רפואית מתקדמת

הנחיות לשיחה:
1. דבר בעברית בלבד
2. היה מנומס, מקצועי וחם
3. תן תשובות תמציתיות וברורות (2-4 משפטים)
4. אם לא יודע משהו, הפנה ללקוח לטלפון 03-6076111
5. למצבי חירום - תמיד הדגש את מספר *3380
6. השתמש בטון אכפתי ומקצועי המתאים לחברת שירותי בריאות
7. אל תמציא מידע - השתמש רק במידע שניתן לך

זכור: אתה מייצג חברה רפואית מכובדת עם 30 שנות ניסיון. הקפד על מקצועיות ואמפתיה בכל תשובה.`;
