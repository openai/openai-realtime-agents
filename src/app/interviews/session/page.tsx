"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InterviewExperience from "@/app/components/InterviewExperience";
import InterviewAgent from "@/app/components/InterviewAgent";
import { useEvent } from "@/app/contexts/EventContext";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import Link from "next/link";

export default function InterviewSessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = searchParams.get("id");
  const { transcriptItems, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent } = useEvent();
  
  const [sessionStatus, setSessionStatus] = useState<string>("DISCONNECTED");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [agentConfigLoaded, setAgentConfigLoaded] = useState(false);

  useEffect(() => {
    if (!interviewId) {
      router.push("/interviews");
    }
  }, [interviewId, router]);

  // Monitor transcript to detect when agent is speaking
  useEffect(() => {
    if (transcriptItems.length === 0) return;

    // Find the most recent assistant message
    const latestAssistantMessage = [...transcriptItems]
      .reverse()
      .find(item => item.role === "assistant" && !item.isHidden);

    if (latestAssistantMessage && latestAssistantMessage.status === "IN_PROGRESS") {
      setIsAgentSpeaking(true);
    } else {
      setIsAgentSpeaking(false);
    }
  }, [transcriptItems]);

  const handleAgentConfigLoaded = () => {
    setAgentConfigLoaded(true);
    logClientEvent({}, "interview_config_loaded");
  };

  // You may implement session status handling in the future

  // If no interview ID provided, show error
  if (!interviewId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-red-600 text-xl font-medium mb-4">Missing Interview ID</h2>
          <p className="text-gray-600 mb-6">No interview ID was provided. Please select an interview from the list.</p>
          <Link 
            href="/interviews"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Interviews
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Interview Session</h1>
          <Link 
            href={`/interviews/${interviewId}`}
            className="text-blue-600 hover:text-blue-800"
          >
            Exit Session
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Interview Experience */}
          <div className="lg:col-span-1">
            <InterviewExperience 
              interviewId={interviewId}
              isAgentSpeaking={isAgentSpeaking}
              sessionStatus={sessionStatus}
            />
            
            {/* Hidden InterviewAgent to handle connection */}
            <div className="hidden">
              <InterviewAgent 
                onAgentConfigLoaded={(_config) => {
                  handleAgentConfigLoaded();
                  // The App component will get the config through its own mechanisms
                }}
              />
            </div>
            
            {/* Status display */}
            <div className="mt-4 bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
              <h3 className="font-medium text-gray-800 mb-2">Interview Status</h3>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    sessionStatus === "CONNECTED" ? "bg-green-500" : 
                    sessionStatus === "CONNECTING" ? "bg-yellow-500" : "bg-red-500"
                  }`}></div>
                  <span className="text-sm">
                    Connection: {sessionStatus}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${agentConfigLoaded ? "bg-green-500" : "bg-gray-300"}`}></div>
                  <span className="text-sm">
                    Agent Config: {agentConfigLoaded ? "Loaded" : "Not Loaded"}
                  </span>
                </div>
              </div>
              
              {/* Quick instructions */}
              <div className="mt-4 text-xs text-gray-600 p-3 bg-gray-50 rounded">
                <p className="font-medium mb-1">Quick Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Click &quot;Complete Interview&quot; when you&apos;ve finished all questions</li>
                  <li>The transcript is saved automatically</li>
                  <li>Questions are tracked as they come up in conversation</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Right column - Main conversation area (handled by App.tsx) */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border-l-4 border-indigo-500">
              <h2 className="text-lg font-medium text-gray-800 mb-2">Interview Conversation</h2>
              <p className="text-gray-600 text-sm">
                The conversation with the AI interviewer appears below. Speak naturally or type your responses.
              </p>
            </div>
            
            {/* The main app will automatically load in this area */}
            <div className="flex-1 bg-transparent rounded-lg overflow-hidden">
              {/* App.tsx content renders here through layout */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 