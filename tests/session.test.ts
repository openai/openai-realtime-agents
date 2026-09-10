import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../src/server/session';
const request = (origin='http://localhost:3210', body:unknown={voice:'marin',language:'uk'})=>new Request('http://localhost:3210/api/session',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('rejects foreign and absent origins before issuing a credential',async()=>{
 for(const origin of ['https://evil.example','']){const r=await createSession(request(origin),{OPENAI_API_KEY:'secret'});assert.equal(r.status,403);}
});
test('missing key fails clearly and never contacts OpenAI',async()=>{
 const r=await createSession(request(),{},async()=>{throw new Error('Must not call');});assert.equal(r.status,503);assert.match((await r.json()).error,/API key/);
});
test('settings allowlist rejects model/voice injection',async()=>{
 for(const body of [null,{voice:'unknown',language:'uk'},{voice:'marin',language:'unknown'}]) assert.equal((await createSession(request(undefined,body),{OPENAI_API_KEY:'secret'})).status,400);
});
test('private origin gets only short-lived credential and configured model',async()=>{
 const upstream:typeof fetch=async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/realtime/client_secrets');
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer secret');
  const payload=JSON.parse(init?.body as string);assert.equal(payload.session.audio.input.turn_detection.interrupt_response,true);assert.equal(payload.session.audio.output.voice,'marin');
  return Response.json({value:'ephemeral',api_key:'do-not-return'});
 };
 const r=await createSession(request('https://pc.example'),{OPENAI_API_KEY:'secret',APP_ORIGIN:'https://pc.example'},upstream);
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{value:'ephemeral',model:'gpt-realtime-2.1'});
});
test('upstream failures are sanitized',async()=>{
 for(const status of [401,429,500]){const r=await createSession(request(),{OPENAI_API_KEY:'secret'},async()=>Response.json({error:'sensitive upstream details'},{status}));assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/sensitive|secret/);}
});
