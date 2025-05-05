"use client"

import { getSupabaseClient } from "@/app/lib/supabase";

interface InterviewWithRelations {
  id: string;
  admin_notes: string;
  status?: string;
  completed_at?: string | null;
  company_id?: string | null;
  person_id?: string | null;
  support_engagement_id?: string | null;
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

export async function getInterviewWithRelationsClient(interviewId: string): Promise<InterviewWithRelations | null> {
  const supabase = getSupabaseClient();

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select(`
      id,
      admin_notes,
      status,
      completed_at,
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

  const [companyRes, personRes, engagementRes, questionsRes] = await Promise.all([
    interview.company_id ? supabase
      .from('companies')
      .select('business_name, description, date_established, traction_level, province')
      .eq('id', interview.company_id)
      .maybeSingle() : { data: null },
    interview.person_id ? supabase
      .from('people')
      .select('first_name, last_name, title')
      .eq('id', interview.person_id)
      .maybeSingle() : { data: null },
    interview.support_engagement_id ? supabase
      .from('support_engagements')
      .select('title, description, date_identified, status, support_type')
      .eq('id', interview.support_engagement_id)
      .maybeSingle() : { data: null },
    supabase
      .from('questions')
      .select('id, text, ordinal, context')
      .eq('interview_id', interviewId)
      .order('ordinal', { ascending: true })
  ]);

  return {
    ...interview,
    company: companyRes.data || undefined,
    person: personRes.data || undefined,
    support_engagement: engagementRes.data || undefined,
    questions: questionsRes.data || []
  } as InterviewWithRelations;
} 