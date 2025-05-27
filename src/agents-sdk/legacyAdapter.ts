import { AgentConfig } from '@/app/types';
import { RealtimeAgent } from '@openai/agents-core/realtime';

/*
 * Helper utilities that convert `RealtimeAgent` objects produced by the new
 * SDK into the legacy `AgentConfig` shape consumed by the existing React UI.
 *
 * NOTE: This is an *approximation*.  It drops tool schemas because the client
 * only needs the list of tool names to trigger UI behaviour.  If richer data
 * is required later we can expose `tool.parameters.jsonSchema`.
 */

export function agentToLegacy(agent: RealtimeAgent): AgentConfig {
  return {
    name: agent.name,
    publicDescription: agent.handoffDescription ?? agent.name,
    instructions: agent.instructions,
    tools: (agent.tools ?? []).map((t: any) => ({
      type: 'function',
      name: t.name,
      description: t.description ?? '',
      parameters: t.parameters ?? { type: 'object', properties: {} },
    })),
    downstreamAgents: (agent.handoffs ?? [])
      .filter((h): h is RealtimeAgent => (h as any).name !== undefined)
      .map((h) => ({
        name: (h as any).name,
        publicDescription: (h as any).handoffDescription ?? (h as any).name,
      })),
  } as AgentConfig;
}

export function scenarioToLegacy(agents: RealtimeAgent[]): AgentConfig[] {
  return agents.map(agentToLegacy);
}
