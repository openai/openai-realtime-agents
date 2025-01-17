'use client';

import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, mode, setTheme, setMode } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const themes = [
    { id: 'default', name: 'Default' },
    { id: 'blue', name: 'Blue' },
    { id: 'green', name: 'Green' },
    { id: 'purple', name: 'Purple' },
  ];

  return (
    <>
      <div className="theme-toggle flex gap-2">
        {/* Mode Toggle */}
        <button
          onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors dark:bg-primary/20 dark:hover:bg-primary/30"
          aria-label="Toggle dark mode"
        >
          {mode === 'light' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          )}
        </button>

        {/* Theme Selector Toggle */}
        <button
          onClick={() => setShowThemeSelector(!showThemeSelector)}
          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors dark:bg-primary/20 dark:hover:bg-primary/30"
          aria-label="Select theme"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="12" y1="2" x2="12" y2="4"></line>
            <line x1="12" y1="20" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="4" y2="12"></line>
            <line x1="20" y1="12" x2="22" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Theme Selector Dropdown */}
      {showThemeSelector && (
        <div className="theme-selector dark:border-primary/20 dark:bg-background/95 backdrop-blur-sm">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id as any);
                setShowThemeSelector(false);
              }}
              className={`block w-full text-left px-4 py-2 rounded hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors ${
                theme === t.id ? 'text-primary dark:text-primary/90' : ''
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
