import { NextResponse, NextRequest } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: any
) {
  try {
    const companyId = params.id;
    
    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    
    console.log(`Fetching support engagements for company ${companyId} using service role key...`);
    
    // Get support engagements for this company
    const { data: engagements, error } = await supabaseServer
      .from('support_engagements')
      .select(`
        id,
        title,
        status,
        created_at,
        updated_at,
        description
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Error fetching support engagements for company ${companyId}:`, error);
      throw error;
    }
    
    console.log(`Successfully fetched ${engagements?.length || 0} support engagements for company ${companyId}`);
    
    return NextResponse.json(engagements || []);
  } catch (error) {
    console.error("Error fetching support engagements:", error);
    return NextResponse.json(
      { error: "Failed to fetch support engagements" },
      { status: 500 }
    );
  }
} 