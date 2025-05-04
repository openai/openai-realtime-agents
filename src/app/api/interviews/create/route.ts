import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminNotes, questions, companyId, personId, engagementId } = body;
    
    if (!adminNotes) {
      return NextResponse.json(
        { error: "Interview name/admin notes are required" },
        { status: 400 }
      );
    }
    
    if (!questions || !questions.length || questions.some((q: any) => !q.text)) {
      return NextResponse.json(
        { error: "At least one question with text is required" },
        { status: 400 }
      );
    }
    
    console.log("Creating new interview using service role key...");
    
    // Create a new interview
    const interviewId = uuidv4();
    const inviteToken = uuidv4();
    
    const interviewData: any = {
      id: interviewId,
      invite_token: inviteToken,
      status: 'pending',
      admin_notes: adminNotes
    };
    
    // Add company, person, and engagement if provided
    if (companyId) {
      interviewData.company_id = companyId;
    }
    
    if (personId) {
      interviewData.person_id = personId;
    }
    
    if (engagementId) {
      interviewData.support_engagement_id = engagementId;
    }
    
    const { error: interviewError } = await supabaseServer
      .from('interviews')
      .insert(interviewData);
      
    if (interviewError) {
      console.error("Error creating interview:", interviewError);
      throw interviewError;
    }
    
    console.log(`Successfully created interview with ID: ${interviewId}`);
    
    // Create questions
    const questionsToInsert = questions.map((q: any) => ({
      id: uuidv4(),
      interview_id: interviewId,
      ordinal: q.ordinal,
      text: q.text,
      context: q.context || null
    }));
    
    console.log(`Creating ${questionsToInsert.length} questions for interview ${interviewId}`);
    
    const { error: questionsError } = await supabaseServer
      .from('questions')
      .insert(questionsToInsert);
      
    if (questionsError) {
      console.error("Error creating questions:", questionsError);
      throw questionsError;
    }
    
    console.log(`Successfully created ${questionsToInsert.length} questions`);
    
    return NextResponse.json({
      id: interviewId,
      invite_token: inviteToken,
      company_id: companyId,
      person_id: personId,
      support_engagement_id: engagementId
    });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
} 