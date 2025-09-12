import { DynamicAgent } from "@/app/types";
import { allAgentSets } from "@/app/agentConfigs";

// In-memory storage for development - in production, use a database
let agents: DynamicAgent[] = [];

// Initialize with default agents if empty
function initializeDefaultAgents() {
  if (agents.length === 0) {
    // Use imported allAgentSets

    Object.entries(allAgentSets).forEach(([scenarioKey, scenarioAgents]: [string, any]) => {
      (scenarioAgents as any[]).forEach((agent: any, index: number) => {
        const dynamicAgent: DynamicAgent = {
          id: `${scenarioKey}-agent-${index}`,
          name: agent.name,
          voice: agent.voice || 'sage',
          instructions: typeof agent.instructions === 'string' ? agent.instructions : 'Default instructions',
          tools: agent.tools || [],
          handoffAgentIds: agent.handoffs?.map((h: any) => h.name) || [],
          handoffDescription: agent.handoffDescription || '',
        };
        agents.push(dynamicAgent);
      });
    });
  }
}

export class AgentStorage {
  static async getAllAgents(): Promise<DynamicAgent[]> {
    initializeDefaultAgents();
    return [...agents];
  }

  static async getAgentById(id: string): Promise<DynamicAgent | null> {
    initializeDefaultAgents();
    return agents.find(a => a.id === id) || null;
  }

  static async getAgentsByScenario(scenarioId: string): Promise<DynamicAgent[]> {
    initializeDefaultAgents();
    return agents.filter(agent => agent.id.startsWith(`${scenarioId}-agent-`));
  }

  static async createAgent(agentData: Omit<DynamicAgent, 'id'>): Promise<DynamicAgent> {
    const newAgent: DynamicAgent = {
      ...agentData,
      id: `${agentData.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    agents.push(newAgent);
    return newAgent;
  }

  static async updateAgent(id: string, updates: Partial<DynamicAgent>): Promise<DynamicAgent | null> {
    const agentIndex = agents.findIndex(a => a.id === id);
    if (agentIndex === -1) {
      return null;
    }

    agents[agentIndex] = {
      ...agents[agentIndex],
      ...updates,
    };

    return agents[agentIndex];
  }

  static async deleteAgent(id: string): Promise<boolean> {
    const agentIndex = agents.findIndex(a => a.id === id);
    if (agentIndex === -1) {
      return false;
    }

    agents.splice(agentIndex, 1);
    return true;
  }

  static async getAgentsByIds(ids: string[]): Promise<DynamicAgent[]> {
    initializeDefaultAgents();
    return agents.filter(a => ids.includes(a.id));
  }

  // Utility method to save to localStorage for persistence
  static saveToLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dynamicAgents', JSON.stringify(agents));
    }
  }

  // Utility method to load from localStorage
  static loadFromLocalStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dynamicAgents');
      if (stored) {
        agents = JSON.parse(stored);
      }
    }
  }
}