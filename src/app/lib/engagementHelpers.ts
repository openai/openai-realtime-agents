"use client";

import { AgentConfig } from "@/app/types";

// Helper to update agent instructions with real data from Supabase
export function updateInstructionsWithRealData(
  instructions: string,
  data: { engagement: any; company: any }
): string {
  if (!data || !data.engagement || !data.company) {
    console.warn("Missing data for updating instructions");
    return instructions;
  }

  const { engagement, company } = data;
  
  // Format dates for display
  const dateIdentified = engagement.date_identified 
    ? new Date(engagement.date_identified).toLocaleDateString() 
    : "N/A";
  
  // Replace placeholder data with real data
  return instructions
    .replace(/Starluv Inc/g, company.business_name || "Starluv Inc")
    .replace(/08ea46fc-f85f-4176-a139-54caa44fda7e/g, engagement.id || "")
    .replace(/Investment Planning/g, engagement.support_type || "Investment Planning")
    .replace(/Investment Readiness/g, engagement.title || "Investment Readiness")
    .replace(/March 26, 2025/g, dateIdentified)
    .replace(/Newfoundland/g, company.province || "NL")
    .replace(/established in 2021/g, `established in ${new Date(company.date_established).getFullYear() || 2021}`)
    .replace(/early adopters traction level/g, `${company.traction_level || "early_adopters"} traction level`);
}

// Helper to create a modified agent config with real data
export function createUpdatedAgentConfig(
  originalAgent: AgentConfig | undefined,
  engagementData: any
): AgentConfig | undefined {
  if (!originalAgent) return undefined;

  return {
    ...originalAgent,
    instructions: updateInstructionsWithRealData(
      originalAgent.instructions,
      engagementData
    )
  };
} 