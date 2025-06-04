/**
 * Monkey-patches the global RTCPeerConnection so that when the SDK
 * internally calls addTrack() we can inject our preferred codec
 * before the WebRTC offer is generated.  This lets you use the codec
 * selector in the UI to force narrow-band (8 kHz) codecs to
 * simulate how the voice agent sounds over a PSTN/SIP phone call.
 *
 * OpenAI Realtime API doesn't support renegotiation, so this has
 * to happen before the connection is established.
 *
 * This patch is idempotent – calling multiple times with the same
 * codec has no effect. 
 */

let alreadyPatched = false;
let preferredCodec: string | null = null;

export function overrideAudioCodecOnce(codec: string) {
  preferredCodec = codec?.toLowerCase();

  if (alreadyPatched) return;
  alreadyPatched = true;

  if (typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
    return;
  }

  const OriginalAddTrack = RTCPeerConnection.prototype.addTrack;

  RTCPeerConnection.prototype.addTrack = function patchedAddTrack(
    track: MediaStreamTrack,
    ...streams: MediaStream[]
  ): RTCRtpSender {
    const sender: RTCRtpSender = OriginalAddTrack.apply(this, [track, ...streams]);

    try {
      if (!preferredCodec) return sender;

      const transceiver = (this as RTCPeerConnection)
        .getTransceivers()
        .find((t) => t.sender === sender);

      if (!transceiver) return sender;

      const caps = RTCRtpSender.getCapabilities('audio');
      if (!caps || !Array.isArray(caps.codecs)) return sender;

      const chosen = caps.codecs.find(
        (c) => c.mimeType.toLowerCase() === `audio/${preferredCodec}`,
      );
      if (chosen) {
        console.log('Setting codec preference to', preferredCodec);
        transceiver.setCodecPreferences([chosen]);
      }
    } catch (err) {
      console.error('Failed to override audio codec', err);
    }

    return sender;
  };
}
