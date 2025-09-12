import { simpleHandoffScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';

import type { RealtimeAgent } from '@openai/agents/realtime';
import type { DynamicScenario } from '@/app/types';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

export const defaultAgentSetKey = 'chatSupervisor';

// Helper function to convert dynamic scenario to RealtimeAgent format
export function convertDynamicScenarioToRealtimeAgents(scenario: DynamicScenario): RealtimeAgent[] {
  return scenario.agents.map(agent => ({
    name: agent.name,
    voice: agent.voice as any,
    instructions: agent.instructions,
    tools: agent.tools,
    handoffs: agent.handoffAgentIds.map(id => ({ name: id })),
    handoffDescription: agent.handoffDescription,
  })) as any as RealtimeAgent[];
}

// Extended agent sets that include dynamic scenarios
export function getAllAgentSetsWithDynamic(dynamicScenarios: DynamicScenario[] = []): Record<string, RealtimeAgent[]> {
  const extendedSets = { ...allAgentSets };

  // Add dynamic scenarios
  dynamicScenarios.forEach(scenario => {
    extendedSets[scenario.id] = convertDynamicScenarioToRealtimeAgents(scenario);
  });

  return extendedSets;
}
