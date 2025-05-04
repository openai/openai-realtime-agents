export interface InterviewQuestion {
  id: string;
  interview_id: string;
  ordinal: number;
  text: string;
  context: string | null;
}

export interface Interview {
  id: string;
  invite_token: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  admin_notes: string;
  questions?: InterviewQuestion[];
  company_id?: string;
  person_id?: string;
}

export interface Answer {
  id: string;
  question_id: string;
  audio_path: string | null;
  transcript: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Company {
  id: string;
  business_name: string;
  logo?: string | null;
  operating_status?: string;
  description?: string | null;
  website?: string | null;
  traction_level?: string | null;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  photo?: string | null;
}

export interface SupportEngagement {
  id: string;
  company_id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
} 