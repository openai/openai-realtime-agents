import { useCallback, useEffect, useRef, useState } from 'react';

export function useEvents(baseUrl: string, sessionId: string | undefined) {
  const [events, setEvents] = useState<any[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [warn, setWarn] = useState<string>('');
  const backoffRef = useRef<number>(1000);
  const timerRef = useRef<number | null>(null);

  const updateLastSeq = useCallback(
    (seq: number) => {
      setLastSeq(seq);
      if (sessionId) {
        try {
          localStorage.setItem(`lastSeq:${sessionId}`, String(seq));
        } catch {}
      }
    },
    [sessionId]
  );

  const fetchEvents = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(
        `${baseUrl}/api/sdk/session/${encodeURIComponent(sessionId)}/events${
          lastSeq ? `?since=${lastSeq}` : ''
        }`
      );
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        setEvents((prev) => {
          const merged = [...prev];
          for (const ev of data) {
            if (!merged.some((e) => e.seq === ev.seq)) merged.push(ev);
          }
          merged.sort((a, b) => a.seq - b.seq);
          const maxSeq = merged.length
            ? merged[merged.length - 1].seq
            : lastSeq;
          updateLastSeq(maxSeq);
          return merged;
        });
      }
      // success: reset backoff and clear warn
      backoffRef.current = 1000;
      if (warn) setWarn('');
    } catch (e: any) {
      // transient fail: increase backoff and set warning
      const next = Math.min(backoffRef.current * 2, 10000);
      backoffRef.current = next;
      setWarn('Network hiccup; retrying…');
    }
  }, [baseUrl, sessionId, lastSeq, updateLastSeq, warn]);

  // resume on mount/session change
  useEffect(() => {
    if (!sessionId) return;
    try {
      const saved = Number(localStorage.getItem(`lastSeq:${sessionId}`) || '0');
      if (saved) setLastSeq(saved);
    } catch {}
    void fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // polling with backoff
  useEffect(() => {
    if (!sessionId) return;
    function tick() {
      void fetchEvents().finally(() => {
        timerRef.current = window.setTimeout(tick, backoffRef.current);
      });
    }
    timerRef.current = window.setTimeout(tick, backoffRef.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, fetchEvents]);

  // Expose a manual refresh to allow callers to do short fast-poll bursts
  const refresh = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  return { events, lastSeq, setEvents, setLastSeq, warn, refresh };
}
