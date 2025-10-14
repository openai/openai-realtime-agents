export type ChatSource = 'sdk' | 'llm' | 'realtime';

export interface ChatMessage {
  id: string;
  role: string;
  text: string;
  raw: any;
  kind: 'user' | 'assistant' | 'tool' | 'system';
  toolName?: string;
  source: ChatSource;
}

function normalizeText(s: string): string {
  // Collapse excessive whitespace while preserving newlines
  if (!s) return '';
  // Convert Windows newlines to \n, trim lines, and collapse multiple blank lines
  const unified = s.replace(/\r\n/g, '\n');
  const cleaned = unified
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

export function extractText(item: any): string {
  if (!item) return '';
  if (typeof item.content === 'string') return normalizeText(item.content);
  if (Array.isArray(item.content)) {
    const textParts = item.content
      .filter(
        (c: any) =>
          c &&
          (c.type === 'output_text' ||
            c.type === 'input_text' ||
            c.type === 'text')
      )
      .map((c: any) => (typeof c.text === 'string' ? c.text : ''))
      .filter(Boolean);
    if (textParts.length) return normalizeText(textParts.join('\n'));
  }
  // Common alternative fields
  if (typeof item.text === 'string') return normalizeText(item.text);
  if (typeof item.output === 'string') return normalizeText(item.output);
  if (Array.isArray(item.output_text))
    return normalizeText(item.output_text.join('\n'));
  if (Array.isArray(item.input_text))
    return normalizeText(item.input_text.join('\n'));
  if (item.arguments && typeof item.arguments === 'string')
    return normalizeText(item.arguments);
  if (item.response && typeof item.response === 'object') {
    const r = item.response;
    if (Array.isArray(r.output_text))
      return normalizeText(r.output_text.join('\n'));
    if (typeof r.text === 'string') return normalizeText(r.text);
  }
  // Session items shape
  if (Array.isArray(item.items)) {
    const parts = item.items
      .filter(
        (it: any) =>
          it && it.type === 'output_text' && typeof it.text === 'string'
      )
      .map((it: any) => it.text);
    if (parts.length) return normalizeText(parts.join('\n'));
  }
  return '';
}

export function buildChatMessages(
  events: any[],
  transcript: any[],
  realtimeLogs: any[],
  opts?: { source?: ChatSource }
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const source: ChatSource = opts?.source || 'sdk';
  if (events.length > 0) {
    const partials = new Map<string, string>();
    for (const ev of events) {
      if (ev.type === 'token' && ev.message_id) {
        const sofar = partials.get(ev.message_id) || '';
        partials.set(ev.message_id, sofar + (ev.text || ''));
      } else if (ev.type === 'handoff') {
        msgs.push({
          id: `handoff:${ev.seq}`,
          role: 'system',
          text: `Handoff to ${ev.agent_id}${
            ev.reason ? ` – ${ev.reason}` : ''
          }`,
          raw: ev,
          kind: 'system',
          source,
        });
      } else if (ev.type === 'message') {
        const role = ev.role || 'assistant';
        const kind: ChatMessage['kind'] =
          role === 'user'
            ? 'user'
            : role === 'assistant'
            ? 'assistant'
            : 'system';
        const progressive = ev.message_id
          ? partials.get(ev.message_id) || ''
          : '';
        // Prefer final text; otherwise use progressive tokens or fallback extraction
        const preferred = ev.final
          ? ev.text || progressive
          : progressive || ev.text || '';
        const fallback = extractText(ev);
        const text = normalizeText(preferred || fallback);
        if (!text) {
          // Avoid pushing empty assistant/system messages
          continue;
        }
        msgs.push({
          id: `e:${ev.seq}`,
          role,
          text,
          raw: ev,
          kind,
          source,
        });
      }
    }
    for (const [mid, text] of partials.entries()) {
      const hasFinal = events.some(
        (e: any) =>
          e.type === 'message' && e.message_id === mid && e.final === true
      );
      if (!hasFinal && text) {
        msgs.push({
          id: `tok:${mid}`,
          role: 'assistant',
          text,
          raw: { message_id: mid, type: 'token' },
          kind: 'assistant',
          source,
        });
      }
    }
  } else {
    for (const it of transcript) {
      const t = it.type || it.role;
      if (t === 'function_call' || t === 'function_call_output') continue;
      const role = it.role || (t === 'message' ? 'assistant' : t) || 'item';
      const kind: ChatMessage['kind'] =
        role === 'user'
          ? 'user'
          : role === 'assistant'
          ? 'assistant'
          : role === 'tool'
          ? 'tool'
          : 'system';
      const text = extractText(it);
      msgs.push({
        id: it.id || 't:' + msgs.length,
        role,
        text,
        raw: it,
        kind,
        source,
      });
    }
  }
  realtimeLogs.forEach((l: any) => {
    if (l.kind === 'text' && l.role && l.content) {
      msgs.push({
        id: 'rt:' + l.id,
        role: l.role,
        text: l.content,
        raw: l,
        kind: l.role === 'user' ? 'user' : 'assistant',
        source: 'realtime',
      });
    }
  });
  return msgs;
}

export function computeStreaming(events: any[]): boolean {
  const tokenIds = new Set<string>();
  const finals = new Set<string>();
  for (const ev of events) {
    if (ev.type === 'token' && ev.message_id) tokenIds.add(ev.message_id);
    if (ev.type === 'message' && ev.message_id && ev.final === true)
      finals.add(ev.message_id);
  }
  for (const mid of tokenIds) if (!finals.has(mid)) return true;
  return false;
}
