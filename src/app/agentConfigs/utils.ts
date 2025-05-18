// src/app/agentConfigs/utils.ts
import { AgentConfig, Tool } from "@/app/types";

/**
 * Interface para o contexto de conversa persistente
 */
interface ConversationContext {
  name?: string;
  preferredTreatment?: string; 
  benefitNumber?: string;
  benefitValue?: number;
  requestedAmount?: string;
  purpose?: string;
  hasCompanion?: boolean;
  companionType?: string;
  confirmedEntities: Set<string>;
  previousStates: string[];
  currentState: string;
  lastInputTime: number;
  cameraVerified: boolean;
  lastStateChangeTime: number;
}

/**
 * Interface para informações extraídas da entrada do usuário
 */
interface ExtractedEntities {
  name?: string;
  preferredTreatment?: string;
  benefitNumber?: string;
  requestedAmount?: string;
  purpose?: string;
  hasCompanion?: boolean;
  companionType?: string;
  earlyExit?: boolean;
}

/**
 * Interface para resultado do processamento de entrada
 */
interface ProcessingResult {
  entities: ExtractedEntities;
  hasMultipleEntities: boolean;
  shouldAdvanceState: boolean;
  recommendedState: string | null;
  confidence: number;
  conflictingEntities: string[];
}

/**
 * Estado global para manter o contexto da conversa
 */
let conversationContext: ConversationContext = {
  confirmedEntities: new Set<string>(),
  previousStates: [],
  currentState: "1_greeting",
  lastInputTime: Date.now(),
  cameraVerified: false,
  lastStateChangeTime: Date.now()
};

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
 * Processa a entrada do usuário para extrair informações relevantes
 * e determinar o próximo estado
 */
export function processUserInput(input: string): ProcessingResult {
  const entities = extractEntities(input);
  const hasMultipleEntities = countSignificantEntities(entities) > 1;
  
  // Comparar entidades extraídas com o contexto atual para detectar conflitos
  const conflictingEntities = detectConflictingEntities(entities);
  
  // Verificar o tempo decorrido desde a última interação
  const timeSinceLastInput = Date.now() - conversationContext.lastInputTime;
  
  // Atualizar o tempo da última entrada
  conversationContext.lastInputTime = Date.now();
  
  // Determinar se deve avançar estado
  const shouldAdvance = determineIfShouldAdvance(entities, timeSinceLastInput);
  
  // Determinar o estado recomendado
  const recommendedState = determineRecommendedState(entities, conversationContext);
  
  // Calcular confiança na recomendação
  const confidence = calculateConfidence(entities, recommendedState);
  
  // Atualizar o contexto da conversa com as novas informações
  updateContext(entities);
  const result = {
    entities,
    hasMultipleEntities,
    shouldAdvanceState: shouldAdvance,
    recommendedState,
    confidence,
    conflictingEntities,
  };

  console.log('[processUserInput]', result);
  return result;
}

/**
 * Versão assíncrona que pode consultar um modelo LLM para sugerir o próximo estado
 */
export async function processUserInputAsync(input: string): Promise<ProcessingResult> {
  const result = processUserInput(input);

  try {
    const llmState = await getLLMRecommendedState(input, exportContext());
    if (llmState) {
      result.recommendedState = llmState;
      result.shouldAdvanceState = true;
      result.confidence = Math.max(result.confidence, 0.8);
    }
  } catch (err) {
    console.error("LLM state recommendation failed", err);
  }

  console.log('[processUserInputAsync]', result);
  return result;
}

/**
 * Chama a rota interna /api/chat/completions para obter recomendação de estado
 */
async function getLLMRecommendedState(
  message: string,
  context: ConversationContext
): Promise<string | null> {
  try {
    const system = {
      role: "system",
      content: `Você é um classificador de estados para a assistente Marlene. Responda APENAS com o id do próximo estado dentre: 1_greeting, 2_identify_need, 4_benefit_verification, 5_camera_verification, 6_loan_simulation, 7_understanding_check, 8_confirmation, 9_closing, 10_early_exit.`,
    };

    const user = {
      role: "user",
      content: `Estado atual: ${context.currentState}. Mensagem: ${message}`,
    };

    const resp = await fetch("/api/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-3.5-turbo", messages: [system, user] }),
    });

    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const match = text.match(
      /(1_greeting|2_identify_need|4_benefit_verification|5_camera_verification|6_loan_simulation|7_understanding_check|8_confirmation|9_closing|10_early_exit)/
    );
    const state = match ? match[1] : null;
    if (state) {
      console.log('[getLLMRecommendedState] LLM suggested', state);
    }
    return state;
  } catch (err) {
    console.error("Failed to fetch LLM state", err);
    return null;
  }
}

/**
 * Atualiza o contexto da conversa com novas entidades extraídas
 */
export function updateContext(entities: ExtractedEntities): void {
  // Atualizar apenas se valores não forem indefinidos
  if (entities.name) {
    conversationContext.name = entities.name;
    conversationContext.confirmedEntities.add('name');
  }
  
  if (entities.preferredTreatment) {
    conversationContext.preferredTreatment = entities.preferredTreatment;
    conversationContext.confirmedEntities.add('preferredTreatment');
  }
  
  if (entities.benefitNumber) {
    conversationContext.benefitNumber = entities.benefitNumber;
    conversationContext.confirmedEntities.add('benefitNumber');
  }
  
  if (entities.requestedAmount) {
    conversationContext.requestedAmount = entities.requestedAmount;
    conversationContext.confirmedEntities.add('requestedAmount');
  }
  
  if (entities.purpose) {
    conversationContext.purpose = entities.purpose;
    conversationContext.confirmedEntities.add('purpose');
  }
  
  if (entities.hasCompanion) {
    conversationContext.hasCompanion = entities.hasCompanion;
    conversationContext.confirmedEntities.add('hasCompanion');
  }
  
  if (entities.companionType) {
    conversationContext.companionType = entities.companionType;
    conversationContext.confirmedEntities.add('companionType');
  }

  console.log('[updateContext]', {
    currentState: conversationContext.currentState,
    confirmed: Array.from(conversationContext.confirmedEntities),
  });
}

/**
 * Registra uma mudança de estado no contexto da conversa
 */
export function recordStateChange(newState: string): void {
  // Adicionar estado atual ao histórico
  const prev = conversationContext.currentState;
  conversationContext.previousStates.push(prev);

  // Atualizar estado atual
  conversationContext.currentState = newState;

  // Registrar o momento da mudança
  conversationContext.lastStateChangeTime = Date.now();

  console.log('[StateChange]', {
    from: prev,
    to: newState,
    at: new Date(conversationContext.lastStateChangeTime).toISOString(),
  });
}

/**
 * Extrair todas as possíveis entidades da entrada do usuário
 */
function extractEntities(input: string): ExtractedEntities {
  return {
    name: extractName(input) || undefined,
    preferredTreatment: extractPreferredTreatment(input) || undefined,
    benefitNumber: extractBenefitNumber(input) || undefined,
    requestedAmount: extractMonetaryValue(input) || undefined,
    purpose: extractPurpose(input) || undefined,
    hasCompanion: hasCompanion(input),
    companionType: extractCompanionType(input) || undefined,
    earlyExit: detectEarlyExitIntent(input)
  };
}

/**
 * Detecta entidades conflitantes entre o input atual e o contexto
 */
function detectConflictingEntities(entities: ExtractedEntities): string[] {
  const conflicts: string[] = [];
  
  // Verificar para cada entidade se há conflito com o contexto existente
  if (entities.name && 
      conversationContext.name && 
      entities.name !== conversationContext.name && 
      conversationContext.confirmedEntities.has('name')) {
    conflicts.push('name');
  }
  
  if (entities.benefitNumber && 
      conversationContext.benefitNumber && 
      entities.benefitNumber !== conversationContext.benefitNumber &&
      conversationContext.confirmedEntities.has('benefitNumber')) {
    conflicts.push('benefitNumber');
  }
  
  if (entities.requestedAmount && 
      conversationContext.requestedAmount) {
    // Normalizar valores para comparação
    const normalizedNew = normalizeMonetaryValue(entities.requestedAmount);
    const normalizedExisting = normalizeMonetaryValue(conversationContext.requestedAmount);
    
    if (normalizedNew !== normalizedExisting && 
        conversationContext.confirmedEntities.has('requestedAmount')) {
      conflicts.push('requestedAmount');
    }
  }
  
  return conflicts;
}

/**
 * Normaliza um valor monetário para comparação
 */
function normalizeMonetaryValue(value: string): string {
  // Remover 'R$', espaços, pontos e converter vírgula para ponto
  return value.replace(/[R$\s.]/g, '').replace(',', '.');
}

/**
 * Conta o número de entidades significativas extraídas
 */
function countSignificantEntities(entities: ExtractedEntities): number {
  let count = 0;
  
  // Nome e tratamento preferido são menos significativos para avanço de estado
  if (entities.benefitNumber) count += 2; // Mais peso para benefício
  if (entities.requestedAmount) count += 2; // Mais peso para valor solicitado
  if (entities.purpose) count += 1;
  if (entities.name) count += 0.5; // Menor peso para nome
  if (entities.preferredTreatment) count += 0.5;
  if (entities.hasCompanion) count += 0.5;
  
  return Math.floor(count);
}

/**
 * Determina se deve avançar para um estado mais adiante com base nas entidades e timing
 */
function determineIfShouldAdvance(entities: ExtractedEntities, timeSinceLastInput: number): boolean {
  // Se muitas entidades significativas foram fornecidas
  const entityCount = countSignificantEntities(entities);
  
  // Se foi a primeira interação ou passaram-se menos de 10 segundos desde a última entrada
  const isQuickFollowup = timeSinceLastInput < 10000;
  
  // Se estamos em um dos primeiros estados
  const inEarlyState = ['1_greeting', '2_identify_need'].includes(conversationContext.currentState);
  
  // Critérios para avançar:
  // 1. Muitas entidades significativas (especialmente benefício e valor)
  // 2. Interação rápida depois da última (sugerindo complemento de informação)
  // 3. Em estado inicial, mais propício a saltos
  
  if (entityCount >= 2) return true;
  if (entityCount >= 1 && isQuickFollowup && inEarlyState) return true;
  if (entities.benefitNumber && entities.requestedAmount) return true;
  
  return false;
}

/**
 * Determina o estado mais adequado com base nas entidades extraídas
 */
function determineRecommendedState(entities: ExtractedEntities, context: ConversationContext): string | null {
  if (entities.earlyExit) {
    return "10_early_exit";
  }

  // Combinação de benefício e valor é o caso mais claro para simulação
  if (entities.requestedAmount &&
      (entities.benefitNumber || context.benefitNumber)) {
    return "6_loan_simulation";
  }

  // Se já temos benefício e valor no contexto, seguir para simulação
  if (context.benefitNumber && context.requestedAmount) {
    return "6_loan_simulation";
  }
  
  // Se temos benefício e câmera verificada, mas não valor
  if ((entities.benefitNumber || context.benefitNumber) &&
      !entities.requestedAmount &&
      !context.requestedAmount) {
    return "6_loan_simulation"; // Para perguntar valor
  }
  
  // Se temos benefício mas não câmera verificada
  if ((entities.benefitNumber || context.benefitNumber) && 
      !context.cameraVerified) {
    return "5_camera_verification";
  }
  
  // Se temos apenas valor sem benefício
  if (entities.requestedAmount && 
      !entities.benefitNumber && 
      !context.benefitNumber) {
    return "4_benefit_verification"; // Precisamos do benefício
  }
  
  // Se temos propósito mas não outras informações importantes
  if (entities.purpose &&
      !entities.benefitNumber &&
      !context.benefitNumber) {
    return "2_identify_need";
  }
  
  // Se temos nome ou tratamento preferido
  if ((entities.name || entities.preferredTreatment) && 
      !entities.benefitNumber && 
      !context.benefitNumber && 
      !entities.requestedAmount) {
    return "2_identify_need";
  }
  
  // Se não detectamos informações suficientes
  return null;
}

/**
 * Calcula o nível de confiança na recomendação de estado
 */
function calculateConfidence(entities: ExtractedEntities, recommendedState: string | null): number {
  if (!recommendedState) return 0;
  
  let confidence = 0;
  
  switch (recommendedState) {
    case "6_loan_simulation":
      // Alta confiança se temos benefício e valor solicitado
      if (entities.benefitNumber && entities.requestedAmount) {
        confidence = 0.9;
      }
      // Média-alta se temos benefício no contexto e valor solicitado agora
      else if (conversationContext.benefitNumber && entities.requestedAmount) {
        confidence = 0.8;
      }
      // Média se temos apenas benefício (contexto ou atual) e verificação de câmera
      else if ((entities.benefitNumber || conversationContext.benefitNumber) && conversationContext.cameraVerified) {
        confidence = 0.7;
      }
      break;

    case "10_early_exit":
      if (entities.earlyExit) {
        confidence = 0.9;
      } else {
        confidence = 0.4;
      }
      break;
      
    case "5_camera_verification":
      // Alta confiança se temos benefício mas não câmera verificada
      if ((entities.benefitNumber || conversationContext.benefitNumber) && !conversationContext.cameraVerified) {
        confidence = 0.85;
      }
      break;
      
    case "4_benefit_verification":
      // Alta confiança se temos valor mas não benefício
      if (entities.requestedAmount && !entities.benefitNumber && !conversationContext.benefitNumber) {
        confidence = 0.75;
      }
      break;
      
      
  case "2_identify_need":
      // Baixa-média confiança para nome/tratamento ou propósito sem outras informações críticas
      if ((entities.name || entities.preferredTreatment) && !entities.benefitNumber && !entities.requestedAmount) {
        confidence = 0.5;
      } else if (entities.purpose && !entities.benefitNumber) {
        confidence = 0.6;
      }
      break;
      
    default:
      confidence = 0.3; // Baixa confiança para outros casos
  }
  
  return confidence;
}

/**
 * Extrai possível nome do usuário do texto
 */
function extractName(text: string): string | null {
  // Padrões comuns para identificação de nome
  const patterns = [
    /meu nome [ée]h?\s+([a-zA-Z\s]+?)(?:[,.]|$|\s(?:e|mas|porque))/i,
    /me chamo\s+([a-zA-Z\s]+?)(?:[,.]|$|\s(?:e|mas|porque))/i,
    /sou (?:o|a)\s+([a-zA-Z\s]+?)(?:[,.]|$|\s(?:e|mas|porque))/i,
    /aqui [ée]h?\s+(?:o|a)\s+([a-zA-Z\s]+?)(?:[,.]|$|\s(?:e|mas|porque))/i,
    /(?:^|\s)(?:eu sou|quem fala [ée]h?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})(?:\s|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Limpar e validar o nome encontrado
      const cleanName = match[1].trim();
      
      // Validar se parece um nome válido (pelo menos 3 caracteres, sem números)
      if (cleanName.length >= 3 && !/\d/.test(cleanName)) {
        return cleanName;
      }
    }
  }
  
  // Tentar estratégia de busca de palavras capitalizadas
  const capitalizedWords = text.match(/(?:^|\s)([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})(?:\s|$)/);
  if (capitalizedWords && capitalizedWords[1]) {
    const potentialName = capitalizedWords[1].trim();
    
    // Lista de palavras comuns que não são nomes
    const nonNameWords = [
      'Bom', 'Boa', 'Olá', 'Oi', 'Sim', 'Não', 'Itaú', 'Banco', 
      'INSS', 'Brasil', 'São', 'Paulo', 'Rio', 'Janeiro'
    ];
    
    // Verificar se não é uma dessas palavras
    if (!nonNameWords.some(word => potentialName.includes(word))) {
      return potentialName;
    }
  }

  return null;
}

/**
 * Extrai possível número de benefício do texto com validação aprimorada
 */
function extractBenefitNumber(text: string): string | null {
  // Padrões para números de benefício
  const patterns = [
    /(?:meu )?benefício\s+(?:é|eh|e)?\s*[:]?\s*(\d[\d\s.]*\d)/i,
    /(?:número|numero|nº)\s+(?:do|de)\s+benefício\s+(?:é|eh|e)?\s*[:]?\s*(\d[\d\s.]*\d)/i,
    /(?:benefício|nb|número do benefício)[:#]?\s*(\d[\d\s.]*\d)/i,
    /\b(\d{6,})\b/,  // Sequências numéricas isoladas (possíveis benefícios)
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Normalizar removendo espaços e pontos
      const normalizedBenefit = match[1].replace(/[\s.]/g, '');
      
      // Validar comprimento do benefício (tipicamente 6-12 dígitos)
      if (normalizedBenefit.length >= 6 && normalizedBenefit.length <= 12) {
        // Validar que são apenas dígitos
        if (/^\d+$/.test(normalizedBenefit)) {
          return normalizedBenefit;
        }
      }
    }
  }

  // Tentar encontrar sequências numéricas que pareçam benefícios
  const digitSequences = text.match(/\b\d{6,12}\b/g);
  if (digitSequences && digitSequences.length > 0) {
    // Retornar a primeira sequência de 6-12 dígitos encontrada
    return digitSequences[0];
  }

  return null;
}

/**
 * Extrai possível valor monetário do texto com reconhecimento aprimorado
 */
function extractMonetaryValue(text: string): string | null {
  // Padrões para valores monetários
  const patterns = [
    /R\$\s*(\d{1,3}(?:\.?\d{3})*(?:,\d{1,2})?)/i,
    /(\d{1,3}(?:\.?\d{3})*(?:,\d{1,2})?)\s*reais/i,
    /(?:quero|preciso de|gostaria de)(?:\s+pegar|\s+solicitar|\s+fazer|\s+um empréstimo de)\s+(?:R\$\s*)?(\d{1,3}(?:\.?\d{3})*(?:,\d{1,2})?)/i,
    /empréstimo\s+de\s+(?:R\$\s*)?(\d{1,3}(?:\.?\d{3})*(?:,\d{1,2})?)/i,
    /valor\s+de\s+(?:R\$\s*)?(\d{1,3}(?:\.?\d{3})*(?:,\d{1,2})?)/i,
    /(\d+)\s*mil(?:\s+reais)?/i,
    /\b(dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\s+mil\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = match[1].trim();
      
      // Converter palavras numéricas para valores
      if (pattern.toString().includes('dez|vinte|trinta')) {
        const wordToNumber: Record<string, number> = {
          'dez': 10000,
          'vinte': 20000,
          'trinta': 30000,
          'quarenta': 40000,
          'cinquenta': 50000,
          'sessenta': 60000,
          'setenta': 70000,
          'oitenta': 80000,
          'noventa': 90000,
          'cem': 100000
        };
        
        const numberWord = match[1].toLowerCase();
        if (wordToNumber[numberWord]) {
          value = wordToNumber[numberWord].toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        }
      }
      // Converter expressões como "10 mil" para formato numérico
      else if (pattern.toString().includes('mil')) {
        const numericPart = parseInt(value.replace(/\D/g, ''));
        value = (numericPart * 1000).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
      
      // Garantir que há dígitos no valor
      if (!/\d/.test(value)) continue;
      
      // Garantir formato correto
      if (!value.includes('R$')) {
        value = `R$ ${value}`;
      }
      
      // Validar que o valor está em uma faixa plausível para empréstimo
      // Extrair apenas os dígitos para validação
      const numericValue = parseInt(value.replace(/\D/g, ''));
      if (numericValue >= 1000 && numericValue <= 200000) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extrai possível finalidade do empréstimo
 */
function extractPurpose(text: string): string | null {
  // Padrões para finalidades comuns
  const patterns = [
    /(?:para|pra)\s+(reforma|comprar|pagar|quitar|ajudar|viajar)/i,
    /preciso\s+(?:do\s+dinheiro\s+)?(?:para|pra)\s+(reforma|reformar|comprar|pagar|quitar|ajudar|viajar)/i,
    /quero\s+(?:fazer\s+um\s+empréstimo\s+)?(?:para|pra)\s+(reforma|reformar|comprar|pagar|quitar|ajudar|viajar)/i,
    /(?:empréstimo|dinheiro)\s+(?:para|pra)\s+(reforma|reformar|comprar|pagar|quitar|ajudar|viajar)/i,
  ];
  
  // Lista de finalidades comuns
  const commonPurposes = [
    'reforma', 'reformar', 'compra', 'comprar', 'pagamento', 'pagar', 
    'quitação', 'quitar', 'ajuda', 'ajudar', 'viagem', 'viajar',
    'saúde', 'tratamento', 'presente', 'dar', 'investimento', 
    'investir', 'emergência', 'casa', 'carro', 'moto'
  ];
  
  // Verificar padrões específicos
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }
  
  // Verificar menções diretas de finalidades comuns
  for (const purpose of commonPurposes) {
    const purposeRegex = new RegExp(`\\b${purpose}\\b`, 'i');
    if (purposeRegex.test(text)) {
      return purpose;
    }
  }

  return null;
}

/**
 * Extrai possível forma de tratamento preferida
 */
function extractPreferredTreatment(text: string): string | null {
  // Padrões para preferências de tratamento
  const patterns = [
    /(?:me chame|pode me chamar|prefiro|me trate|me tratar)\s+(?:de|como)\s+([a-zA-Zà-ú\s]+?)(?:[,.]|$|\s(?:e|mas|porque))/i,
    /(?:pode me chamar|me chame)\s+(?:pelo|por|de)\s+(senhor|senhora|você|seu|dona)/i,
    /(?:prefiro|pode|use)\s+(?:o|a)\s+(senhor|senhora|você|nome)/i,
    /(?:pode me chamar de|me chame de|me trate como|pode me tratar como|prefiro ser chamado de|prefiro que me chame de)\s+([a-zA-Zà-ú\s]+?)(?:[,.]|$)/i,
    /(?:não precisa|sem|nada de)\s+(?:me chamar de|formalidade|me tratar como)\s+(?:o\s+)?(senhor|senhora)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let treatment = match[1].trim().toLowerCase();
      
      // Se for negação de formalidade, padronizar como "você"
      if (pattern.toString().includes('não precisa|sem|nada de')) {
        return "você";
      }
      
      // Padronizar tratamentos
      if (['sr', 'sr.', 'senhor'].includes(treatment)) {
        treatment = "senhor";
      } else if (['sra', 'sra.', 'senhora'].includes(treatment)) {
        treatment = "senhora";
      } else if (['vc', 'voce', 'tu'].includes(treatment)) {
        treatment = "você";
      } else if (['nome'].includes(treatment)) {
        treatment = "nome";
      }
      
      return treatment;
    }
  }

  // Verificar também expressões de informalidade
  if (/(?:pode me chamar|me chame|me trate|prefiro)\s+(?:com|de)\s+você/i.test(text) ||
      /(?:sem formalidade|informal)/i.test(text)) {
    return "você";
  }

  return null;
}

/**
 * Verifica se o texto indica a presença de acompanhante
 */
function hasCompanion(text: string): boolean {
  // Padrões que indicam presença de acompanhante
  const companionPatterns = [
    /estou\s+com\s+m(?:eu|inha)/i,
    /(?:meu|minha)\s+(?:filho|filha|neto|neta|esposo|esposa|marido|mulher|sobrinho|sobrinha|acompanhante)/i,
    /(?:vim|estou|cheguei)\s+acompanhad[oa]/i,
    /(?:trouxe|com)\s+(?:um|uma)\s+acompanhante/i,
    /(?:não )?estou\s+sozinho/i,
    /(?:tem|há)\s+alguém\s+comigo/i,
  ];

  return companionPatterns.some(pattern => pattern.test(text));
}

/**
 * Extrai o tipo de acompanhante mencionado
 */
function extractCompanionType(text: string): string | null {
  if (!hasCompanion(text)) return null;
  
  // Padrões para tipos de acompanhante
  const patterns = [
    /(?:com\s+m(?:eu|inha)|acompanhad[oa] d[oa] m(?:eu|inha))\s+(filho|filha|neto|neta|esposo|esposa|marido|mulher|sobrinho|sobrinha|irmão|irmã|pai|mãe|amigo|amiga)/i,
    /m(?:eu|inha)\s+(filho|filha|neto|neta|esposo|esposa|marido|mulher|sobrinho|sobrinha|irmão|irmã|pai|mãe|amigo|amiga)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const companionType = match[1].toLowerCase();
      
      // Agrupar tipos semelhantes
      if (['filho', 'filha'].includes(companionType)) return 'filho(a)';
      if (['neto', 'neta'].includes(companionType)) return 'neto(a)';
      if (['esposo', 'esposa', 'marido', 'mulher'].includes(companionType)) return 'cônjuge';
      if (['sobrinho', 'sobrinha'].includes(companionType)) return 'outro_familiar';
      if (['irmão', 'irmã', 'pai', 'mãe'].includes(companionType)) return 'outro_familiar';
      if (['amigo', 'amiga'].includes(companionType)) return 'amigo(a)';
      
      return 'outro_familiar';
    }
  }
  
  return 'acompanhante';
}

/**
 * Detecta se o usuário quer encerrar o atendimento
 */
function detectEarlyExitIntent(text: string): boolean {
  const patterns = [
    /\bdesist(?:ir|o|iu)?\b/i,
    /\bcancelar?\b/i,
    /n[aã]o\s+quero/i,
    /deixa\s+pra\s+l[aá]/i,
  ];
  return patterns.some((p) => p.test(text));
}

/**
 * Registra quando a câmera é verificada com sucesso
 */
export function setCameraVerified(verified: boolean): void {
  conversationContext.cameraVerified = verified;
  if (verified) {
    conversationContext.confirmedEntities.add('cameraVerified');
  }
}

/**
 * Ferramenta para animação de valor
 */
export const animateValueTool: Tool = {
  type: "function",
  name: "animate_loan_value",
  description: "Destaca o valor do empréstimo na interface. Use sempre que mencionar o valor solicitado pelo cliente.",
  parameters: { 
    type: "object",
    properties: {
      amount: {
        type: "string",
        description: "Valor do empréstimo a ser destacado (ex: R$ 10.000,00)"
      }
    },
    required: [] 
  },
};

/**
 * Ferramenta para abrir câmera
 */
export const openCameraTool: Tool = {
  type: "function",
  name: "open_camera",
  description:
    "Pede permissão ao usuário e ativa a câmera do dispositivo para verificação. Use em um momento natural da conversa, após explicar a necessidade.",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * Ferramenta para fechar câmera
 */
export const closeCameraTool: Tool = {
  type: "function",
  name: "close_camera",
  description:
    "Fecha a câmera do dispositivo após a verificação estar completa.",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * Ferramenta para verificar compreensão do cliente
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
 * Ferramenta para simplificação de conceitos financeiros
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
 * Ferramenta para incluir acompanhante na conversa
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

/**
 * Ferramenta para consulta de benefício e limites disponíveis
 */
export const consultBenefitTool: Tool = {
  type: "function",
  name: "consult_benefit",
  description:
    "Consulta informações do benefício do cliente para calcular margem e limite",
  parameters: {
    type: "object",
    properties: {
      benefitNumber: {
        type: "string",
        description: "Número do benefício do INSS",
      },
      customerName: {
        type: "string",
        description: "Nome do cliente",
      },
    },
    required: ["benefitNumber"],
  },
};

/**
 * Ferramenta para criação de documentação acessível
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
 * Ferramenta para tratamento de erros de câmera
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
 * Ferramenta para gerar saudação de acordo com o horário
 */
export const timeGreetingTool: Tool = {
  type: "function",
  name: "time_greeting",
  description:
    "Retorna 'Bom dia', 'Boa tarde' ou 'Boa noite' conforme o horário atual.",
  parameters: { type: "object", properties: {}, required: [] }
};

/**
 * Ferramenta para falar a saudação de acordo com o horário
 */
export const sayGreetingTool: Tool = {
  type: "function",
  name: "say_time_greeting",
  description:
    "Retorna a saudação apropriada ('Bom dia', 'Boa tarde' ou 'Boa noite') conforme o horário atual.",
  parameters: { type: "object", properties: {}, required: [] }
};

/**
 * Resetar o contexto da conversa para uma nova interação
 */
export function resetConversationContext(): void {
  conversationContext = {
    confirmedEntities: new Set<string>(),
    previousStates: [],
    currentState: "1_greeting",
    lastInputTime: Date.now(),
    cameraVerified: false,
    lastStateChangeTime: Date.now()
  };
}

/**
 * Exporta o contexto atual para debug ou armazenamento
 */
export function exportContext(): ConversationContext {
  return { ...conversationContext };
}

/**
 * Importa um contexto existente (para retomar conversas)
 */
export function importContext(context: ConversationContext): void {
  conversationContext = { ...context };
}