// src/app/simple/components/BrowserNavbar.tsx
import React from 'react';

const BrowserNavbar: React.FC = () => {
  return (
    <div className="browser-navbar">
      <div className="browser-navbar-left">
        <button className="browser-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="browser-navbar-center">
        <div className="browser-urlbar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="browser-lock-icon">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2"/>
          </svg>
          <span className="browser-url">formalizacao.com.br</span>
        </div>
      </div>
      <div className="browser-navbar-right">
        <button className="browser-btn">
          <div className="browser-tab">1</div>
        </button>
        <button className="browser-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="1" strokeWidth="3"/>
            <circle cx="12" cy="5" r="1" strokeWidth="3"/>
            <circle cx="12" cy="19" r="1" strokeWidth="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BrowserNavbar;