import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json(
      { error: "Engagement ID is required" },
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