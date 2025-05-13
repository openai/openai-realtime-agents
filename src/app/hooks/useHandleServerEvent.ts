import { ServerEvent, SessionStatus, AgentConfig } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRef, useState } from "react";

export interface UseHandleServerEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentName: string;
  selectedAgentConfigSet: AgentConfig[] | null;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setSelectedAgentName: (name: string) => void;
  shouldForceResponse?: boolean;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentName,
  selectedAgentConfigSet,
  sendClientEvent,
  setSelectedAgentName,
}: UseHandleServerEventParams) {
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  // Estado para monitorar se detectamos um valor monetário
  const [detectedAmount, setDetectedAmount] = useState<string | null>(null);

  // UI events state for rendering icons or other UI triggers
  const [uiEvents, setUiEvents] = useState<{
    name: string;
    icon: string;
    color: string;
  }[]>([]);

  // Debug logs state for inspecting raw events
  const [debugLogs, setDebugLogs] = useState<any[]>([]);

  // Função para detectar valores monetários em texto
  const detectMoneyAmount = (text: string): string | null => {
    // Padrão para detectar valores monetários (R$ 1.000,00 ou 1000 ou mil)
    const moneyRegex = /R\$\s*(\d{1,3}(\.\d{3})*(\,\d{1,2})?|\d+)|(\d+)\s*(mil|milhão|milhões)/i;
    const match = text.match(moneyRegex);
    
    if (match) {
      console.log("💰 Detected money amount in text:", match[0]);
      let amount = match[0];
      
      // Se for "mil" ou similar, converter para número
      if (match[5] && match[4]) {
        const baseNumber = parseInt(match[4], 10);
        if (match[5].toLowerCase() === 'mil') {
          amount = `R$ ${(baseNumber * 1000).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;
        } else if (match[5].toLowerCase() === 'milhão' || match[5].toLowerCase() === 'milhões') {
          amount = `R$ ${(baseNumber * 1000000).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;
        }
      }
      
      // Se não começar com R$, adicionar
      if (!amount.startsWith('R$')) {
        amount = `R$ ${amount}`;
      }
      
      return amount;
    }
    
    return null;
  };

  const handleFunctionCall = async (functionCallParams: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    // Log function call for debugging
    console.log("🛠️ Function call received:", functionCallParams.name);
    setDebugLogs((prev) => [...prev, { type: 'function_call', data: functionCallParams }]);

    // Special handling for UI events
    if (functionCallParams.name === "ui_event") {
      const args = JSON.parse(functionCallParams.arguments);
      console.log("🎮 UI Event args:", args);
      setDebugLogs((prev) => [...prev, { type: 'ui_event_args', data: args }]);
      // Push to uiEvents state for rendering in the UI
      setUiEvents((prev) => [...prev, args]);
      // Retornar sucesso para a chamada de função
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify({ success: true }),
        },
      });
      return;
    }

    // Handling for animate_loan_value
    if (functionCallParams.name === "animate_loan_value") {
      console.log("💰 ANIMATE_LOAN_VALUE chamada detectada!");
      
      // Tente extrair informações dos argumentos
      try {
        const args = JSON.parse(functionCallParams.arguments || "{}");
        console.log("💰 Argumentos da função:", args);
        
        // Usar valor dos argumentos ou um valor padrão
        const valueToUse = args.amount || detectedAmount || 'R$ 12.000,00';
        console.log("💰 Valor a ser usado:", valueToUse);
        
        // Definir o valor no aplicativo
        document.dispatchEvent(new CustomEvent('detect-loan-amount', {
          detail: { amount: valueToUse }
        }));
        
        // Aguardar um pouco para garantir que o valor foi definido
        setTimeout(() => {
          console.log("💰 Disparando animação após definir valor");
          document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
        }, 500);
      } catch (e) {
        console.error("Erro ao processar argumentos:", e);
        
        // Usar valor padrão em caso de erro
        const fallbackValue = detectedAmount || 'R$ 15.000,00';
        console.log("💰 Usando valor padrão:", fallbackValue);
        
        document.dispatchEvent(new CustomEvent('detect-loan-amount', {
          detail: { amount: fallbackValue }
        }));
        
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
        }, 500);
      }
      
      // Retornar resultado da função
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify({ 
            success: true,
            timestamp: new Date().toISOString()
          }),
        },
      });
      
      return;
    }

    // Handle camera functions
    if (functionCallParams.name === "open_camera") {
      console.log("[DEBUG] Open camera function call received");
      setDebugLogs((prev) => [...prev, { type: 'open_camera', data: { timestamp: new Date().toISOString() } }]);
      
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify({ 
            success: true,
            timestamp: new Date().toISOString()
          }),
        },
      });
      sendClientEvent({ type: "response.create" });
      return;
    }

    if (functionCallParams.name === "close_camera") {
      console.log("[DEBUG] Close camera function call received");
      setDebugLogs((prev) => [...prev, { type: 'close_camera', data: { timestamp: new Date().toISOString() } }]);
      
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify({ 
            success: true,
            timestamp: new Date().toISOString()
          }),
        },
      });
      sendClientEvent({ type: "response.create" });
      return;
    }
    
    // Existing transferAgents or custom tool logic
    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    if (currentAgent?.toolLogic?.[functionCallParams.name]) {
      const fn = currentAgent.toolLogic[functionCallParams.name];
      const fnResult = await fn(JSON.parse(functionCallParams.arguments), transcriptItems);
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(fnResult),
        },
      });
      sendClientEvent({ type: "response.create" });
      return;
    }

    if (functionCallParams.name === "transferAgents") {
      // ... existing transferAgents logic ...
      const args = JSON.parse(functionCallParams.arguments);
      const destinationAgent = args.destination_agent;
      const newAgentConfig = selectedAgentConfigSet?.find(
        (a) => a.name === destinationAgent
      );
      if (newAgentConfig) setSelectedAgentName(destinationAgent);
      const functionCallOutput = { destination_agent: destinationAgent, did_transfer: !!newAgentConfig };
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(functionCallOutput),
        },
      });
      addTranscriptBreadcrumb(`function call: transferAgents response`, functionCallOutput);
      return;
    }

    // Fallback for other function calls
    const simulatedResult = { result: true };
    sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: functionCallParams.call_id,
        output: JSON.stringify(simulatedResult),
      },
    });
    sendClientEvent({ type: "response.create" });
  };

  const handleServerEvent = (serverEvent: ServerEvent) => {
    console.log("📡 Server event:", serverEvent.type);
    setDebugLogs((prev) => [...prev, { type: 'server_event', data: serverEvent }]);

    logServerEvent(serverEvent);

    switch (serverEvent.type) {
      case "session.created":
        if (serverEvent.session?.id) {
          setSessionStatus("CONNECTED");
          addTranscriptBreadcrumb(
            `session.id: ${serverEvent.session.id}\nStarted at: ${new Date().toLocaleString()}`
          );
        }
        break;

      case "conversation.item.created": {
        // Handle message creation
        if (serverEvent.item?.type === "message") {
          const role = serverEvent.item.role;
          const content = Array.isArray(serverEvent.item.content) 
            ? serverEvent.item.content[0]?.text || '' 
            : typeof serverEvent.item.content === 'string' 
              ? serverEvent.item.content 
              : '';
          
          // Adicionar à transcrição se necessário
          if (role && serverEvent.item.id) {
            const isHidden = false; // ou alguma lógica para determinar se é oculto
            addTranscriptMessage(serverEvent.item.id, role, content, isHidden);
          }
          
          // Detectar padrões monetários em qualquer mensagem
          const amount = detectMoneyAmount(content);
          if (amount) {
            console.log(`💰 Detected money amount in ${role} message:`, amount);
            setDetectedAmount(amount);
            
            // Disparar evento para detect-loan-amount - será capturado pelo UIContext
            document.dispatchEvent(new CustomEvent('detect-loan-amount', {
              detail: { amount }
            }));
            
            // Se for uma mensagem do agente mencionando o valor que detectamos do usuário,
            // podemos também acionar a animação diretamente
            if (role === 'assistant' && detectedAmount && content.includes(detectedAmount)) {
              console.log("💰 Agent mentioned previously detected amount, triggering animation");
              setTimeout(() => {
                document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
              }, 500);
            }
          }
        }
        break;
      }

      case "response.audio_transcript.delta": {
        // Analisar o delta de transcrição para detectar valores monetários
        if (serverEvent.delta) {
          const amount = detectMoneyAmount(serverEvent.delta);
          if (amount) {
            console.log("💰 Detected money amount in audio transcript:", amount);
            setDetectedAmount(amount);
            
            // Disparar evento para detect-loan-amount
            document.dispatchEvent(new CustomEvent('detect-loan-amount', {
              detail: { amount }
            }));
          }
        }
        break;
      }

      case "response.done":
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (
              outputItem.type === "function_call" &&
              outputItem.name &&
              outputItem.arguments
            ) {
              handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: outputItem.arguments,
              });
            }
          });
        }
        break;

      case "response.output_item.done":
        if (serverEvent.item?.id) {
          updateTranscriptItemStatus(serverEvent.item.id, "DONE");
        }
        break;
        
      case "audio_started":
        console.log("🔊 Audio started event received");
        setDebugLogs((prev) => [...prev, { type: 'audio_started', data: serverEvent }]);
        break;
        
      case "audio_ended":
        console.log("🔇 Audio ended event received");
        setDebugLogs((prev) => [...prev, { type: 'audio_ended', data: serverEvent }]);
        break;

      default:
        break;
    }
  };

  // Wrap in ref to avoid re-creating on each render
  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return { handleServerEventRef, uiEvents, debugLogs };
}