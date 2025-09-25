import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRealtime } from '../realtime/useRealtime';

export function App() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { status, connect, disconnect, sendUserText, logs } =
    useRealtime(audioRef);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setBackendStatus(j.ok ? 'OK' : 'NOT OK'))
      .catch(() => setBackendStatus('UNREACHABLE'));
  }, []);

  const [text, setText] = useState('hi');

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        display: 'grid',
        gap: 12,
      }}>
      <h2 style={{ margin: 0 }}>Realtime Agents (Vite)</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>Backend:</strong> <span>{backendStatus}</span>
        <strong>Session:</strong> <span>{status}</span>
        {status === 'CONNECTED' ? (
          <button onClick={disconnect}>Disconnect</button>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              sendUserText(text.trim());
              setText('');
            }
          }}
        />
        <button
          onClick={() => {
            if (!text.trim()) return;
            sendUserText(text.trim());
            setText('');
          }}
          disabled={status !== 'CONNECTED' || !text.trim()}>
          Send
        </button>
      </div>

      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h3 style={{ marginBottom: 8 }}>Transcript (simple)</h3>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
              minHeight: 160,
            }}>
            {logs
              .filter((l) => l.kind === 'text')
              .map((l) => (
                <div key={l.id} style={{ marginBottom: 6 }}>
                  <span style={{ opacity: 0.6 }}>{l.role}: </span>
                  <span>{l.content}</span>
                </div>
              ))}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 8 }}>Events</h3>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
              minHeight: 160,
              maxHeight: 300,
              overflow: 'auto',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
            }}>
            {logs.map((l) => (
              <div key={l.id}>
                <span style={{ opacity: 0.6 }}>{l.time} </span>
                <span>[{l.kind}] </span>
                <span>{l.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
