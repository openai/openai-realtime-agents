"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { getInterviewWithRelations } from "@/app/lib/interviewAgentHelper";

interface InterviewExperienceProps {
  interviewId: string;
  isAgentSpeaking: boolean;
  sessionStatus: string;
}

const InterviewExperience: React.FC<InterviewExperienceProps> = ({
  interviewId,
  isAgentSpeaking,
  sessionStatus,
}) => {
  const { transcriptItems } = useTranscript();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const visualizerRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Load interview data
  useEffect(() => {
    const loadInterview = async () => {
      try {
        setLoading(true);
        const data = await getInterviewWithRelations(interviewId);
        
        if (!data) {
          throw new Error("Failed to load interview data");
        }
        
        setInterview(data);
        setLoading(false);
      } catch (err: any) {
        console.error("Error loading interview:", err);
        setError(err.message || "Failed to load interview");
        setLoading(false);
      }
    };
    
    loadInterview();
  }, [interviewId]);

  // Audio visualization effect
  useEffect(() => {
    if (!visualizerRef.current || !isAgentSpeaking) return;
    
    const canvas = visualizerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    let particles: Array<{x: number, y: number, radius: number, speed: number, direction: number}> = [];
    
    // Initialize particles
    const initParticles = () => {
      particles = [];
      const particleCount = 50;
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height / 2 + (Math.random() * 80 - 40),
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 1 + 0.5,
          direction: Math.random() > 0.5 ? 1 : -1,
        });
      }
    };
    
    // Animation function
    const animate = () => {
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw middle line
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.3)';
      ctx.stroke();
      
      // Update and draw particles
      particles.forEach(particle => {
        // Update position with oscillation
        particle.x += particle.speed;
        particle.y = canvas.height / 2 + 
          Math.sin(Date.now() * 0.002 + particle.x * 0.01) * 
          (20 + Math.sin(Date.now() * 0.001) * 15);
        
        // Reset if off screen
        if (particle.x > canvas.width) {
          particle.x = 0;
        }
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(79, 70, 229, 0.7)';
        ctx.fill();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    initParticles();
    animate();
    
    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAgentSpeaking]);

  // Question tracking effect
  useEffect(() => {
    if (!interview || !interview.questions || transcriptItems.length === 0) return;
    
    const questions = interview.questions.map((q: any) => q.text.toLowerCase());
    const lastUserMessages = transcriptItems
      .filter(item => item.role === 'assistant' && !item.isHidden)
      .map(item => item.title)
      .slice(-5)
      .join(' ')
      .toLowerCase();
    
    // Simple detection to match question context in recent messages
    for (let i = 0; i < questions.length; i++) {
      const questionKeywords = questions[i].split(' ')
        .filter((word: string) => word.length > 4) // Only use substantial words
        .slice(0, 5); // Limit to first 5 keywords
      
      const matchCount = questionKeywords.filter((keyword: string) => 
        lastUserMessages.includes(keyword)
      ).length;
      
      // If we have a match with at least 2 keywords and it's not the current question
      if (matchCount >= 2 && i !== currentQuestionIndex) {
        setCurrentQuestionIndex(i);
        // Add to history if not already there
        if (!questionHistory.includes(questions[i])) {
          setQuestionHistory(prev => [...prev, questions[i]]);
        }
        break;
      }
    }
  }, [transcriptItems, interview, currentQuestionIndex, questionHistory]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error || !interview || !interview.questions) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-700 font-medium mb-2">Error</h3>
        <p className="text-red-600">{error || "Failed to load interview questions"}</p>
      </div>
    );
  }

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
      </div>
      
      {/* Voice Visualization */}
      <div className="p-6 bg-gray-50">
        <div className="relative">
          <div className={`mb-3 flex items-center ${isAgentSpeaking ? 'opacity-100' : 'opacity-50'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${isAgentSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className={`text-sm font-medium ${isAgentSpeaking ? 'text-green-700' : 'text-gray-500'}`}>
              {isAgentSpeaking ? 'Agent is speaking...' : 'Agent is listening...'}
            </span>
          </div>
          
          <div className="h-16 w-full bg-white rounded-lg border overflow-hidden">
            {isAgentSpeaking ? (
              <canvas 
                ref={visualizerRef} 
                className="w-full h-full"
              ></canvas>
            ) : (
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
        </div>
      </div>
    </div>
  );
};

export default InterviewExperience; 