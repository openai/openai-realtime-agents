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
 * Tool para pegar valor correto do consig
 */
export const getInterestRateTool: Tool = {
  name: "get_interest_rate",
  description: "Busca a taxa SELIC diária na API pública do Banco Central",
  func: async () => {
    // fetch é suportado no ambiente edge/serverless
    const res = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
    );
    const json = await res.json();
    // o resultado é [{data: "dd/MM/yyyy", valor: "x,xxxx"}]
    const valor = parseFloat(json[0].valor.replace(",", "."));
    return JSON.stringify({ rate: valor });
  },
};