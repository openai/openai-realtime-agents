import { useRef } from "react";
import { convertWebMBlobToWav } from "../lib/audioUtils";

function useAudioDownload() {
  // Ref to store the MediaRecorder instance.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Ref to collect all recorded Blob chunks.
  const recordedChunksRef = useRef<Blob[]>([]);
  // Refs to the capture resources that have to be released when we stop.
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  // Bumped by stopRecording so a startRecording that is still awaiting the
  // microphone can tell it has been superseded and release what it acquired.
  const recordingIdRef = useRef(0);

  /**
   * Releases the microphone capture and the AudioContext created by
   * startRecording. Safe to call when nothing is being recorded.
   */
  const releaseAudioResources = () => {
    sourceNodesRef.current.forEach((source) => source.disconnect());
    sourceNodesRef.current = [];

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch((err) => {
        console.error("Error closing the audio context:", err);
      });
    }
  };

  /**
   * Starts recording by combining the provided remote stream with
   * the microphone audio.
   * @param remoteStream - The remote MediaStream (e.g., from the audio element).
   */
  const startRecording = async (remoteStream: MediaStream) => {
    const recordingId = ++recordingIdRef.current;

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Error getting microphone stream:", err);
      // Fallback to an empty MediaStream if microphone access fails.
      micStream = new MediaStream();
    }

    // stopRecording may have run while we were waiting for the microphone.
    if (recordingId !== recordingIdRef.current) {
      micStream.getTracks().forEach((track) => track.stop());
      return;
    }
    micStreamRef.current = micStream;

    // Create an AudioContext to merge the streams.
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const destination = audioContext.createMediaStreamDestination();

    // Connect the remote audio stream.
    try {
      const remoteSource = audioContext.createMediaStreamSource(remoteStream);
      remoteSource.connect(destination);
      sourceNodesRef.current.push(remoteSource);
    } catch (err) {
      console.error("Error connecting remote stream to the audio context:", err);
    }

    // Connect the microphone audio stream.
    try {
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);
      sourceNodesRef.current.push(micSource);
    } catch (err) {
      console.error("Error connecting microphone stream to the audio context:", err);
    }

    const options = { mimeType: "audio/webm" };
    try {
      const mediaRecorder = new MediaRecorder(destination.stream, options);
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      // Start recording without a timeslice.
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("Error starting MediaRecorder with combined stream:", err);
      releaseAudioResources();
    }
  };

  /**
   * Stops the MediaRecorder, if active, and releases the microphone and the
   * AudioContext it was recording through.
   */
  const stopRecording = () => {
    recordingIdRef.current++;

    const mediaRecorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      // Release the microphone and the AudioContext only once the recorder has
      // flushed its final chunk, so the end of the recording is not lost.
      mediaRecorder.onstop = releaseAudioResources;
      // Request any final data before stopping.
      mediaRecorder.requestData();
      mediaRecorder.stop();
    } else {
      releaseAudioResources();
    }
  };

  /**
   * Initiates download of the recording after converting from WebM to WAV.
   * If the recorder is still active, we request its latest data before downloading.
   */
  const downloadRecording = async () => {
    // If recording is still active, request the latest chunk.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Request the current data.
      mediaRecorderRef.current.requestData();
      // Allow a short delay for ondataavailable to fire.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (recordedChunksRef.current.length === 0) {
      console.warn("No recorded chunks found to download.");
      return;
    }
    
    // Combine the recorded chunks into a single WebM blob.
    const webmBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });

    try {
      // Convert the WebM blob into a WAV blob.
      const wavBlob = await convertWebMBlobToWav(webmBlob);
      const url = URL.createObjectURL(wavBlob);

      // Generate a formatted datetime string (replace characters not allowed in filenames).
      const now = new Date().toISOString().replace(/[:.]/g, "-");

      // Create an invisible anchor element and trigger the download.
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `realtime_agents_audio_${now}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the blob URL after a short delay.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Error converting recording to WAV:", err);
    }
  };

  return { startRecording, stopRecording, downloadRecording };
}

export default useAudioDownload; 