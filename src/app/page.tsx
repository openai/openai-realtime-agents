import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Volta Research Platform</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Platform Features</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>Run voice-based research interviews using AI assistant</li>
            <li>Collect structured feedback on support engagements</li>
            <li>Generate insights from interview transcripts</li>
            <li>Manage and track multiple interviews</li>
          </ul>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/interviews" className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold text-blue-600 mb-2">Interview Management</h2>
            <p className="text-gray-600 mb-4">
              View, create, and manage research interviews to collect feedback on support engagements.
            </p>
            <span className="text-blue-600 font-medium">View Interviews →</span>
          </Link>
          
          <div className="block bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">AI Agent Settings</h2>
            <p className="text-gray-600 mb-4">
              Configure the AI interviewer&apos;s behavior, voice, and question flow for optimal feedback collection.
            </p>
            <Link 
              href="/app"
              className="inline-block px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              Go to Agent Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
