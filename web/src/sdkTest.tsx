import React, { useState } from 'react';

export default function SDKTestStandalone() {
  const [sessionId, setSessionId] = useState('');
  const [instructions, setInstructions] = useState('You are concise.');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [input, setInput] = useState('Hello');
  const [output, setOutput] = useState('');
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const baseUrl =
    (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:8000';

  async function createSession() {
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/sdk/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions,
          session_id: sessionId || undefined,
          model,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setSessionId(data.session_id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function sendMessage() {
    if (!sessionId) return alert('Create session first');
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/sdk/session/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_input: input }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setOutput(data.final_output || '');
      setToolCalls(data.tool_calls || []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function loadTranscript() {
    if (!sessionId) return alert('Create session first');
    setLoading(true);
    try {
      const r = await fetch(
        `${baseUrl}/api/sdk/session/transcript?session_id=${encodeURIComponent(
          sessionId
        )}`
      );
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setTranscript(data.items || []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>SDK Test (Vite)</h1>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        Standalone page without realtime connection or agentConfig redirects.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label>
            Session ID
            <br />
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="(auto)"
            />
          </label>
        </div>
        <div>
          <label>
            Model
            <br />
            <input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          Instructions
          <br />
          <textarea
            value={instructions}
            rows={3}
            style={{ width: 360 }}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button disabled={loading} onClick={createSession}>
          Create / Reuse Session
        </button>
        <button disabled={loading || !sessionId} onClick={loadTranscript}>
          Load Transcript
        </button>
      </div>
      <hr style={{ margin: '20px 0' }} />
      <h2>Send Message</h2>
      <textarea
        rows={2}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: 360 }}
      />
      <br />
      <button disabled={loading || !sessionId} onClick={sendMessage}>
        Send
      </button>
      {output && (
        <div style={{ marginTop: 16 }}>
          <h3>Final Output</h3>
          <pre style={{ background: '#111', color: '#eee', padding: 12 }}>
            {output}
          </pre>
        </div>
      )}
      {toolCalls.length > 0 && (
        <div>
          <h3>Tool Calls</h3>
          <ul>
            {toolCalls.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <h3>Transcript ({transcript.length})</h3>
        <ol style={{ fontSize: 13 }}>
          {transcript.map((it, i) => (
            <li key={i}>
              {it.type}: {JSON.stringify(it).slice(0, 120)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
