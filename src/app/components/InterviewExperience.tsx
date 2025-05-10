"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import type { InterviewWithRelations as InterviewData } from "@/app/lib/interviewClientHelper";

interface InterviewExperienceProps {
  interviewData: InterviewData;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isAgentThinking: boolean;
  sessionStatus: string;
  agentStatusMessage: string;
}

const InterviewExperience: React.FC<InterviewExperienceProps> = ({
  interviewData,
  isAgentSpeaking,
  isUserSpeaking,
  isAgentThinking,
  sessionStatus,
  agentStatusMessage,
}) => {
  const { transcriptItems } = useTranscript();
  const interview = interviewData;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const visualizerRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [hasFirstQuestionBeenAsked, setHasFirstQuestionBeenAsked] = useState(false);

  // Audio visualization effect
  useEffect(() => {
    // If canvas ref is not set, or neither agent nor user is speaking, do nothing or clear.
    if (!visualizerRef.current || (!isAgentSpeaking && !isUserSpeaking)) {
      if (visualizerRef.current) {
        const canvas = visualizerRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    const canvas = visualizerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    let particles: Array<{x: number, y: number, radius: number, speed: number, directionFactor: number}> = []; // Added directionFactor

    // Determine active speaker for styling
    const agentColor = 'rgba(79, 70, 229, 0.7)'; // Indigo
    const agentLineColor = 'rgba(79, 70, 229, 0.3)';
    const userColor = 'rgba(14, 165, 233, 0.7)'; // Sky Blue
    const userLineColor = 'rgba(14, 165, 233, 0.3)';

    let particleFillColor;
    let middleLineColor;
    let particleDirectionFactor;

    if (isUserSpeaking) { // User speaking takes visual priority
      particleFillColor = userColor;
      middleLineColor = userLineColor;
      particleDirectionFactor = -1; // RTL for user
    } else if (isAgentSpeaking) { // Agent speaking, user is not
      particleFillColor = agentColor;
      middleLineColor = agentLineColor;
      particleDirectionFactor = 1; // LTR for agent
    } else {
      // This case should ideally not be hit if the effect guard condition is correct,
      // but as a fallback, ensure no animation or clear.
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      ctx.clearRect(0,0,canvas.width, canvas.height);
      return; // Do not proceed with particle animation if neither is speaking
    }
    
    const initParticles = () => {
      particles = [];
      const particleCount = 50;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height / 2 + (Math.random() * 80 - 40),
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 1 + 0.5,
          directionFactor: particleDirectionFactor, // Use determined direction
        });
      }
    };
    
    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = middleLineColor;
      ctx.stroke();
      
      particles.forEach(particle => {
        particle.x += particle.speed * particle.directionFactor; // Apply direction
        particle.y = canvas.height / 2 + 
          Math.sin(Date.now() * 0.002 + particle.x * 0.01) * 
          (20 + Math.sin(Date.now() * 0.001) * 15);
        
        // Reset based on direction
        if (particle.directionFactor > 0 && particle.x > canvas.width) { // LTR
          particle.x = 0;
        } else if (particle.directionFactor < 0 && particle.x < 0) { // RTL
          particle.x = canvas.width;
        }
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particleFillColor;
        ctx.fill();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    initParticles();
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isAgentSpeaking, isUserSpeaking]); // Added isUserSpeaking to dependencies

  // Question tracking effect – track progress without causing infinite re-renders
  useEffect(() => {
    if (!interview || !interview.questions || transcriptItems.length === 0) return;
    
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\w\s]/g, "");

    const lastAssistantMsg = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant" && !item.isHidden);

    if (!lastAssistantMsg) return;

    const msgNorm = normalize(lastAssistantMsg.title || "");

    for (let i = 0; i < interview.questions.length; i++) {
      const qNorm = normalize(interview.questions[i].text);
      const words = qNorm.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      const overlap = words.filter((w) => msgNorm.includes(w)).length;
      const ratio = overlap / words.length;

      const isFirstQuestionMatch = !hasFirstQuestionBeenAsked && i === 0;
      const isNextSequential = i === currentQuestionIndex + 1;

      if ((ratio >= 0.6 && (isFirstQuestionMatch || isNextSequential))) {
        setCurrentQuestionIndex(i);
        setQuestionHistory((prev) => {
          if (prev.includes(interview.questions[i].text.toLowerCase())) return prev;
          return [...prev, interview.questions[i].text.toLowerCase()];
        });
        if (isFirstQuestionMatch) setHasFirstQuestionBeenAsked(true);
        break;
      }
    }
  }, [transcriptItems, interview]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            {interview.company ? interview.company.business_name : "Interview"} - {interview.person ? `${interview.person.first_name} ${interview.person.last_name}` : "Candidate"}
          </h2>
          
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            sessionStatus === "CONNECTED" 
              ? "bg-green-100 text-green-800" 
              : sessionStatus === "CONNECTING" 
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}>
            {sessionStatus === "CONNECTED" 
              ? "Live" 
              : sessionStatus === "CONNECTING" 
              ? "Connecting..."
              : "Disconnected"}
          </div>
        </div>
      </div>
      
      {/* Question Tracker */}
      <div className="p-6 border-b">
        {!hasFirstQuestionBeenAsked ? (
          <div className="text-center text-gray-600 py-8">
            The agent is preparing to begin the interview. Please listen for instructions.
          </div>
        ) : (
          <>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-md font-medium text-gray-700">Current Discussion</h3>
            <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {interview.questions.length}</span>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <p className="text-indigo-900 font-medium">{interview.questions[currentQuestionIndex].text}</p>
            {interview.questions[currentQuestionIndex].context && (
              <p className="text-indigo-700 text-sm mt-2">{interview.questions[currentQuestionIndex].context}</p>
            )}
          </div>
        </div>
        {/* Progress indicator */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-indigo-600 h-2.5 rounded-full" 
            style={{ width: `${((currentQuestionIndex + 1) / interview.questions.length) * 100}%` }}
          ></div>
        </div>
        {/* Question history */}
        {questionHistory.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Covered Questions</h4>
            <div className="space-y-1">
              {questionHistory.map((question, idx) => (
                <div key={idx} className="text-xs bg-gray-100 px-3 py-1.5 rounded-md text-gray-700">
                  {question.length > 70 ? question.substring(0, 70) + '...' : question}
                </div>
              ))}
            </div>
          </div>
            )}
          </>
        )}
      </div>
      
      {/* Voice Visualization */}
      <div className="p-6 bg-gray-50">
        <div className="relative">
          <div className={`mb-3 flex items-center ${isAgentSpeaking || isUserSpeaking || isAgentThinking ? 'opacity-100' : 'opacity-50'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${
              isUserSpeaking 
                ? 'bg-blue-500'
                : isAgentThinking 
                ? 'bg-yellow-400'
                : isAgentSpeaking
                ? 'bg-green-500'
                : 'bg-gray-400 opacity-50'
            }
            ${ !(isUserSpeaking || isAgentThinking || isAgentSpeaking) ? 'opacity-50 !animate-none' : '' }
            `}></div>
            <span className={`text-sm font-medium ${ 
              isUserSpeaking 
                ? 'text-blue-700' 
                : isAgentThinking
                ? 'text-yellow-700'
                : 'text-gray-700'
            }`}>
              {agentStatusMessage}
            </span>
          </div>
          
          <div className="h-16 w-full bg-white rounded-lg border overflow-hidden">
            {(isAgentSpeaking || isUserSpeaking || isAgentThinking) ? (
              <canvas 
                ref={visualizerRef} 
                className="w-full h-full"
              ></canvas>
            ) : (
              // Default static mic icon when no one is speaking
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center px-2">
            All information collected is considered <span className="font-semibold">confidential</span> and will not be shared with anyone outside the authorized Volta team you are working with.
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewExperience; 