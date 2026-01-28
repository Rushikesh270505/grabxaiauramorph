
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
    // Fallback: Morph particles even for typed text for the "Wow" factor
    if (window.particleSystem && !isRecording) {
        window.particleSystem.setStage('text', text);
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
        // Pass the FULL text, the particle system sequencer will now handle everything
        window.particleSystem.setStage('text', spokenText.trim());
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
    if (voices.length > 0) {
        console.log(`Loaded ${voices.length} voices.`);
    }
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// Warm up the speech engine (crucial for some browsers/OS)
function warmUpAudio() {
    window.speechSynthesis.cancel();
    const warmUp = new SpeechSynthesisUtterance("");
    warmUp.volume = 0;
    window.speechSynthesis.speak(warmUp);
    console.log("Audio engine warmed up.");
}

function speak(text, isWelcome = false) {
    if (!text) return;

    // Safety check for browser support
    if (!window.speechSynthesis) {
        console.error("Speech Synthesis not supported in this browser.");
        return;
    }

    window.speechSynthesis.cancel();

    if (voices.length === 0) loadVoices();

    const utterance = new SpeechSynthesisUtterance(text);

    // VOICE SELECTION LOGIC
    let selectedVoice = null;

    if (isWelcome) {
        // Targeted Robotic/Male voices
        selectedVoice = voices.find(v =>
            v.name.includes('Google US English Male') ||
            v.name.includes('Microsoft David') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex') || // Common on Mac
            v.name.includes('Male')
        );

        utterance.rate = 0.75; // Even slower for heavy, cinematic sync
        utterance.pitch = 0.85;
    } else {
        selectedVoice = voices.find(v =>
            v.name.includes('Google') ||
            v.name.includes('Female') ||
            v.name.includes('Samantha')
        );
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
    }

    // Default to first available voice if preferred isn't found
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    } else if (voices.length > 0) {
        utterance.voice = voices[0];
    }

    utterance.volume = 1.0;

    // Trigger Particle Morphing if short text AND not in welcome cinematic
    if (window.particleSystem && text.length < 100 && !isWelcome) {
        window.particleSystem.setStage('text', text);
    }

    console.log(`Speaking: "${text.substring(0, 30)}..." using ${utterance.voice ? utterance.voice.name : 'default'}`);
    window.speechSynthesis.speak(utterance);
    return utterance;
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

// Cinematic Welcome Sequence - Robust Sequential Flow
async function startCinematicSequence() {
    console.log("Starting Cinematic Sequence...");
    const overlay = document.getElementById('initOverlay');
    if (overlay) overlay.classList.add('fade-out');

    warmUpAudio();
    loadVoices();

    const welcomeSegments = [
        "Welcome, to the future,",
        "of digital interaction.",
        "Experience, the GRAB X Aura Morph,",
        "where every particle, is ",
        "an extension of your imagination.",
        "Let’s build, something extraordinary, together.",
        "GRAB X Quantum Core, initialized.",
        "Systems are online, and monitoring.",
        "I am your AI assistant,",
        "ready to transform your ideas,",
        "into cinematic reality."
    ];

    if (window.particleSystem) {
        console.log("Setting initial TEXT stage for sequence...");
        window.particleSystem.setStage('text', '');
    }

    for (let i = 0; i < welcomeSegments.length; i++) {
        const segment = welcomeSegments[i];
        console.log(`Processing Segment ${i + 1}/11: ${segment}`);

        if (window.particleSystem) {
            // Render text without commas for cleaner visuals
            window.particleSystem.renderMorph(segment.replace(/,/g, ''));
        }

        // Promise wrapper for reliable sequential speech
        await new Promise((resolve) => {
            const utterance = speak(segment, true);
            if (!utterance) {
                console.warn("Utterance failed to create for segment:", segment);
                resolve();
                return;
            }

            let resolved = false;
            const complete = () => {
                if (!resolved) {
                    resolved = true;
                    // Cinematic "breath" pause (300ms) between sentences
                    setTimeout(resolve, 300);
                }
            };

            utterance.onend = complete;
            utterance.onerror = complete;

            // Failsafe: Wait at most 8s per segment
            setTimeout(complete, 8000);
        });
    }

    console.log("Greeting Sequence Complete. Transitioning back to SPHERE...");
    setTimeout(() => {
        if (window.particleSystem) {
            console.log("FINAL TRANSITION: Stage -> SPHERE");
            if (window.particleSystem.textSequenceInterval) {
                clearInterval(window.particleSystem.textSequenceInterval);
                window.particleSystem.textSequenceInterval = null;
            }
            window.particleSystem.setStage('sphere');
        } else {
            console.error("ERROR: window.particleSystem lost during sequence!");
        }
    }, 2000);
}

// User Initialization Trigger
document.getElementById('initBtn').addEventListener('click', startCinematicSequence);

window.addEventListener('load', () => {
    // Just ensure voices are ready for the button
    loadVoices();
});
