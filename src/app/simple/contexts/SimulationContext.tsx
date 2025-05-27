"use client";

// src/app/simple/contexts/SimulationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadPresets, saveUserPresets } from '@/app/three/presetsStorage';
import type { CoinPreset } from '@/app/three/coinPresets';

interface SimulationContextType {
  simulationMode: boolean;
  setSimulationMode: (mode: boolean) => void;
  offlineMode: boolean;
  setOfflineMode: (mode: boolean) => void;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => void;
  locale: string;
  setLocale: (locale: string) => void;
  show3DCoin: boolean;
  setShow3DCoin: (show: boolean) => void;
  presets: Record<string, CoinPreset>;
  presetNames: string[];
  selectedPreset: string;
  setSelectedPreset: (preset: string) => void;
  addPreset: (name: string, preset: CoinPreset) => void;
  removePreset: (name: string) => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [simulationMode, setSimulationMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('simulation_mode') === 'true';
  });
  const [offlineMode, setOfflineMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('offline_mode') === 'true';
  });
  const [currencySymbol, setCurrencySymbol] = useState<string>(() => {
    if (typeof window === 'undefined') return 'R$';
    return localStorage.getItem('currency_symbol') || 'R$';
  });
  const [locale, setLocale] = useState<string>(() => {
    if (typeof window === 'undefined') return 'pt-BR';
    return localStorage.getItem('locale') || 'pt-BR';
  });
  const [show3DCoin, setShow3DCoin] = useState<boolean>(false);

  const [presets, setPresets] = useState<Record<string, CoinPreset>>(() => {
    if (typeof window === 'undefined') return {};
    return loadPresets();
  });
  const presetNames = Object.keys(presets);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const keys = Object.keys(presets);
    return keys.includes('default') ? 'default' : keys[0] || '';
  });

  // Persist simple flags
  useEffect(() => {
    localStorage.setItem('simulation_mode', simulationMode.toString());
  }, [simulationMode]);
  useEffect(() => {
    localStorage.setItem('offline_mode', offlineMode.toString());
  }, [offlineMode]);
  useEffect(() => {
    localStorage.setItem('currency_symbol', currencySymbol);
  }, [currencySymbol]);
  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  // Persist presets on change
  useEffect(() => {
    if (typeof window !== 'undefined') saveUserPresets(presets);
  }, [presets]);

  const addPreset = (name: string, preset: CoinPreset) => {
    setPresets(prev => ({ ...prev, [name]: preset }));
    setSelectedPreset(name);
  };
  const removePreset = (name: string) => {
    setPresets(prev => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    if (selectedPreset === name) setSelectedPreset('default');
  };

  return (
    <SimulationContext.Provider value={{
      simulationMode, setSimulationMode,
      offlineMode, setOfflineMode,
      currencySymbol, setCurrencySymbol,
      locale, setLocale,
      show3DCoin, setShow3DCoin,
      presets, presetNames,
      selectedPreset, setSelectedPreset,
      addPreset, removePreset
    }}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = (): SimulationContextType => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};