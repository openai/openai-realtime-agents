// src/app/hooks/useHandleServerEvent.ts

import { ServerEvent, SessionStatus, AgentConfig } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRef, useState, useEffect } from "react";
import { useSimulation } from "../simple/contexts/SimulationContext";
import {
  processUserInputAsync,
  recordStateChange
} from "@/app/agentConfigs/utils";

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
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();

  const { logServerEvent } = useEvent();
  const { simulationMode } = useSimulation();

  // Estado para monitorar se detectamos um valor monetário
  const [detectedAmount, setDetectedAmount] = useState<string | null>(null);

  // UI events state for rendering icons or other UI triggers
  const [, setUIEvents] = useState<{
    name: string;
    icon: string;
    color: string;
  }[]>([]);

  // Debug logs state for inspecting raw events
  const [, setDebugLogs] = useState<any[]>([]);

  // Efeito para ouvir eventos simulados
  useEffect(() => {
    if (!simulationMode) return; // Apenas ouvir no modo simulação
    
    // Handler para eventos simulados de UI
    const handleSimulatedUIEvent = (e: CustomEvent) => {
      if (e.detail) {
        console.log("🧪 Evento UI simulado:", e.detail);
        setUIEvents(prev => [...prev, e.detail]);
      }
    };
    
    // Registrar ouvintes
    document.addEventListener('simulated-ui-event', handleSimulatedUIEvent as EventListener);
    
    // Limpar ouvintes
    return () => {
      document.removeEventListener('simulated-ui-event', handleSimulatedUIEvent as EventListener);
    };
  }, [simulationMode]);

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
      setUIEvents((prev) => [...prev, args]);
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

    // Handling para open_camera - CRUCIAL PARA PRESERVAR O COMPORTAMENTO DO BALÃOZINHO
    if (functionCallParams.name === "open_camera") {
      console.log("[DEBUG] Open camera function call received");
      setDebugLogs((prev) => [...prev, { type: 'open_camera', data: { timestamp: new Date().toISOString() } }]);
      
      // IMPORTANTE: Adicionar um balãozinho em vez de abrir a câmera diretamente
      // Isso mantém o comportamento atual onde o usuário precisa clicar no balão
      addCameraRequest(50); // Posição padrão
      
      // Responder à chamada de função para não deixar a Marlene esperando
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
      
      // Não chamar response.create para permitir que a Marlene continue falando
      return;
    }

    // Handle close_camera
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

    // Handling para animate_loan_value
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
      
      // Criar resposta após a animação
      sendClientEvent({ type: "response.create" });
      return;
    }

    // Existing transferAgents or custom tool logic
    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    if (currentAgent?.toolLogic?.[functionCallParams.name]) {
      const fn = currentAgent.toolLogic[functionCallParams.name];
      const fnResult = await fn(
        JSON.parse(functionCallParams.arguments),
        []
      );
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

  const addCameraRequest = (left: number) => {
    // Função simplificada para adicionar solicitação de câmera
    // No projeto completo, esta função provavelmente existe em outro componente
    document.dispatchEvent(new CustomEvent('add-camera-request', {
      detail: { left }
    }));
  };

  const handleServerEvent = async (serverEvent: ServerEvent) => {
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
          
          // NOVA FUNCIONALIDADE: Processar mensagens do usuário para extrair entidades
          if (role === "user") {
            // Processar a entrada do usuário para extrair entidades e determinar transições
            const processResult = await processUserInputAsync(content);
            
            // Se identificou várias entidades e recomenda mudança de estado
            if (processResult.hasMultipleEntities && 
                processResult.shouldAdvanceState && 
                processResult.recommendedState) {
              
              console.log("🔄 Transição de estado recomendada:", processResult.recommendedState);
              recordStateChange(processResult.recommendedState);
              
              // Se o usuário forneceu múltiplas informações importantes, registrar um evento
              addTranscriptBreadcrumb(
                `Múltiplas informações detectadas: ${Object.keys(processResult.entities)
                  .filter(k => processResult.entities[k as keyof typeof processResult.entities])
                  .join(', ')}`,
                processResult
              );
            }
            
            // Verificar se há valor monetário para animar
            if (processResult.entities.requestedAmount) {
              // Disparar evento para detectar valor monetário
              document.dispatchEvent(new CustomEvent('detect-loan-amount', {
                detail: { amount: processResult.entities.requestedAmount }
              }));
            }
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
            if (role === 'assistant' && detectedAmount) {
              // Para comparar valores, normalize-os primeiro (retirando R$, espaços e pontos)
              const normalizeValue = (val: string) => {
                return val.replace(/[R$\s\.]/g, '').replace(',', '.').toLowerCase();
              };
              
              const normalizedDetectedAmount = normalizeValue(detectedAmount);
              const normalizedAmount = normalizeValue(amount);
              
              // Verifique se o valor detectado é aproximadamente o mesmo
              const detectedNum = parseFloat(normalizedDetectedAmount);
              const currentNum = parseFloat(normalizedAmount);
              
              const closeEnough = Math.abs(detectedNum - currentNum) < 1 || 
                                 content.includes(detectedAmount);
              
              if (closeEnough) {
                console.log("💰 Agent mentioned previously detected amount, triggering animation");
                setTimeout(() => {
                  document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
                }, 500);
              }
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

  // Efeito para processar eventos de função simulados
  useEffect(() => {
    if (!simulationMode) return;
    
    const handleFunctionDetected = (e: CustomEvent) => {
      if (e.detail?.name && e.detail?.arguments) {
        console.log("🧪 Processando chamada de função simulada:", e.detail);
        
        // Simular chamada de função
        handleFunctionCall({
          name: e.detail.name,
          arguments: e.detail.arguments,
          call_id: `simulated-${Date.now()}`
        });
      }
    };
    
    document.addEventListener('function-detected', handleFunctionDetected as EventListener);
    
    return () => {
      document.removeEventListener('function-detected', handleFunctionDetected as EventListener);
    };
  }, [simulationMode]);

  // Wrap in ref to avoid re-creating on each render
  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return handleServerEventRef;
}
