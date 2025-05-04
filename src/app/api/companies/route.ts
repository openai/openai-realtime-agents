import { NextRequest, NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // Get companies
    const { data: companies, error } = await supabaseServer
      .from("companies")
      .select("id, business_name")
      .order("business_name", { ascending: true });

    if (error) {
      console.error("Error fetching companies:", error);
      return NextResponse.json(
        { error: "Failed to fetch companies" },
        { status: 500 }
      );
    }

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Error in companies API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 