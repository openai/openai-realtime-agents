import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(_request: NextRequest) {
  void _request;
  try {
    // Get people
    const { data: people, error } = await supabaseServer
      .from("people")
      .select("id, first_name, last_name, title")
      .order("last_name", { ascending: true });

    if (error) {
      console.error("Error fetching people:", error);
      return NextResponse.json(
        { error: "Failed to fetch people" },
        { status: 500 }
      );
    }

    return NextResponse.json(people);
  } catch (error) {
    console.error("Error in people API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 