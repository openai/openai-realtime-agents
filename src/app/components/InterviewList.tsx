"use client";

import { useEffect, useState } from "react";
import { Interview } from "../lib/types";
import NextLink from "next/link";
import { Link as LinkIcon, MoreVertical } from "lucide-react";

export default function InterviewList() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedInterviewId, setCopiedInterviewId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const handleCopyLink = async (inviteToken: string, id: string) => {
    if (!inviteToken) return;
    const url = `${window.location.origin}/i/${inviteToken}`;

    // Try Web Share API first (better UX on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: "Volta Interview", url });
        setCopiedInterviewId(id);
        return;
      } catch {
        // user cancelled or share failed, fall back below
      }
    }

    // Clipboard API (requires secure context)
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedInterviewId(id);
        setTimeout(() => setCopiedInterviewId(null), 2000);
        return;
      } catch {
        console.warn("Clipboard API failed, falling back");
      }
    }

    // Fallback to textarea + execCommand
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedInterviewId(id);
      setTimeout(() => setCopiedInterviewId(null), 2000);
    } catch {
      alert(`Copy this link: ${url}`);
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
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
              <div className="relative">
                <button
                  onClick={() => toggleMenu(interview.id)}
                  className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {openMenuId === interview.id && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                    <NextLink
                      href={`/interviews/${interview.id}`}
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                    >
                      View Details
                    </NextLink>
                    <NextLink
                      href={`/app?interviewId=${interview.id}`}
                      className="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
                    >
                      Launch AI
                    </NextLink>
                    <button
                      onClick={() => {
                        handleCopyLink(interview.invite_token, interview.id);
                        setOpenMenuId(null);
                      }}
                      className="flex w-full px-4 py-2 text-sm hover:bg-gray-100 text-gray-700 items-center gap-2"
                    >
                      <LinkIcon className="w-4 h-4" />
                      {copiedInterviewId === interview.id ? 'Copied!' : 'Share Link'}
                    </button>
                  </div>
                )}
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