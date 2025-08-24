export async function ensureHouseholdId(): Promise<string> {
  // Try cookie-backed API first
  try {
    const res = await fetch("/api/household/init", { cache: "no-store" });
    const data = await res.json();
    if (data?.id) {
      try { localStorage.setItem("pp_household_id", data.id); } catch {}
      return data.id as string;
    }
  } catch {}

  // Fallback to local uuid if API isn't reachable
  let id = "";
  try { id = localStorage.getItem("pp_household_id") || ""; } catch {}
  if (!id) {
    id = crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    try { localStorage.setItem("pp_household_id", id); } catch {}
  }
  return id;
}
