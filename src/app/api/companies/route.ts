import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(request: Request) {
  try {
    // Log environment variables (without exposing full key values)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKeyExists = !!process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
    
    console.log(`Supabase URL exists: ${!!supabaseUrl}`);
    console.log(`Service role key exists: ${serviceKeyExists}`);
    
    if (!supabaseUrl || !serviceKeyExists) {
      throw new Error("Missing Supabase credentials. Check environment variables.");
    }
    
    console.log("Fetching companies from Supabase using service role key...");
    
    // Get all active companies, sorted by name
    const { data: companies, error } = await supabaseServer
      .from('companies')
      .select('id, business_name, logo, operating_status, website, traction_level')
      .eq('is_active', true)
      .order('business_name', { ascending: true });
    
    if (error) {
      console.error("Error fetching companies:", error);
      throw error;
    }
    
    console.log(`Successfully fetched ${companies?.length || 0} companies from Supabase`);
    console.log("First few companies:", companies?.slice(0, 3));
    
    return NextResponse.json(companies);
  } catch (error: any) {
    console.error("Detailed error fetching company data:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch company data" },
      { status: 500 }
    );
  }
} 