// Utility to create agent configuration from interview data

export interface InterviewWithRelations {
  id: string;
  admin_notes: string;
  company?: {
    business_name: string;
    description: string | null;
    date_established: string | null;
    traction_level: string | null;
    province: string | null;
  };
  person?: {
    first_name: string;
    last_name: string;
    title: string | null;
  };
  support_engagement?: {
    title: string;
    description: string | null;
    date_identified: string;
    status: string;
    support_type: string;
  };
  questions: {
    id: string;
    text: string;
    ordinal: number;
    context: string | null;
  }[];
}

import { startupInterviewerTemplate } from "@/app/agentConfigs/supportFeedback";
import { AgentConfig } from "@/app/types";

export function createInterviewAgentConfig(interview: InterviewWithRelations): AgentConfig {
  const agentConfig = { ...startupInterviewerTemplate };

  const questionsList = interview.questions
    .map((q) => `   • Q${q.ordinal} – ${q.text}`)
    .join("\n");

  let questionStates = "";
  const lastQuestionIndex = interview.questions.length;

  interview.questions.forEach((question, index) => {
    const stateNumber = index + 2;
    const nextState =
      index === lastQuestionIndex - 1
        ? `${lastQuestionIndex + 2}_wrap_up`
        : `${stateNumber + 1}_q${index + 2}_context`;

    questionStates += `
  {
    "id": "${stateNumber}_q${index + 1}_context",
    "description": "Ask the question #${index + 1}.",
    "instructions": [
      "Ask: '${question.text}'",
      "Listen actively and encourage elaboration if the answer is short.",
      "Ask follow-up questions to get specific details and examples about their experience."
    ],
    "transitions": [
      {
        "next_step": "${nextState}",
        "condition": "A thorough answer to the question is provided."
      }
    ]
  },`;
  });

  questionStates = questionStates.slice(0, -1);

  const replacements: Record<string, string> = {
    "{{COMPANY_NAME}}": interview.company?.business_name || "the company",
    "{{PERSON_NAME}}": interview.person
      ? `${interview.person.first_name} ${interview.person.last_name}`
      : "the interviewee",
    "{{SUPPORT_TYPE}}": interview.support_engagement?.support_type || "support",
    "{{ENGAGEMENT_TITLE}}": interview.support_engagement?.title || "Support Engagement",
    "{{ENGAGEMENT_DATE}}": interview.support_engagement?.date_identified || "recent date",
    "{{ENGAGEMENT_STATUS}}": interview.support_engagement?.status || "In Progress",
    "{{COMPANY_DESCRIPTION}}": `$${interview.company?.business_name || "The company"} is a ${
      interview.company?.description || "company"
    } established in ${
      new Date(interview.company?.date_established || Date.now()).getFullYear() || "recent years"
    }. They're based in ${interview.company?.province || "the region"}.`,
    "{{ENGAGEMENT_BACKGROUND}}":
      interview.support_engagement?.description ||
      "The engagement was focused on providing support to the company.",
    "{{QUESTION_COUNT}}": interview.questions.length.toString(),
    "{{QUESTIONS_LIST}}": questionsList,
    "{{QUESTION_STATES}}": questionStates,
    "{{ENGAGEMENT_SHORT_DESCRIPTION}}":
      interview.support_engagement?.description?.substring(0, 100) || "support needs",
    "{{ENGAGEMENT_ID}}": interview.id,
    "{{LAST_STATE_ID}}": `${interview.questions.length + 2}_wrap_up`,
  };

  let instructions = agentConfig.instructions;

  Object.entries(replacements).forEach(([key, value]) => {
    instructions = instructions.replace(new RegExp(key, "g"), value);
  });

  return {
    ...agentConfig,
    instructions,
  };
} 