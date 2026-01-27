// Core Application Logic for GRABX AI

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const micButton = document.getElementById('micButton');
const voiceStatus = document.getElementById('voiceStatus');
const transcriptionDiv = document.getElementById('transcription');

let isRecording = false;
let recognition;
let audioContext;
let analyzer;
let dataArray;
let source;

// 1. Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; // Changed to false for better network stability
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let interimTranscription = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                userInput.value = transcript.trim();
                console.log("Speech Final:", transcript);
                transcriptionDiv.textContent = transcript;
                if (window.particleSystem) window.particleSystem.setStage('text', transcript);
                setTimeout(stopVoiceMode, 1000);
            } else {
                interimTranscription += transcript;
                transcriptionDiv.textContent = interimTranscription;

                // LIVE MORPH: Update particles in real-time with everything heard
                const statusWords = ["Listening...", "Initializing Voice...", "Initializing...", "STT Network Lag"];
                if (window.particleSystem && interimTranscription.trim().length > 0 && !statusWords.some(s => interimTranscription.includes(s))) {
                    window.particleSystem.setStage('text', interimTranscription.trim());
                }
            }
        }
    };

    recognition.onstart = () => {
        console.log("Voice recognition started");
        recognitionActive = true;
        transcriptionDiv.textContent = "Listening...";
        transcriptionDiv.style.color = "white";
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        if (event.error === 'network') {
            transcriptionDiv.textContent = "Network error. Reconnecting...";
            transcriptionDiv.style.color = "#ffaa00";
        } else if (event.error === 'not-allowed') {
            alert("Microphone blocked. Please check site permissions.");
            stopVoiceMode();
        } else if (event.error === 'no-speech') {
            console.log("No speech detected this cycle.");
        }
    };

    recognition.onend = () => {
        console.log("Recognition cycle ended.");
        recognitionActive = false;

        if (isRecording) {
            // Heartbeat restart with a tiny delay to avoid network spam
            setTimeout(() => {
                if (isRecording && !recognitionActive) {
                    try {
                        recognition.start();
                    } catch (e) { console.warn("Restart failed:", e); }
                }
            }, 300);
        }
    };
}

// 2. Real-Time Audio Analysis (Web Audio API)
async function initAudioAnalysis() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyzer = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyzer);

        analyzer.fftSize = 256;
        const bufferLength = analyzer.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        analyzeAudio();
    } catch (err) {
        console.error('Mic Access Denied:', err);
        alert('Please allow microphone access for voice features.');
    }
}

function analyzeAudio() {
    if (!isRecording) return;

    requestAnimationFrame(analyzeAudio);
    analyzer.getByteFrequencyData(dataArray);

    // Calculate Volume (RMS)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const averageVolume = sum / dataArray.length;
    const normalizedVolume = Math.min(1.0, (averageVolume / 40)); // Increased sensitivity factor

    // Update Particle System
    if (window.particleSystem) {
        window.particleSystem.updateAudioData(normalizedVolume, dataArray[10] / 255);
    }
}

// 3. UI Interactions
function addMessage(content, role) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // Check if content has code blocks
    if (content.includes('```')) {
        const parts = content.split('```');
        msgDiv.innerHTML = parts.map((part, index) => {
            if (index % 2 === 1) {
                const codeLines = part.split('\n');
                const lang = codeLines[0].trim();
                const code = codeLines.slice(1).join('\n');
                return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
            }
            return escapeHtml(part).replace(/\n/g, '<br>');
        }).join('');
    } else {
        msgDiv.textContent = content;
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (role === 'ai') {
        speak(content.replace(/```[\s\S]*?```/g, 'Code block omitted from speech.'));
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    userInput.value = '';

    // Fallback: Morph particles even for typed text for the "Wow" factor
    if (window.particleSystem && !isRecording) {
        // Shift particle colors to a premium purple-blue for typed messages
        this.originalColor = '#b4f0ff';
        window.particleSystem.particles.forEach(p => p.color = '#c084fc');

        window.particleSystem.setStage('text', text);

        // Calculate duration based on text length
        const duration = Math.max(4000, text.length * 100);

        setTimeout(() => {
            if (!isRecording) {
                window.particleSystem.setStage('sphere');
                // Reset colors back to original GRABX palette
                window.particleSystem.particles.forEach(p => p.color = p.initialColor);
            }
        }, duration);
    }

    // Call RushiAiAgent Backend (Assuming it's running on port 5001)
    try {
        const response = await fetch('http://localhost:5001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiFullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    if (data.type === 'result') {
                        aiFullResponse += data.message;
                    }
                }
            });
        }

        if (aiFullResponse) {
            addMessage(aiFullResponse, 'ai');
        } else {
            addMessage("I'm sorry, I couldn't process that.", 'ai');
        }

    } catch (err) {
        console.error('Chat Error:', err);
        addMessage('Error connecting to backend AI.', 'ai');
    }
}

// 4. Voice Mode Control
let recognitionActive = false;

function startVoiceMode() {
    if (recognitionActive) return;

    console.log("Starting voice mode...");
    isRecording = true;
    recognitionActive = true;
    micButton.classList.add('recording');
    voiceStatus.classList.add('active');
    transcriptionDiv.textContent = 'Initializing Voice...';
    transcriptionDiv.style.color = "white";
    userInput.value = '';

    // If network fails, allow clicking the bubble to simulate voice for testing visuals
    transcriptionDiv.onclick = () => {
        if (transcriptionDiv.textContent.includes("Network")) {
            console.log("Simulating voice for visual testing...");
            userInput.value = "Hello GRABX";
            stopVoiceMode();
        }
    };

    if (window.particleSystem) window.particleSystem.setStage('sphere');

    initAudioAnalysis();

    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.warn("Recognition start skipped:", e);
        }
    }
}

function stopVoiceMode() {
    if (!isRecording) return;

    console.log("Stopping voice mode...");
    isRecording = false;
    recognitionActive = false;
    micButton.classList.remove('recording');
    voiceStatus.classList.remove('active');

    // Get the most complete text available
    let spokenText = userInput.value || transcriptionDiv.textContent || "";

    // CRITICAL: If the text is just an error message, don't morph or send it
    const statusMessages = ["Network Error", "STT Network Lag", "Listening...", "Initializing Voice...", "Initializing..."];
    if (statusMessages.some(msg => spokenText.includes(msg))) {
        console.log("Ignoring non-speech text for morphing.");
        spokenText = userInput.value || ""; // Only use definite input value
    }

    console.log("Processing text for morphing:", spokenText);

    // Transition to text morphing if we have spoken text
    if (spokenText.trim() && window.particleSystem) {
        // Pass the FULL text, the particle system sequencer will now handle paging
        window.particleSystem.setStage('text', spokenText.trim());

        setTimeout(() => {
            if (!isRecording) window.particleSystem.setStage('sphere');
        }, 8000); // Longer timeout because sequencer needs time to flip pages
    } else if (window.particleSystem) {
        window.particleSystem.setStage('sphere');
    }

    if (recognition) {
        try {
            recognition.stop();
        } catch (e) { }
        recognition.onend = null;
    }

    if (audioContext) {
        const ctx = audioContext;
        setTimeout(() => { try { ctx.close(); } catch (e) { } }, 500);
        audioContext = null;
    }

    if (spokenText.trim()) {
        userInput.value = spokenText;
        sendMessage();
    }
}

// 5. UI Toggles
const chatWrapper = document.getElementById('chatWrapper');
const toggleChat = document.getElementById('toggleChat');

toggleChat.addEventListener('click', (e) => {
    e.stopPropagation();
    chatWrapper.classList.toggle('minimized');
    toggleChat.textContent = chatWrapper.classList.contains('minimized') ? '+' : '−';
});

document.getElementById('chatHeader').addEventListener('click', () => {
    chatWrapper.classList.toggle('minimized');
    toggleChat.textContent = chatWrapper.classList.contains('minimized') ? '+' : '−';
});

// 6. Text-to-Speech
let voices = [];
function loadVoices() {
    voices = window.speechSynthesis.getVoices();
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
    if (!text) return;
    window.speechSynthesis.cancel();

    // Fallback: If voices not loaded yet, try loading again
    if (voices.length === 0) loadVoices();

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find a premium robotic/deep male voice
    const preferredVoice = voices.find(v =>
        v.name.includes('Google US English Male') ||
        v.name.includes('Daniel') ||
        v.name.includes('Guy') ||
        v.name.includes('Microsoft David')
    );

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1.0;
    utterance.pitch = 0.8; // Deep, synthetic feel
    utterance.volume = 1.0;

    // Trigger "AI Morphing" - Neon Green shift
    if (window.particleSystem) {
        window.particleSystem.particles.forEach(p => p.color = '#39ff14'); // Neon Green

        // Pass FULL text to use the new sequencer
        window.particleSystem.setStage('text', text);

        utterance.onend = () => {
            if (!isRecording) {
                setTimeout(() => {
                    window.particleSystem.setStage('sphere');
                    window.particleSystem.particles.forEach(p => p.color = p.initialColor); // Reset to theme
                }, 6000); // Increased to 6s dwell time as requested
            }
        };
    }

    window.speechSynthesis.speak(utterance);
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

micButton.addEventListener('click', () => {
    if (isRecording) {
        stopVoiceMode();
    } else {
        startVoiceMode();
    }
});
