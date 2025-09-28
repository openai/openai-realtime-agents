import { useCallback, useEffect, useRef, useState } from 'react';

type UseEventsOptions = {
  enabled?: boolean; // start/stop polling
  minMs?: number; // minimum poll interval
  maxMs?: number; // maximum poll interval
  idleStopMs?: number; // stop polling entirely after this much inactivity
  visibilityPause?: boolean; // pause when tab hidden
};

export function useEvents(
  baseUrl: string,
  sessionId: string | undefined,
  opts: UseEventsOptions = {}
) {
  const [events, setEvents] = useState<any[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [warn, setWarn] = useState<string>('');
  const minMs = opts.minMs ?? 1000;
  const maxMs = opts.maxMs ?? 15000;
  const idleStopMs = opts.idleStopMs ?? 2 * 60 * 1000; // 2 minutes
  const visibilityPause = opts.visibilityPause ?? true;
  const enabledRef = useRef<boolean>(opts.enabled ?? true);
  const backoffRef = useRef<number>(minMs);
  const timerRef = useRef<number | null>(null);
  const lastEventAtRef = useRef<number>(Date.now());
  const runningRef = useRef<boolean>(false);

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

  const fetchEvents = useCallback(
    async (force: boolean = false) => {
      if (!sessionId) return;
      if (!enabledRef.current && !force) return;
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
          // New data: reset backoff and mark activity
          backoffRef.current = minMs;
          lastEventAtRef.current = Date.now();
        } else {
          // No new data: gently increase interval up to max
          backoffRef.current = Math.min(
            Math.max(Math.round(backoffRef.current * 1.5), minMs),
            maxMs
          );
        }
        if (warn) setWarn('');
      } catch (e: any) {
        // transient fail: increase backoff and set warning
        const next = Math.min(backoffRef.current * 2, maxMs);
        backoffRef.current = next;
        setWarn('Network hiccup; retrying…');
      }
    },
    [baseUrl, sessionId, lastSeq, updateLastSeq, warn, minMs, maxMs]
  );

  // resume on mount/session change
  useEffect(() => {
    if (!sessionId) return;
    try {
      const saved = Number(localStorage.getItem(`lastSeq:${sessionId}`) || '0');
      if (saved) setLastSeq(saved);
    } catch {}
    void fetchEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // polling with backoff + visibility/idle pause
  useEffect(() => {
    enabledRef.current = opts.enabled ?? true;
  }, [opts.enabled]);

  useEffect(() => {
    if (!sessionId) return;
    function scheduleNext() {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Idle stop: if no new events for idleStopMs, stop polling
      const idleFor = Date.now() - lastEventAtRef.current;
      const shouldStopForIdle = idleFor >= idleStopMs;
      const shouldPauseForHidden = visibilityPause && document.hidden;
      const shouldRun =
        enabledRef.current && !shouldPauseForHidden && !shouldStopForIdle;
      if (!shouldRun) {
        runningRef.current = false;
        return;
      }
      runningRef.current = true;
      timerRef.current = window.setTimeout(async () => {
        await fetchEvents();
        scheduleNext();
      }, backoffRef.current);
    }
    scheduleNext();
    return () => {
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, fetchEvents, idleStopMs, visibilityPause, opts.enabled]);

  useEffect(() => {
    if (!visibilityPause) return;
    const onVis = () => {
      if (!sessionId) return;
      if (!enabledRef.current) return;
      if (!document.hidden) void fetchEvents(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [sessionId, visibilityPause, fetchEvents]);

  // Expose a manual refresh to allow callers to do short fast-poll bursts
  const refresh = useCallback(async () => {
    await fetchEvents(true);
  }, [fetchEvents]);

  const pause = useCallback(() => {
    enabledRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const resume = useCallback(() => {
    enabledRef.current = true;
    backoffRef.current = minMs;
    lastEventAtRef.current = Date.now();
    // trigger a quick refresh; loop effect will schedule next
    void fetchEvents();
  }, [fetchEvents, minMs]);

  return {
    events,
    lastSeq,
    setEvents,
    setLastSeq,
    warn,
    refresh,
    pause,
    resume,
  };
}
