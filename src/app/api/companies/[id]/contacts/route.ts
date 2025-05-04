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
    
    console.log(`Fetching contacts for company ${companyId} using service role key...`);
    
    // First get the person IDs associated with this company
    const { data: peopleCompanies, error: pcError } = await supabaseServer
      .from('people_companies')
      .select('person_id')
      .eq('company_id', companyId);
    
    if (pcError) {
      console.error(`Error fetching people_companies for company ${companyId}:`, pcError);
      throw pcError;
    }
    
    // Extract the person_ids
    const personIds = peopleCompanies.map(pc => pc.person_id);
    
    if (personIds.length === 0) {
      console.log(`No contacts found for company ${companyId}`);
      return NextResponse.json([]);
    }
    
    console.log(`Found ${personIds.length} person IDs for company ${companyId}`);
    
    // Get contact details for these people
    const { data: contacts, error } = await supabaseServer
      .from('people')
      .select(`
        id, 
        first_name, 
        last_name,
        title,
        photo
      `)
      .eq('is_active', true)
      .in('id', personIds)
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error(`Error fetching contacts for company ${companyId}:`, error);
      throw error;
    }
    
    console.log(`Successfully fetched ${contacts?.length || 0} contacts for company ${companyId}`);
    
    return NextResponse.json(contacts || []);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
} 