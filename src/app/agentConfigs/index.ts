// src/app/agentConfigs/index.ts
import { AllAgentConfigsType } from "@/app/types";
import frontDeskAuthentication from "./frontDeskAuthentication";
import customerServiceRetail from "./customerServiceRetail";
import simpleExample from "./simpleExample";
import marlene from "./marlene";

// Exportação unificada com todos os agentes disponíveis
export const allAgentSets: AllAgentConfigsType = {
  frontDeskAuthentication,
  customerServiceRetail,
  simpleExample,
  marlene
};

// Você pode definir o agente padrão conforme sua preferência
// Definido como "marlene" para iniciar com esse agente por padrão
export const defaultAgentSetKey = "marlene";

// Alternativamente, se preferir usar simpleExample como padrão
// export const defaultAgentSetKey = "simpleExample";
