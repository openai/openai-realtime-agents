import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

// Configuração mínima do agente Marlene para uso básico
const marlene: AgentConfig = {
  name: "marlene",
  publicDescription: "Atendente Marlene da Credmais para crédito consignado.",
  instructions: "Oi Lucas, tudo bom? Eu sou a Marlene, da Credmais. Em que posso ajudar?",
  tools: [],
  downstreamAgents: [],
};

// Mesmo sem agentes downstream, usamos o utilitário para manter consistência
const agents = injectTransferTools([marlene]);
export default agents;
