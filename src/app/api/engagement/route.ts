import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const interviewId = searchParams.get('interviewId');
  
  // If interviewId is provided, use it to get all required data
  if (interviewId) {
    try {
      console.log(`Fetching interview data for interview ID: ${interviewId} using service role key...`);
      
      // Get interview data including company_id, person_id, and support_engagement_id
      const { data: interview, error: interviewError } = await supabaseServer
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();
      
      if (interviewError) {
        console.error("Error fetching interview:", interviewError);
        throw interviewError;
      }
      
      if (!interview) {
        return NextResponse.json(
          { error: "Interview not found" },
          { status: 404 }
        );
      }
      
      // Get company data
      const { data: company, error: companyError } = interview.company_id ? await supabaseServer
        .from('companies')
        .select('*')
        .eq('id', interview.company_id)
        .single() : { data: null, error: null };
        
      if (companyError) {
        console.error("Error fetching company:", companyError);
        throw companyError;
      }
      
      // Get person data
      const { data: person, error: personError } = interview.person_id ? await supabaseServer
        .from('people')
        .select('*')
        .eq('id', interview.person_id)
        .single() : { data: null, error: null };
        
      if (personError) {
        console.error("Error fetching person:", personError);
        throw personError;
      }
      
      // Get engagement data
      const { data: engagement, error: engagementError } = interview.support_engagement_id ? await supabaseServer
        .from('support_engagements')
        .select('*')
        .eq('id', interview.support_engagement_id)
        .single() : { data: null, error: null };
        
      if (engagementError) {
        console.error("Error fetching engagement:", engagementError);
        throw engagementError;
      }
      
      // Get questions
      const { data: questions, error: questionsError } = await supabaseServer
        .from('questions')
        .select('*')
        .eq('interview_id', interviewId)
        .order('ordinal', { ascending: true });
        
      if (questionsError) {
        console.error("Error fetching questions:", questionsError);
        throw questionsError;
      }
      
      return NextResponse.json({ 
        interview,
        company,
        person,
        engagement,
        questions
      });
    } catch (error) {
      console.error("Error fetching interview data:", error);
      return NextResponse.json(
        { error: "Failed to fetch interview data" },
        { status: 500 }
      );
    }
  }
  
  // Original functionality for direct engagement ID lookup
  if (!id) {
    return NextResponse.json(
      { error: "Engagement ID or Interview ID is required" },
      { status: 400 }
    );
  }
  
  try {
    console.log(`Fetching engagement data for ID: ${id} using service role key...`);
    
    // Get engagement data
    const { data: engagement, error: engagementError } = await supabaseServer
      .from('support_engagements')
      .select('*')
      .eq('id', id)
      .single();
    
    if (engagementError) {
      console.error("Error fetching engagement:", engagementError);
      throw engagementError;
    }
    
    if (!engagement) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }
    
    console.log(`Successfully fetched engagement data for ID: ${id}`);
    
    // Get company data
    const { data: company, error: companyError } = await supabaseServer
      .from('companies')
      .select('*')
      .eq('id', engagement.company_id)
      .single();
      
    if (companyError) {
      console.error("Error fetching company:", companyError);
      throw companyError;
    }
    
    console.log(`Successfully fetched company data with ID: ${engagement.company_id}`);
    
    return NextResponse.json({ 
      engagement,
      company
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
} 