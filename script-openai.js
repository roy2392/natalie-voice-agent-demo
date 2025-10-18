// Natali Voice Agent - OpenAI GPT-4o with Natural TTS
class NataliVoiceAgent {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.recognition = null;
        this.conversationHistory = [];
        this.knowledgeBase = null;

        // Initialize elements
        this.voiceButton = document.getElementById('voiceButton');
        this.stopButton = document.getElementById('stopButton');
        this.statusText = document.getElementById('statusText');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.conversation = document.getElementById('conversation');

        this.init();
    }

    async init() {
        // Load knowledge base
        await this.loadKnowledgeBase();

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

        console.log('Natali Voice Agent initialized with OpenAI');
    }

    async loadKnowledgeBase() {
        try {
            const response = await fetch('natalie-knowledge-base.json');
            this.knowledgeBase = await response.json();
            console.log('Knowledge base loaded successfully');
        } catch (error) {
            console.error('Failed to load knowledge base:', error);
        }
    }

    generateSystemPrompt() {
        if (!this.knowledgeBase) {
            return this.getDefaultSystemPrompt();
        }

        const kb = this.knowledgeBase;

        return `אתה סוכן קולי חכם ומקצועי עבור חברת נטלי - ${kb.company.description}.

מידע מפורט על נטלי:

📊 נתונים סטטיסטיים:
- ${kb.company.statistics.calls_per_year}
- ${kb.company.statistics.connected_homes}
- ${kb.company.statistics.home_doctor_visits}
- ${kb.company.statistics.service_providers}

📞 פרטי התקשרות:
- כתובת: ${kb.contact.address}
- טלפון מרכזייה: ${kb.contact.main_phone}
- WhatsApp: ${kb.contact.whatsapp}
- חירום לחברים: ${kb.contact.emergency_hotline_members}
- שירותים כלליים: ${kb.contact.member_services_hotline}
- שעות פעילות: ${kb.contact.hours}

🏥 שירותי נטלי:

1. ${kb.services.emergency_solutions.name}:
${kb.services.emergency_solutions.details.map(d => `   - ${d}`).join('\n')}

2. ${kb.services.telemedicine.name}:
${kb.services.telemedicine.details.map(d => `   - ${d}`).join('\n')}

3. ${kb.services.home_care.name}:
${kb.services.home_care.details.map(d => `   - ${d}`).join('\n')}

4. ${kb.services.community_services.name}:
${kb.services.community_services.details.map(d => `   - ${d}`).join('\n')}

5. ${kb.services.education_training.name}:
${kb.services.education_training.details.map(d => `   - ${d}`).join('\n')}

6. שירותים נוספים לחברי נטלי:
${kb.services.additional_member_services.details.map(d => `   - ${d}`).join('\n')}

⭐ יתרונות נטלי:
${kb.unique_selling_points.map(p => `- ${p}`).join('\n')}

❓ שאלות נפוצות:
${kb.faq.map(f => `
שאלה: ${f.question}
תשובה: ${f.answer}`).join('\n')}

הנחיות לשיחה:
1. דבר בעברית בלבד
2. היה מנומס, מקצועי, חם ואכפתי
3. תן תשובות תמציתיות וברורות (2-4 משפטים)
4. השתמש במידע מבסיס הידע שסופק לך למעלה
5. אם לא יודע משהו, הפנה ללקוח לטלפון ${kb.contact.main_phone}
6. למצבי חירום - הדגש את מספר ${kb.contact.emergency_hotline_members} (לחברים) או ${kb.contact.member_services_hotline} (כללי)
7. השתמש בטון אכפתי ומקצועי המתאים לחברת שירותי בריאות
8. תמיד ענה על סמך המידע המדויק שסופק לך
9. אל תמציא מידע - אם לא בטוח, הפנה ללקוח לצוות נטלי

זכור: אתה מייצג חברה רפואית מכובדת עם ${kb.company.experience} ניסיון. הקפד על מקצועיות, דיוק ואמפתיה בכל תשובה.`;
    }

    getDefaultSystemPrompt() {
        return `אתה סוכן קולי חכם ומקצועי עבור חברת נטלי - החברה הגדולה והוותיקה ביותר לשירותי רפואה ביתיים בישראל.

דבר בעברית בלבד, היה מנומס ומקצועי, ותן תשובות תמציתיות וברורות.`;
    }

    async startListening() {
        if (this.isListening || this.isSpeaking || this.isProcessing) return;

        // Request microphone permission on mobile
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.statusText.textContent = 'יש לאפשר גישה למיקרופון';
            return;
        }

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
        // Stop any ongoing speech
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }

        if (this.isListening) {
            this.recognition.stop();
        }
        this.resetUI();
    }

    resetUI() {
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.voiceIndicator.classList.remove('listening', 'speaking');
        this.voiceButton.classList.remove('listening');
        this.voiceButton.style.display = 'block';
        this.stopButton.style.display = 'none';

        // Update button text based on conversation history
        this.updateButtonText();

        // Update status text
        const hasConversation = this.conversationHistory.length > 0;
        this.statusText.textContent = hasConversation ? 'לחצו על המיקרופון כדי להמשיך' : 'לחצו על המיקרופון כדי להתחיל';
    }

    updateButtonText() {
        const buttonText = this.voiceButton.querySelector('.button-text');
        const hasConversation = this.conversationHistory.length > 0;
        buttonText.textContent = hasConversation ? 'המשך שיחה' : 'התחל שיחה';
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
        if (!this.isSpeaking && !this.isProcessing) {
            this.statusText.textContent = 'לחצו על המיקרופון כדי להתחיל';
        }
    }

    async onResult(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Recognized:', transcript);

        // Display user message
        this.addMessage(transcript, 'user');

        // Process with OpenAI GPT-4o
        this.isProcessing = true;
        this.statusText.textContent = 'חושב...';

        try {
            const response = await this.generateAIResponse(transcript);
            await this.speakWithOpenAI(response);
        } catch (error) {
            console.error('Error generating response:', error);
            this.statusText.textContent = 'שגיאה בקבלת תשובה';
            this.addMessage('מצטער, אירעה שגיאה. אנא נסו שוב או חייגו 03-6076111', 'agent');
            setTimeout(() => this.resetUI(), 3000);
        }

        this.isProcessing = false;
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

    async generateAIResponse(userMessage) {
        // Wait for configuration to load
        await configReady;

        // Add user message to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        // Prepare the API request to OpenAI
        const url = 'https://api.openai.com/v1/chat/completions';

        const requestBody = {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: this.generateSystemPrompt()
                },
                ...this.conversationHistory
            ],
            max_tokens: 150,
            temperature: 0.7
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AZURE_CONFIG.openai.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI API error:', errorText);
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;

            // Add assistant response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });

            // Keep conversation history manageable (last 10 messages)
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }

            return assistantMessage;

        } catch (error) {
            console.error('Error calling OpenAI:', error);
            throw error;
        }
    }

    async speakWithOpenAI(text) {
        this.isSpeaking = true;
        this.voiceIndicator.classList.add('speaking');
        this.statusText.textContent = 'משיב...';

        // Display agent message
        this.addMessage(text, 'agent');

        try {
            // Wait for configuration
            await configReady;

            // Use OpenAI TTS API
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AZURE_CONFIG.openai.apiKey}`
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    voice: 'nova', // Natural female voice - works well for Hebrew
                    input: text,
                    speed: 0.95
                })
            });

            if (!response.ok) {
                throw new Error('TTS API request failed');
            }

            // Get audio data
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Play the audio
            const audio = new Audio(audioUrl);

            audio.onended = () => {
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.statusText.textContent = 'לחצו על המיקרופון כדי להמשיך';
                this.resetUI();
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.resetUI();
                URL.revokeObjectURL(audioUrl);
            };

            await audio.play();

        } catch (error) {
            console.error('Error with OpenAI TTS:', error);
            // Fallback to browser TTS
            console.log('Falling back to browser TTS');
            await this.speakWithBrowser(text);
        }
    }

    speakWithBrowser(text) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'he-IL';
            utterance.rate = 0.95;
            utterance.pitch = 1.05;
            utterance.volume = 1.0;

            // Get available voices
            const voices = window.speechSynthesis.getVoices();

            // Find best Hebrew voice
            const hebrewVoice =
                voices.find(v => v.lang.startsWith('he') && v.name.toLowerCase().includes('carmit')) ||
                voices.find(v => v.lang.startsWith('he') && !v.localService) ||
                voices.find(v => v.lang.startsWith('he'));

            if (hebrewVoice) {
                utterance.voice = hebrewVoice;
            }

            utterance.onend = () => {
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.statusText.textContent = 'לחצו על המיקרופון כדי להמשיך';
                this.resetUI();
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('Browser TTS error:', event.error);
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.resetUI();
                resolve();
            };

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        });
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
