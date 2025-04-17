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

  // UI events state for rendering icons or other UI triggers
  const [uiEvents, setUiEvents] = useState<{
    name: string;
    icon: string;
    color: string;
  }[]>([]);

  // Debug logs state for inspecting raw events
  const [debugLogs, setDebugLogs] = useState<any[]>([]);

  const handleFunctionCall = async (functionCallParams: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    // Log function call for debugging
    console.log("[DEBUG] Function call received:", functionCallParams);
    setDebugLogs((prev) => [...prev, { type: 'function_call', data: functionCallParams }]);

    // Special handling for UI events
    if (functionCallParams.name === "ui_event") {
      const args = JSON.parse(functionCallParams.arguments);
      console.log("[DEBUG] UI Event args:", args);
      setDebugLogs((prev) => [...prev, { type: 'ui_event_args', data: args }]);
      // Push to uiEvents state for rendering in the UI
      setUiEvents((prev) => [...prev, args]);
      // Optionally you could send back a confirmation to the agent
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
    console.log("[DEBUG] Server event:", serverEvent);
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
        // ... existing logic ...
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

      // ... other cases remain unchanged ...

      default:
        break;
    }
  };

  // Wrap in ref to avoid re-creating on each render
  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return { handleServerEventRef, uiEvents, debugLogs };
}
