# 🌌 GRABX Aura Morph Particle System

A cinematic, AI-powered interactive particle system designed with the premium **GRABX** aesthetic. This project features a high-performance 3D particle sphere that reacts to voice, text input, and mouse movement, morphing into complex text formations with high-fidelity "Venom-style" scatter effects.

## ✨ Features

- **🛡️ Stabilized 3D Sphere**: A premium rotating particle shell with halved rotation speed for cinematic stability and organic multi-axis drift.
- **🔡 High-Precision Morphing**: Ultra-fast deterministic sampling engine ensures instant, lag-free text formation for any input.
- **🕸️ Cinematic "Venom" Depth**: Particles form text at a stable 3D focal distance (+250 units), featuring a dense core (85% particles) and an ethereal digital halo.
- **🎙️ Voice-to-Morph (STT)**: Real-time particle morphing as you speak using the Web Speech API with no-lag interim results.
- **🎭 Stage clearing UI**: The chat box instantly slides away during text formation to clear the stage for the particle animation, reappearing gracefully once the sequence ends.
- **📖 Dynamic Text Lifecycle**: Automatically splits long paragraphs into perfectly timed cinematic pages. No text is ever cut off.
- **💎 Pure GRABX Aesthetics**: Consistent Navy, Blue, and White color palette with premium glassmorphism UI and "Outfit" typography.

## 🛠️ Technologies Used

- **HTML5 Canvas**: High-performance 2D/3D particle rendering.
- **Pure JavaScript**: Custom physics engine with decoupled rotation and return-to-sphere logic.
- **Web Speech API**: For real-time voice recognition and Text-to-Speech feedback.
- **Web Audio API**: Real-time frequency and volume analysis for reactive visuals.
- **CSS3**: Modern glassmorphism with instant-hide/smooth-slide animations.

## 🚀 Getting Started

### Prerequisites

To run this project locally, you only need a modern web browser (Chrome or Edge recommended for best Web Speech API support).

### 📥 Installation & Cloning

Follow these steps to get a local copy up and running:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rushikesh270505/grabxaiauramorph.git
   ```

2. **Navigate into the project directory:**
   ```bash
   cd grabxaiauramorph
   ```

3. **Run the application:**
   - Since this is a pure frontend project, you can simply open `index.html` in your browser.
   - Alternatively, use a local server like Live Server (VS Code extension) or Python's HTTP server:
     ```bash
     # If you have Python installed
     python3 -m http.server 5002
     ```
   - Open your browser and go to `http://localhost:5002`.

## 🎮 How to Use

- **Mouse Interaction**: Move your cursor over the sphere to push particles away with smoothed physics.
- **Voice Mode**: Click the mic icon and speak. The particles will form your words in real-time as the UI clears the stage.
- **Text Mode**: Type your message and press Enter. Watch the UI slide down instantly to let the particles shine.
- **Long Paragraphs**: The system handles unlimited text lengths, flipping through pages automatically until the message is complete.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---
*Created with ❤️ for the GRABX Ecosystem.*
