# Legion

![Banner](./public/banner.jpg)

**Legion** is an experimental Web3 + AI project that visualizes collective intelligence as a living swarm. Each user spawns a **metaball node** in 3D space, interconnected with quantum-style lines, animated with fluid physics, and enriched with **AI-driven conversations**.  

The project blends **crypto-inspired visualization**, **multi-agent AI systems**, and **real-time networking** into one interactive swarm canvas.

---

## ✨ Features

- 🧬 **Swarm Visualizer**: Users spawn as metaballs in a shared 3D cosmic environment.  
- 🌌 **Quantum Links**: Animated, wavy, data-transfer lines connect the nodes.  
- 🤖 **Principals Powered by LLMs**: Core entities in the swarm (Principals) are powered by **Large Language Models (LLMs)**, enabling AI-driven dialogue and decision-making.  
- 🎮 **Interactive Camera**: Free-fly mode, follow-your-node, and swarm zoom-out views.  
- 🔌 **WebSockets**: Real-time node spawning and swarm state sync across clients.  
- 🛡️ **Legion Panel**: Right-side panel for consensus logs, activity, and swarm insights.

---

## 🛠 Tech Stack

- **Frontend**: Next.js + React + TypeScript  
- **3D/Graphics**: Three.js + React Three Fiber + custom GLSL shaders  
- **Networking**: Node.js WebSocket server  
- **AI**: LLMs (e.g., OpenAI GPT models — requires API key)  

---

## ⚙️ Setup

1. Clone the repository:  
   ```bash
   git clone https://github.com/yourusername/legion.git
   cd legion
   ```

2. Install dependencies:  
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root and add your **LLM API key**:  
   ```bash
   NEXT_PUBLIC_LLM_API_KEY=your_api_key_here
   ```

4. Run the WebSocket server:  
   ```bash
   node server.mjs
   ```

5. Start the Next.js development server:  
   ```bash
   npm run dev
   ```

---

## 📂 Project Structure

```
├── public/              # Static assets (banners, icons, SVGs)
├── scripts/             # Utility scripts
├── src/
│   ├── app/             # Next.js app routes
│   ├── components/      # React components (SwarmCanvas, MetaBall, QuantumLinks, etc.)
│   ├── hooks/           # Custom hooks (e.g., useSwarm)
│   └── styles/          # CSS modules
└── server.mjs           # WebSocket server
```

---

## 🧭 Vision / Lore

Legion is a living experiment in **crypto, AI, and collective intelligence**.  
Every node is a participant; every link is a transaction of energy, thought, or data. The **Principals**, powered by LLMs, are guiding forces — shaping the swarm with reason, randomness, and emergent logic.  

Together, the swarm evolves. 🪐  
