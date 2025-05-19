Visão Geral da Aplicação Simple
A pasta src/app/simple contém uma aplicação completa centrada na assistente Marlene, especializada em orientar pessoas sobre empréstimos consignados, com foco em usuários idosos e com baixo letramento digital. O sistema implementa uma interface que simula um smartphone com verificação facial e animações para valores de empréstimo.
Estrutura de Agentes
Agente Principal: Marlene
A Marlene (src/app/agentConfigs/marlene.ts) é uma assistente de voz para a Credmais, configurada com:
javascriptconst marlene: AgentConfig = {
  name: "marlene",
  publicDescription: "Marlene, atendente de voz da Credmais para crédito consignado.",
  instructions: `
    # Personality and Tone
    ## Identity
    Você é a Marlene, atendente de voz da Credmais, loja autorizada pelo Itaú para crédito consignado...
    ...
  `,
  tools: [
    animateValueTool,
    openCameraTool,
    closeCameraTool,
    verifyUnderstandingTool,
    // outras ferramentas...
  ],
  toolLogic: {
    // implementações das ferramentas
  }
}
Personalidade e Tom
A Marlene foi projetada com características específicas:

Sotaque mineiro suave e acolhedor
Ritmo de fala lento e pausado
Linguagem extremamente simplificada
Uso de analogias e exemplos do cotidiano
Alta empatia e paciência com usuários de baixa literacia digital

Ferramentas Especializadas
O agente utiliza ferramentas personalizadas para melhorar a experiência:

animate_loan_value: Destaca visualmente valores monetários mencionados
open_camera/close_camera: Controla a câmera para verificação de identidade
verify_understanding: Verifica se o cliente compreendeu os termos
simplify_financial_explanation: Traduz conceitos financeiros para analogias simples
consult_benefit: Consulta informações do benefício previdenciário

Aspectos Técnicos e Implementação
Configuração do Ambiente

Configure as variáveis de ambiente em .env.local:
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
NEXT_PUBLIC_USE_LLM_BACKEND=true

Instale as dependências e inicie o servidor:
bashnpm install
npm run dev

Acesse a aplicação em http://localhost:3000/simple

Arquitetura WebRTC
A comunicação com a API Realtime usa WebRTC através de:
javascript// src/app/lib/realtimeConnection.ts
export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // ...
    ],
    iceCandidatePoolSize: 10
  };
  
  const pc = new RTCPeerConnection(pcConfig);
  // Configuração de tracks de áudio
  // ...
  
  // Criação de DataChannel
  const dc = pc.createDataChannel("oai-events", {
    ordered: true,
    maxRetransmits: 3
  });
  
  // Configuração e troca de SDP
  // ...
  
  return { pc, dc };
}
Integração de Máquina de Estados
O fluxo de conversação é gerenciado por:

verificationMachine.ts: Máquina de estados XState que controla o fluxo de verificação
useHandleServerEvent.ts: Hook que processa eventos baseado nos estados

javascript// Exemplo de máquina de estado para verificação
export const verificationMachine = createMachine<Context, Event, State>({
  id: 'verification',
  initial: 'idle',
  states: {
    idle: {
      on: { START: 'preparing' }
    },
    preparing: {
      on: { 
        PROGRESS: 'analyzing',
        ERROR: 'failed',
        CANCEL: 'idle'
      }
    },
    // ...mais estados
  }
});
Processamento de Linguagem Natural
O módulo utils.ts contém funções para extrair informações das mensagens:
javascript// src/app/agentConfigs/utils.ts
export function processUserInput(input: string): ProcessingResult {
  const entities = extractEntities(input);
  const hasMultipleEntities = countSignificantEntities(entities) > 1;
  
  // Determinação do próximo estado baseado nas entidades
  const recommendedState = determineRecommendedState(entities, conversationContext);
  
  // Atualização do contexto da conversa
  updateContext(entities);
  
  return {
    entities,
    hasMultipleEntities,
    shouldAdvanceState: shouldAdvance,
    recommendedState,
    confidence,
    conflictingEntities,
  };
}
Chamada de Funções (Tools)
As ferramentas são definidas e implementadas em marlene.ts e utils.ts:
javascript// Definição
export const animateValueTool: Tool = {
  type: "function",
  name: "animate_loan_value",
  description: "Destaca o valor do empréstimo na interface",
  parameters: { 
    type: "object",
    properties: {
      amount: {
        type: "string",
        description: "Valor do empréstimo a ser destacado"
      }
    },
    required: ["amount"] 
  },
};

// Implementação
animate_loan_value: (args) => {
  console.log(`[toolLogic] Animando valor: ${args.amount}`);
  return { highlightedAmount: args.amount };
},
Simulação para Testes
Para usar o modo de simulação durante o desenvolvimento:

Ative o toggle "Modo Simulação" no canto inferior direito
Use o painel de simulação para:

Simular detecção de valores monetários
Acionar abertura/fechamento de câmera
Testar a animação de valores



Processamento de Eventos
O hook useHandleServerEvent gerencia eventos recebidos da API:
javascriptconst handleServerEvent = async (serverEvent: ServerEvent) => {
  console.log("📡 Server event:", serverEvent.type);
  
  switch (serverEvent.type) {
    case "conversation.item.created": {
      if (serverEvent.item?.type === "message") {
        const role = serverEvent.item.role;
        const content = Array.isArray(serverEvent.item.content) 
          ? serverEvent.item.content[0]?.text || '' 
          : typeof serverEvent.item.content === 'string' 
            ? serverEvent.item.content 
            : '';
        
        // Processar mensagem
        const processResult = await processUserInputAsync(content);
        
        // Detectar valores monetários
        const amount = detectMoneyAmount(content);
        if (amount) {
          document.dispatchEvent(new CustomEvent('detect-loan-amount', {
            detail: { amount }
          }));
        }
      }
      break;
    }
    
    case "response.done":
      if (serverEvent.response?.output) {
        // Processar função chamada pelo agente
        serverEvent.response.output.forEach((outputItem) => {
          if (outputItem.type === "function_call") {
            handleFunctionCall({
              name: outputItem.name,
              call_id: outputItem.call_id,
              arguments: outputItem.arguments,
            });
          }
        });
      }
      break;
  }
};
Integração com o Front-end
Componentes React
A interface é implementada através de componentes React em src/app/simple/components/:
javascript// src/app/simple/components/PhoneMockup.tsx
const PhoneMockup: React.FC = () => {
  // Estados e hooks
  const { uiEvents, cameraRequests, removeCameraRequest } = useUI();
  const { state: cameraState, openCamera } = useCamera();
  const { state: verificationState, startVerification } = useVerification();
  
  return (
    <div className="phone-mockup">
      <StatusBar />
      <BrowserNavbar />
      
      {/* Indicador de verificação */}
      {verificationState.active && <VerificationProgress />}
      
      {/* Preview da câmera */}
      {cameraState.active && <CameraView />}
      
      {/* Animação do valor do empréstimo */}
      <LoanValueAnimation />
      
      <AnimatedFooter />
    </div>
  );
}
Contextos React
A aplicação utiliza vários contextos para gerenciar estado:
javascript// src/app/simple/contexts/UIContext.tsx
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estados UI
  const [uiEvents, setUIEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [loanState, setLoanState] = useState<LoanState>({
    requestedAmount: null,
    showAnimation: false,
    animationProgress: 0
  });
  
  // Função para adicionar evento UI
  const addUIEvent = (event: UIEvent) => {
    setUIEvents(prev => [...prev, event]);
    setTimeout(() => {
      setUIEvents(prev => prev.filter(e => e !== event));
    }, 3000);
  };
  
  // Escuta eventos globais para detecção de valores
  useEffect(() => {
    const handleDetectAmount = (e: CustomEvent) => {
      if (e.detail && e.detail.amount) {
        setRequestedLoanAmount(e.detail.amount);
      }
    };
    
    document.addEventListener('detect-loan-amount', handleDetectAmount as EventListener);
    
    return () => {
      document.removeEventListener('detect-loan-amount', handleDetectAmount as EventListener);
    };
  }, []);
  
  return (
    <UIContext.Provider value={{
      uiEvents,
      cameraRequests,
      loanState,
      addUIEvent,
      // ...outras funções
    }}>
      {children}
    </UIContext.Provider>
  );
};
A aplicação Simple foi projetada para priorizar acessibilidade e simplicidade, utilizando tecnologias modernas para criar uma experiência de conversação natural e adaptada para pessoas com baixo letramento digital, particularmente idosos interessados em empréstimos consignados.