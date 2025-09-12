"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DynamicScenario, ScenarioContextType } from '@/app/types';
import { ScenarioStorage } from '@/app/lib/scenarioStorage';

const ScenarioContext = createContext<ScenarioContextType | undefined>(undefined);

export const useScenarios = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenarios must be used within a ScenarioProvider');
  }
  return context;
};

interface ScenarioProviderProps {
  children: ReactNode;
}

export const ScenarioProvider: React.FC<ScenarioProviderProps> = ({ children }) => {
  const [scenarios, setScenarios] = useState<DynamicScenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<DynamicScenario | null>(null);
  const [loading, setLoading] = useState(true);

  // Load scenarios on mount
  useEffect(() => {
    loadScenarios();
  }, []);

  // Run migration on first load if no scenarios exist
  useEffect(() => {
    const runMigrationIfNeeded = async () => {
      try {
        const existingScenarios = await ScenarioStorage.getAllScenarios();
        if (existingScenarios.length === 0) {
          console.log('No scenarios found, running migration...');
          const { MigrationService } = await import('@/app/lib/migration');
          await MigrationService.migrateExistingScenarios();
          // Reload scenarios after migration
          await loadScenarios();
        }
      } catch (error) {
        console.error('Migration failed:', error);
      }
    };

    runMigrationIfNeeded();
  }, []);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const loadedScenarios = await ScenarioStorage.getAllScenarios();
      setScenarios(loadedScenarios);

      // Set first scenario as current if none is selected
      if (loadedScenarios.length > 0 && !currentScenario) {
        setCurrentScenario(loadedScenarios[0]);
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveScenario = async (scenario: DynamicScenario) => {
    try {
      let savedScenario: DynamicScenario;

      if (scenario.id.startsWith('scenario-')) {
        // Update existing scenario
        savedScenario = await ScenarioStorage.updateScenario(scenario.id, scenario) || scenario;
      } else {
        // Create new scenario
        savedScenario = await ScenarioStorage.createScenario(scenario);
      }

      // Update local state
      setScenarios(prev => {
        const existingIndex = prev.findIndex(s => s.id === savedScenario.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = savedScenario;
          return updated;
        } else {
          return [...prev, savedScenario];
        }
      });

      // Save to localStorage for persistence
      ScenarioStorage.saveToLocalStorage();

      return savedScenario;
    } catch (error) {
      console.error('Error saving scenario:', error);
      throw error;
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      const success = await ScenarioStorage.deleteScenario(scenarioId);
      if (success) {
        setScenarios(prev => prev.filter(s => s.id !== scenarioId));

        // If current scenario was deleted, set to first available
        if (currentScenario?.id === scenarioId) {
          const remaining = scenarios.filter(s => s.id !== scenarioId);
          setCurrentScenario(remaining.length > 0 ? remaining[0] : null);
        }

        // Save to localStorage for persistence
        ScenarioStorage.saveToLocalStorage();
      }
      return success;
    } catch (error) {
      console.error('Error deleting scenario:', error);
      throw error;
    }
  };

  const updateScenario = async (scenarioId: string, updates: Partial<DynamicScenario>) => {
    try {
      const updatedScenario = await ScenarioStorage.updateScenario(scenarioId, updates);
      if (updatedScenario) {
        setScenarios(prev => prev.map(s =>
          s.id === scenarioId ? updatedScenario : s
        ));

        // Update current scenario if it's the one being updated
        if (currentScenario?.id === scenarioId) {
          setCurrentScenario(updatedScenario);
        }

        // Save to localStorage for persistence
        ScenarioStorage.saveToLocalStorage();
      }
      return updatedScenario;
    } catch (error) {
      console.error('Error updating scenario:', error);
      throw error;
    }
  };

  const value: ScenarioContextType = {
    scenarios,
    currentScenario,
    loadScenarios,
    saveScenario,
    deleteScenario,
    updateScenario,
    setCurrentScenario,
  };

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
};