/**
 * Monkey-patches the global RTCPeerConnection so that when the SDK
 * internally calls addTrack() we can inject our preferred codec
 * before the WebRTC offer is generated.  This lets you use the codec
 * selector in the UI to force narrow-band (8 kHz) codecs to
 * simulate how the voice agent sounds over a PSTN/SIP phone call.
 *
 * In a normal WebRTC app you would call transceiver.setCodecPreferences()
 * followed by a renegotiation when you want to change codecs.  The Realtime
 * SDK owns the negotiation flow and does not currently expose any
 * API to trigger a renegotiation or to set preferred codecs ahead of time.
 *
 * This patch is idempotent – calling multiple times with the same
 * codec has no effect. 
 */

let alreadyPatched = false;
(() => {
    if (alreadyPatched) return;
    alreadyPatched = true;
  
    if (typeof window === 'undefined') return;
    if ((window as any).__oaiCodecPatchApplied) return;
    if (!('RTCPeerConnection' in window)) return;
  
    (window as any).__oaiCodecPatchApplied = true;
  
    const search = new URLSearchParams(window.location.search);
    const wanted = (search.get('codec') || 'opus').toLowerCase(); // opus/pcmu/pcma
  
    const applyPreference = (
      pc: RTCPeerConnection,
      sender: RTCRtpSender,
    ) => {
      try {
        const caps = RTCRtpSender.getCapabilities('audio');
        if (!caps) return;
        const pref = caps.codecs.find(
          (c) => c.mimeType.toLowerCase() === `audio/${wanted}`,
        );
        if (!pref) {
          return;
        }
  
        const transceiver = pc
          .getTransceivers()
          .find((t) => t.sender === sender);
        if (transceiver) {
          transceiver.setCodecPreferences([pref]);
        }
      } catch (err) {
        console.error('[codecPatch] Error in applyPreference', err);
      }
    };
  
  
    const OriginalAddTrack = RTCPeerConnection.prototype.addTrack;
    RTCPeerConnection.prototype.addTrack = function patchedAddTrack(
      track: MediaStreamTrack,
      ...streams: MediaStream[]
    ) {
      const sender = OriginalAddTrack.apply(this, [track, ...streams]);
      applyPreference(this, sender);
      return sender;
    };
  
  
    const OriginalAddTransceiver = RTCPeerConnection.prototype.addTransceiver;
    RTCPeerConnection.prototype.addTransceiver = function patchedAddTransceiver(
      ...args: any[]
    ) {
      const transceiver = OriginalAddTransceiver.apply(this, args as any);
      if (transceiver?.sender) {
        applyPreference(this, transceiver.sender);
      }
      return transceiver;
    };
  
  })();

  export function audioFormatForCodec(codec: string) {
    let audioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw' = 'pcm16';
    if (typeof window !== 'undefined') {
      if (codec === 'pcmu') audioFormat = 'g711_ulaw';
      else if (codec === 'pcma') audioFormat = 'g711_alaw';
    }
    return audioFormat;
  }