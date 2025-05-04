"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CompanySelector from "@/app/components/CompanySelector";
import ContactSelector from "@/app/components/ContactSelector";
import EngagementSelector from "@/app/components/EngagementSelector";
import SupportPersonSelector from "@/app/components/SupportPersonSelector";
import { Company, Person, SupportEngagement } from "@/app/lib/types";

export default function CreateInterviewPage() {
  const router = useRouter();
  const [adminNotes, setAdminNotes] = useState("");
  const [isAdminNotesManuallyEdited, setIsAdminNotesManuallyEdited] = useState(false);
  const [questions, setQuestions] = useState([
    { ordinal: 1, text: "", context: "" }
  ]);
  
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<SupportEngagement | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate interview name based on selections
  useEffect(() => {
    // Skip if user has manually edited the name
    if (isAdminNotesManuallyEdited) return;
    
    // Generate name only when all three are selected
    if (selectedCompany && selectedEngagement && selectedPerson) {
      const engagementTitle = selectedEngagement.title || "Support Engagement";
      const companyName = selectedCompany.business_name;
      const personName = `${selectedPerson.first_name} ${selectedPerson.last_name}`;
      
      const generatedName = `${engagementTitle} Review - ${companyName} with ${personName}`;
      setAdminNotes(generatedName);
    } else if (selectedCompany && selectedPerson) {
      // Fallback if only company and person are selected
      const companyName = selectedCompany.business_name;
      const personName = `${selectedPerson.first_name} ${selectedPerson.last_name}`;
      
      const generatedName = `Interview - ${companyName} with ${personName}`;
      setAdminNotes(generatedName);
    }
  }, [selectedCompany, selectedEngagement, selectedPerson, isAdminNotesManuallyEdited]);

  const handleAdminNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminNotes(e.target.value);
    setIsAdminNotesManuallyEdited(true);
  };

  const resetInterviewName = () => {
    setIsAdminNotesManuallyEdited(false);
    // This will trigger the useEffect to regenerate the name
    if (selectedCompany && selectedEngagement && selectedPerson) {
      const engagementTitle = selectedEngagement.title || "Support Engagement";
      const companyName = selectedCompany.business_name;
      const personName = `${selectedPerson.first_name} ${selectedPerson.last_name}`;
      
      const generatedName = `${engagementTitle} Review - ${companyName} with ${personName}`;
      setAdminNotes(generatedName);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { ordinal: questions.length + 1, text: "", context: "" }
    ]);
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      const updatedQuestions = questions.filter((_, i) => i !== index);
      // Recalculate ordinals
      const reorderedQuestions = updatedQuestions.map((q, i) => ({
        ...q,
        ordinal: i + 1
      }));
      setQuestions(reorderedQuestions);
    }
  };

  const handleCompanySelected = (company: Company | null) => {
    setSelectedCompany(company);
    // Clear downstream selections when company changes
    setSelectedEngagement(null);
    setSelectedPerson(null);
  };

  const handleEngagementSelected = (engagement: SupportEngagement | null) => {
    setSelectedEngagement(engagement);
    // Clear person selection when engagement changes
    setSelectedPerson(null);
  };

  const handlePersonSelected = (person: Person | null) => {
    setSelectedPerson(person);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate
    if (!adminNotes.trim()) {
      setError("Interview name/notes are required");
      setIsSubmitting(false);
      return;
    }

    if (questions.some(q => !q.text.trim())) {
      setError("All questions must have text");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/interviews/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminNotes,
          questions,
          companyId: selectedCompany?.id,
          personId: selectedPerson?.id,
          engagementId: selectedEngagement?.id || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create interview");
      }

      router.push("/interviews");
      router.refresh();
    } catch (err: any) {
      console.error("Error creating interview:", err);
      setError(err.message || "Failed to create interview");
      setIsSubmitting(false);
    }
  };

  // Check if all fields are selected for the interview name
  const allSelectionsComplete = !!(selectedCompany && selectedPerson);
  const allDetailedSelectionsComplete = !!(selectedCompany && selectedEngagement && selectedPerson);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Interview</h1>
        <p className="text-gray-600 mt-1">Set up an interview with questions to collect feedback.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-6">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700">
              Interview Name/Notes
            </label>
            {allSelectionsComplete && isAdminNotesManuallyEdited && (
              <button
                type="button"
                onClick={resetInterviewName}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Reset to auto-generated
              </button>
            )}
          </div>
          
          {allSelectionsComplete ? (
            <div className="relative">
              <input
                type="text"
                id="adminNotes"
                value={adminNotes}
                onChange={handleAdminNotesChange}
                className={`w-full px-4 py-2 border ${allDetailedSelectionsComplete ? 'border-green-300 bg-green-50' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="Interview name will be auto-generated"
              />
              {!isAdminNotesManuallyEdited && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Auto-generated</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center border border-gray-300 bg-gray-100 px-4 py-2 rounded-md">
              <p className="text-gray-500 italic">
                Complete company, engagement, and contact selection to auto-generate name
              </p>
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Company & Support Information</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Company
              </label>
              <CompanySelector 
                onCompanySelected={handleCompanySelected}
                selectedCompanyId={selectedCompany?.id || null}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Support Engagement
              </label>
              <EngagementSelector
                companyId={selectedCompany?.id || null}
                onEngagementSelected={handleEngagementSelected}
                selectedEngagementId={selectedEngagement?.id || null}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Contact
              </label>
              {selectedEngagement ? (
                <SupportPersonSelector
                  engagementId={selectedEngagement?.id || null}
                  onPersonSelected={handlePersonSelected}
                  selectedPersonId={selectedPerson?.id || null}
                />
              ) : (
                <ContactSelector
                  companyId={selectedCompany?.id || null}
                  onContactSelected={handlePersonSelected}
                  selectedContactId={selectedPerson?.id || null}
                />
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={index} className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-medium text-gray-900">Question {question.ordinal}</div>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-800 text-sm bg-red-50 px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor={`question-${index}`} className="block text-sm text-gray-700 mb-1">
                      Question Text
                    </label>
                    <input
                      type="text"
                      id={`question-${index}`}
                      value={question.text}
                      onChange={(e) => updateQuestion(index, "text", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., How would you describe your experience with this support engagement?"
                    />
                  </div>

                  <div>
                    <label htmlFor={`context-${index}`} className="block text-sm text-gray-700 mb-1">
                      Context (optional)
                    </label>
                    <textarea
                      id={`context-${index}`}
                      value={question.context}
                      onChange={(e) => updateQuestion(index, "context", e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Context or additional information for the interviewer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-white text-gray-700 border border-gray-300 px-5 py-2 rounded-md mr-3 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !allSelectionsComplete}
            className={`bg-blue-600 text-white px-5 py-2 rounded-md shadow-sm ${
              isSubmitting || !allSelectionsComplete ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Creating..." : "Create Interview"}
          </button>
        </div>
      </form>
    </div>
  );
} 