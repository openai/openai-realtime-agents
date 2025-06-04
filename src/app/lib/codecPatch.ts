/*
 * Global monkey-patch that forces the preferred audio codec (opus / pcmu / pcma)
 * onto every RTCPeerConnection created **after** it is loaded.  It must therefore
 * be imported exactly once, before the Realtime SDK establishes its WebRTC
 * connection.
 */

(() => {
  // TEMP LOGGING: Trace when the codecPatch is loaded
  console.log('[codecPatch] Loaded at', new Date().toISOString());

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
        console.warn('[codecPatch] Preferred codec not found:', wanted);
        return;
      }

      const transceiver = pc
        .getTransceivers()
        .find((t) => t.sender === sender);
      if (transceiver) {
        console.log('[codecPatch] Setting codec preferences to', pref.mimeType, 'on transceiver', transceiver);
        transceiver.setCodecPreferences([pref]);
      } else {
        console.warn('[codecPatch] No matching transceiver for sender', sender);
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
    console.log('[codecPatch] addTrack called', { track, streams, pc: this });
    const sender = OriginalAddTrack.apply(this, [track, ...streams]);
    applyPreference(this, sender);
    return sender;
  };


  const OriginalAddTransceiver = RTCPeerConnection.prototype.addTransceiver;
  RTCPeerConnection.prototype.addTransceiver = function patchedAddTransceiver(
    ...args: any[]
  ) {
    console.log('[codecPatch] addTransceiver called', args, { pc: this });
    const transceiver = OriginalAddTransceiver.apply(this, args as any);
    if (transceiver?.sender) {
      applyPreference(this, transceiver.sender);
    }
    return transceiver;
  };

})();
