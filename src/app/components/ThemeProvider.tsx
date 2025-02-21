'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'blue' | 'green' | 'purple' | 'default';
type Mode = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  mode: Mode;
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('default');
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedMode = localStorage.getItem('mode') as Mode;
    
    if (savedTheme) setTheme(savedTheme);
    if (savedMode) setMode(savedMode);
  }, []);

  useEffect(() => {
    // Update document classes and data attributes
    const root = document.documentElement;
    
    // Update dark mode class
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update theme
    if (theme !== 'default') {
      root.setAttribute('data-theme', `${theme}-${mode}`);
    } else {
      root.removeAttribute('data-theme');
    }

    // Apply background color transition
    document.body.style.transition = 'background-color 0.3s ease';

    // Save preferences
    localStorage.setItem('theme', theme);
    localStorage.setItem('mode', mode);
  }, [theme, mode]);

  const value = {
    theme,
    mode,
    setTheme: (newTheme: Theme) => setTheme(newTheme),
    setMode: (newMode: Mode) => setMode(newMode),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}