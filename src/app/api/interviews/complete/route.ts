import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { interviewId } = await request.json();

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    // Check if interview exists
    const { data: interview, error: checkError } = await supabaseServer
      .from('interviews')
      .select('id, status')
      .eq('id', interviewId)
      .single();

    if (checkError || !interview) {
      console.error("Interview not found:", checkError);
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Update the interview status
    const { error: updateError } = await supabaseServer
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error("Error updating interview status:", updateError);
      return NextResponse.json(
        { error: "Failed to update interview status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "Interview marked as completed" 
    });
    
  } catch (error) {
    console.error("Error in complete interview endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 