import { useEffect, useRef, useState } from 'react';

export function useWsEvents(
  baseUrl: string,
  sessionId?: string,
  runtime: 'sdk' | 'llm' = 'llm'
) {
  const [events, setEvents] = useState<any[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const url = `${baseUrl.replace(
      /^http/,
      'ws'
    )}/api/${runtime}/session/ws?session_id=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      // Optional resume
      if (lastSeq) ws.send(JSON.stringify({ type: 'resume', since: lastSeq }));
    };
    ws.onmessage = (evt) => {
      try {
        const ev = JSON.parse(evt.data);
        setEvents((prev) => {
          const merged = [...prev, ev];
          merged.sort((a, b) => (a.seq || 0) - (b.seq || 0));
          const maxSeq = merged.length
            ? merged[merged.length - 1].seq
            : lastSeq;
          setLastSeq(maxSeq || 0);
          return merged;
        });
      } catch {}
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [baseUrl, sessionId, runtime]);

  return { events, lastSeq, connected };
}
