import { AgentConfig, Tool } from "@/app/types";

/**
 * Gera dinamicamente o tool de transferência de agentes downstream
 */
export function injectTransferTools(agentDefs: AgentConfig[]): AgentConfig[] {
  agentDefs.forEach((agentDef) => {
    const downstream = agentDef.downstreamAgents || [];
    if (downstream.length > 0) {
      const descList = downstream
        .map((d) => `- ${d.name}: ${d.publicDescription}`)
        .join("\n");
      const transferTool: Tool = {
        type: "function",
        name: "transferAgents",
        description: `Transfere o usuário para outro agente especializado.\nDisponíveis:\n${descList}`,
        parameters: {
          type: "object",
          properties: {
            rationale_for_transfer: { type: "string" },
            conversation_context: { type: "string" },
            destination_agent: {
              type: "string",
              enum: downstream.map((d) => d.name),
            },
          },
          required: [
            "rationale_for_transfer",
            "conversation_context",
            "destination_agent",
          ],
        },
      };
      agentDef.tools = [...(agentDef.tools || []), transferTool];
    }
    // evita circular
    agentDef.downstreamAgents = (agentDef.downstreamAgents || []).map(
      ({ name, publicDescription }) => ({ name, publicDescription })
    );
  });
  return agentDefs;
}

/**
 * Tool para exibir um ícone/alerta na UI (ex: 💰)
 */
export const uiEventTool: Tool = {
  type: "function",
  name: "ui_event",
  description: `Emite um evento para a interface exibir um ícone/flutuante.`,
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      icon: { type: "string" },
      color: { type: "string" },
    },
    required: ["name", "icon", "color"],
  },
};

/**
 * Tool para solicitar que o cliente abra a câmera
 */
export const openCameraTool: Tool = {
  type: "function",
  name: "open_camera",
  description:
    "Pede permissão ao usuário e ativa a câmera do dispositivo para verificação.",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * Ferramenta para obter saudação baseada no horário atual
 */
export const getGreetingTool: Tool = {
  type: "function",
  name: "get_greeting",
  description: "Retorna a saudação adequada baseada no horário local atual",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * Ferramenta para obter saudação baseada no horário atual
 */
export const getGreetingTool: Tool = {
  type: "function",
  name: "get_greeting",
  description: "Retorna a saudação adequada baseada no horário local atual",
  parameters: { type: "object", properties: {}, required: [] },
};