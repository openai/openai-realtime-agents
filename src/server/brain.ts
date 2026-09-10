import {BRAINS,isBrain,type Turn} from '../shared/brains';
type Env={OPENAI_API_KEY?:string;APP_ORIGIN?:string};
const headers={'Cache-Control':'no-store'};
const fail=(error:string,status=400)=>Response.json({error},{status,headers});
export async function answerWithBrain(request:Request,env:Env={OPENAI_API_KEY:process.env.OPENAI_API_KEY,APP_ORIGIN:process.env.APP_ORIGIN},upstream:typeof fetch=fetch) {
 const origins=['http://localhost:3210','http://127.0.0.1:3210',env.APP_ORIGIN];
 if (!origins.includes(request.headers.get('origin')||'')) return fail('Request must come from your voice app.',403);
 if (!env.OPENAI_API_KEY) return fail('OpenAI API key is missing.',503);
 let data;
 try {const raw=await request.text();if(raw.length>100000)return fail('Conversation is too large.',413);data=JSON.parse(raw);}catch{return fail('Invalid request.');}
 if (!data || !isBrain(data.brain) || data.brain==='realtime' || !['uk','en'].includes(data.language) || typeof data.question!=='string' || !data.question.trim() || data.question.length>12000 || !Array.isArray(data.history) || data.history.length>40) return fail('Invalid reasoning request.');
 if (data.history.some((t:Turn)=>!t || !['user','assistant'].includes(t.role) || typeof t.text!=='string' || t.text.length>8000)) return fail('Invalid conversation history.');
 const brain=data.brain as Exclude<keyof typeof BRAINS,'realtime'>;
 try {
  const response=await upstream('https://api.openai.com/v1/responses',{
   method:'POST',signal:AbortSignal.any([request.signal,AbortSignal.timeout(120000)]),
   headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:BRAINS[brain].model,store:false,reasoning:{effort:'medium'},max_output_tokens:4096,
    instructions:'You are '+BRAINS[brain].label+', the reasoning model for a private voice companion. Reply in '+(data.language==='uk'?'Ukrainian':'English')+' unless the user explicitly requests otherwise. The following input contains a bounded transcript of the conversation followed by the latest request. Answer the latest request using that context. Usually use 2-5 conversational sentences; expand when needed. No markdown tables or spoken URLs. Be accurate and preserve uncertainty. You have no external tools or live browsing. Never claim otherwise.',
    input:[...data.history.map((t:Turn)=>({role:t.role,content:t.text})),{role:'user',content:data.question}]
   })
  });
  if(!response.ok) return fail(response.status===404||response.status===403?'Selected model is not available to this API key. Choose another mode.':response.status===429?'OpenAI usage limit reached. Try again or choose another mode.':'The selected model could not answer. Try again or choose another mode.',502);
  const result=await response.json();
  if(result.status && result.status!=='completed') return fail('The model did not finish its answer. Try a shorter question.',502);
  const answer=(result.output||[]).filter((item:{type:string})=>item.type==='message').flatMap((item:{content?:{type:string;text?:string}[]})=>item.content||[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('\n').trim();
  if(!answer)return fail('The model returned no spoken answer. Please try again.',502);
  return Response.json({answer,brain,model:BRAINS[brain].model},{headers});
 } catch {return fail(request.signal.aborted?'Request cancelled.':'The reasoning request timed out or lost connection. Please try again.',502);}
}

