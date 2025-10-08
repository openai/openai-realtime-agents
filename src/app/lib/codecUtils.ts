import type { RealtimeAudioFormat } from '@openai/agents/realtime';

export function audioFormatForCodec(codec: string): RealtimeAudioFormat {
  const normalized = typeof codec === 'string' ? codec.toLowerCase() : 'opus';

  if (normalized === 'pcmu') {
    return { type: 'audio/pcmu' };
  }

  if (normalized === 'pcma') {
    return { type: 'audio/pcma' };
  }

  // Default to wideband PCM for Opus or any other codec
  return { type: 'audio/pcm', rate: 24000 };
}

// Apply preferred codec on a peer connection's audio transceivers. Safe to call multiple times.
export function applyCodecPreferences(
  pc: RTCPeerConnection,
  codec: string,
): void {
  try {
    const caps = (RTCRtpSender as any).getCapabilities?.('audio');
    if (!caps) return;

    const pref = caps.codecs.find(
      (c: any) => c.mimeType.toLowerCase() === `audio/${codec.toLowerCase()}`,
    );
    if (!pref) return;

    pc
      .getTransceivers()
      .filter((t) => t.sender && t.sender.track?.kind === 'audio')
      .forEach((t) => t.setCodecPreferences([pref]));
  } catch (err) {
    console.error('[codecUtils] applyCodecPreferences error', err);
  }
}
