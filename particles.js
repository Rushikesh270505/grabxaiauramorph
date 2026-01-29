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

        this.sphereX = 0;
        this.sphereY = 0;
        this.sphereZ = 0;

        this.isAmbient = isAmbient;
        this.size = 1.2;

        const rand = Math.random();
        if (rand < 0.2) {
            this.initialColor = '#ffffff';
        } else if (rand < 0.5) {
            this.initialColor = '#1e3a8a';
        } else {
            this.initialColor = Math.random() > 0.5 ? '#00d4ff' : '#3b82f6';
        }
        this.color = this.initialColor;
        this.opacity = isAmbient ? Math.random() * 0.3 + 0.1 : Math.random() * 0.5 + 0.3;

        this.vx = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);
        this.vy = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);
        this.vz = (Math.random() - 0.5) * (isAmbient ? 0.5 : 2);

        this.friction = 0.95;
        this.ease = 0.1;

        this.isTemporary = false;
        this.life = 1.0;
    }

    update(volume, frequency, relMouseX, relMouseY, stage, transitionProgress = 0) {
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

        if (stage === 'text') {
            this.x += (this.targetX - this.x) * (this.ease * 1.5);
            this.y += (this.targetY - this.y) * (this.ease * 1.5);
            this.z += (this.targetZ - this.z) * (this.ease * 1.5);
            this.vx *= 0.8;
            this.vy *= 0.8;
            this.vz *= 0.8;
        } else {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dz = this.targetZ - this.z;

            const basePull = (stage === 'sphere') ? 0.08 : 0.05;
            const pull = basePull + (transitionProgress * 0.2);

            this.vx += dx * pull;
            this.vy += dy * pull;
            this.vz += dz * pull;
        }

        if (relMouseX !== null && relMouseY !== null) {
            const mdx = this.x - relMouseX;
            const mdy = this.y - relMouseY;
            const dist = Math.sqrt(mdx * mdx + mdy * mdy);
            const forceRange = 80;
            if (dist < forceRange) {
                const force = (forceRange - dist) / forceRange;
                this.vx += (mdx / dist) * force * 4;
                this.vy += (mdy / dist) * force * 4;
            }
        }

        if (volume > 0.05) {
            const buzz = volume * 2;
            this.vx += (Math.random() - 0.5) * buzz;
            this.vy += (Math.random() - 0.5) * buzz;
            this.vz += (Math.random() - 0.5) * buzz;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;

        const baseFriction = 0.85;
        const friction = baseFriction - (transitionProgress * 0.1);
        this.vx *= friction;
        this.vy *= friction;
        this.vz *= friction;

        if (this.isTemporary) {
            this.life -= 0.015;
        }
    }

    draw(ctx, centerX, centerY, stage) {
        const perspective = 600;
        const scale = perspective / (perspective + this.z);
        const x2d = this.x * scale + centerX;
        const y2d = this.y * scale + centerY;

        const finalSize = this.size * scale;
        const baseOpacity = stage === 'text' ? 0.7 : 1.0;
        const finalOpacity = Math.min(1, this.opacity * scale * baseOpacity);

        if (this.isTemporary && this.life < 0.1) return;

        ctx.fillStyle = this.color;
        ctx.globalAlpha = finalOpacity * (this.isTemporary ? this.life : 1);
        ctx.beginPath();
        ctx.arc(x2d, y2d, finalSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.numParticles = 25000;
        this.currentStage = 'sphere';
        this.audioData = { volume: 0, frequency: 0 };
        this.mouse = { x: null, y: null };
        this.rotationX = 0;
        this.rotationY = 0;
        this.transitionProgress = 0;
        this.analysisCanvas = null;
        this.analysisCtx = null;

        // Initialize everything
        this.resize();
        this.init();
        this.setupListeners();
    }

    setupListeners() {
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
        this.updateAnalysisResolution();
    }

    updateAnalysisResolution() {
        if (!this.analysisCanvas) {
            this.analysisCanvas = document.createElement('canvas');
            this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });
        }
        const scale = 0.2;
        // Ensure strictly integer dimensions
        this.analysisCanvas.width = Math.floor(window.innerWidth * scale);
        this.analysisCanvas.height = Math.floor(window.innerHeight * scale);
    }

    init() {
        this.particles = [];
        this.ambientParticles = [];
        this.coreParticles = [];

        // Create Particles
        for (let i = 0; i < this.numParticles; i++) {
            const phi = Math.acos(-1 + (2 * i) / this.numParticles);
            const theta = Math.sqrt(this.numParticles * Math.PI) * phi;
            const radius = 200;

            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);

            const p = new Particle(x, y, z, false);
            p.sphereX = x;
            p.sphereY = y;
            p.sphereZ = z;
            this.particles.push(p);
            this.coreParticles.push(p);
        }

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

    setStage(stage, text = '', forceLive = false) {
        console.log(`System: Setting Stage to ${stage.toUpperCase()}`);
        this.currentStage = stage;

        if (stage !== 'text') {
            this.lastText = null;
            this.particles = [...this.coreParticles, ...this.ambientParticles];
        }

        if (stage === 'sphere') {
            this.transitionProgress = 1.0;
            const radius = 200;
            this.lastText = null;
            this.coreParticles.forEach((p, i) => {
                const phi = Math.acos(-1 + (2 * i) / this.coreParticles.length);
                const theta = Math.sqrt(this.coreParticles.length * Math.PI) * phi;
                p.sphereX = radius * Math.cos(theta) * Math.sin(phi);
                p.sphereY = radius * Math.sin(theta) * Math.sin(phi);
                p.sphereZ = radius * Math.cos(phi);
                p.targetX = p.sphereX;
                p.targetY = p.sphereY;
                p.targetZ = p.sphereZ;
                p.color = p.initialColor;
            });
        } else if (stage === 'text') {
            this.lastText = null;
            if (text) {
                const isLive = forceLive || text.endsWith('...');
                this.morphToText(text, isLive);
            }
        } else if (stage === 'idle') {
            this.coreParticles.forEach(p => {
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
        if (isLive) {
            this.renderMorph(text, true);
        } else {
            this.sequenceText(text);
        }
    }

    sequenceText(text) {
        // Use hiddenCanvas for correct font metrics (Full Resolution)
        hCtx.font = `bold ${Math.floor(canvas.width / 12)}px Outfit, Arial, sans-serif`;
        const words = text.split(' ');
        const chunks = [];
        let currentChunk = "";
        const maxChunkWidth = canvas.width * 0.8;

        words.forEach(word => {
            const testLine = currentChunk ? currentChunk + " " + word : word;
            const metrics = hCtx.measureText(testLine);
            if (metrics.width < maxChunkWidth) {
                currentChunk = testLine;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = word;
            }
        });
        if (currentChunk) chunks.push(currentChunk);

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
            this.textSequenceInterval = setInterval(displayChunk, 5000);
        }
    }

    renderMorph(text, isLive = false) {
        if (!text) return;

        // HIGH PERFORMANCE THROTTLING (40ms) - Near Instant
        // Prevents browser choke while feeling instant to user.
        const throttleLimit = 40;
        const now = Date.now();

        if (isLive && this.lastRenderTime && (now - this.lastRenderTime < throttleLimit)) {
            if (this.pendingRender) clearTimeout(this.pendingRender);
            this.pendingRender = setTimeout(() => {
                this.renderMorph(text, isLive);
            }, throttleLimit);
            return;
        }

        if (this.pendingRender) clearTimeout(this.pendingRender);
        this.lastRenderTime = now;
        this.lastText = text;

        if (!this.analysisCanvas) this.updateAnalysisResolution();

        const analysisW = this.analysisCanvas.width;
        const analysisH = this.analysisCanvas.height;
        const analysisScale = 0.2;

        const aCtx = this.analysisCtx;

        aCtx.clearRect(0, 0, analysisW, analysisH);
        aCtx.fillStyle = 'white';
        aCtx.textAlign = 'center';
        aCtx.textBaseline = 'middle';

        let fontSize = Math.floor(analysisW / 12);
        if (fontSize < 10) fontSize = 10;
        aCtx.font = `bold ${fontSize}px Outfit, Arial, sans-serif`;

        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = aCtx.measureText(currentLine + " " + word).width;
            if (width < analysisW * 0.95) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const centerY = analysisH / 2;
        const centerX = analysisW / 2;
        let startY = centerY - (totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
            aCtx.fillText(line, centerX, startY + (i * lineHeight));
        });

        const imageData = aCtx.getImageData(0, 0, analysisW, analysisH).data;
        const textPixels = [];
        const step = 1;

        for (let y = 0; y < analysisH; y += step) {
            for (let x = 0; x < analysisW; x += step) {
                const index = (y * analysisW + x) * 4;
                if (imageData[index + 3] > 10) {
                    textPixels.push({
                        relX: (x - centerX) / analysisScale,
                        relY: (y - centerY) / analysisScale
                    });
                }
            }
        }

        if (textPixels.length === 0) return;

        // Shuffle
        for (let i = textPixels.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [textPixels[i], textPixels[j]] = [textPixels[j], textPixels[i]];
        }

        const numCore = this.coreParticles.length;
        const textTargetCount = Math.floor(numCore * 0.9);
        const pixelStep = textPixels.length / textTargetCount;

        this.particles = this.particles.filter(p => !p.isTemporary);

        this.coreParticles.forEach((p, i) => {
            if (i < textTargetCount) {
                const pixelIndex = Math.floor((i * pixelStep) % textPixels.length);
                const px = textPixels[pixelIndex];

                p.targetX = px.relX + (Math.random() - 0.5) * 4;
                p.targetY = px.relY + (Math.random() - 0.5) * 4;
                p.targetZ = 250 + (Math.random() - 0.5) * 20;

                // SUPER FAST EASE (0.50)
                const baseEase = isLive ? 0.50 : 0.12;
                p.ease = baseEase + Math.random() * 0.05;
            } else {
                const angle1 = Math.random() * Math.PI * 2;
                const angle2 = Math.random() * Math.PI * 2;
                const dist = 350 + Math.random() * 200;
                p.targetX = Math.cos(angle1) * Math.sin(angle2) * dist;
                p.targetY = Math.sin(angle1) * Math.sin(angle2) * dist;
                p.targetZ = 300 + Math.cos(angle2) * dist;
                p.ease = 0.02 + Math.random() * 0.04;
            }
        });

        if (textPixels.length > textTargetCount) {
            const overflow = textPixels.length - textTargetCount;
            const maxOverflow = 2500;
            const spawnCount = Math.min(overflow, maxOverflow);

            for (let i = 0; i < spawnCount; i++) {
                const pixelIndex = Math.floor(textTargetCount + i);
                if (pixelIndex >= textPixels.length) break;
                const px = textPixels[pixelIndex];
                const parent = this.coreParticles[i % numCore];
                const tp = new Particle(parent.x, parent.y, parent.z, false);
                tp.isTemporary = true;
                tp.targetX = px.relX + (Math.random() - 0.5) * 3;
                tp.targetY = px.relY + (Math.random() - 0.5) * 3;
                tp.targetZ = 250;
                const baseEase = isLive ? 0.35 : 0.08;
                tp.ease = baseEase + Math.random() * 0.05;
                tp.opacity = Math.random() * 0.3 + 0.2;
                this.particles.push(tp);
            }
        }
    }

    update() {
        if (this.currentStage === 'sphere') {
            this.rotationX += 0.002;
            this.rotationY += 0.003;
            // Easing transitions logic
            if (this.transitionProgress > 0.01) this.transitionProgress *= 0.95;
            else this.transitionProgress = 0;

            this.coreParticles.forEach(p => {
                const cosX = Math.cos(this.rotationX);
                const sinX = Math.sin(this.rotationX);
                const cosY = Math.cos(this.rotationY);
                const sinY = Math.sin(this.rotationY);

                // Rotate around absolute sphere coordinates
                const y1 = p.sphereY * cosX - p.sphereZ * sinX;
                const z1 = p.sphereY * sinX + p.sphereZ * cosX;
                const x2 = p.sphereX * cosY - z1 * sinY;
                const z2 = p.sphereX * sinY + z1 * cosY;

                p.targetX = x2;
                p.targetY = y1;
                p.targetZ = z2;
            });
        }
    }

    updateAudioData(volume, frequency) {
        this.audioData.volume = volume;
        this.audioData.frequency = frequency;
    }

    animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Decay transition progress
        if (this.transitionProgress > 0) {
            this.transitionProgress -= 0.005;
            if (this.transitionProgress < 0) this.transitionProgress = 0;
        }

        if (this.currentStage === 'sphere') {
            this.rotationY += 0.005;
            this.rotationX += 0.002;

            if (this.mouse.x !== null && this.mouse.y !== null) {
                this.rotationY += (this.mouse.x / canvas.width) * 0.05;
                this.rotationX += (this.mouse.y / canvas.height) * 0.05;
            }

            const cosX = Math.cos(this.rotationX);
            const sinX = Math.sin(this.rotationX);
            const cosY = Math.cos(this.rotationY);
            const sinY = Math.sin(this.rotationY);
            const radius = 200 + this.audioData.volume * 200;

            this.coreParticles.forEach(p => {
                let tx = p.sphereX;
                let ty = p.sphereY;
                let tz = p.sphereZ;

                // Rotation around Y
                let ntx = tx * cosY - tz * sinY;
                let ntz = tz * cosY + tx * sinY;
                tx = ntx;
                tz = ntz;
                // Rotation around X
                let nty = ty * cosX - tz * sinX;
                ntz = tz * cosX + ty * sinX;
                ty = nty;
                tz = ntz;

                const scale = (radius / 200);
                p.targetX = tx * scale;
                p.targetY = ty * scale;
                p.targetZ = tz * scale;
            });
        }

        ctx.globalCompositeOperation = 'lighter';
        this.particles = this.particles.filter(p => !p.isTemporary || p.life > 0.01);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.update(this.audioData.volume, this.audioData.frequency, this.mouse.x, this.mouse.y, this.currentStage, this.transitionProgress);
            p.draw(ctx, this.centerX, this.centerY, this.currentStage);
        }

        ctx.globalCompositeOperation = 'source-over';
        requestAnimationFrame(() => this.animate());
    }
}

const system = new ParticleSystem();
system.animate();
window.particleSystem = system;