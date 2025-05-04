import { NextResponse } from "next/server";
import supabaseServer from "@/app/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const engagementId = params.id;
    
    if (!engagementId) {
      return NextResponse.json(
        { error: "Engagement ID is required" },
        { status: 400 }
      );
    }
    
    console.log(`Fetching support personnel for engagement ${engagementId} using service role key...`);
    
    // First get the engagement details to get the company_id
    const { data: engagement, error: engagementError } = await supabaseServer
      .from('support_engagements')
      .select('company_id')
      .eq('id', engagementId)
      .single();
      
    if (engagementError) {
      console.error(`Error fetching engagement details:`, engagementError);
      throw engagementError;
    }
    
    if (!engagement) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }
    
    const companyId = engagement.company_id;
    console.log(`Found engagement with company_id: ${companyId}`);
    
    // Now get all contacts associated with this company
    const { data: peopleCompanies, error: pcError } = await supabaseServer
      .from('people_companies')
      .select('person_id')
      .eq('company_id', companyId);
    
    if (pcError) {
      console.error(`Error fetching people_companies:`, pcError);
      throw pcError;
    }
    
    // Extract the person IDs
    const personIds = peopleCompanies?.map(pc => pc.person_id) || [];
    
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
      console.error(`Error fetching contacts:`, error);
      throw error;
    }
    
    console.log(`Successfully fetched ${contacts?.length || 0} contacts for company ${companyId} and engagement ${engagementId}`);
    
    return NextResponse.json(contacts || []);
  } catch (error: any) {
    console.error("Error fetching contacts:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch contacts" },
      { status: 500 }
    );
  }
} 