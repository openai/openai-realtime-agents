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
 * Tool para solicitar que o cliente abra a câmera
 */
export const openCameraTool: Tool = {
  type: "function",
  name: "open_camera",
  description:
    "Pede permissão ao usuário e ativa a câmera do dispositivo para verificação. Use em um momento natural da conversa, após explicar a necessidade.",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * Tool para fechar a câmera após a verificação
 */
export const closeCameraTool: Tool = {
  type: "function",
  name: "close_camera",
  description:
    "Fecha a câmera do dispositivo após a verificação estar completa.",
  parameters: { type: "object", properties: {}, required: [] },
};
/**
 * Tool para simplificar explicação financeira
 */
export const simplifyFinancialExplanationTool: Tool = {
  type: "function",
  name: "simplify_financial_explanation",
  description: "Traduz conceitos financeiros para explicações muito simplificadas com analogias do cotidiano",
  parameters: {
    type: "object",
    properties: {
      concept: {
        type: "string",
        enum: ["juros", "parcela", "prazo", "margem_consignavel", "valor_total"],
        description: "Conceito financeiro a ser explicado"
      },
      context: {
        type: "string",
        description: "Contexto específico da conversa"
      }
    },
    required: ["concept"]
  }
};

/**
 * Tool para verificar compreensão do cliente
 */
export const verifyUnderstandingTool: Tool = {
  type: "function",
  name: "verify_understanding",
  description: "Verifica se o cliente compreendeu os termos do empréstimo",
  parameters: {
    type: "object",
    properties: {
      loanAmount: {
        type: "string",
        description: "Valor do empréstimo"
      },
      installmentValue: {
        type: "string",
        description: "Valor da parcela mensal"
      },
      term: {
        type: "number",
        description: "Prazo em meses"
      },
      benefitImpactPercentage: {
        type: "number",
        description: "Percentual do benefício comprometido"
      }
    },
    required: ["loanAmount", "installmentValue", "term", "benefitImpactPercentage"]
  }
};

/**
 * Tool para criar documentação visual e por áudio
 */
export const createAccessibleDocumentationTool: Tool = {
  type: "function",
  name: "create_accessible_documentation",
  description: "Cria documentação simplificada com recursos visuais e áudio para baixa alfabetização",
  parameters: {
    type: "object",
    properties: {
      customerName: {
        type: "string",
        description: "Nome do cliente"
      },
      loanDetails: {
        type: "object",
        properties: {
          loanAmount: { type: "string" },
          installmentValue: { type: "string" },
          term: { type: "number" },
          benefitDeduction: { type: "string" }
        }
      },
      deliveryMethod: {
        type: "string",
        enum: ["whatsapp_audio", "sms", "print_visual"],
        description: "Método de entrega com preferência para formatos não-textuais"
      }
    },
    required: ["customerName", "loanDetails", "deliveryMethod"]
  }
};
/**
 * Tool para lidar com erros de câmera
 */
export const handleCameraErrorTool: Tool = {
  type: "function",
  name: "handle_camera_error",
  description: "Trata erros na verificação por câmera oferecendo alternativas",
  parameters: {
    type: "object",
    properties: {
      errorType: {
        type: "string",
        enum: ["permission_denied", "device_unavailable", "timeout", "other"],
        description: "Tipo de erro encontrado"
      },
      alternativeMethod: {
        type: "string",
        enum: ["try_again", "phone_verification", "in_person_verification"],
        description: "Método alternativo sugerido"
      }
    },
    required: ["errorType"]
  }
};
/**
 * Tool para incluir acompanhante na conversa
 */
export const includeCompanionTool: Tool = {
  type: "function",
  name: "include_companion",
  description: "Adapta o atendimento para incluir um acompanhante na conversa",
  parameters: {
    type: "object",
    properties: {
      hasCompanion: {
        type: "boolean",
        description: "Indica se há um acompanhante presente"
      },
      relationshipType: {
        type: "string",
        enum: ["filho(a)", "cônjuge", "neto(a)", "outro_familiar", "amigo(a)", "cuidador(a)"],
        description: "Relação do acompanhante com o cliente"
      }
    },
    required: ["hasCompanion"]
  }
};