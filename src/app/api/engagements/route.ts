import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // Get support engagements
    const { data: engagements, error } = await supabaseServer
      .from("support_engagements")
      .select("id, title, description, support_type, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching support engagements:", error);
      return NextResponse.json(
        { error: "Failed to fetch support engagements" },
        { status: 500 }
      );
    }

    return NextResponse.json(engagements);
  } catch (error) {
    console.error("Error in support engagements API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 