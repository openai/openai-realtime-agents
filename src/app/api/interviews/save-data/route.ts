import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { interviewId, transcriptData } = await request.json();

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    // Check if interview exists
    const { data: interview, error: checkError } = await supabaseServer
      .from('interviews')
      .select('id')
      .eq('id', interviewId)
      .single();

    if (checkError || !interview) {
      console.error("Interview not found:", checkError);
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Update the interview_data field
    const { error: updateError } = await supabaseServer
      .from('interviews')
      .update({
        interview_data: transcriptData
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error("Error saving interview data:", updateError);
      return NextResponse.json(
        { error: "Failed to save interview data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "Interview data saved successfully" 
    });
    
  } catch (error) {
    console.error("Error in save-data endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 