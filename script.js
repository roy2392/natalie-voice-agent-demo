// Natali Voice Agent - Hebrew Voice Assistant
class NataliVoiceAgent {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;

        // Initialize elements
        this.voiceButton = document.getElementById('voiceButton');
        this.stopButton = document.getElementById('stopButton');
        this.statusText = document.getElementById('statusText');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.conversation = document.getElementById('conversation');

        // Knowledge base about Natali services
        this.knowledgeBase = {
            company: {
                name: "נטלי",
                description: "החברה הגדולה, הוותיקה והמנוסה ביותר לשירותי רפואה ביתיים בישראל",
                experience: "למעלה מ-30 שנות ניסיון",
                phone: "03-6076111",
                emergency: "*3380",
                address: "רחוב החילזון 4, רמת גן 5231282"
            },
            services: [
                "מוקד חירום רפואי זמין 24 שעות ביממה, 7 ימים בשבוע",
                "שירותי טלרפואה מתקדמים",
                "טיפול סיעודי ביתי מקצועי",
                "תוכניות בריאות קהילתיות",
                "התקני מעקב רפואיים חכמים",
                "מערכות כפתור מצוקה מתקדמות",
                "צוותים רפואיים ארציים",
                "שירותים לחולים כרוניים וקשישים",
                "תמיכה משפחתית מקיפה"
            ],
            advantages: [
                "כיסוי ארצי מלא",
                "אלפי אנשי מקצוע רפואיים",
                "זמינות 24/7",
                "ניסיון של מעל 30 שנה",
                "שירות אמין ומקצועי",
                "טכנולוגיה רפואית מתקדמת"
            ]
        };

        this.init();
    }

    init() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.statusText.textContent = 'הדפדפן אינו תומך בזיהוי קולי';
            this.voiceButton.disabled = true;
            return;
        }

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'he-IL';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        // Event listeners
        this.voiceButton.addEventListener('click', () => this.startListening());
        this.stopButton.addEventListener('click', () => this.stopAgent());

        this.recognition.onstart = () => this.onListeningStart();
        this.recognition.onresult = (event) => this.onResult(event);
        this.recognition.onerror = (event) => this.onError(event);
        this.recognition.onend = () => this.onListeningEnd();

        // Synthesis events
        this.synthesis.onvoiceschanged = () => this.loadVoices();
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();

        // Try to find the best quality Hebrew voice
        // Priority: 1) Premium Hebrew voices, 2) Any Hebrew voice, 3) Default
        const hebrewVoices = this.voices.filter(voice => voice.lang.startsWith('he'));

        if (hebrewVoices.length > 0) {
            // Prefer premium/enhanced voices (usually have "Enhanced" or "Premium" in name)
            const premiumVoice = hebrewVoices.find(voice =>
                voice.name.includes('Enhanced') ||
                voice.name.includes('Premium') ||
                voice.name.includes('Natural') ||
                voice.localService === false // Cloud-based voices are usually better
            );

            // Prefer female voices for a warmer, more caring tone
            const femaleVoice = hebrewVoices.find(voice =>
                voice.name.includes('Female') ||
                voice.name.includes('Carmit') ||
                voice.name.includes('female')
            );

            this.hebrewVoice = premiumVoice || femaleVoice || hebrewVoices[0];
        } else {
            this.hebrewVoice = this.voices[0];
        }

        console.log('Available voices:', this.voices.map(v => `${v.name} (${v.lang})`));
        console.log('Selected voice:', this.hebrewVoice?.name);
    }

    startListening() {
        if (this.isListening || this.isSpeaking) return;

        try {
            this.recognition.start();
            this.voiceButton.style.display = 'none';
            this.stopButton.style.display = 'block';
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.statusText.textContent = 'שגיאה בהפעלת המיקרופון';
        }
    }

    stopAgent() {
        this.synthesis.cancel();
        if (this.isListening) {
            this.recognition.stop();
        }
        this.resetUI();
    }

    resetUI() {
        this.isListening = false;
        this.isSpeaking = false;
        this.voiceIndicator.classList.remove('listening', 'speaking');
        this.voiceButton.classList.remove('listening');
        this.voiceButton.style.display = 'block';
        this.stopButton.style.display = 'none';
        this.statusText.textContent = 'לחצו על המיקרופון כדי להתחיל';
    }

    onListeningStart() {
        this.isListening = true;
        this.voiceIndicator.classList.add('listening');
        this.voiceButton.classList.add('listening');
        this.statusText.textContent = 'מקשיב... דברו בבקשה';
    }

    onListeningEnd() {
        this.isListening = false;
        this.voiceIndicator.classList.remove('listening');
        if (!this.isSpeaking) {
            this.statusText.textContent = 'מעבד את השאלה...';
        }
    }

    onResult(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Recognized:', transcript);

        // Display user message
        this.addMessage(transcript, 'user');

        // Process and respond
        const response = this.generateResponse(transcript);
        this.speak(response);
    }

    onError(event) {
        console.error('Speech recognition error:', event.error);

        let errorMessage = 'אירעה שגיאה';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'לא זוהה דיבור. אנא נסו שוב';
                break;
            case 'audio-capture':
                errorMessage = 'לא נמצא מיקרופון';
                break;
            case 'not-allowed':
                errorMessage = 'יש לאפשר גישה למיקרופון';
                break;
        }

        this.statusText.textContent = errorMessage;
        setTimeout(() => this.resetUI(), 3000);
    }

    generateResponse(question) {
        const q = question.toLowerCase();

        // Greetings
        if (q.includes('שלום') || q.includes('היי') || q.includes('בוקר טוב') || q.includes('ערב טוב')) {
            return 'שלום וברכה! אני הסוכן הקולי החכם של נטלי. איך אוכל לעזור לכם היום?';
        }

        // Emergency / Contact
        if (q.includes('חירום') || q.includes('דחוף') || q.includes('טלפון') || q.includes('מספר') || q.includes('צור קשר')) {
            return `למצבי חירום, חייגו כוכבית 3380. למידע כללי, טלפון ${this.knowledgeBase.company.phone}. המוקד שלנו זמין 24 שעות ביממה, 7 ימים בשבוע.`;
        }

        // Services
        if (q.includes('שירות') || q.includes('מה אתם') || q.includes('מה עושים') || q.includes('מציעים')) {
            const services = this.knowledgeBase.services.slice(0, 4).join(', ');
            return `נטלי מציעה מגוון רחב של שירותי רפואה ביתיים, כולל: ${services}, ועוד הרבה יותר.`;
        }

        // Home care / nursing
        if (q.includes('סיעוד') || q.includes('טיפול') || q.includes('אחות') || q.includes('ביתי')) {
            return 'אנחנו מספקים שירותי טיפול סיעודי ביתי מקצועי עם אלפי אנשי מקצוע מנוסים. הצוותים שלנו זמינים בכל הארץ ומעניקים טיפול איכותי ומסור בבית המטופל.';
        }

        // Emergency button / monitoring
        if (q.includes('כפתור') || q.includes('מצוקה') || q.includes('מעקב') || q.includes('התקן')) {
            return 'אנחנו מספקים מערכות כפתור מצוקה מתקדמות והתקני מעקב רפואיים חכמים. המערכות מחוברות למוקד החירום שלנו שזמין 24 שעות ביממה לתגובה מהירה.';
        }

        // Telehealth
        if (q.includes('טלרפואה') || q.includes('מרחוק') || q.includes('וידאו')) {
            return 'נטלי מציעה שירותי טלרפואה מתקדמים המאפשרים לקבל ייעוץ רפואי מקצועי מהבית. השירות זמין דרך מגוון ערוצי תקשורת ומאפשר מעקב רפואי מתמיד.';
        }

        // Experience / About
        if (q.includes('ניסיון') || q.includes('שנים') || q.includes('מי אתם') || q.includes('על החברה')) {
            return `נטלי היא החברה הגדולה, הוותיקה והמנוסה ביותר לשירותי רפואה ביתיים בישראל, עם למעלה מ-30 שנות ניסיון. אנחנו מעניקים שירות אמין ומקצועי לאלפי משפחות בכל רחבי הארץ.`;
        }

        // Availability / Hours
        if (q.includes('שעות') || q.includes('זמין') || q.includes('מתי') || q.includes('פתוח')) {
            return 'המוקד החירום הרפואי שלנו זמין 24 שעות ביממה, 7 ימים בשבוע, 365 ימים בשנה. אנחנו תמיד כאן בשבילכם.';
        }

        // Location / Address
        if (q.includes('כתובת') || q.includes('איפה') || q.includes('מיקום') || q.includes('נמצא')) {
            return `המשרדים שלנו ממוקמים ב${this.knowledgeBase.company.address}. השירותים שלנו זמינים בכל רחבי הארץ.`;
        }

        // Elderly / Seniors
        if (q.includes('קשיש') || q.includes('זקן') || q.includes('גיל שלישי')) {
            return 'אנחנו מתמחים במתן שירותים מקיפים לאזרחים ותיקים, כולל טיפול סיעודי ביתי, מעקב רפואי, כפתור מצוקה, ותמיכה משפחתית מלאה. הצוות שלנו מיומן במיוחד בטיפול בקשישים.';
        }

        // Chronic patients
        if (q.includes('כרוני') || q.includes('מחלה') || q.includes('ממושך')) {
            return 'נטלי מספקת שירותים מיוחדים לחולים כרוניים, כולל מעקב רפואי מתמשך, התקני מעקב חכמים, טיפול ביתי מקצועי ותמיכה משפחתית. אנחנו מבינים את הצרכים המיוחדים של חולים כרוניים ומעניקים טיפול מותאם אישית.';
        }

        // Cost / Price
        if (q.includes('מחיר') || q.includes('כמה עולה') || q.includes('עלות') || q.includes('תשלום')) {
            return 'המחירים משתנים בהתאם לסוג השירות ולצרכים האישיים. אנא צרו קשר עם המוקד שלנו בטלפון 03-6076111 לקבלת הצעת מחיר מותאמת אישית וייעוץ ללא עלות.';
        }

        // Thank you
        if (q.includes('תודה') || q.includes('תודה רבה')) {
            return 'בשמחה! אם יש לכם שאלות נוספות, אני כאן לעזור. תמיד אפשר גם לפנות למוקד שלנו בטלפון 03-6076111.';
        }

        // Goodbye
        if (q.includes('להתראות') || q.includes('ביי') || q.includes('שלום')) {
            return 'להתראות ויום נעים! נטלי תמיד כאן בשבילכם. בריאות טובה!';
        }

        // Default response
        return 'זו שאלה מעניינת. אשמח לעזור לכם. אנא חייגו למוקד שלנו בטלפון 03-6076111 או כוכבית 3380 למצבי חירום, ונציגינו המקצועיים יענו על כל שאלה בפירוט. אנחנו זמינים 24 שעות ביממה.';
    }

    speak(text) {
        this.isSpeaking = true;
        this.voiceIndicator.classList.add('speaking');
        this.statusText.textContent = 'משיב...';

        // Display agent message
        this.addMessage(text, 'agent');

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'he-IL';

        // Optimize for natural-sounding Hebrew speech
        utterance.rate = 0.95;      // Slightly slower for natural rhythm (was 0.9)
        utterance.pitch = 1.05;     // Slightly higher pitch for warmth and friendliness
        utterance.volume = 1.0;     // Full volume for clarity

        if (this.hebrewVoice) {
            utterance.voice = this.hebrewVoice;
        }

        utterance.onend = () => {
            this.isSpeaking = false;
            this.voiceIndicator.classList.remove('speaking');
            this.statusText.textContent = 'לחצו על המיקרופון כדי להמשיך';
            this.resetUI();
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.isSpeaking = false;
            this.voiceIndicator.classList.remove('speaking');
            this.resetUI();
        };

        // Cancel any ongoing speech before starting new one
        this.synthesis.cancel();

        // Small delay to ensure clean start (helps with some browsers)
        setTimeout(() => {
            this.synthesis.speak(utterance);
        }, 50);
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const label = document.createElement('div');
        label.className = 'message-label';
        label.textContent = type === 'user' ? 'אתם:' : 'נטלי:';

        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;

        messageDiv.appendChild(label);
        messageDiv.appendChild(messageText);

        this.conversation.appendChild(messageDiv);
        this.conversation.scrollTop = this.conversation.scrollHeight;
    }
}

// Initialize the voice agent when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const agent = new NataliVoiceAgent();
});
