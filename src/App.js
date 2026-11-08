import React from 'react';
import './App.css';
import DfaNfaVisualizer from './Canvas';
import { FaGithub } from 'react-icons/fa';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
              <path d="M2 12h20"/>
            </svg>
          </div>
          <h1 className="app-title">
            Automata Studio <span className="app-subtitle">· DFA/NFA Visualizer</span>
          </h1>
        </div>
        <div className="header-right">
          <a
            href="https://github.com/officialblake/Draw-DFA"
            target="_blank"
            rel="noopener noreferrer"
            className="header-btn"
          >
            <FaGithub /> GitHub
          </a>
        </div>
      </header>
      <DfaNfaVisualizer />
    </div>
  );
}

export default App;
