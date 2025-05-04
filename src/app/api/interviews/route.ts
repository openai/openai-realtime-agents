import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(_request: Request) {
  void _request;
  try {
    console.log("Fetching interviews from Supabase using service role key...");
    
    // Get all interviews
    const { data: interviews, error: interviewsError } = await supabaseServer
      .from('interviews')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (interviewsError) {
      console.error("Error fetching interviews:", interviewsError);
      throw interviewsError;
    }
    
    console.log(`Successfully fetched ${interviews?.length || 0} interviews`);
    
    // Get all questions (we'll organize them by interview_id)
    const { data: questions, error: questionsError } = await supabaseServer
      .from('questions')
      .select('*')
      .order('ordinal', { ascending: true });
      
    if (questionsError) {
      console.error("Error fetching questions:", questionsError);
      throw questionsError;
    }
    
    console.log(`Successfully fetched ${questions?.length || 0} questions`);
    
    // Group questions by interview_id
    const questionsByInterview = questions.reduce((acc, question) => {
      if (!acc[question.interview_id]) {
        acc[question.interview_id] = [];
      }
      acc[question.interview_id].push(question);
      return acc;
    }, {});
    
    // Enrich interviews with their questions
    const enrichedInterviews = interviews.map(interview => ({
      ...interview,
      questions: questionsByInterview[interview.id] || []
    }));
    
    return NextResponse.json(enrichedInterviews);
  } catch (error) {
    console.error("Error fetching interview data:", error);
    return NextResponse.json(
      { error: "Failed to fetch interview data" },
      { status: 500 }
    );
  }
} 