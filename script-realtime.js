// Natali Voice Agent - OpenAI Realtime API with Natural Voice
class NataliRealtimeAgent {
    constructor() {
        this.isConnected = false;
        this.isSpeaking = false;
        this.ws = null;
        this.audioContext = null;
        this.audioQueue = [];
        this.isPlaying = false;
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

        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Event listeners
        this.voiceButton.addEventListener('click', () => this.startConversation());
        this.stopButton.addEventListener('click', () => this.stopConversation());

        console.log('Natali Realtime Agent initialized');
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

    async startConversation() {
        if (this.isConnected) return;

        // Request microphone permission
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.statusText.textContent = 'יש לאפשר גישה למיקרופון';
            return;
        }

        // Wait for configuration to load
        await configReady;

        // Check if we have OpenAI API key
        if (!AZURE_CONFIG.openai.apiKey) {
            this.statusText.textContent = 'שגיאה: חסר מפתח API';
            return;
        }

        this.statusText.textContent = 'מתחבר...';

        try {
            // Get ephemeral token from OpenAI
            const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AZURE_CONFIG.openai.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-realtime-preview-2024-12-17',
                    voice: 'verse' // Natural, expressive voice
                })
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to get session token');
            }

            const tokenData = await tokenResponse.json();
            const ephemeralKey = tokenData.client_secret.value;

            // Connect to Realtime API via WebSocket
            this.ws = new WebSocket(
                'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
                ['realtime', `openai-insecure-api-key.${ephemeralKey}`, 'openai-beta.realtime-v1']
            );

            this.ws.onopen = () => this.onConnectionOpen();
            this.ws.onmessage = (event) => this.onMessage(event);
            this.ws.onerror = (error) => this.onError(error);
            this.ws.onclose = () => this.onConnectionClose();

        } catch (error) {
            console.error('Failed to connect:', error);
            this.statusText.textContent = 'שגיאה בהתחברות';
            this.stopConversation();
        }
    }

    onConnectionOpen() {
        console.log('Connected to OpenAI Realtime API');
        this.isConnected = true;

        // Update UI
        this.voiceButton.style.display = 'none';
        this.stopButton.style.display = 'block';
        this.voiceIndicator.classList.add('listening');
        this.statusText.textContent = 'מקשיב... דברו בבקשה';

        // Configure session with Hebrew support and knowledge base
        this.ws.send(JSON.stringify({
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: this.generateSystemPrompt(),
                voice: 'verse',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                },
                temperature: 0.7,
                max_response_output_tokens: 150
            }
        }));

        // Start capturing audio
        this.startAudioCapture();
    }

    async startAudioCapture() {
        const audioContext = new AudioContext({ sampleRate: 24000 });
        const source = audioContext.createMediaStreamSource(this.mediaStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!this.isConnected) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);

            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send audio to Realtime API
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
                this.ws.send(JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: base64Audio
                }));
            }
        };

        this.audioProcessor = processor;
        this.audioSource = source;
    }

    onMessage(event) {
        const message = JSON.parse(event.data);

        console.log('Received:', message.type);

        switch (message.type) {
            case 'conversation.item.input_audio_transcription.completed':
                // User speech transcribed
                const userText = message.transcript;
                console.log('User said:', userText);
                this.addMessage(userText, 'user');
                break;

            case 'response.audio.delta':
                // Receive audio chunks from assistant
                this.playAudioChunk(message.delta);
                if (!this.isSpeaking) {
                    this.isSpeaking = true;
                    this.voiceIndicator.classList.remove('listening');
                    this.voiceIndicator.classList.add('speaking');
                    this.statusText.textContent = 'משיב...';
                }
                break;

            case 'response.audio_transcript.delta':
                // Assistant's response text (for display)
                console.log('Assistant:', message.delta);
                break;

            case 'response.done':
                // Response completed
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.voiceIndicator.classList.add('listening');
                this.statusText.textContent = 'מקשיב... דברו בבקשה';

                // Display assistant message
                if (message.response.output && message.response.output.length > 0) {
                    const output = message.response.output[0];
                    if (output.content && output.content.length > 0) {
                        const text = output.content
                            .filter(c => c.type === 'text')
                            .map(c => c.text)
                            .join('');
                        if (text) {
                            this.addMessage(text, 'agent');
                        }
                    }
                }
                break;

            case 'error':
                console.error('API Error:', message.error);
                this.statusText.textContent = 'שגיאה בתקשורת';
                break;
        }
    }

    playAudioChunk(base64Audio) {
        // Decode base64 audio
        const audioData = this.base64ToArrayBuffer(base64Audio);
        const int16Array = new Int16Array(audioData);

        // Convert to Float32Array
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        // Queue audio for playback
        this.audioQueue.push(audioBuffer);

        if (!this.isPlaying) {
            this.playNextAudio();
        }
    }

    playNextAudio() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const audioBuffer = this.audioQueue.shift();

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        source.onended = () => {
            this.playNextAudio();
        };

        source.start();
    }

    onError(error) {
        console.error('WebSocket error:', error);
        this.statusText.textContent = 'שגיאה בחיבור';
        this.stopConversation();
    }

    onConnectionClose() {
        console.log('Disconnected from Realtime API');
        this.isConnected = false;
        this.isSpeaking = false;
        this.resetUI();
    }

    stopConversation() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }

        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        this.audioQueue = [];
        this.isPlaying = false;
        this.isConnected = false;
        this.isSpeaking = false;

        this.resetUI();
    }

    resetUI() {
        this.voiceIndicator.classList.remove('listening', 'speaking');
        this.voiceButton.style.display = 'block';
        this.stopButton.style.display = 'none';

        const hasConversation = this.conversation.children.length > 0;
        this.statusText.textContent = hasConversation ? 'לחצו על המיקרופון כדי להמשיך' : 'לחצו על המיקרופון כדי להתחיל';

        const buttonText = this.voiceButton.querySelector('.button-text');
        buttonText.textContent = hasConversation ? 'המשך שיחה' : 'התחל שיחה';
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

    // Utility functions
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Initialize the voice agent when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const agent = new NataliRealtimeAgent();
});
