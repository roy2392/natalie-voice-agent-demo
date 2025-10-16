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

        // Load voices and initialize Azure Speech Service
        this.loadVoices();

        // Initialize Azure Speech Service
        this.initAzureSpeech();
    }

    loadVoices() {
        // Force load voices
        const loadVoicesImpl = () => {
            this.availableVoices = window.speechSynthesis.getVoices();
            if (this.availableVoices.length > 0) {
                console.log('Voices loaded:', this.availableVoices.length);
                console.log('Available Hebrew voices:',
                    this.availableVoices
                        .filter(v => v.lang.startsWith('he'))
                        .map(v => `${v.name} (${v.lang}) - ${v.localService ? 'Local' : 'Remote'}`)
                );
            }
        };

        // Voices might load asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoicesImpl;
        }

        // Also try loading immediately
        loadVoicesImpl();
    }

    initAzureSpeech() {
        // Azure Speech SDK will be loaded from CDN in HTML
        if (typeof SpeechSDK !== 'undefined' && AZURE_CONFIG.speech.apiKey) {
            try {
                const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                    AZURE_CONFIG.speech.apiKey,
                    AZURE_CONFIG.speech.region
                );
                speechConfig.speechSynthesisVoiceName = AZURE_CONFIG.speech.voiceName;
                speechConfig.speechSynthesisLanguage = 'he-IL';

                // Use browser audio output
                const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
                this.speechSynthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

                console.log('Azure Speech Service initialized successfully');
            } catch (error) {
                console.warn('Azure Speech initialization failed, falling back to browser TTS:', error);
                this.speechSynthesizer = null;
            }
        } else {
            console.warn('Azure Speech SDK not loaded or no API key, falling back to browser TTS');
            this.speechSynthesizer = null;
        }
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
            // Check if we're on iOS - if so, use browser TTS instead
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                console.log('iOS detected, using browser TTS instead of Azure Speech');
                this.speakWithBrowser(text).then(resolve).catch(reject);
                return;
            }

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
                    // Fallback to browser TTS on error
                    console.log('Falling back to browser TTS');
                    this.speakWithBrowser(text).then(resolve).catch(reject);
                }
            );
        });
    }

    speakWithBrowser(text) {
        return new Promise((resolve) => {
            // iOS requires speech synthesis to be triggered by user interaction
            // We'll ensure it's called in the right context
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'he-IL';
            utterance.rate = 0.95;
            utterance.pitch = 1.05;
            utterance.volume = 1.0;

            // Use cached voices or get fresh ones
            const voices = this.availableVoices || window.speechSynthesis.getVoices();

            console.log('🔊 Speaking with browser TTS');
            console.log('Total voices available:', voices.length);
            console.log('Hebrew voices:', voices.filter(v => v.lang.startsWith('he')).map(v => v.name));

            // Priority order for Hebrew voices
            const hebrewVoice =
                // Look for Carmit or other named voices (usually higher quality)
                voices.find(v => v.lang.startsWith('he') && v.name.toLowerCase().includes('carmit')) ||
                // Look for premium/enhanced voices
                voices.find(v => v.lang.startsWith('he') && (v.name.includes('Premium') || v.name.includes('Enhanced'))) ||
                // Look for remote/cloud voices (usually better quality)
                voices.find(v => v.lang.startsWith('he') && !v.localService) ||
                // Any Hebrew voice
                voices.find(v => v.lang.startsWith('he'));

            if (hebrewVoice) {
                utterance.voice = hebrewVoice;
                console.log('✅ Selected voice:', hebrewVoice.name, '(' + hebrewVoice.lang + ')', hebrewVoice.localService ? 'Local' : 'Remote');
            } else {
                console.warn('⚠️ No Hebrew voice found! Using default.');
            }

            utterance.onstart = () => {
                console.log('🎤 Speech started');
            };

            utterance.onend = () => {
                console.log('✅ Speech completed');
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.statusText.textContent = 'לחצו על המיקרופון כדי להמשיך';
                this.resetUI();
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('❌ Browser TTS error:', event.error);
                this.isSpeaking = false;
                this.voiceIndicator.classList.remove('speaking');
                this.resetUI();
                resolve();
            };

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // iOS Safari sometimes needs a small delay
            setTimeout(() => {
                console.log('▶️ Starting speech synthesis...');
                window.speechSynthesis.speak(utterance);
            }, 100);
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
