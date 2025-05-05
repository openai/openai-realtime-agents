"use client";

import { useEffect, useState } from "react";
import { Interview } from "../lib/types";
import NextLink from "next/link";
import { Link as LinkIcon } from "lucide-react";

export default function InterviewList() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedInterviewId, setCopiedInterviewId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/interviews");
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setInterviews(data);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to fetch interviews:", err);
        setError(err.message || "Failed to load interviews");
        setLoading(false);
      }
    };

    fetchInterviews();
  }, []);

  const handleCopyLink = (inviteToken: string, id: string) => {
    if (!inviteToken) return;
    const url = `${window.location.origin}/i/${inviteToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInterviewId(id);
      setTimeout(() => setCopiedInterviewId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 bg-white rounded-lg shadow">
        <div className="animate-pulse text-gray-500">Loading interviews...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg shadow">
        <h3 className="font-bold mb-2">Error loading interviews</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 text-gray-800 p-8 rounded-lg shadow text-center">
        <p className="mb-4">No interviews found. Create an interview to get started.</p>
        <NextLink 
          href="/interviews/create" 
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Create New Interview
        </NextLink>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <h2 className="text-lg font-semibold p-5 border-b bg-gray-50">Interviews</h2>
      <div className="divide-y">
        {interviews.map((interview) => (
          <div key={interview.id} className="p-5 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900 text-lg">{interview.admin_notes || "Untitled Interview"}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Created: {new Date(interview.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    interview.status === "completed" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {interview.status === "completed" ? "Completed" : "Pending"}
                  </span>
                </p>
              </div>
              <div className="flex space-x-3">
                <NextLink 
                  href={`/interviews/${interview.id}`}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
                >
                  View
                </NextLink>
                {interview.status !== "completed" && (
                  <NextLink 
                    href={`/interviews/${interview.id}`}
                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shadow-sm"
                  >
                    Conduct
                  </NextLink>
                )}
                <NextLink 
                  href={`/app?interviewId=${interview.id}`}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors shadow-sm flex items-center"
                >
                  <svg 
                    className="w-4 h-4 mr-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" 
                    />
                  </svg>
                  Launch AI
                </NextLink>
                <button
                  onClick={() => handleCopyLink(interview.invite_token, interview.id)}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors shadow-sm flex items-center"
                >
                  <LinkIcon className="w-4 h-4 mr-1" />
                  {copiedInterviewId === interview.id ? 'Copied!' : 'Share Link'}
                </button>
              </div>
            </div>
            
            {interview.questions && interview.questions.length > 0 && (
              <div className="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Questions:</p>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  {interview.questions.slice(0, 3).map((question) => (
                    <li key={question.id} className="mb-1">
                      {question.text}
                    </li>
                  ))}
                  {interview.questions.length > 3 && (
                    <li className="text-gray-500 italic">
                      +{interview.questions.length - 3} more questions
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 