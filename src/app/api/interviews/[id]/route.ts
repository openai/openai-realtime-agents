import { NextResponse, NextRequest } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function DELETE(_req: NextRequest, { params }: any) {
  try {
    const interviewId = params.id;
    if (!interviewId) {
      return NextResponse.json({ error: "Interview ID is required" }, { status: 400 });
    }

    // Ensure interview exists
    const { data: existing, error: fetchErr } = await supabaseServer
      .from("interviews")
      .select("id")
      .eq("id", interviewId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const { error: deleteErr } = await supabaseServer
      .from("interviews")
      .delete()
      .eq("id", interviewId);

    if (deleteErr) {
      console.error("Error deleting interview:", deleteErr);
      return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/interviews/[id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 