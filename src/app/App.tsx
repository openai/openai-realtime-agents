"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { customerServiceRetailScenario } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";
import { customerServiceRetailCompanyName } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { simpleHandoffScenario } from "@/app/agentConfigs/simpleHandoff";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import { fetchResponsesMessage } from "./agentConfigs/chatSupervisor/supervisorAgent";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced 
  // via global codecPatch at module load 

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = agentSetKey === 'customerServiceRetail'
          ? customerServiceRetailCompanyName
          : chatSupervisorCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
            placeEmojiInFront,
          },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    const turnDetection = isPTTActive
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });

    // Send an initial 'hi' message to trigger the agent to greet the user
    if (shouldTriggerResponse) {
      sendSimulatedUserMessage('hi');
    }
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();

    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');

    // No placeholder; we'll rely on server transcript once ready.
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newAgentConfig);
    window.location.replace(url.toString());
  };

  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    // Reconnect session with the newly selected agent as root so that tool
    // execution works correctly.
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
    // connectToRealtime will be triggered by effect watching selectedAgentName
  };

  // Because we need a new connection, refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. 
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  // ---------------------------------------------------------------
  // Simple grid game state: WASD controls a zombie on a square grid
  // ---------------------------------------------------------------
  const GRID_ROWS = 10;
  const GRID_COLS = 10;
  const [playerPos, setPlayerPos] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  type Facing = 'N' | 'E' | 'S' | 'W';
  const [facing, setFacing] = useState<Facing>('S');
  const [heldItemEmoji, setHeldItemEmoji] = useState<string | null>(null);
  const [heldItemAction, setHeldItemAction] = useState<'throw' | 'drop'>('throw');
  const MAX_MANA = 100;
  const [mana, setMana] = useState<number>(100);
  type Projectile = { id: string; row: number; col: number; emoji: string; dir: Facing };
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  type FloatText = { id: string; row: number; col: number; text: string };
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [baseHealth, setBaseHealth] = useState<number>(100);
  type EnemyType = 'chicken' | 'pig' | 'cow' | 't-rex' | 'rocket' | 'robot';
  const ENEMY_EMOJI: Record<EnemyType, string> = {
    chicken: '🐔',
    pig: '🐷',
    cow: '🐄',
    't-rex': '🦖',
    rocket: '🚀',
    robot: '🤖',
  };
  const ENEMY_COST: Record<EnemyType, number> = {
    chicken: 2,
    pig: 3,
    cow: 5,
    't-rex': 15,
    rocket: 12,
    robot: 8,
  };
  type Enemy = { id: string; type: EnemyType; row: number; col: number; emoji: string };
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [manaShakeFlag, setManaShakeFlag] = useState<number>(0);
  // Keep refs in sync so functions shared via extraContext always see latest state
  const playerPosRef = useRef<{ row: number; col: number }>(playerPos);
  const facingRef = useRef<Facing>(facing);
  const heldItemEmojiRef = useRef<string | null>(heldItemEmoji);
  const heldItemActionRef = useRef<'throw' | 'drop'>(heldItemAction);
  const manaRef = useRef<number>(mana);
  const projectilesRef = useRef<Projectile[]>(projectiles);
  const enemiesRef = useRef<Enemy[]>(enemies);
  const projectileTimersRef = useRef<Record<string, number>>({});
  const projectileBusyRef = useRef<Record<string, boolean>>({});
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { facingRef.current = facing; }, [facing]);
  useEffect(() => { heldItemEmojiRef.current = heldItemEmoji; }, [heldItemEmoji]);
  useEffect(() => { heldItemActionRef.current = heldItemAction; }, [heldItemAction]);
  useEffect(() => { manaRef.current = mana; }, [mana]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);

  // Mana regeneration: 5 mana per second
  useEffect(() => {
    const t = window.setInterval(() => {
      setMana((prev) => Math.min(MAX_MANA, prev + 5));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  type BoardCell = { emoji?: string; action?: 'throw' | 'drop' };
  const createInitialBoard = (): BoardCell[][] => {
    const rows: BoardCell[][] = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => ({}) as BoardCell)
    );
    // Place a rock at (5,5)
    if (GRID_ROWS > 5 && GRID_COLS > 5) {
      rows[5][5] = { emoji: '🪨', action: 'drop' };
    }
    return rows;
  };
  const [board, setBoard] = useState<BoardCell[][]>(createInitialBoard);
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);
  const addFloatText = (row: number, col: number, text: string) => {
    const id = uuidv4();
    setFloatTexts((prev) => [...prev, { id, row, col, text }]);
    window.setTimeout(() => {
      setFloatTexts((prev) => prev.filter((f) => f.id !== id));
    }, 750);
  };

  // Fighting overlay state (cells currently resolving a collision)
  const [fightingCells, setFightingCells] = useState<Set<string>>(new Set());
  const fightKey = (r: number, c: number) => `${r},${c}`;
  const startFight = (r: number, c: number) => setFightingCells((prev) => {
    const next = new Set(prev);
    next.add(fightKey(r, c));
    return next;
  });
  const endFight = (r: number, c: number) => setFightingCells((prev) => {
    const next = new Set(prev);
    next.delete(fightKey(r, c));
    return next;
  });

  // Allows tools/agents to place an emoji in the cell in front of the player
  const inBounds = (r: number, c: number) => r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;
  const facingToDelta = (f: Facing) => (
    f === 'N' ? { dRow: -1, dCol: 0 } :
    f === 'S' ? { dRow: 1, dCol: 0 } :
    f === 'W' ? { dRow: 0, dCol: -1 } :
                { dRow: 0, dCol: 1 }
  );
  const reverseFacing = (f: Facing): Facing => (
    f === 'N' ? 'S' : f === 'S' ? 'N' : f === 'E' ? 'W' : 'E'
  );
  const getFrontPos = (pos: { row: number; col: number }, f: Facing) => {
    const { dRow, dCol } = facingToDelta(f);
    return { row: pos.row + dRow, col: pos.col + dCol };
  };

  const onCollide = async (emoji1: string, emoji2: string): Promise<string | null> => {
    try {
      console.log('emojis collided', emoji1, emoji2);
      const response = await fetchResponsesMessage({
        model: "gpt-4o-mini",
        input: [{ type: "message", role: "user", content: `Which one wins in a fight between ${emoji1} and ${emoji2}? Think about classic games like rock, paper, scissors.` }],
        text: {
          format: {
            name: "winner",
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                winner: {
                  type: "string",
                  description: "The emoji that wins the fight"
                }
              },
              required: ["winner"],
              additionalProperties: false
            },
          },
        }
      });
      const winnerString = (response as any).output_text;
      const parsed = JSON.parse(winnerString || '{}');
      const winner = typeof parsed.winner === 'string' ? parsed.winner : null;
      console.log('winner', winner);
      return winner;
    } catch {
      return null;
    }
  };

  const moveHeldOnBoard = async (
    from: { row: number; col: number },
    to: { row: number; col: number }
  ): Promise<boolean> => {
    const emoji = heldItemEmojiRef.current;
    if (!emoji) return false;
    if (!inBounds(to.row, to.col)) return false;

    const destEmoji = boardRef.current[to.row]?.[to.col]?.emoji;
    if (destEmoji) {
      startFight(to.row, to.col);
      const winner = await onCollide(emoji, destEmoji);
      endFight(to.row, to.col);
      if (winner !== emoji) {
        return false;
      }
      // Held wins: destroy destination emoji and move held into cell, preserving action
      setBoard((prev) => {
        const next = prev.map((r) => r.slice());
        if (inBounds(from.row, from.col) && next[from.row][from.col]?.emoji === emoji) {
          next[from.row][from.col] = {} as any;
        }
        next[to.row][to.col] = { emoji, action: heldItemActionRef.current };
        return next;
      });
      return true;
    }

    // No collision, just move held, preserving action
    setBoard((prev) => {
      const next = prev.map((r) => r.slice());
      if (inBounds(from.row, from.col) && next[from.row][from.col]?.emoji === emoji) {
        next[from.row][from.col] = {} as any;
      }
      next[to.row][to.col] = { emoji, action: heldItemActionRef.current };
      return next;
    });
    return true;
  };

  const stepProjectile = async (id: string) => {
    if (projectileBusyRef.current[id]) return;
    const p = projectilesRef.current.find((q) => q.id === id);
    if (!p) return;
    const { dRow, dCol } = facingToDelta(p.dir);
    const nextRow = p.row + dRow;
    const nextCol = p.col + dCol;
    // Projectile vs enemy collision at next cell
    const enemyAtNext = enemiesRef.current.find((en) => en.row === nextRow && en.col === nextCol);
    if (enemyAtNext) {
      projectileBusyRef.current[id] = true;
      startFight(nextRow, nextCol);
      const winner = await onCollide(p.emoji, enemyAtNext.emoji);
      endFight(nextRow, nextCol);
      projectileBusyRef.current[id] = false;
      if (winner === p.emoji) {
        // Remove enemy, move projectile into that cell
        setEnemies((arr) => arr.filter((en) => en.id !== enemyAtNext.id));
        const newArr = projectilesRef.current.map((q) => q.id === id ? { ...q, row: nextRow, col: nextCol } : q);
        setProjectiles(newArr);
        projectilesRef.current = newArr;
        return;
      } else if (winner === enemyAtNext.emoji) {
        // Destroy projectile, enemy survives
        const newArr = projectilesRef.current.filter((q) => q.id !== id);
        setProjectiles(newArr);
        projectilesRef.current = newArr;
        const t = projectileTimersRef.current[id];
        if (t) { clearInterval(t); delete projectileTimersRef.current[id]; }
        return;
      } else {
        // Unknown/tie: both removed
        setEnemies((arr) => arr.filter((en) => en.id !== enemyAtNext.id));
        const newArr = projectilesRef.current.filter((q) => q.id !== id);
        setProjectiles(newArr);
        projectilesRef.current = newArr;
        const t = projectileTimersRef.current[id];
        if (t) { clearInterval(t); delete projectileTimersRef.current[id]; }
        return;
      }
    }
    if (!inBounds(nextRow, nextCol)) {
      // Bounce: reverse direction and move one cell back the way it came
      const rev = reverseFacing(p.dir);
      const { dRow: rRow, dCol: rCol } = facingToDelta(rev);
      const bounceRow = p.row + rRow;
      const bounceCol = p.col + rCol;
      if (!inBounds(bounceRow, bounceCol)) {
        // If still invalid, just flip dir and stay in place this tick
        const newArrStay = projectilesRef.current.map((q) => q.id === id ? { ...q, dir: rev } : q);
        setProjectiles(newArrStay);
        projectilesRef.current = newArrStay;
        return;
      }
      const boardEmojiAtBounce = boardRef.current[bounceRow]?.[bounceCol]?.emoji;
      if (boardEmojiAtBounce) {
        projectileBusyRef.current[id] = true;
        startFight(bounceRow, bounceCol);
        const winner = await onCollide(p.emoji, boardEmojiAtBounce);
        endFight(bounceRow, bounceCol);
        projectileBusyRef.current[id] = false;
        if (winner === p.emoji) {
          // Clear board and move projectile into bounce cell with reversed dir
          setBoard((prev) => {
            const next = prev.map((r) => r.slice());
            next[bounceRow][bounceCol] = {} as any;
            return next;
          });
          const newArr = projectilesRef.current.map((q) => q.id === id ? { ...q, row: bounceRow, col: bounceCol, dir: rev } : q);
          setProjectiles(newArr);
          projectilesRef.current = newArr;
          return;
        } else if (winner === boardEmojiAtBounce) {
          // Board wins: destroy projectile
          const newArr = projectilesRef.current.filter((q) => q.id !== id);
          setProjectiles(newArr);
          projectilesRef.current = newArr;
          const t = projectileTimersRef.current[id];
          if (t) {
            clearInterval(t);
            delete projectileTimersRef.current[id];
          }
          return;
        } else {
          // Unknown: do nothing this tick
          return;
        }
      }
      // No board on bounce cell: just update projectile to bounce cell and reverse dir
      const newArr = projectilesRef.current.map((q) => q.id === id ? { ...q, row: bounceRow, col: bounceCol, dir: rev } : q);
      setProjectiles(newArr);
      projectilesRef.current = newArr;
      return;
    }
    // Check projectile vs projectile collisions (same-target or swap-crossing)
    const others = projectilesRef.current.filter((q) => q.id !== id);
    const pNextKey = `${nextRow},${nextCol}`;
    let handledProjectileCollision = false;
    for (const q of others) {
      // Predict q's next (ignore bounce for this detection)
      const d2 = facingToDelta(q.dir);
      const qNext = { row: q.row + d2.dRow, col: q.col + d2.dCol };
      const qNextKey = `${qNext.row},${qNext.col}`;
      const qCurrentKey = `${q.row},${q.col}`;
      const pCurrentKey = `${p.row},${p.col}`;
      const isSameTarget = qNextKey === pNextKey;
      const isSwapCross = qNext.row === p.row && qNext.col === p.col && nextRow === q.row && nextCol === q.col;
      if (isSameTarget || isSwapCross) {
        // Single-resolver to avoid double-handling: lowest id lexically
        const leaderId = id < q.id ? id : q.id;
        if (id !== leaderId) {
          handledProjectileCollision = true; // the other will handle
          break;
        }
        projectileBusyRef.current[id] = true;
        projectileBusyRef.current[q.id] = true;
        startFight(nextRow, nextCol);
        const winner = await onCollide(p.emoji, q.emoji);
        endFight(nextRow, nextCol);
        projectileBusyRef.current[id] = false;
        projectileBusyRef.current[q.id] = false;
        if (winner === p.emoji) {
          // Remove q, move p to its next, keep p.dir
          const newArr = projectilesRef.current.filter((r) => r.id !== q.id).map((r) => r.id === id ? { ...r, row: nextRow, col: nextCol } : r);
          setProjectiles(newArr);
          projectilesRef.current = newArr;
          const tq = projectileTimersRef.current[q.id];
          if (tq) { clearInterval(tq); delete projectileTimersRef.current[q.id]; }
        } else if (winner === q.emoji) {
          // Remove p, q continues (into its own next)
          const newArr = projectilesRef.current.filter((r) => r.id !== id).map((r) => r.id === q.id ? { ...r, row: qNext.row, col: qNext.col } : r);
          setProjectiles(newArr);
          projectilesRef.current = newArr;
          const tp = projectileTimersRef.current[id];
          if (tp) { clearInterval(tp); delete projectileTimersRef.current[id]; }
        } else {
          // Unknown/tie: both removed
          const newArr = projectilesRef.current.filter((r) => r.id !== id && r.id !== q.id);
          setProjectiles(newArr);
          projectilesRef.current = newArr;
          const tp = projectileTimersRef.current[id];
          if (tp) { clearInterval(tp); delete projectileTimersRef.current[id]; }
          const tq = projectileTimersRef.current[q.id];
          if (tq) { clearInterval(tq); delete projectileTimersRef.current[q.id]; }
        }
        handledProjectileCollision = true;
        break;
      }
    }
    if (handledProjectileCollision) return;

    const boardEmoji = boardRef.current[nextRow]?.[nextCol]?.emoji;
    if (boardEmoji) {
      projectileBusyRef.current[id] = true;
      startFight(nextRow, nextCol);
      const winner = await onCollide(p.emoji, boardEmoji);
      endFight(nextRow, nextCol);
      projectileBusyRef.current[id] = false;
      if (winner === p.emoji) {
        // Destroy board emoji and continue moving
        setBoard((prev) => {
          const next = prev.map((r) => r.slice());
          next[nextRow][nextCol] = {} as any;
          return next;
        });
        const newArr = projectilesRef.current.map((q) => q.id === id ? { ...q, row: nextRow, col: nextCol } : q);
        setProjectiles(newArr);
        projectilesRef.current = newArr;
        return;
      } else if (winner === boardEmoji) {
        // Destroy projectile
        const newArr = projectilesRef.current.filter((q) => q.id !== id);
        setProjectiles(newArr);
        projectilesRef.current = newArr;
        const t = projectileTimersRef.current[id];
        if (t) {
          clearInterval(t);
          delete projectileTimersRef.current[id];
        }
        return;
      } else {
        // Unknown or tie - hold position this tick
        return;
      }
    }
    const newArr = projectilesRef.current.map((q) => q.id === id ? { ...q, row: nextRow, col: nextCol } : q);
    setProjectiles(newArr);
    projectilesRef.current = newArr;
  };

  const addProjectile = (start: { row: number; col: number }, dir: Facing, emoji: string) => {
    const id = uuidv4();
    setProjectiles((prev) => [...prev, { id, row: start.row, col: start.col, emoji, dir }]);
    const timer = window.setInterval(() => { void stepProjectile(id); }, 250);
    projectileTimersRef.current[id] = timer;
  };

  // ---------------------------------------------------------------
  // Enemies: spawn from bottom row and move upwards toward the base (top row)
  // ---------------------------------------------------------------
  const spawnEnemy = () => {
    const types: EnemyType[] = ['chicken', 'pig', 'cow', 't-rex', 'rocket', 'robot'];
    const type = types[Math.floor(Math.random() * types.length)];
    // Restrict spawn to the rightmost 3 columns
    const lanes = Math.min(3, GRID_COLS);
    const startCol = Math.max(0, GRID_COLS - lanes);
    const col = startCol + Math.floor(Math.random() * lanes);
    const id = uuidv4();
    setEnemies((prev) => [...prev, { id, type, emoji: ENEMY_EMOJI[type], row: GRID_ROWS - 1, col }]);
  };

  const moveEnemiesUp = async () => {
    const prev = enemiesRef.current;
    const next: Enemy[] = [];
    for (const e of prev) {
      const targetRow = e.row - 1;
      const targetCol = e.col;
      if (targetRow < 0) {
        // Reached/over base – remove and show hit feedback and deduct health if within base lanes
        const lanes = Math.min(3, GRID_COLS);
        const startCol = Math.max(0, GRID_COLS - lanes);
        if (e.col >= startCol) {
          const dmg = ENEMY_COST[e.type] ?? 1;
          setBaseHealth((h) => Math.max(0, h - dmg));
          addFloatText(0, e.col, `-${dmg}`);
        } else {
          addFloatText(0, e.col, '💥');
        }
        continue;
      }

      // Check collision with projectile currently at target
      const projectileAtTarget = projectilesRef.current.find((p) => p.row === targetRow && p.col === targetCol);
      if (projectileAtTarget) {
        startFight(targetRow, targetCol);
        const winner = await onCollide(projectileAtTarget.emoji, e.emoji);
        endFight(targetRow, targetCol);
        if (winner === projectileAtTarget.emoji) {
          // Projectile wins: enemy destroyed; projectile remains
          continue;
        } else if (winner === e.emoji) {
          // Enemy wins: destroy projectile and move enemy into target
          setProjectiles((arr) => arr.filter((q) => q.id !== projectileAtTarget.id));
          const t = projectileTimersRef.current[projectileAtTarget.id];
          if (t) { clearInterval(t); delete projectileTimersRef.current[projectileAtTarget.id]; }
          next.push({ ...e, row: targetRow });
          continue;
        } else {
          // Unknown/tie: hold positions (enemy doesn't move this tick)
          next.push(e);
          continue;
        }
      }

      // Check collision with board item (includes dropped and actively-held items)
      const boardEmojiAtTarget = boardRef.current[targetRow]?.[targetCol]?.emoji;
      if (boardEmojiAtTarget) {
        startFight(targetRow, targetCol);
        const winner = await onCollide(e.emoji, boardEmojiAtTarget);
        endFight(targetRow, targetCol);
        if (winner === e.emoji) {
          // Enemy wins: clear board emoji and move enemy
          setBoard((prevBoard) => {
            const copy = prevBoard.map((r) => r.slice());
            copy[targetRow][targetCol] = {} as any;
            return copy;
          });
          // If the destroyed board item was the player's actively held item in front, clear held state
          const front = getFrontPos(playerPosRef.current, facingRef.current);
          if (
            heldItemEmojiRef.current &&
            front.row === targetRow &&
            front.col === targetCol &&
            heldItemEmojiRef.current === boardEmojiAtTarget
          ) {
            setHeldItemEmoji(null);
            heldItemEmojiRef.current = null;
            setHeldItemAction('throw');
            heldItemActionRef.current = 'throw';
          }
          next.push({ ...e, row: targetRow });
          continue;
        } else if (winner === boardEmojiAtTarget) {
          // Board item wins: enemy destroyed
          continue;
        } else {
          // Unknown/tie: do not move
          next.push(e);
          continue;
        }
      }

      // No collisions; move enemy up
      next.push({ ...e, row: targetRow });
    }
    setEnemies(next);
  };

  // Spawn a new enemy every 1.5s
  useEffect(() => {
    const t = window.setInterval(spawnEnemy, 4000);
    return () => clearInterval(t);
  }, []);

  // Move enemies upward every 700ms
  useEffect(() => {
    const t = window.setInterval(moveEnemiesUp, 750);
    return () => clearInterval(t);
  }, []);

  const placeEmojiInFront = (
    objectName: { name: string; emoji: string; action?: 'throw' | 'drop'; cost?: number }
  ): 'ok' | 'no_mana' | 'no_space' => {
    const pos = playerPosRef.current;
    const face = facingRef.current;
    const target = getFrontPos(pos, face);
    if (!inBounds(target.row, target.col)) return 'no_space';
    const action = objectName.action ?? 'throw';
    const cost = typeof (objectName as any).cost === 'number' ? (objectName as any).cost : 0;
    if (manaRef.current < cost) {
      console.warn('Not enough mana');
      // trigger mana bar shake
      setManaShakeFlag((n) => n + 1);
      return 'no_mana';
    }
    if (cost > 0) {
      setMana((prev) => Math.max(0, prev - cost));
    }
    // Behavior by action: default to 'throw'
    // Always hold first; placement is determined by action on spacebar
    setHeldItemEmoji(objectName.emoji);
    heldItemEmojiRef.current = objectName.emoji;
    setHeldItemAction(action);
    heldItemActionRef.current = action;

    // Place visually in front only if action is currently 'throw' (so it follows)
    // For 'drop', we still show it in front as held-following until user presses space to drop.
    setBoard((prev) => {
      const next = prev.map((r) => r.slice());
      next[target.row][target.col] = { emoji: objectName.emoji, action };
      return next;
    });
    if (cost > 0) addFloatText(target.row, target.col, `-${cost}`);
    return 'ok';
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'q') {
        e.preventDefault();
        const order: Facing[] = ['N', 'E', 'S', 'W'];
        const idx = order.indexOf(facingRef.current);
        const nextFacing = k === 'e'
          ? order[(idx + 1) % order.length]
          : order[(idx + order.length - 1) % order.length];
        if (heldItemEmojiRef.current) {
          const currentHeld = getFrontPos(playerPosRef.current, facingRef.current);
          const nextHeld = getFrontPos(playerPosRef.current, nextFacing);
          if (!inBounds(nextHeld.row, nextHeld.col)) {
            return; // block turn if held would go off-board
          }
          void moveHeldOnBoard(currentHeld, nextHeld);
        }
        setFacing(nextFacing);
        return;
      }

      if (k === ' ') {
        e.preventDefault();
        const front = getFrontPos(playerPosRef.current, facingRef.current);
        if (!heldItemEmojiRef.current) {
          // Try pick up if facing a droppable item
          if (inBounds(front.row, front.col)) {
            const cell = boardRef.current[front.row][front.col];
            if (cell?.emoji && (cell.action ?? 'throw') === 'drop') {
              const emoji = cell.emoji;
              setHeldItemEmoji(emoji);
              heldItemEmojiRef.current = emoji;
              setHeldItemAction('drop');
              heldItemActionRef.current = 'drop';
              // Do not clear the board here; leave it visible as held in front.
            }
          }
        } else {
          // We are holding something: act based on action
          const start = front;
          if (inBounds(start.row, start.col)) {
            const emoji = heldItemEmojiRef.current;
            const action = heldItemActionRef.current;
            if (action === 'throw') {
              // Clear from board and fire projectile
              setBoard((prev) => {
                const next = prev.map((r) => r.slice());
                next[start.row][start.col] = {} as any;
                return next;
              });
              setHeldItemEmoji(null);
              heldItemEmojiRef.current = null;
              if (emoji) addProjectile(start, facingRef.current, emoji);
            } else {
              // drop: leave emoji on the board and release hold
              setHeldItemEmoji(null);
              heldItemEmojiRef.current = null;
              setHeldItemAction('throw');
              heldItemActionRef.current = 'throw';
            }
          }
        }
        return;
      }

      let dRow = 0;
      let dCol = 0;
      if (k === 'w') dRow = -1;
      else if (k === 's') dRow = 1;
      else if (k === 'a') dCol = -1;
      else if (k === 'd') dCol = 1;
      else return;

      e.preventDefault();
      const current = playerPosRef.current;
      const next = {
        row: Math.max(0, Math.min(GRID_ROWS - 1, current.row + dRow)),
        col: Math.max(0, Math.min(GRID_COLS - 1, current.col + dCol)),
      };
      if (heldItemEmojiRef.current) {
        const currentHeld = getFrontPos(current, facingRef.current);
        const nextHeld = getFrontPos(next, facingRef.current);
        if (!inBounds(nextHeld.row, nextHeld.col)) {
          return; // block move if held would go off-board
        }
        void moveHeldOnBoard(currentHeld, nextHeld);
      }
      setPlayerPos(next);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <div>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
        <div className="flex items-center">
          <label className="flex items-center text-base gap-1 mr-2 font-medium">
            Scenario
          </label>
          <div className="relative inline-block">
            <select
              value={agentSetKey}
              onChange={handleAgentChange}
              className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
            >
              {Object.keys(allAgentSets).map((agentKey) => (
                <option key={agentKey} value={agentKey}>
                  {agentKey}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {agentSetKey && (
            <div className="flex items-center ml-6">
              <label className="flex items-center text-base gap-1 mr-2 font-medium">
                Agent
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedAgentName}
                  onChange={handleSelectedAgentChange}
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
                >
                  {selectedAgentConfigSet?.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-1 items-center justify-start p-4 gap-2">
        {/* Mana bar */}
        <ManaBar mana={mana} maxMana={MAX_MANA} shakeKey={manaShakeFlag} />
        <div
          className="grid w-full max-w-[min(90vmin,640px)]"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
          aria-label="zombie-grid"
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
            const row = Math.floor(idx / GRID_COLS);
            const col = idx % GRID_COLS;
            const isPlayer = row === playerPos.row && col === playerPos.col;
            const isDark = (row + col) % 2 === 1;
            const dotPosClass = facing === 'N'
              ? 'top-1 left-1/2 -translate-x-1/2'
              : facing === 'E'
                ? 'right-1 top-1/2 -translate-y-1/2'
                : facing === 'S'
                  ? 'bottom-1 left-1/2 -translate-x-1/2'
                  : 'left-1 top-1/2 -translate-y-1/2';
            const cell = board[row]?.[col];
            const projectileHere = projectiles.find((p) => p.row === row && p.col === col);
            const enemyHere = enemies.find((en) => en.row === row && en.col === col);
            const isFighting = fightingCells.has(fightKey(row, col));
            const floatsHere = floatTexts.filter((f) => f.row === row && f.col === col);
            const lanes = Math.min(3, GRID_COLS);
            const baseStartCol = Math.max(0, GRID_COLS - lanes);
            const isBaseLaneTop = row === 0 && col >= baseStartCol;
            const baseHealthFraction = baseHealth / 100;
            const barFill = isBaseLaneTop ? Math.max(0, Math.min(1, baseHealthFraction)) : 0;
            return (
              <div
                key={`${row}-${col}`}
                className={`aspect-square relative flex items-center justify-center border border-gray-300 text-2xl select-none ${isDark ? 'bg-gray-200' : 'bg-white'}`}
              >
                {cell?.emoji ? (
                  <span className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" role="img" aria-label="cell-emoji">{cell.emoji}</span>
                ) : null}
                {projectileHere ? (
                  <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="img" aria-label="projectile">{projectileHere.emoji}</span>
                ) : null}
                {enemyHere ? (
                  <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="img" aria-label="enemy">{enemyHere.emoji}</span>
                ) : null}
                {isFighting ? (
                  <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" role="img" aria-label="fighting">🥊</span>
                ) : null}
                {floatsHere.map((f) => (
                  <span key={f.id} className="absolute z-30 float-fade" style={{ top: '0.25rem' }}>{f.text}</span>
                ))}
                {isBaseLaneTop ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 z-20 bg-gray-300">
                    <div className="h-1 bg-red-500" style={{ width: `${barFill * 100}%` }} />
                  </div>
                ) : null}
                {isPlayer ? (
                  <>
                    <span role="img" aria-label="zombie" className="z-10">🧟</span>
                    <span
                      className={`pointer-events-none absolute ${dotPosClass} w-2 h-2 rounded-full bg-gray-800 z-10`}
                    />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          downloadRecording={downloadRecording}
          canSend={
            sessionStatus === "CONNECTED"
          }
        />

        <Events isExpanded={isEventsPaneExpanded} />
      </div>

      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={onToggleConnection}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        codec={urlCodec}
        onCodecChange={handleCodecChange}
      />
    </div>
  );
}

export default App;

function ManaBar({ mana, maxMana, shakeKey }: { mana: number; maxMana: number; shakeKey: number }) {
  return (
    <div className={`w-full max-w-[min(90vmin,640px)] ${shakeKey ? 'shake-red' : ''}`} key={shakeKey}>
      <div className="text-sm mb-1">Mana: {mana}/{maxMana}</div>
      <div className="w-full h-3 bg-gray-300 rounded overflow-hidden">
        <div
          className="mana-fill h-3 bg-blue-500"
          style={{ width: `${(mana / maxMana) * 100}%` }}
        />
      </div>
    </div>
  );
}
