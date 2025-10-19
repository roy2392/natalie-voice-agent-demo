// Natali Voice Agent - OpenAI GPT-4o with Natural TTS
class NataliVoiceAgent {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.recognition = null;
        this.conversationHistory = [];
        this.knowledgeBase = null;
        this.callScenarios = null;
        this.currentScenario = null;
        this.currentStep = 0;
        this.collectedData = {};

        // Initialize elements
        this.voiceButton = document.getElementById('voiceButton');
        this.stopButton = document.getElementById('stopButton');
        this.statusText = document.getElementById('statusText');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.conversation = document.getElementById('conversation');
        this.scenarioSelection = document.getElementById('scenarioSelection');
        this.agentContainer = document.getElementById('agentContainer');
        this.backButton = document.getElementById('backButton');

        this.init();
    }

    async init() {
        // Load knowledge base and call scenarios
        await this.loadKnowledgeBase();
        await this.loadCallScenarios();

        // Setup scenario selection buttons
        this.setupScenarioSelection();

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
        this.backButton.addEventListener('click', () => this.returnToScenarioSelection());

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

    async loadCallScenarios() {
        try {
            const response = await fetch('call-scenarios.json');
            this.callScenarios = await response.json();
            console.log('Call scenarios loaded successfully');
        } catch (error) {
            console.error('Failed to load call scenarios:', error);
        }
    }

    setupScenarioSelection() {
        const scenarioButtons = document.querySelectorAll('.scenario-btn');
        scenarioButtons.forEach(button => {
            button.addEventListener('click', () => {
                const scenario = button.getAttribute('data-scenario');
                this.selectScenario(scenario);
            });
        });
    }

    selectScenario(scenarioType) {
        console.log('Selected scenario:', scenarioType);

        // Reset state
        this.conversationHistory = [];
        this.currentStep = 0;
        this.collectedData = {};
        this.conversation.innerHTML = '';

        // Set current scenario
        if (scenarioType === 'assistant') {
            this.currentScenario = 'assistant';
        } else if (scenarioType === 'outbound') {
            this.currentScenario = 'outbound_satisfaction';
        } else if (scenarioType === 'inbound') {
            this.currentScenario = 'inbound_intake_short';
        }

        // Hide scenario selection, show agent container
        this.scenarioSelection.style.display = 'none';
        this.agentContainer.style.display = 'flex';

        // Start the conversation automatically for structured scenarios
        if (this.currentScenario !== 'assistant') {
            setTimeout(() => this.startStructuredCall(), 1000);
        }
    }

    returnToScenarioSelection() {
        // Stop any ongoing speech
        this.stopAgent();

        // Reset state
        this.conversationHistory = [];
        this.currentStep = 0;
        this.collectedData = {};
        this.currentScenario = null;
        this.conversation.innerHTML = '';

        // Show scenario selection, hide agent container
        this.agentContainer.style.display = 'none';
        this.scenarioSelection.style.display = 'block';

        // Reset UI
        this.resetUI();
    }

    async startStructuredCall() {
        if (!this.callScenarios || !this.currentScenario) return;

        const scenario = this.callScenarios[this.currentScenario];
        if (!scenario) return;

        // Initialize data collection
        this.collectedData = { ...scenario.data_collection };
        this.collectedData.timestamp = new Date().toISOString();

        // Start with first step
        this.currentStep = 0;
        await this.executeStep();
    }

    async executeStep() {
        if (!this.callScenarios || !this.currentScenario) return;

        const scenario = this.callScenarios[this.currentScenario];
        const step = scenario.flow.find(s => s.step === this.currentStep + 1);

        if (!step) {
            console.error('Step not found:', this.currentStep + 1);
            return;
        }

        console.log('Executing step:', step.step, step.type);

        // Get the agent's message
        let agentMessage = step.agent_says;

        // Replace placeholders (e.g., [ADDRESS])
        if (this.currentScenario === 'outbound_satisfaction') {
            const demoAddresses = this.callScenarios.demo_addresses;
            if (demoAddresses && demoAddresses.length > 0) {
                const randomAddress = demoAddresses[Math.floor(Math.random() * demoAddresses.length)];
                agentMessage = agentMessage.replace('[ADDRESS]', randomAddress.address);
            }
        }

        // Display and speak the message
        this.addMessage(agentMessage, 'agent');
        await this.speakWithOpenAI(agentMessage, true);

        // If this step ends the call, finish
        if (step.end_call) {
            console.log('Call ended. Collected data:', this.collectedData);
            if (step.send_webhook) {
                await this.sendWebhook();
            }
            setTimeout(() => this.returnToScenarioSelection(), 3000);
            return;
        }

        // If we should wait for response, prepare to listen
        if (step.wait_for_response !== false) {
            // Wait a bit then start listening
            setTimeout(() => {
                this.startListening();
            }, 1500);
        } else {
            // Move to next step immediately
            this.currentStep++;
            setTimeout(() => this.executeStep(), 1000);
        }
    }

    async sendWebhook() {
        console.log('Sending webhook with data:', this.collectedData);
        // TODO: Implement actual webhook integration
        // For now, just log the data
        alert('נתונים נאספו בהצלחה:\n' + JSON.stringify(this.collectedData, null, 2));
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

👤 פרופילי מטופלים לדוגמה (למטרות הדגמה):
${kb.patient_profiles.demo_patients.map(p => `
מטופל: ${p.name} (ת.ז. חבר: ${p.member_id})
גיל: ${p.age}
כתובת: ${p.address}
מצבים רפואיים: ${p.conditions.join(', ')}
תרופות: ${p.medications.map(m => `${m.name} - ${m.dosage} ${m.times}`).join(', ')}
תורים קרובים: ${p.appointments.map(a => `${a.type} עם ${a.doctor || a.therapist || a.nurse} ב-${a.date} בשעה ${a.time} - ${a.purpose}`).join('; ')}
ציוד: ${p.equipment.join(', ')}
${p.caregiver ? `מטפל/ת: ${p.caregiver.name}, ${p.caregiver.schedule}` : ''}
הערות: ${p.special_notes}`).join('\n\n')}

🤖 יכולות עוזר אישי:
${kb.patient_profiles.personal_assistant_capabilities.map(c => `- ${c}`).join('\n')}

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

🔑 זיהוי מטופלים - חשוב מאוד:
10. כשמישהו מזדהה בשמו (למשל "שלום, אני דוד כהן" או "זה משה לוי"), זכור את השם ושמור אותו לכל השיחה
11. אם מישהו אומר "אני" או "שלי" בשאלות אישיות, בדוק בהיסטוריית השיחה אם הוא כבר אמר את שמו
12. אם השם מופיע בהיסטוריית השיחה, השתמש בפרופיל המתאים מיד
13. רק אם אין שם בהיסטוריה ומישהו שואל שאלה אישית, בקש ממנו להזדהות בצורה טבעית: "אפשר לדעת איך קוראים לך?"
14. ברגע שהמטופל אמר את שמו, זכור אותו לכל השיחה ואל תשאל שוב
15. השתמש במידע מפרופיל המטופל המתאים לכל שאלה אישית

דוגמאות לשאלות אישיות:
- "שלום, אני דוד כהן. מתי התור הבא שלי?" → זהה כדוד כהן ותן מידע על התורים שלו
- משתמש: "היי זה משה" → זכור שזה משה לוי
- משתמש: "מתי התור שלי?" → אם כבר יודע שזה משה לוי, תן את המידע. אם לא, שאל בנימוס "איך קוראים לך?"
- "אני שרה, אילו תרופות אני לוקחת?" → זהה כשרה אברהם ותן רשימת תרופות
- במשפט שני: "ומתי התור הבא?" → תשתמש בפרופיל שרה שכבר זיהית

זכור: אתה מייצג חברה רפואית מכובדת עם ${kb.company.experience} ניסיון. הקפד על מקצועיות, דיוק ואמפתיה בכל תשובה. השתמש בהיסטוריית השיחה כדי לזכור מי המטופל.`;
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

        // Check if we're in a structured call scenario
        if (this.currentScenario && this.currentScenario !== 'assistant') {
            await this.handleStructuredResponse(transcript);
        } else {
            // Free-form assistant mode
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
    }

    async handleStructuredResponse(userResponse) {
        if (!this.callScenarios || !this.currentScenario) return;

        const scenario = this.callScenarios[this.currentScenario];
        const currentStepData = scenario.flow.find(s => s.step === this.currentStep + 1);

        if (!currentStepData) return;

        // Store the response based on question type
        if (currentStepData.type === 'question') {
            const questionId = currentStepData.question_id;

            // Validate and store the response
            if (currentStepData.validation === 'yes_no') {
                // Check for yes/no response
                const isYes = /כן|נכון|בסדר|מרוצה/i.test(userResponse);
                const isNo = /לא|לא נכון|לא מרוצה/i.test(userResponse);

                if (questionId === 'satisfaction') {
                    this.collectedData.satisfaction = userResponse;
                } else if (questionId === 'address_verification') {
                    this.collectedData.address_confirmed = isYes;

                    // Determine next step based on yes/no
                    if (isYes && currentStepData.next_step_if_yes) {
                        this.currentStep = currentStepData.next_step_if_yes - 1;
                        await this.executeStep();
                        return;
                    } else if (isNo && currentStepData.next_step_if_no) {
                        this.currentStep = currentStepData.next_step_if_no - 1;
                        await this.executeStep();
                        return;
                    }
                }
            } else if (currentStepData.validation === 'name') {
                this.collectedData.name = userResponse;
            } else if (currentStepData.validation === 'city') {
                this.collectedData.city = userResponse;
            } else if (currentStepData.validation === 'address') {
                this.collectedData.new_address = userResponse;
            } else if (currentStepData.validation === 'free_text') {
                if (questionId === 'inquiry') {
                    this.collectedData.inquiry = userResponse;
                } else {
                    this.collectedData[questionId] = userResponse;
                }
            }
        }

        // Move to next step
        this.currentStep = currentStepData.next_step ? currentStepData.next_step - 1 : this.currentStep + 1;
        await this.executeStep();
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

        console.log('API Key present:', !!AZURE_CONFIG.openai.apiKey);
        console.log('API Key starts with sk-:', AZURE_CONFIG.openai.apiKey?.startsWith('sk-'));

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
            console.log('Calling OpenAI API...');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AZURE_CONFIG.openai.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI API error response:', errorText);
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Response received successfully');
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
            console.error('Error details:', error.message);
            throw error;
        }
    }

    async speakWithOpenAI(text, skipAddMessage = false) {
        this.isSpeaking = true;
        this.voiceIndicator.classList.add('speaking');
        this.statusText.textContent = 'משיב...';

        // Display agent message (only for assistant mode)
        if (!skipAddMessage) {
            this.addMessage(text, 'agent');
        }

        try {
            // Wait for configuration
            await configReady;

            console.log('Calling OpenAI TTS API...');
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

            console.log('TTS Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS API error:', errorText);
                throw new Error(`TTS API request failed: ${response.status}`);
            }

            console.log('TTS audio received, creating audio element...');
            // Get audio data
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Play the audio
            const audio = new Audio(audioUrl);

            audio.onended = () => {
                console.log('Audio playback completed');
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

            console.log('Starting audio playback...');
            await audio.play();

        } catch (error) {
            console.error('Error with OpenAI TTS:', error);
            console.error('TTS Error details:', error.message);
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
