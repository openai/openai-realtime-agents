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
          {mode === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Theme Selector Toggle */}
        <button
          onClick={() => setShowThemeSelector(!showThemeSelector)}
          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors dark:bg-primary/20 dark:hover:bg-primary/30"
          aria-label="Select theme"
        >
          🎨
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