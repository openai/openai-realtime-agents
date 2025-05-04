import { startupInterviewerTemplate } from '../agentConfigs/supportFeedback';
import { AgentConfig } from '../types';
import supabaseServer from './supabase-server';

// Type definition for interview and related data
interface InterviewWithRelations {
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

/**
 * Fetches an interview with all related data (company, person, support engagement, questions)
 */
export async function getInterviewWithRelations(interviewId: string): Promise<InterviewWithRelations | null> {
  // Fetch the interview
  const { data: interview, error: interviewError } = await supabaseServer
    .from('interviews')
    .select(`
      id,
      admin_notes,
      company_id,
      person_id,
      support_engagement_id
    `)
    .eq('id', interviewId)
    .single();

  if (interviewError || !interview) {
    console.error('Error fetching interview:', interviewError);
    return null;
  }

  // Fetch related data
  const [
    { data: company },
    { data: person },
    { data: supportEngagement },
    { data: questions }
  ] = await Promise.all([
    // Get company
    interview.company_id ? supabaseServer
      .from('companies')
      .select('business_name, description, date_established, traction_level, province')
      .eq('id', interview.company_id)
      .single() : { data: null },
    
    // Get person
    interview.person_id ? supabaseServer
      .from('people')
      .select('first_name, last_name, title')
      .eq('id', interview.person_id)
      .single() : { data: null },
    
    // Get support engagement
    interview.support_engagement_id ? supabaseServer
      .from('support_engagements')
      .select('title, description, date_identified, status, support_type')
      .eq('id', interview.support_engagement_id)
      .single() : { data: null },
    
    // Get questions
    supabaseServer
      .from('questions')
      .select('id, text, ordinal, context')
      .eq('interview_id', interviewId)
      .order('ordinal', { ascending: true })
  ]);

  return {
    ...interview,
    company: company || undefined,
    person: person || undefined,
    support_engagement: supportEngagement || undefined,
    questions: questions || []
  };
}

/**
 * Creates a customized agent config based on interview data
 */
export function createInterviewAgentConfig(interview: InterviewWithRelations): AgentConfig {
  // Start with the template
  const agentConfig = { ...startupInterviewerTemplate };
  
  // Generate question list
  const questionsList = interview.questions.map(q => 
    `   • Q${q.ordinal} – ${q.text}`
  ).join('\n');

  // Generate question states
  let questionStates = '';
  const lastQuestionIndex = interview.questions.length;
  
  interview.questions.forEach((question, index) => {
    const stateNumber = index + 2; // +2 because we start at state 2 (after intro)
    const nextState = index === lastQuestionIndex - 1 ? `${lastQuestionIndex + 2}_wrap_up` : `${stateNumber + 1}_q${index + 2}_context`;
    
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

  // Trim trailing comma from the last item
  questionStates = questionStates.slice(0, -1);

  // Prepare replacement values
  const replacements: Record<string, string> = {
    '{{COMPANY_NAME}}': interview.company?.business_name || 'the company',
    '{{PERSON_NAME}}': interview.person ? `${interview.person.first_name} ${interview.person.last_name}` : 'the interviewee',
    '{{SUPPORT_TYPE}}': interview.support_engagement?.support_type || 'support',
    '{{ENGAGEMENT_TITLE}}': interview.support_engagement?.title || 'Support Engagement',
    '{{ENGAGEMENT_DATE}}': interview.support_engagement?.date_identified || 'recent date',
    '{{ENGAGEMENT_STATUS}}': interview.support_engagement?.status || 'In Progress',
    '{{COMPANY_DESCRIPTION}}': `${interview.company?.business_name || 'The company'} is a ${interview.company?.description || 'company'} established in ${new Date(interview.company?.date_established || Date.now()).getFullYear() || 'recent years'}. They're based in ${interview.company?.province || 'the region'}.`,
    '{{ENGAGEMENT_BACKGROUND}}': interview.support_engagement?.description || 'The engagement was focused on providing support to the company.',
    '{{QUESTION_COUNT}}': interview.questions.length.toString(),
    '{{QUESTIONS_LIST}}': questionsList,
    '{{QUESTION_STATES}}': questionStates,
    '{{ENGAGEMENT_SHORT_DESCRIPTION}}': interview.support_engagement?.description?.substring(0, 100) || 'support needs',
    '{{ENGAGEMENT_ID}}': interview.id,
    '{{LAST_STATE_ID}}': `${interview.questions.length + 2}_wrap_up`
  };

  // Apply replacements to the template
  let instructions = agentConfig.instructions;
  
  Object.entries(replacements).forEach(([key, value]) => {
    instructions = instructions.replace(new RegExp(key, 'g'), value);
  });
  
  return {
    ...agentConfig,
    instructions
  };
} 