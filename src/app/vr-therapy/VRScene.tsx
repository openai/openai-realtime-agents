"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { SessionStatus } from "@/app/types";
import { ThreeJSScene } from "./ThreeJSScene";

interface VRSceneProps {
    isVRActive: boolean;
    currentAgent: string;
    xrSession: any; // XRSession type
    showSubtitles: boolean;
    sessionStatus: SessionStatus;
}

export default function VRScene({
    isVRActive,
    currentAgent,
    xrSession,
    showSubtitles,
    sessionStatus
}: VRSceneProps) {
    const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneManagerRef = useRef<ThreeJSScene | null>(null);
    const [isSceneLoaded, setIsSceneLoaded] = useState(false);

    const { transcriptItems } = useTranscript();

    // Initialize Three.js scene
    useEffect(() => {
        if (!canvasRef.current || sceneManagerRef.current) return;

        try {
            sceneManagerRef.current = new ThreeJSScene(canvasRef.current);
            setIsSceneLoaded(true);
            console.log('3D scene initialized successfully');
        } catch (error) {
            console.warn('Three.js not available, falling back to 2D avatars:', error);
            setIsSceneLoaded(false);
        }

        return () => {
            if (sceneManagerRef.current) {
                sceneManagerRef.current.dispose();
                sceneManagerRef.current = null;
            }
        };
    }, []);

    // Note: Window resize handling will be added when DOM types are available

    // Get latest transcript for subtitles
    useEffect(() => {
        const latestMessage = transcriptItems[transcriptItems.length - 1];
        if (latestMessage && latestMessage.type === 'MESSAGE' && latestMessage.role === 'assistant') {
            setCurrentSubtitle(latestMessage.title || "");

            // Start speaking animation
            if (sceneManagerRef.current) {
                sceneManagerRef.current.startSpeaking();

                // Stop speaking after estimated duration
                const estimatedDuration = (latestMessage.title?.length || 0) * 100; // ~100ms per character
                setTimeout(() => {
                    sceneManagerRef.current?.stopSpeaking();
                }, estimatedDuration);
            }
        }
    }, [transcriptItems]);

    // Update scene based on current agent
    useEffect(() => {
        if (sceneManagerRef.current && isSceneLoaded) {
            sceneManagerRef.current.switchToAvatar(currentAgent);
            console.log(`3D Scene: Switched to agent ${currentAgent}`);
        }
    }, [currentAgent, isSceneLoaded]);

    // Update VR mode
    useEffect(() => {
        if (sceneManagerRef.current && isSceneLoaded) {
            sceneManagerRef.current.setVRMode(isVRActive);
        }
    }, [isVRActive, isSceneLoaded]);

    const getAgentInfo = () => {
        switch (currentAgent) {
            case 'greeterTherapist':
                return {
                    name: 'Intake Coordinator',
                    color: '#4F46E5', // Indigo
                    description: 'Welcoming you to the therapy session'
                };
            case 'virtualTherapist':
                return {
                    name: 'Dr. Therapy',
                    color: '#059669', // Emerald
                    description: 'Your virtual therapist'
                };
            default:
                return {
                    name: 'Assistant',
                    color: '#6B7280', // Gray
                    description: 'AI Assistant'
                };
        }
    };

    const agentInfo = getAgentInfo();

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600">
            {/* Three.js Canvas for 3D Scene */}
            <canvas
                ref={canvasRef}
                className="w-full h-full absolute inset-0"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }}
            />

            {/* 2D Fallback when Three.js is not available */}
            {!isSceneLoaded && (
                <>
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/80 via-purple-500/80 to-indigo-600/80 animate-pulse" />

                    {/* 2D Avatar Fallback */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            {/* Simple Avatar Representation */}
                            <div
                                className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold shadow-lg"
                                style={{ backgroundColor: agentInfo.color }}
                            >
                                {currentAgent === 'greeterTherapist' ? '👋' : '🧠'}
                            </div>

                            {/* Agent Name */}
                            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                                {agentInfo.name}
                            </h2>

                            {/* Session Status */}
                            <div className="text-lg text-white/80 mb-4 drop-shadow">
                                {sessionStatus === 'CONNECTED' ? agentInfo.description : 'Not Connected'}
                            </div>

                            {/* Connection Status Indicator */}
                            <div className="flex items-center justify-center space-x-2">
                                <div
                                    className={`w-3 h-3 rounded-full ${sessionStatus === 'CONNECTED' ? 'bg-green-400' :
                                        sessionStatus === 'CONNECTING' ? 'bg-yellow-400 animate-pulse' :
                                            'bg-red-400'
                                        }`}
                                />
                                <span className="text-white/80 text-sm">
                                    {sessionStatus === 'CONNECTED' ? 'Connected' :
                                        sessionStatus === 'CONNECTING' ? 'Connecting...' :
                                            'Disconnected'}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 3D Scene Status */}
            {isSceneLoaded && (
                <div className="absolute top-4 right-4 bg-green-600/80 text-white px-3 py-1 rounded-lg text-sm">
                    ✨ 3D Mode Active
                </div>
            )}

            {/* Subtitle Display */}
            {showSubtitles && currentSubtitle && (
                <div className="absolute bottom-20 left-0 right-0 px-8">
                    <div className="bg-black/70 text-white p-4 rounded-lg max-w-4xl mx-auto text-center">
                        <p className="text-lg leading-relaxed">
                            {currentSubtitle}
                        </p>
                    </div>
                </div>
            )}

            {/* VR Mode Indicator */}
            {isVRActive && (
                <div className="absolute top-4 left-4 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    VR Mode Active
                </div>
            )}
        </div>
    );
} 