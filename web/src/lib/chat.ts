export type ChatSource = 'sdk' | 'realtime';

export interface ChatMessage {
  id: string;
  role: string;
  text: string;
  raw: any;
  kind: 'user' | 'assistant' | 'tool' | 'system';
  toolName?: string;
  source: ChatSource;
}

export function extractText(item: any): string {
  if (!item) return '';
  if (typeof item.content === 'string') return item.content;
  if (Array.isArray(item.content)) {
    const textParts = item.content
      .filter(
        (c: any) =>
          c &&
          (c.type === 'output_text' ||
            c.type === 'input_text' ||
            c.type === 'text')
      )
      .map((c: any) => c.text?.trim())
      .filter(Boolean);
    if (textParts.length) return textParts.join('\n');
  }
  if (typeof item.text === 'string') return item.text;
  if (typeof item.output === 'string') return item.output;
  if (item.arguments && typeof item.arguments === 'string')
    return item.arguments;
  return '';
}

export function buildChatMessages(
  events: any[],
  transcript: any[],
  realtimeLogs: any[]
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
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
          source: 'sdk',
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
        const text = ev.final
          ? ev.text || progressive
          : progressive || ev.text || '';
        msgs.push({
          id: `e:${ev.seq}`,
          role,
          text,
          raw: ev,
          kind,
          source: 'sdk',
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
          source: 'sdk',
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
        source: 'sdk',
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
