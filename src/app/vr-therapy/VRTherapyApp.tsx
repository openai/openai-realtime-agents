"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { SessionStatus } from "@/app/types";
import { virtualTherapistScenario } from "@/app/agentConfigs/virtualTherapist";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";
import { virtualTherapistCompanyName } from "@/app/agentConfigs/virtualTherapist";
import VRScene from "./VRScene";
import VRControls from "./VRControls";

// WebXR types
declare global {
    interface Navigator {
        xr?: XRSystem;
    }

    interface XRSystem {
        isSessionSupported(mode: string): Promise<boolean>;
        requestSession(mode: string, options?: any): Promise<XRSession>;
    }

    interface XRSession {
        addEventListener(type: string, listener: EventListener): void;
        removeEventListener(type: string, listener: EventListener): void;
        end(): Promise<void>;
        requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
    }

    interface XRReferenceSpace { }
}

export default function VRTherapyApp() {
    const [isVRSupported, setIsVRSupported] = useState(false);
    const [isVRActive, setIsVRActive] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [currentAgent, setCurrentAgent] = useState<string>("greeterTherapist");

    const xrSessionRef = useRef<XRSession | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    const { addTranscriptBreadcrumb } = useTranscript();
    const { logClientEvent, logServerEvent } = useEvent();

    // Initialize audio element for WebXR
    const sdkAudioElement = React.useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        const el = document.createElement('audio');
        el.autoplay = true;
        el.style.display = 'none';
        // For VR, we want spatial audio
        el.setAttribute('crossorigin', 'anonymous');
        document.body.appendChild(el);
        return el;
    }, []);

    useEffect(() => {
        if (sdkAudioElement && !audioElementRef.current) {
            audioElementRef.current = sdkAudioElement;
        }
    }, [sdkAudioElement]);

    const {
        connect,
        disconnect,
        sendEvent,
        interrupt,
        mute,
    } = useRealtimeSession({
        onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
        onAgentHandoff: (agentName: string) => {
            setCurrentAgent(agentName);
        },
    });

    // Check WebXR support
    useEffect(() => {
        const checkVRSupport = async () => {
            if (navigator.xr) {
                try {
                    const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
                    setIsVRSupported(isSupported);
                } catch (error) {
                    console.log('WebXR not supported:', error);
                    setIsVRSupported(false);
                }
            } else {
                setIsVRSupported(false);
            }
        };

        checkVRSupport();
    }, []);

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

    const startVRSession = async () => {
        if (!navigator.xr || !isVRSupported) {
            alert('WebXR is not supported on this device');
            return;
        }

        try {
            const session = await navigator.xr.requestSession('immersive-vr', {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['hand-tracking', 'bounded-floor']
            });

            xrSessionRef.current = session;
            setIsVRActive(true);

            session.addEventListener('end', () => {
                setIsVRActive(false);
                xrSessionRef.current = null;
            });

            console.log('VR session started');
        } catch (error) {
            console.error('Failed to start VR session:', error);
            alert('Failed to start VR session. Make sure you\'re using a VR headset.');
        }
    };

    const endVRSession = async () => {
        if (xrSessionRef.current) {
            await xrSessionRef.current.end();
        }
    };

    const connectToTherapy = async () => {
        if (sessionStatus !== "DISCONNECTED") return;
        setSessionStatus("CONNECTING");

        try {
            const EPHEMERAL_KEY = await fetchEphemeralKey();
            if (!EPHEMERAL_KEY) return;

            const guardrail = createModerationGuardrail(virtualTherapistCompanyName);

            await connect({
                getEphemeralKey: async () => EPHEMERAL_KEY,
                initialAgents: virtualTherapistScenario,
                audioElement: sdkAudioElement,
                outputGuardrails: [guardrail],
                extraContext: {
                    addTranscriptBreadcrumb,
                },
            });
        } catch (err) {
            console.error("Error connecting to therapy session:", err);
            setSessionStatus("DISCONNECTED");
        }
    };

    const disconnectFromTherapy = () => {
        disconnect();
        setSessionStatus("DISCONNECTED");
    };

    return (
        <div className="w-full h-screen bg-gradient-to-b from-blue-50 to-indigo-100 relative overflow-hidden">
            {/* VR Scene - This will contain the 3D environment */}
            <VRScene
                isVRActive={isVRActive}
                currentAgent={currentAgent}
                xrSession={xrSessionRef.current}
                showSubtitles={showSubtitles}
                sessionStatus={sessionStatus}
            />

            {/* VR Controls - Overlay for non-VR or settings */}
            <VRControls
                isVRSupported={isVRSupported}
                isVRActive={isVRActive}
                sessionStatus={sessionStatus}
                showSubtitles={showSubtitles}
                onStartVR={startVRSession}
                onEndVR={endVRSession}
                onConnect={connectToTherapy}
                onDisconnect={disconnectFromTherapy}
                onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
            />

            {/* Hidden audio element for spatial audio */}
            {sdkAudioElement && (
                <div style={{ display: 'none' }}>
                    <audio ref={audioElementRef} />
                </div>
            )}
        </div>
    );
} 