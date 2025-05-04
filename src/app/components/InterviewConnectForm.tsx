"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface InterviewConnectFormProps {
  interviewId: string;
  initialCompanyId?: string;
  initialPersonId?: string;
  initialSupportEngagementId?: string;
}

interface Company {
  id: string;
  business_name: string;
}

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  title?: string;
}

interface SupportEngagement {
  id: string;
  title: string;
  support_type: string;
}

export default function InterviewConnectForm({
  interviewId,
  initialCompanyId,
  initialPersonId,
  initialSupportEngagementId,
}: InterviewConnectFormProps) {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [engagements, setEngagements] = useState<SupportEngagement[]>([]);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId || "");
  const [selectedPersonId, setSelectedPersonId] = useState<string>(initialPersonId || "");
  const [selectedEngagementId, setSelectedEngagementId] = useState<string>(initialSupportEngagementId || "");
  
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Load reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      setLoading(true);
      try {
        // Fetch companies
        const companiesResponse = await fetch("/api/companies");
        if (companiesResponse.ok) {
          const companiesData = await companiesResponse.json();
          setCompanies(companiesData);
        }

        // Fetch people
        const peopleResponse = await fetch("/api/people");
        if (peopleResponse.ok) {
          const peopleData = await peopleResponse.json();
          setPeople(peopleData);
        }

        // Fetch support engagements
        const engagementsResponse = await fetch("/api/engagements");
        if (engagementsResponse.ok) {
          const engagementsData = await engagementsResponse.json();
          setEngagements(engagementsData);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching reference data:", err);
        setError("Failed to load reference data");
        setLoading(false);
      }
    };

    fetchReferenceData();
  }, []);

  // Filter people and engagements when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      // Could add additional filtering by company if needed
    }
  }, [selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/interviews/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interviewId,
          companyId: selectedCompanyId || null,
          personId: selectedPersonId || null,
          supportEngagementId: selectedEngagementId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect interview");
      }

      setSuccess(true);
      setSaving(false);
      
      // Refresh the page or redirect after successful save
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error("Error connecting interview:", err);
      setError(err.message || "An error occurred while saving");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse text-center py-4">
        <p>Loading data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">Connect Interview Data</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
          Interview connections updated successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">-- Select a company --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.business_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person
          </label>
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">-- Select a person --</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.first_name} {person.last_name} {person.title ? `(${person.title})` : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Support Engagement
          </label>
          <select
            value={selectedEngagementId}
            onChange={(e) => setSelectedEngagementId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">-- Select an engagement --</option>
            {engagements.map((engagement) => (
              <option key={engagement.id} value={engagement.id}>
                {engagement.title} ({engagement.support_type})
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
              saving ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {saving ? "Saving..." : "Connect Data"}
          </button>
        </div>
      </form>
    </div>
  );
} 