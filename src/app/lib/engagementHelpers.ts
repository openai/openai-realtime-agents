"use client";

import { AgentConfig } from "@/app/types";

// Helper to update agent instructions with real data from Supabase
export function updateInstructionsWithRealData(
  instructions: string,
  data: { engagement?: any; company?: any; person?: any; questions?: any[] }
): string {
  if (!data) {
    console.warn("Missing data for updating instructions");
    return instructions;
  }

  const { engagement, company, person, questions } = data;
  
  // If we don't have any data, return original instructions
  if (!engagement && !company && !person) {
    console.warn("No specific data available for updating instructions");
    return instructions;
  }

  let updatedInstructions = instructions;
  
  // Replace company data if available
  if (company) {
    // Format dates for display
    const companyEstablished = company.date_established 
      ? new Date(company.date_established).getFullYear() 
      : 2021;
    
    const companyDescription = `${company.traction_level || "early-stage"} company (${company.traction_level || "early adopters"} traction level)`;
      
    // Replace template placeholders
    updatedInstructions = updatedInstructions
      .replace(/{{COMPANY_NAME}}/g, company.business_name || "Unnamed Company")
      .replace(/{{COMPANY_LOCATION}}/g, company.province || "Unknown Location")
      .replace(/{{COMPANY_ESTABLISHED_YEAR}}/g, String(companyEstablished))
      .replace(/{{COMPANY_DESCRIPTION}}/g, companyDescription);
      
    // Also replace any hardcoded values for backward compatibility
    updatedInstructions = updatedInstructions
      .replace(/Starluv Inc/g, company.business_name || "Unnamed Company")
      .replace(/Newfoundland/g, company.province || "Unknown Location")
      .replace(/established in 2021/g, `established in ${companyEstablished}`)
      .replace(/early adopters traction level/g, `${company.traction_level || "early adopters"} traction level`);
  }
  
  // Replace engagement data if available
  if (engagement) {
    // Format dates for display
    const dateIdentified = engagement.date_identified 
      ? new Date(engagement.date_identified).toLocaleDateString() 
      : "N/A";
    
    const engagementShortDescription = engagement.description ? 
      engagement.description.substring(0, 100).replace(/<[^>]*>/g, '') + "..." : 
      "organizing documents and preparing for fundraising";
      
    // Replace template placeholders
    updatedInstructions = updatedInstructions
      .replace(/{{ENGAGEMENT_ID}}/g, engagement.id || "")
      .replace(/{{SUPPORT_TYPE}}/g, engagement.support_type || "Support")
      .replace(/{{ENGAGEMENT_TITLE}}/g, engagement.title || "Support Engagement")
      .replace(/{{ENGAGEMENT_DATE}}/g, dateIdentified)
      .replace(/{{ENGAGEMENT_STATUS}}/g, engagement.status || "In Progress")
      .replace(/{{ENGAGEMENT_SHORT_DESCRIPTION}}/g, engagementShortDescription)
      .replace(/{{ENGAGEMENT_BACKGROUND}}/g, engagement.description ? 
        engagement.description.replace(/<[^>]*>/g, '') : 
        "The engagement was focused on providing support to the company.");
    
    // Also replace any hardcoded values for backward compatibility
    updatedInstructions = updatedInstructions
      .replace(/08ea46fc-f85f-4176-a139-54caa44fda7e/g, engagement.id || "")
      .replace(/Investment Planning/g, engagement.support_type || "Support")
      .replace(/Investment Readiness/g, engagement.title || "Support Engagement")
      .replace(/March 26, 2025/g, dateIdentified)
      .replace(/Identified \(not yet completed\)/g, engagement.status || "In Progress");
  }
  
  // Replace person data if available
  if (person) {
    const personName = `${person.first_name} ${person.last_name}`;
    const personRole = person.job_title || "representative";
    
    // Replace template placeholders
    updatedInstructions = updatedInstructions
      .replace(/{{PERSON_NAME}}/g, personName)
      .replace(/{{PERSON_ROLE}}/g, personRole);
    
    // Also replace any hardcoded values for backward compatibility
    updatedInstructions = updatedInstructions
      .replace(/the founder/g, personName)
      .replace(/the interviewee/g, personName);
  }
  
  // Add custom questions if available
  if (questions && questions.length > 0) {
    // Create questions list
    const questionCount = questions.length;
    const questionsList = questions.map((q, index) => {
      return `   • Q${index + 1} – ${q.text}${q.context ? ` (Context: ${q.context})` : ''}`;
    }).join('\n');
    
    // Create question states for the conversation
    const questionStates = questions.map((q, index) => {
      const stateIndex = index + 2; // +2 because intro is state 1
      const nextStateIndex = stateIndex + 1;
      const finalStateIndex = questions.length + 2; // +2 because intro is state 1
      
      return `{
    "id": "${stateIndex}_q${index + 1}",
    "description": "Ask ${q.text}",
    "instructions": [
      "Ask: '${q.text}'",
      ${q.context ? `"Keep in mind this context: ${q.context}",` : ''}
      "Listen actively and encourage elaboration if the answer is short.",
      "Ask follow-up questions to get specific examples and details."
    ],
    "transitions": [
      {
        "next_step": "${nextStateIndex === finalStateIndex ? finalStateIndex : nextStateIndex}_${nextStateIndex === finalStateIndex ? 'wrap_up' : `q${index + 2}`}",
        "condition": "A thorough answer is given."
      }
    ]
  },`;
    }).join('\n  ');
    
    // Replace template placeholders
    updatedInstructions = updatedInstructions
      .replace(/{{QUESTION_COUNT}}/g, questionCount.toString())
      .replace(/{{QUESTIONS_LIST}}/g, questionsList)
      .replace(/{{QUESTION_STATES}}/g, questionStates)
      .replace(/{{LAST_STATE_ID}}/g, `${questions.length + 2}_wrap_up`);
    
    // Also replace the old hardcoded questions for backward compatibility
    const defaultQuestionsPattern = "   • Q1 – Context leading up to needing investment planning support";
    const endOfDefaultQuestions = "   • Q3 – Impacts or outcomes experienced after the support (even anecdotal).";
    
    // Find the start and end of the default questions section
    const startPos = updatedInstructions.indexOf(defaultQuestionsPattern);
    if (startPos !== -1) {
      const endPos = updatedInstructions.indexOf(endOfDefaultQuestions);
      if (endPos !== -1 && endPos > startPos) {
        // Replace the found section with our new questions
        const endOfSection = endPos + endOfDefaultQuestions.length;
        updatedInstructions = 
          updatedInstructions.substring(0, startPos) + 
          questionsList + 
          updatedInstructions.substring(endOfSection);
      }
    }
    
    // For compatibility, also try to replace the hard-coded conversation states with our dynamic ones
    // This only works if the template hasn't been modified too much from the original
    if (updatedInstructions.includes('"id": "2_q1_context"') && 
        updatedInstructions.includes('"id": "3_q2_challenges"') && 
        updatedInstructions.includes('"id": "4_q3_impact"')) {
      
      // Find the start of the question states
      const stateStartPattern = '"id": "2_q1_context"';
      const stateEndPattern = '"id": "5_wrap_up"';
      
      const stateStartPos = updatedInstructions.indexOf(stateStartPattern);
      if (stateStartPos !== -1) {
        const stateEndPos = updatedInstructions.indexOf(stateEndPattern);
        if (stateEndPos !== -1 && stateEndPos > stateStartPos) {
          // Get the text before the first question state
          const beforeStates = updatedInstructions.substring(0, stateStartPos - 3); // -3 to remove the comma and whitespace
          
          // Get the text starting from the wrap-up state to the end
          const afterStates = updatedInstructions.substring(stateEndPos - 3); // -3 to add proper indentation
          
          // Combine with our dynamic states
          updatedInstructions = beforeStates + questionStates + afterStates;
        }
      }
    }
  }
  
  return updatedInstructions;
}

// Helper to create a modified agent config with real data
export function createUpdatedAgentConfig(
  originalAgent: AgentConfig | undefined,
  data: { 
    engagement?: any; 
    company?: any; 
    person?: any;
    questions?: any[];
    interview?: any; 
  }
): AgentConfig | undefined {
  if (!originalAgent) return undefined;

  // Create a deep copy of the original agent to avoid mutating it
  const updatedAgent: AgentConfig = {
    ...originalAgent,
    instructions: updateInstructionsWithRealData(
      originalAgent.instructions,
      data
    )
  };
  
  // Add custom data using a field that won't conflict with TypeScript
  if (data.interview) {
    (updatedAgent as any).interviewData = {
      interviewId: data.interview.id,
      adminNotes: data.interview.admin_notes
    };
  }
  
  return updatedAgent;
} 