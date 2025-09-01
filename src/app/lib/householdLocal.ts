export async function ensureHouseholdId(): Promise<string> {
  // 1) If the URL has ?householdId, prefer it and switch cookie/server state
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const qId = (url.searchParams.get('householdId') || '').trim();
      if (qId) {
        try {
          const r = await fetch(`/api/household/switch?householdId=${encodeURIComponent(qId)}`, { cache: 'no-store' });
          const j = await r.json();
          if (r.ok && j?.id) {
            try { localStorage.setItem('pp_household_id', j.id); } catch {}
            return j.id as string;
          }
        } catch {}
      }
    }
  } catch {}

  // 2) Otherwise, use cookie-backed init which creates/reads a server household and sets cookie
  try {
    const res = await fetch('/api/household/init', { cache: 'no-store' });
    const data = await res.json();
    if (data?.id) {
      try { localStorage.setItem('pp_household_id', data.id); } catch {}
      return data.id as string;
    }
  } catch {}

  // 3) Fallback to local uuid if API isn't reachable
  let id = '';
  try { id = localStorage.getItem('pp_household_id') || ''; } catch {}
  if (!id) {
    id = crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    try { localStorage.setItem('pp_household_id', id); } catch {}
  }
  return id;
}
