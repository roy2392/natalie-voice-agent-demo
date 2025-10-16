// Natali Voice Agent - Azure AI Powered
class NataliVoiceAgent {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        this.recognition = null;
        this.conversationHistory = [];

        // Initialize elements
        this.voiceButton = document.getElementById('voiceButton');
        this.stopButton = document.getElementById('stopButton');
        this.statusText = document.getElementById('statusText');
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.conversation = document.getElementById('conversation');

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

        // Initialize Azure Speech Service
        this.initAzureSpeech();
    }

    initAzureSpeech() {
        // Disable Azure Speech and use browser TTS for better voice quality
        // Azure Speech SDK will be loaded from CDN in HTML, but we're not using it
        console.log('Using browser TTS for natural Hebrew voice');
        this.speechSynthesizer = null;
    }

    startListening() {
        if (this.isListening || this.isSpeaking || this.isProcessing) return;

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
        // Stop Azure speech synthesis
        if (this.speechSynthesizer) {
            this.speechSynthesizer.close();
            this.initAzureSpeech(); // Reinitialize for next use
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
        if (!this.isSpeaking && !this.isProcessing) {
            this.statusText.textContent = 'לחצו על המיקרופון כדי להתחיל';
        }
    }

    async onResult(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Recognized:', transcript);

        // Display user message
        this.addMessage(transcript, 'user');

        // Process with Azure OpenAI
        this.isProcessing = true;
        this.statusText.textContent = 'חושב...';

        try {
            const response = await this.generateAIResponse(transcript);
            await this.speak(response);
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

        // Prepare the API request
        const url = `${AZURE_CONFIG.openai.endpoint}/openai/deployments/${AZURE_CONFIG.openai.deploymentName}/chat/completions?api-version=${AZURE_CONFIG.openai.apiVersion}`;

        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: NATALI_SYSTEM_PROMPT
                },
                ...this.conversationHistory
            ],
            max_tokens: 150,
            temperature: 0.7,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': AZURE_CONFIG.openai.apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Azure OpenAI API error:', errorText);
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
            console.error('Error calling Azure OpenAI:', error);
            throw error;
        }
    }

    async speak(text) {
        this.isSpeaking = true;
        this.voiceIndicator.classList.add('speaking');
        this.statusText.textContent = 'משיב...';

        // Display agent message
        this.addMessage(text, 'agent');

        // Use Azure Speech Service if available, otherwise fall back to browser TTS
        if (this.speechSynthesizer) {
            await this.speakWithAzure(text);
        } else {
            await this.speakWithBrowser(text);
        }
    }

    speakWithAzure(text) {
        return new Promise((resolve, reject) => {
            // Use SSML for better control
            const ssml = `
                <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">
                    <voice name="${AZURE_CONFIG.speech.voiceName}">
                        <prosody rate="0.95" pitch="+5%">
                            ${this.escapeXml(text)}
                        </prosody>
                    </voice>
                </speak>
            `;

            this.speechSynthesizer.speakSsmlAsync(
                ssml,
                (result) => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        console.log('Azure TTS completed successfully');
                    } else {
                        console.error('Azure TTS error:', result.errorDetails);
                    }
                    this.isSpeaking = false;
                    this.voiceIndicator.classList.remove('speaking');
                    this.statusText.textContent = 'לחצו על המיקרופון כדי להמשיך';
                    this.resetUI();
                    resolve();
                },
                (error) => {
                    console.error('Azure TTS error:', error);
                    this.isSpeaking = false;
                    this.voiceIndicator.classList.remove('speaking');
                    this.resetUI();
                    reject(error);
                }
            );
        });
    }

    speakWithBrowser(text) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'he-IL';
            utterance.rate = 0.95;
            utterance.pitch = 1.05;
            utterance.volume = 1.0;

            // Try to find Hebrew voice
            const voices = window.speechSynthesis.getVoices();
            const hebrewVoice = voices.find(voice => voice.lang.startsWith('he'));
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
                console.error('Browser TTS error:', event);
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.resetUI();
                resolve();
            };

            window.speechSynthesis.cancel();
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 50);
        });
    }

    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
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
