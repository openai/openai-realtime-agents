'use client';
import {useEffect, useRef, useState} from 'react';
import {RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC} from '@openai/agents/realtime';
import {instructions} from '../shared/voice';

type Status = 'idle' | 'connecting' | 'listening' | 'speaking';
type Line = {id: string; role: string; text: string};
export default function VoiceApp() {
 const [status, setStatus] = useState<Status>('idle');
 const [ready, setReady] = useState<boolean | null>(null);
 const [error, setError] = useState('');
 const [muted, setMuted] = useState(false);
 const [voice, setVoice] = useState('marin');
 const [language, setLanguage] = useState('uk');
 const [lines, setLines] = useState<Line[]>([]);
 const [elapsed, setElapsed] = useState(0);
 const [keepAwake, setKeepAwake] = useState(true);
 const [wakeActive, setWakeActive] = useState(false);
 const session = useRef<RealtimeSession | null>(null);
 const stream = useRef<MediaStream | null>(null);
 const audio = useRef<HTMLAudioElement | null>(null);
 const wake = useRef<WakeLockSentinel | null>(null);
 const attempt = useRef(0);
 const busy = useRef(false);
 const timer = useRef<ReturnType<typeof setInterval> | null>(null);
 const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
 const abort = useRef<AbortController | null>(null);
 const active = status !== 'idle';

 function dispose() {
  attempt.current++;
  busy.current = false;
  abort.current?.abort(); abort.current = null;
  const current = session.current; session.current = null;
  try { current?.close(); } catch {}
  stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
  if (audio.current) { audio.current.pause(); audio.current.srcObject = null; audio.current = null; }
  void wake.current?.release().catch(() => {}); wake.current = null;
  if (timer.current) clearInterval(timer.current);
  if (watchdog.current) clearTimeout(watchdog.current);
  timer.current = null; watchdog.current = null;
 }
 function end() { dispose(); setStatus('idle'); setMuted(false); setWakeActive(false); }
 async function health() {
  try { const r = await fetch('/api/health', {cache:'no-store'}); if (!r.ok) throw new Error(); const data = await r.json(); setReady(Boolean(data.ready)); }
  catch { setReady(null); setError('Cannot reach your PC. Check Tailscale and restart the app.'); }
 }
 useEffect(() => {
  void health();
  const savedVoice = localStorage.getItem('voice');
  const savedLanguage = localStorage.getItem('language');
  if (savedVoice === 'marin' || savedVoice === 'cedar') setVoice(savedVoice);
  if (savedLanguage === 'uk' || savedLanguage === 'en') setLanguage(savedLanguage);
  const onOffline = () => { end(); setError('Connection lost. Reconnect when your internet returns.'); };
  window.addEventListener('offline', onOffline);
  return () => { dispose(); window.removeEventListener('offline', onOffline); };
 }, []);
 useEffect(() => {
  if (!active || status === 'connecting' || !keepAwake) { void wake.current?.release().catch(() => {}); return; }
  let cancelled = false;
  const acquire = async () => {
   if (document.visibilityState !== 'visible' || !navigator.wakeLock || wake.current) return;
   try {
    const lock = await navigator.wakeLock.request('screen');
    if (cancelled) { await lock.release(); return; }
    wake.current = lock; setWakeActive(true);
    lock.addEventListener('release', () => { if (wake.current === lock) {wake.current = null; setWakeActive(false);} });
   } catch { setWakeActive(false); }
  };
  void acquire(); document.addEventListener('visibilitychange', acquire);
  return () => { cancelled = true; document.removeEventListener('visibilitychange', acquire); void wake.current?.release().catch(() => {}); };
 }, [active, status === 'connecting', keepAwake]);

 async function start() {
  if (busy.current || session.current) return;
  busy.current = true; const id = ++attempt.current;
  setError(''); setLines([]); setElapsed(0); setMuted(false); setStatus('connecting');
  const fail = (message: string) => { if (attempt.current !== id) return; end(); setError(message); };
  watchdog.current = setTimeout(() => fail('Connection timed out. Check microphone permission and try again.'), 35000);
  try {
   if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open the private HTTPS link to enable your microphone.');
   const player = document.createElement('audio'); player.autoplay = true; player.setAttribute('playsinline',''); audio.current = player;
   // Invoke capture directly from the button gesture for mobile browsers.
   const mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if (attempt.current !== id) {mic.getTracks().forEach(t=>t.stop());return;}
   stream.current = mic;
   mic.getAudioTracks()[0]?.addEventListener('ended', () => fail('The microphone stopped. Tap Start to reconnect.'));
   mic.getAudioTracks()[0]?.addEventListener('mute', () => {if(attempt.current===id)setError('Microphone paused by the phone. Return to the app to resume.');});
   mic.getAudioTracks()[0]?.addEventListener('unmute', () => {if(attempt.current===id)setError('');});
   abort.current = new AbortController();
   const response = await fetch('/api/session', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice,language}),signal:abort.current.signal});
   const token = await response.json();
   if (!response.ok) throw new Error(token.error || 'Could not start the call.');
   if (attempt.current !== id) return;
   const transport = new OpenAIRealtimeWebRTC({audioElement:player,mediaStream:mic});
   const agent = new RealtimeAgent({name:'Vinson',instructions:instructions(language),voice,tools:[]});
   const call = new RealtimeSession(agent,{transport,model:token.model, tracingDisabled:true,
    config:{audio:{input:{transcription:{model:'gpt-4o-mini-transcribe',language},turnDetection:{type:'semantic_vad',eagerness:'medium',createResponse:true,interruptResponse:true}},output:{voice}}}});
   session.current = call;
   call.on('error', () => fail('The voice session encountered an error. End the call and reconnect.'));
   call.on('history_updated', history => {
    if (attempt.current !== id) return;
    setLines(history.flatMap(item => item.type === 'message' && (item.role === 'user' || item.role === 'assistant') ? [{
     id:item.itemId, role:item.role, text:item.content.map(c => 'text' in c ? c.text : 'transcript' in c ? c.transcript : '').filter(Boolean).join(' ')
    }] : []).filter(line=>line.text));
   });
   call.on('transport_event', event => {
    if (attempt.current !== id) return;
    if (event.type === 'output_audio_buffer.started') setStatus('speaking');
    if (['output_audio_buffer.stopped','output_audio_buffer.cleared','input_audio_buffer.speech_started'].includes(event.type)) setStatus('listening');
   });
   transport.on('connection_change', state => {if(state === 'disconnected') fail('Call disconnected. Tap Start for a new conversation.');});
   await call.connect({apiKey:token.value});
   if (attempt.current !== id) {call.close();return;}
   if (watchdog.current) clearTimeout(watchdog.current);
   busy.current = false; setStatus('listening');
   const started = Date.now(); timer.current = setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);
   await player.play().catch(()=>setError('Audio playback paused. Tap Resume audio.'));
   // Ask for a greeting without inserting a fabricated user message into the transcript.
   call.transport.sendEvent({type:'response.create',response:{instructions:'Give one short greeting and invite the user to speak.'}});
  } catch (e) {
   const message = e instanceof Error ? (e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser settings and try again.' : e.name === 'NotFoundError' ? 'No microphone found. Connect a microphone and retry.' : e.message) : 'Could not connect.';
   fail(message);
  }
 }
 function toggleMute() {const next=!muted;session.current?.mute(next);setMuted(next);}
 return <main>
  <header><a className="brand" href="/"><span className="brand-mark">v</span> vinson<span className="brand-light"> / voice</span></a><span className="private"><i/> Personal space</span></header>
  <section className="conversation">
   <div className="eyebrow">A LITTLE SPACE TO THINK OUT LOUD</div>
   <h1>{active ? 'I’m here.' : 'Let’s talk.'}</h1>
   <p className="subtitle">{active ? 'Take your time. You can interrupt me anytime.' : 'Your thoughts, a familiar voice. Just start speaking.'}</p>
   <div className={'orb-wrap '+status} aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orb"><div className="wave">{[0,1,2,3,4,5,6].map(i=><span key={i} style={{animationDelay:(i*.13)+'s'}}/>)}</div></div></div>
   <div className="call-state" role="status"><span className={'dot '+(active?'on':'')}/>{status === 'idle' ? 'Ready when you are' : status === 'connecting' ? 'Connecting…' : muted ? 'Microphone muted' : status === 'speaking' ? 'Vinson is speaking' : 'Listening to you'}{active && status!=='connecting' && <span className="clock">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>}</div>
   {error && <div className="notice error" role="alert">{error}{error.includes('Resume audio') && <button onClick={()=>void audio.current?.play().then(()=>setError('')).catch(()=>{})}>Resume audio</button>}</div>}
   {ready === false && <div className="notice setup"><strong>One small setup step</strong><p>Add your API key to <code>.env.local</code> on your PC and restart the app.</p><button onClick={()=>void health()}>Check again ↗</button></div>}
   <div className="actions">
    {active ? <><button className="secondary" disabled={status==='connecting'} onClick={toggleMute}>{muted?'Unmute':'Mute mic'}</button><button className="end" onClick={end}>{status==='connecting'?'Cancel':'End conversation'}</button></> : <button className="start" onClick={()=>void start()} disabled={ready!==true}><Mic/> Start conversation <span>↗</span></button>}
   </div>
   <p className="small">{active ? 'Speak naturally. No need to hold a button.' : 'Your microphone stays off until you start.'}</p>
  </section>
  <section className="preferences" aria-label="Conversation settings">
   <label>VOICE<select aria-label="Voice" disabled={active} value={voice} onChange={e=>{setVoice(e.target.value);localStorage.setItem('voice',e.target.value);}}><option value="marin">Marin</option><option value="cedar">Cedar</option></select></label>
   <label>LANGUAGE<select aria-label="Language" disabled={active} value={language} onChange={e=>{setLanguage(e.target.value);localStorage.setItem('language',e.target.value);}}><option value="uk">Українська</option><option value="en">English</option></select></label>
   <label className="awake"><input type="checkbox" checked={keepAwake} onChange={e=>setKeepAwake(e.target.checked)}/><span>Keep screen awake<small>{wakeActive?'Active during this call':'While this page is visible'}</small></span></label>
  </section>
  <details className="transcript"><summary>Conversation transcript <span>{lines.length ? lines.length+' messages' : 'This call only'}</span></summary><div className="messages">{lines.length ? lines.map(line=><article key={line.id} className={line.role}><b>{line.role==='user'?'You':'Vinson'}</b><p>{line.text}</p></article>) : <p className="empty">Your conversation will appear here.</p>}</div></details>
  <footer><span>VOICE FIRST. NO RUSH.</span><p>Voice is processed by OpenAI. API usage is billed separately.<br/>Screen-lock and Bluetooth behavior depend on your phone and browser.</p></footer>
 </main>;
}
function Mic(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8"/></svg>;}
