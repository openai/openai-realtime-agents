import { redirect } from "next/navigation";
import supabaseServer from "@/app/lib/supabase-server";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Fetch interview by invite token
  const { data: interview, error } = await supabaseServer
    .from("interviews")
    .select("id, status")
    .eq("invite_token", token)
    .single();

  if (error || !interview) {
    redirect("/invite-not-found");
  }

  // If interview is completed, show message page instead
  if (interview.status === "completed") {
    redirect("/invite-completed");
  }

  // Redirect to app page in candidate mode
  redirect(`/app?interviewId=${interview.id}&candidate=1`);
} 