"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentConfig } from "@/app/types";
import { getInterviewWithRelations, createInterviewAgentConfig } from "@/app/lib/interviewAgentHelper";
import Link from "next/link";

interface InterviewAgentProps {
  onAgentConfigLoaded: (config: AgentConfig) => void;
}

const InterviewAgent: React.FC<InterviewAgentProps> = ({ onAgentConfigLoaded }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("interviewId");
    if (!id) {
      setError("No interview ID provided");
      setLoading(false);
      return;
    }

    setInterviewId(id);
    loadInterviewData(id);
  }, [searchParams]);

  const loadInterviewData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const interviewData = await getInterviewWithRelations(id);
      
      if (!interviewData) {
        setError("Failed to load interview data");
        setLoading(false);
        return;
      }

      if (!interviewData.questions || interviewData.questions.length === 0) {
        setError("This interview has no questions");
        setLoading(false);
        return;
      }

      // Create agent config based on interview data
      const agentConfig = createInterviewAgentConfig(interviewData);
      
      // Pass the config to parent component
      onAgentConfigLoaded(agentConfig);
      
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading interview data:", err);
      setError(err.message || "Failed to load interview data");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="animate-pulse text-center py-4">
          <p>Loading interview data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-700 font-medium mb-2">Error</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Link 
          href="/interviews"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back to Interviews
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Active Interview Session</h3>
        <Link 
          href={`/interviews`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Interviews
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-2">
        Interview ID: <span className="font-mono text-xs">{interviewId}</span>
      </p>
      <p className="text-green-600 text-sm">
        ✓ Interview data loaded successfully
      </p>
    </div>
  );
};

export default InterviewAgent; 