"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getInterviewWithRelationsClient as getInterviewWithRelations } from "@/app/lib/interviewClientHelper";
import InterviewConnectForm from "@/app/components/InterviewConnectForm";

export default function InterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const interviewId = params.id as string;

  useEffect(() => {
    if (!interviewId) return;
    
    fetchInterviewData();
  }, [interviewId]);

  const fetchInterviewData = async () => {
    try {
      setLoading(true);
      
      const interviewData = await getInterviewWithRelations(interviewId);
      
      if (!interviewData) {
        setError("Failed to load interview data");
        setLoading(false);
        return;
      }

      setInterview(interviewData);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching interview:", error);
      setError(error.message || "Failed to load interview data");
      setLoading(false);
    }
  };

  const startInterviewSession = () => {
    router.push(`/app?interviewId=${interviewId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 p-4 rounded-md">
          <h2 className="text-red-800 font-medium">Error</h2>
          <p className="text-red-600">{error}</p>
          <Link 
            href="/interviews"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/interviews" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Back to Interviews
          </Link>
          <h1 className="text-2xl font-bold">Interview Details</h1>
        </div>
        {interview.status !== 'completed' && (
          <button
            onClick={startInterviewSession}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start Interview Session
          </button>
        )}
        {interview.status === 'completed' && (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
            This interview has been completed
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-medium mb-4">General Information</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Interview ID</dt>
                <dd className="font-mono text-sm">{interview.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    interview.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {interview.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </dd>
              </div>
              {interview.completed_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Completed Date</dt>
                  <dd>{new Date(interview.completed_at).toLocaleString()}</dd>
                </div>
              )}
              {interview.admin_notes && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Admin Notes</dt>
                  <dd>{interview.admin_notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            {interview.company && (
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2">Company Information</h3>
                <dl className="space-y-1">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd>{interview.company.business_name}</dd>
                  </div>
                  {interview.company.description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd>{interview.company.description}</dd>
                    </div>
                  )}
                  {interview.company.province && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Location</dt>
                      <dd>{interview.company.province}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {interview.person && (
              <div>
                <h3 className="text-md font-medium mb-2">Contact Information</h3>
                <dl className="space-y-1">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd>{interview.person.first_name} {interview.person.last_name}</dd>
                  </div>
                  {interview.person.title && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Title</dt>
                      <dd>{interview.person.title}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {interview.support_engagement && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Support Engagement</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Title</dt>
              <dd>{interview.support_engagement.title}</dd>
            </div>
            {interview.support_engagement.description && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd>{interview.support_engagement.description}</dd>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd>{interview.support_engagement.support_type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    interview.support_engagement.status === 'Completed' 
                      ? 'bg-green-100 text-green-800' 
                      : interview.support_engagement.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {interview.support_engagement.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Date Identified</dt>
                <dd>{new Date(interview.support_engagement.date_identified).toLocaleDateString()}</dd>
              </div>
            </div>
          </dl>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Interview Questions</h2>
          {interview.questions && interview.questions.length > 0 ? (
            <ol className="list-decimal pl-5 space-y-3">
              {interview.questions.map((question: any) => (
                <li key={question.id} className="pl-1">
                  <p className="font-medium">{question.text}</p>
                  {question.context && (
                    <p className="text-sm text-gray-600 mt-1">{question.context}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500">No questions have been added to this interview.</p>
          )}
        </div>

        <div>
          <InterviewConnectForm 
            interviewId={interviewId} 
            initialCompanyId={interview.company_id}
            initialPersonId={interview.person_id}
            initialSupportEngagementId={interview.support_engagement_id}
          />
        </div>
      </div>

      {interview.interview_data && interview.interview_data.messages && interview.interview_data.messages.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Interview Transcript</h2>
          <p className="text-sm text-gray-500 mb-3">
            Last updated: {new Date(interview.interview_data.metadata.last_updated).toLocaleString()}
          </p>
          
          <div className="space-y-4 max-h-96 overflow-y-auto p-2">
            {interview.interview_data.messages.map((message: any) => (
              <div 
                key={message.id} 
                className={`p-3 rounded-lg ${
                  message.role === 'assistant' 
                    ? 'bg-blue-50 border-l-4 border-blue-400' 
                    : 'bg-gray-50 border-l-4 border-gray-400'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">
                    {message.role === 'assistant' ? 'Agent' : 'User'}
                  </span>
                  <span className="text-xs text-gray-500">{message.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Total messages: {interview.interview_data.metadata.message_count}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 