# Automata Studio — DFA / NFA Visualizer

A modern, interactive finite state machine design, simulation, and analysis suite built with React and JointJS.

![Automata Studio Interface](Images/logo.png)

---

## ✨ Features & Capabilities

### 🎨 Modern Dark-Themed UI
- **Glassmorphic Top Navigation & Toolbars**: Clean, cohesive dark palette featuring subtle borders, gradient accents, and responsive layout.
- **Interactive Canvas with Grid Dot Pattern**: Smooth state positioning, dragging, node styling, and auto-routed transition links with Manhattan routing.
- **Floating Input Testing Bar**: Run test strings anytime with live path evaluation and status badges.
- **Visual State Indicators**:
  - Start states denoted by dedicated color coding and badges.
  - Accepting states highlighted with double-ring borders and green accents.
  - Interactive deletion and accepting state toggle straight from the sidebar list.

### ⚙️ Automata Mechanisms
1. **Interactive State & Transition Construction**:
   - Add states with automated grid placement.
   - Configure transitions with target selection and single-character symbol / $\varepsilon$-transition support.
   - Self-loops and multi-character transition aggregation supported seamlessly.
2. **String Testing & Path Highlighting**:
   - **DFA Step-by-Step Simulation**: Deterministic path navigation highlighting current and visited nodes/edges on the canvas.
   - **NFA Simulation with $\varepsilon$-Transitions**: Depth-first search (DFS) with full $\varepsilon$-closure exploration to discover accepting paths.
   - Live visual playback with path sequences displayed directly in toasts.
3. **NFA to DFA Conversion (Subset Construction)**:
   - Full power-set $\varepsilon$-closure algorithm.
   - Converts arbitrary NFAs with or without $\varepsilon$-transitions into equivalent minimal DFAs with proper subset naming and state mapping.
4. **DFA Minimization (Hopcroft's Algorithm)**:
   - Partition refinement separating accepting and non-accepting states.
   - Eliminates redundant/equivalent states and updates transition graphs automatically.
5. **DFA Equivalence Checking**:
   - Upload any two DFA JSON definitions.
   - Product construction algorithm finds distinguishing states or proves equivalence.
6. **State Machine Persistence & Preloaded Examples**:
   - Export and import automata definitions in JSON format.
   - One-click example presets:
     - DFA that accepts strings ending with `1`.
     - NFA that accepts strings containing `101`.
     - NFA featuring $\varepsilon$-transitions.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### Installation
```bash
git clone https://github.com/officialblake/Draw-DFA.git
cd Draw-DFA
npm install
```

### Running Locally
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm test
```

---

## 🛠️ Tech Stack
- **React 18**
- **JointJS 3.7+**
- **CSS3 Design Tokens** (Custom design system)
- **React Icons**
