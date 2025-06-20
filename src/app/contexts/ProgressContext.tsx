"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AgentProgress {
  passed: boolean;
  bestScore: number;
  attempts: number;
  lastAttemptDate: string;
}

interface ProgressState {
  angryCustomer: AgentProgress;
  frustratedCustomer: AgentProgress;
  naiveCustomer: AgentProgress;
}

interface ProgressContextType {
  progress: ProgressState;
  updateProgress: (agentName: string, score: number) => void;
  resetProgress: () => void;
  hasPassedAll: () => boolean;
}

const defaultProgress: ProgressState = {
  angryCustomer: { passed: false, bestScore: 0, attempts: 0, lastAttemptDate: '' },
  frustratedCustomer: { passed: false, bestScore: 0, attempts: 0, lastAttemptDate: '' },
  naiveCustomer: { passed: false, bestScore: 0, attempts: 0, lastAttemptDate: '' },
};

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agentProgress');
      const loadedProgress = saved ? JSON.parse(saved) : defaultProgress;
      console.log('Loading progress from localStorage:', loadedProgress);
      return loadedProgress;
    }
    return defaultProgress;
  });

  useEffect(() => {
    localStorage.setItem('agentProgress', JSON.stringify(progress));
    console.log('Saving progress to localStorage:', progress);
  }, [progress]);

  const updateProgress = (agentName: string, score: number) => {
    console.log(`Updating progress for ${agentName} with score ${score}`);
    setProgress(prev => {
      const agentKey = agentName as keyof ProgressState;
      const current = prev[agentKey];
      console.log(`Current progress for ${agentName}:`, current);
      
      const passed = score >= 80;
      const newBestScore = Math.max(current.bestScore, score);
      const newAttempts = current.attempts + 1;
      
      const newProgress = {
        ...prev,
        [agentKey]: {
          passed: passed || current.passed, // Once passed, always passed
          bestScore: newBestScore,
          attempts: newAttempts,
          lastAttemptDate: new Date().toISOString(),
        }
      };
      
      console.log(`New progress for ${agentName}:`, newProgress[agentKey]);
      console.log(`Attempt count for ${agentName}: ${newAttempts}`);
      return newProgress;
    });
  };

  const resetProgress = () => {
    console.log('Resetting all progress');
    setProgress(defaultProgress);
  };

  const hasPassedAll = () => {
    return progress.angryCustomer.passed && 
           progress.frustratedCustomer.passed && 
           progress.naiveCustomer.passed;
  };

  return (
    <ProgressContext.Provider value={{ progress, updateProgress, resetProgress, hasPassedAll }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
} 