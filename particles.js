const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const hCtx = hiddenCanvas.getContext('2d');

class Particle {
    constructor(x, y, z, isAmbient = false) {
        this.baseX = x;
        this.baseY = y;
        this.baseZ = z;

        this.x = x;
        this.y = y;
        this.z = z;

        this.targetX = x;
        this.targetY = y;
        this.targetZ = z;

        this.isAmbient = isAmbient;
        this.size = isAmbient ? Math.random() * 1.5 : Math.random() * 1.5 + 0.5;

        // GRABX Palette: White, Blue, Navy
        const colors = ['#ffffff', '#00d4ff', '#1e3a8a', '#3b82f6'];
        this.initialColor = colors[Math.floor(Math.random() * colors.length)];
        this.color = this.initialColor;
        this.opacity = isAmbient ? Math.random() * 0.3 + 0.1 : Math.random() * 0.5 + 0.3;

        this.vx = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);
        this.vy = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);
        this.vz = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);

        this.friction = 0.95;
        this.ease = 0.1;
    }

    update(volume, frequency, relMouseX, relMouseY, stage) {
        if (this.isAmbient) {
            this.x += this.vx;
            this.y += this.vy;
            this.z += this.vz;

            const rangeX = canvas.width / 2 + 200;
            const rangeY = canvas.height / 2 + 200;
            if (Math.abs(this.x) > rangeX) this.x *= -0.95;
            if (Math.abs(this.y) > rangeY) this.y *= -0.95;
            return;
        }

        // 1. MOVEMENT LOGIC
        if (stage === 'text') {
            // Direct easing for perfect text formation (snappy)
            this.x += (this.targetX - this.x) * (this.ease * 1.5);
            this.y += (this.targetY - this.y) * (this.ease * 1.5);
            this.z += (this.targetZ - this.z) * (this.ease * 1.5);
            this.vx *= 0.8;
            this.vy *= 0.8;
            this.vz *= 0.8;
        } else {
            // Physics-based for organic sphere/idle
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dz = this.targetZ - this.z;
            const pull = 0.05;
            this.vx += dx * pull;
            this.vy += dy * pull;
            this.vz += dz * pull;
        }

        // 2. MOUSE INTERACTION: Stronger but smoother repulsion
        if (relMouseX !== null && relMouseY !== null) {
            const mdx = this.x - relMouseX;
            const mdy = this.y - relMouseY;
            const dist = Math.sqrt(mdx * mdx + mdy * mdy);
            const forceRange = 150;

            if (dist < forceRange) {
                const force = (forceRange - dist) / forceRange;
                this.vx += (mdx / dist) * force * 4;
                this.vy += (mdy / dist) * force * 4;
            }
        }

        // 3. AUDIO REACTIVITY: Subtle jitter
        if (volume > 0.05) {
            const buzz = volume * 2;
            this.vx += (Math.random() - 0.5) * buzz;
            this.vy += (Math.random() - 0.5) * buzz;
            this.vz += (Math.random() - 0.5) * buzz;
        }

        // 4. INTEGRATION: Apply movement and friction
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;

        this.vx *= 0.85; // High friction for clean stops
        this.vy *= 0.85;
        this.vz *= 0.85;
    }

    draw(ctx, centerX, centerY, stage) {
        // Simple 3D projection
        const perspective = 600;
        const scale = perspective / (perspective + this.z);
        const x2d = this.x * scale + centerX;
        const y2d = this.y * scale + centerY;

        const finalSize = this.size * scale * (stage === 'text' ? 1.5 : 1);
        const finalOpacity = Math.min(1, this.opacity * scale * (stage === 'text' ? 2 : 1));

        if (finalSize < 0.1) return;

        ctx.fillStyle = this.color;
        ctx.globalAlpha = finalOpacity;
        ctx.beginPath();
        ctx.arc(x2d, y2d, finalSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.numParticles = 5000; // Increased for better text readability
        this.currentStage = 'sphere';
        this.audioData = { volume: 0, frequency: 0 };
        this.mouse = { x: null, y: null };
        this.resize();
        this.init();

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX - this.centerX;
            this.mouse.y = e.clientY - this.centerY;
        });
        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        hiddenCanvas.width = window.innerWidth;
        hiddenCanvas.height = window.innerHeight;
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height / 2;
    }

    init() {
        this.particles = [];
        this.ambientParticles = [];
        this.coreParticles = [];

        // Core morphing particles
        for (let i = 0; i < this.numParticles; i++) {
            const phi = Math.acos(-1 + (2 * i) / this.numParticles);
            const theta = Math.sqrt(this.numParticles * Math.PI) * phi;
            const radius = 200;

            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);

            const p = new Particle(x, y, z, false);
            this.particles.push(p);
            this.coreParticles.push(p);
        }

        // Extra spill/ambient particles (background)
        const numAmbient = 1000;
        for (let i = 0; i < numAmbient; i++) {
            const x = (Math.random() - 0.5) * canvas.width;
            const y = (Math.random() - 0.5) * canvas.height;
            const z = (Math.random() - 0.5) * 400;
            const p = new Particle(x, y, z, true);
            this.particles.push(p);
            this.ambientParticles.push(p);
        }
    }

    setStage(stage, text = '') {
        this.currentStage = stage;
        if (stage !== 'text') this.lastText = null;

        const coreParticles = this.particles.filter(p => !p.isAmbient);

        if (stage === 'sphere') {
            const radius = 200;
            coreParticles.forEach((p, i) => {
                const phi = Math.acos(-1 + (2 * i) / coreParticles.length);
                const theta = Math.sqrt(coreParticles.length * Math.PI) * phi;
                p.targetX = radius * Math.cos(theta) * Math.sin(phi);
                p.targetY = radius * Math.sin(theta) * Math.sin(phi);
                p.targetZ = radius * Math.cos(phi);
                p.ease = 0.05 + Math.random() * 0.05;
            });
        } else if (stage === 'text' && text) {
            // IGNORE status strings
            const blackList = ["Task completed", "Processing", "Thinking"];
            if (blackList.some(b => text.includes(b))) {
                this.setStage('sphere');
                return;
            }

            this.lastText = null; // Reset cache to force render
            const isLive = text.endsWith('...');
            this.morphToText(text, isLive);
        } else if (stage === 'idle') {
            coreParticles.forEach(p => {
                p.targetX = (Math.random() - 0.5) * canvas.width;
                p.targetY = (Math.random() - 0.5) * canvas.height;
                p.targetZ = (Math.random() - 0.5) * 500;
                p.ease = 0.02;
            });
        }
    }

    morphToText(text, isLive = false) {
        if (!text) return;

        if (this.textSequenceInterval) {
            clearInterval(this.textSequenceInterval);
            this.textSequenceInterval = null;
        }

        // Live transcription stays un-chunked for speed
        if (isLive) {
            this.renderMorph(text);
            return;
        }

        this.sequenceText(text);
    }

    sequenceText(text) {
        hCtx.font = `bold ${Math.floor(canvas.width / 12)}px Outfit, Arial, sans-serif`;
        const words = text.split(' ');
        const chunks = [];
        let currentLine = words[0];

        // Group words into single lines based on width
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = hCtx.measureText(currentLine + " " + word).width;
            if (width < canvas.width * 0.9) {
                currentLine += " " + word;
            } else {
                chunks.push(currentLine);
                currentLine = word;
            }
        }
        chunks.push(currentLine);

        let currentChunkIndex = 0;
        const displayChunk = () => {
            if (this.currentStage !== 'text') {
                if (this.textSequenceInterval) {
                    clearInterval(this.textSequenceInterval);
                    this.textSequenceInterval = null;
                }
                return;
            }

            this.renderMorph(chunks[currentChunkIndex]);

            currentChunkIndex++;
            if (currentChunkIndex >= chunks.length) {
                // Sequence finished - let it linger then go back to sphere
                if (this.textSequenceInterval) {
                    clearInterval(this.textSequenceInterval);
                    this.textSequenceInterval = null;
                }
                setTimeout(() => {
                    if (this.currentStage === 'text') this.setStage('sphere');
                }, 6000);
            }
        };

        displayChunk();
        if (chunks.length > 1) {
            this.textSequenceInterval = setInterval(displayChunk, 3000);
        }
    }

    renderMorph(text) {
        if (text === this.lastText) return;
        this.lastText = text;

        hCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        hCtx.fillStyle = 'white';
        hCtx.textAlign = 'center';
        hCtx.textBaseline = 'middle';

        // Cinematic Font Size - Scaled to screen
        let fontSize = Math.floor(canvas.width / 12);
        if (fontSize > 180) fontSize = 180; // Massive text
        if (fontSize < 30) fontSize = 30;

        hCtx.font = `bold ${fontSize}px Outfit, Arial, sans-serif`;

        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        // Use 95% of screen width
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = hCtx.measureText(currentLine + " " + word).width;
            if (width < canvas.width * 0.95) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        let startY = this.centerY - (totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
            hCtx.fillText(line, this.centerX, startY + (i * lineHeight));
        });

        const imageData = hCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;
        const textPixels = [];
        const step = text.length < 10 ? 1 : 2; // Finer sampling for short words like "hloo"

        for (let y = 0; y < hiddenCanvas.height; y += step) {
            for (let x = 0; x < hiddenCanvas.width; x += step) {
                const index = (y * hiddenCanvas.width + x) * 4;
                if (imageData[index + 3] > 10) { // Extremely sensitive for reliability
                    textPixels.push({ x: x - this.centerX, y: y - this.centerY });
                }
            }
        }

        // Emergency padding: if word is too small, add slight random scatter to visible pixels
        if (textPixels.length > 0 && textPixels.length < 500) {
            const originalCount = textPixels.length;
            for (let i = 0; i < 1000 - originalCount; i++) {
                const base = textPixels[i % originalCount];
                textPixels.push({
                    x: base.x + (Math.random() - 0.5) * 10,
                    y: base.y + (Math.random() - 0.5) * 10
                });
            }
        }

        if (textPixels.length === 0) {
            console.warn("No pixels found for text:", text);
            return;
        }

        // Fix Vertical Trimming: Shuffle or uniformly sample pixels
        // This ensures particles cover the WHOLE word, not just the top half
        const shuffleArray = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        };
        shuffleArray(textPixels);

        const coreParticles = this.particles.filter(p => !p.isAmbient);

        // Use about 80% of particles for the text to keep it DENSE like the Venom demo
        const textTargetCount = Math.floor(coreParticles.length * 0.85);

        coreParticles.forEach((p, i) => {
            if (i < textTargetCount) {
                // Map to a random pixel from the shuffled set (repeating if needed for density)
                const px = textPixels[i % textPixels.length];
                p.targetX = px.x + (Math.random() - 0.5) * 3;
                p.targetY = px.y + (Math.random() - 0.5) * 3;
                p.targetZ = (Math.random() - 0.5) * 10;
                p.ease = 0.08 + Math.random() * 0.05;
            } else {
                // PARTICLE IS SCATTERED (HALO EFFECT) - More cinematic scatter
                const angle1 = Math.random() * Math.PI * 2;
                const angle2 = Math.random() * Math.PI * 2;
                const dist = 250 + Math.random() * 350;

                p.targetX = Math.cos(angle1) * Math.sin(angle2) * dist;
                p.targetY = Math.sin(angle1) * Math.sin(angle2) * dist;
                p.targetZ = Math.cos(angle2) * dist - 200; // Push some back for depth
                p.ease = 0.01 + Math.random() * 0.02;
            }
        });
    }

    updateAudioData(volume, frequency) {
        this.audioData.volume = volume;
        this.audioData.frequency = frequency;
    }

    animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dynamic, mouse-influenced rotation for sphere mode
        if (this.currentStage === 'sphere') {
            const time = Date.now() * 0.001;

            // Influence rotation speed and direction by mouse position
            let rotX = 0.005;
            let rotY = 0.005;

            if (this.mouse.x !== null && this.mouse.y !== null) {
                rotY = (this.mouse.x / canvas.width) * 0.05;
                rotX = (this.mouse.y / canvas.height) * 0.05;
            } else {
                // Natural drift
                rotY = Math.sin(time * 0.5) * 0.01;
                rotX = Math.cos(time * 0.3) * 0.01;
            }

            const cosX = Math.cos(rotX);
            const sinX = Math.sin(rotX);
            const cosY = Math.cos(rotY);
            const sinY = Math.sin(rotY);

            const radius = 200 + this.audioData.volume * 200;

            this.coreParticles.forEach(p => {
                // Multi-axis rotation
                // Rotate around Y
                let x = p.targetX;
                let z = p.targetZ;
                p.targetX = x * cosY - z * sinY;
                p.targetZ = x * sinY + z * cosY;

                // Rotate around X
                let y = p.targetY;
                z = p.targetZ;
                p.targetY = y * cosX - z * sinX;
                p.targetZ = y * sinX + z * cosX;

                // REDUCED SURFACE JITTER
                const jitter = 0.003;
                p.targetX += (Math.random() - 0.5) * radius * jitter;
                p.targetY += (Math.random() - 0.5) * radius * jitter;
                p.targetZ += (Math.random() - 0.5) * radius * jitter;

                // Keep sphere shape
                const mag = Math.sqrt(p.targetX ** 2 + p.targetY ** 2 + p.targetZ ** 2);
                if (mag > 0) {
                    p.targetX = (p.targetX / mag) * radius;
                    p.targetY = (p.targetY / mag) * radius;
                    p.targetZ = (p.targetZ / mag) * radius;
                }
            });
        }

        // High-performance additive glow
        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.update(this.audioData.volume, this.audioData.frequency, this.mouse.x, this.mouse.y, this.currentStage);
            p.draw(ctx, this.centerX, this.centerY, this.currentStage);
        }

        ctx.globalCompositeOperation = 'source-over';

        requestAnimationFrame(() => this.animate());
    }
}

const system = new ParticleSystem();
system.animate();

window.particleSystem = system;
