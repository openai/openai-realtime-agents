import { DynamicScenario } from "@/app/types";
import { allAgentSets } from "@/app/agentConfigs";

// In-memory storage for development - in production, use a database
let scenarios: DynamicScenario[] = [];

// Initialize with default scenarios if empty
function initializeDefaultScenarios() {
  if (scenarios.length === 0) {
    // Use imported allAgentSets

    Object.entries(allAgentSets).forEach(([key, agents]: [string, any]) => {
      const dynamicAgents = (agents as any[]).map((agent: any, index: number) => ({
        id: `${key}-agent-${index}`,
        name: agent.name,
        voice: agent.voice || 'sage',
        instructions: typeof agent.instructions === 'string' ? agent.instructions : 'Default instructions',
        tools: agent.tools || [],
        handoffAgentIds: agent.handoffs?.map((h: any) => h.name) || [],
        handoffDescription: agent.handoffDescription || '',
      }));

      const scenario: DynamicScenario = {
        id: key,
        name: key,
        description: `Default ${key} scenario`,
        agents: dynamicAgents,
        companyName: key === 'customerServiceRetail' ? 'Snowy Peak Boards' : 'NewTelco',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      scenarios.push(scenario);
    });
  }
}

export class ScenarioStorage {
  static async getAllScenarios(): Promise<DynamicScenario[]> {
    initializeDefaultScenarios();
    return [...scenarios];
  }

  static async getScenarioById(id: string): Promise<DynamicScenario | null> {
    initializeDefaultScenarios();
    return scenarios.find(s => s.id === id) || null;
  }

  static async createScenario(scenarioData: Omit<DynamicScenario, 'id' | 'createdAt' | 'updatedAt'>): Promise<DynamicScenario> {
    const newScenario: DynamicScenario = {
      ...scenarioData,
      id: `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    scenarios.push(newScenario);
    return newScenario;
  }

  static async updateScenario(id: string, updates: Partial<DynamicScenario>): Promise<DynamicScenario | null> {
    const scenarioIndex = scenarios.findIndex(s => s.id === id);
    if (scenarioIndex === -1) {
      return null;
    }

    scenarios[scenarioIndex] = {
      ...scenarios[scenarioIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return scenarios[scenarioIndex];
  }

  static async deleteScenario(id: string): Promise<boolean> {
    const scenarioIndex = scenarios.findIndex(s => s.id === id);
    if (scenarioIndex === -1) {
      return false;
    }

    scenarios.splice(scenarioIndex, 1);
    return true;
  }

  static async getScenariosByIds(ids: string[]): Promise<DynamicScenario[]> {
    initializeDefaultScenarios();
    return scenarios.filter(s => ids.includes(s.id));
  }

  // Utility method to save to localStorage for persistence
  static saveToLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dynamicScenarios', JSON.stringify(scenarios));
    }
  }

  // Utility method to load from localStorage
  static loadFromLocalStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dynamicScenarios');
      if (stored) {
        scenarios = JSON.parse(stored);
      }
    }
  }
}