"use client";
import React from "react";
import { SessionStatus } from "@/app/types";

interface VRControlsProps {
    isVRSupported: boolean;
    isVRActive: boolean;
    sessionStatus: SessionStatus;
    showSubtitles: boolean;
    onStartVR: () => void;
    onEndVR: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onToggleSubtitles: () => void;
}

export default function VRControls({
    isVRSupported,
    isVRActive,
    sessionStatus,
    showSubtitles,
    onStartVR,
    onEndVR,
    onConnect,
    onDisconnect,
    onToggleSubtitles
}: VRControlsProps) {

    return (
        <div className="absolute inset-0 pointer-events-none">
            {/* Top Controls */}
            <div className="absolute top-6 right-6 flex flex-col space-y-3 pointer-events-auto">
                {/* VR Toggle */}
                {isVRSupported && (
                    <button
                        onClick={isVRActive ? onEndVR : onStartVR}
                        className={`px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all ${isVRActive
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {isVRActive ? '🥽 Exit VR' : '🥽 Enter VR'}
                    </button>
                )}

                {/* Subtitle Toggle */}
                <button
                    onClick={onToggleSubtitles}
                    className={`px-6 py-3 rounded-lg font-medium shadow-lg transition-all ${showSubtitles
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-600 hover:bg-gray-700 text-white'
                        }`}
                >
                    {showSubtitles ? '💬 Subtitles On' : '💬 Subtitles Off'}
                </button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                {/* Connection Control */}
                <button
                    onClick={sessionStatus === 'CONNECTED' ? onDisconnect : onConnect}
                    disabled={sessionStatus === 'CONNECTING'}
                    className={`px-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-all transform hover:scale-105 ${sessionStatus === 'CONNECTED'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : sessionStatus === 'CONNECTING'
                                ? 'bg-yellow-500 text-white cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                >
                    {sessionStatus === 'CONNECTED' ? '🔌 Disconnect' :
                        sessionStatus === 'CONNECTING' ? '⏳ Connecting...' :
                            '🔌 Connect to Therapist'}
                </button>
            </div>

            {/* VR Not Supported Message */}
            {!isVRSupported && (
                <div className="absolute top-6 left-6 bg-orange-500 text-white p-4 rounded-lg shadow-lg pointer-events-auto max-w-sm">
                    <p className="font-medium">⚠️ VR Not Supported</p>
                    <p className="text-sm mt-1">
                        This device doesn't support WebXR. For the full VR experience, use a VR headset like Meta Quest 3.
                    </p>
                </div>
            )}

            {/* Instructions */}
            {!isVRActive && sessionStatus === 'DISCONNECTED' && (
                <div className="absolute bottom-6 right-6 bg-black/50 text-white p-4 rounded-lg shadow-lg pointer-events-auto max-w-sm">
                    <h3 className="font-bold mb-2">🎯 Getting Started</h3>
                    <ol className="text-sm space-y-1">
                        <li>1. Click "Connect to Therapist"</li>
                        {isVRSupported && <li>2. Click "Enter VR" for immersive experience</li>}
                        <li>{isVRSupported ? '3' : '2'}. Start speaking with your virtual therapist</li>
                    </ol>
                </div>
            )}

            {/* VR Instructions */}
            {isVRActive && (
                <div className="absolute top-1/2 left-6 transform -translate-y-1/2 bg-purple-600/90 text-white p-4 rounded-lg shadow-lg pointer-events-auto max-w-xs">
                    <h3 className="font-bold mb-2">🥽 VR Mode Active</h3>
                    <p className="text-sm">
                        You're now in VR mode. The virtual therapist will appear in your 3D space.
                        Speak naturally to interact.
                    </p>
                </div>
            )}

            {/* Connection Status */}
            {sessionStatus === 'CONNECTED' && (
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full font-medium shadow-lg pointer-events-auto">
                    ✅ Connected to Virtual Therapy
                </div>
            )}
        </div>
    );
} 