import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      interviewId, 
      companyId, 
      personId, 
      supportEngagementId 
    } = body;

    // Validate required fields
    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    // Check if interview exists
    const { data: existingInterview, error: checkError } = await supabaseServer
      .from("interviews")
      .select("id")
      .eq("id", interviewId)
      .single();

    if (checkError || !existingInterview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Update interview with connections
    const updateData: Record<string, any> = {};
    
    if (companyId) updateData.company_id = companyId;
    if (personId) updateData.person_id = personId;
    if (supportEngagementId) updateData.support_engagement_id = supportEngagementId;

    const { error: updateError } = await supabaseServer
      .from("interviews")
      .update(updateData)
      .eq("id", interviewId);

    if (updateError) {
      console.error("Error connecting interview:", updateError);
      return NextResponse.json(
        { error: "Failed to connect interview" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Interview connections updated successfully",
      id: interviewId
    });
  } catch (error) {
    console.error("Error in connect interview API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 