import { instructions } from '../shared/voice';
import {isBrain,brainInstructions} from '../shared/brains';
type Env = { OPENAI_API_KEY?: string; REALTIME_MODEL?: string; APP_ORIGIN?: string };
const headers = { 'Cache-Control': 'no-store' };
export async function createSession(request: Request, env: Env = {OPENAI_API_KEY:process.env.OPENAI_API_KEY, REALTIME_MODEL:process.env.REALTIME_MODEL, APP_ORIGIN:process.env.APP_ORIGIN}, upstream: typeof fetch = fetch) {
 const permitted = new Set(['http://localhost:3210', 'http://127.0.0.1:3210', env.APP_ORIGIN].filter(Boolean));
 if (!permitted.has(request.headers.get('origin') || '')) return Response.json({error: 'This request must come from your voice app.'}, {status: 403, headers});
 if (!env.OPENAI_API_KEY?.trim()) return Response.json({error: 'Add your OpenAI API key to .env.local on your PC, then restart the app.'}, {status: 503, headers});
 let settings: { voice?: string; language?: string; brain?: string };
 try { settings = await request.json(); } catch { return Response.json({error: 'Invalid settings.'}, {status: 400, headers}); }
 if (!settings || !['marin', 'cedar'].includes(settings.voice || '') || !['uk', 'en'].includes(settings.language || '')) return Response.json({error: 'Choose a supported voice and language.'}, {status: 400, headers});
 const brain=settings.brain??'realtime';
 if(!isBrain(brain))return Response.json({error:'Choose a supported reasoning mode.'},{status:400,headers});
 const model = env.REALTIME_MODEL || 'gpt-realtime-2.1';
 try {
  const response = await upstream('https://api.openai.com/v1/realtime/client_secrets', {
   method: 'POST', signal: AbortSignal.timeout(20000),
   headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
   body: JSON.stringify({session: {type:'realtime', model, instructions:instructions(settings.language!)+' '+brainInstructions(brain), audio:{input:{transcription:{model:'gpt-4o-mini-transcribe',language:settings.language},turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:brain==='realtime',interrupt_response:true}},output:{voice:settings.voice}}}}),
  });
  if (!response.ok) {
   const message = response.status === 401 ? 'OpenAI rejected the API key. Update .env.local and restart.' : response.status === 429 ? 'OpenAI usage limit reached. Check API billing and retry.' : 'OpenAI could not start the call. Check model access and try again.';
   return Response.json({error:message}, {status:502,headers});
  }
  const data = await response.json();
  if (typeof data.value !== 'string') throw new Error('Missing client secret');
  return Response.json({value:data.value,model}, {headers});
 } catch { return Response.json({error:'Could not reach OpenAI. Check the PC internet connection and try again.'}, {status:502,headers}); }
}
