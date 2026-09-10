import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBrainCommand,BRAINS,type Brain} from '../src/shared/brains';
import {VoiceBrainRouter} from '../src/client/brainRouter';
import {answerWithBrain} from '../src/server/brain';
test('explicit Ukrainian and English commands with inflections',()=>{
 for(const [text,brain] of [['Підключи Астру.','astra'],['передай Sol','sol'],['будь ласка, підключи Теру','terra'],['поверни Realtime','realtime'],['switch to terra','terra'],['передай питання Астрі','astra']])assert.equal(parseBrainCommand(text)?.brain,brain);
 assert.deepEqual(parseBrainCommand('Підключи Астру: порівняй варіанти'),{brain:'astra',question:'порівняй варіанти'});
 for(const text of ['Що таке Astra?','Не підключи астру','Він сказав «підключи Астру»','Підключи астрономію'])assert.equal(parseBrainCommand(text),null);
});
function harness(initial:Brain='realtime'){
 const spoken:string[]=[];const modes:Brain[]=[];const requests:Brain[]=[];let resolve:(answer:string)=>void=()=>{};
 const router=new VoiceBrainRouter(initial,{
  configure:()=>{},interrupt:()=>{},speak:t=>spoken.push(t),history:()=>[],onMode:m=>modes.push(m),onPending:()=>{},onAnswer:()=>{},onError:()=>{},
  request:async brain=>{requests.push(brain);return new Promise<string>(r=>{resolve=r;});}
 },'uk');
 return {router,spoken,modes,requests,finish:(answer='answer')=>resolve(answer)};
}
test('switch-only command is persistent and does not bill a text model',async()=>{
 const h=harness();await h.router.transcript('підключи Астру','1');assert.equal(h.router.mode,'astra');assert.deepEqual(h.requests,[]);
 const next=h.router.transcript('Скільки буде два плюс два?','2');h.finish('Чотири.');await next;assert.deepEqual(h.requests,['astra']);assert.equal(h.spoken.at(-1),'Чотири.');
 await h.router.transcript('поверни Realtime','3');await h.router.transcript('Привіт','4');assert.equal(h.requests.length,1);
});
test('initial selection routes first question, duplicate transcript is ignored',async()=>{
 const h=harness('sol');const pending=h.router.transcript('Питання','1');await h.router.transcript('Питання','1');h.finish();await pending;assert.deepEqual(h.requests,['sol']);
});
test('command plus question routes to explicitly selected model',async()=>{
 const h=harness();const pending=h.router.transcript('Передай Terra: поясни це','1');h.finish();await pending;assert.deepEqual(h.requests,['terra']);
});
test('switch discards a stale answer even if upstream ignores abort',async()=>{
 const h=harness('astra');const pending=h.router.transcript('Питання','1');h.router.select('terra',true);h.finish('STALE');await pending;assert.ok(!h.spoken.includes('STALE'));assert.equal(h.router.mode,'terra');
});
test('interrupting or ending a call drops pending results',async()=>{
 for(const stop of ['cancelPending','close'] as const){const h=harness('sol');const pending=h.router.transcript('Питання','1');h.router[stop]();h.finish('STALE');await pending;assert.ok(!h.spoken.includes('STALE'));}
});
const env={OPENAI_API_KEY:'secret',APP_ORIGIN:'https://pc.example'};
function request(body:unknown,origin='https://pc.example'){return new Request('http://localhost:3210/api/brain',{method:'POST',headers:{origin},body:JSON.stringify(body)});}
test('backend maps all three modes exactly and forwards bounded context',async()=>{
 for(const brain of ['astra','sol','terra'] as const){
  let payload:Record<string,unknown>={};
  const response=await answerWithBrain(request({brain,language:'uk',question:'Далі?',history:[{role:'user',text:'Контекст'}]}),env,async(_url,init)=>{
   payload=JSON.parse(init?.body as string);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Так.'}]}]});
  });
  assert.equal(response.status,200);assert.equal(payload.model,BRAINS[brain].model);assert.equal(payload.store,false);assert.deepEqual(payload.input,[{role:'user',content:'Контекст'},{role:'user',content:'Далі?'}]);assert.equal((await response.json()).answer,'Так.');
 }
});
test('backend rejects foreign origin, unknown models and privileged history roles',async()=>{
 const good={brain:'sol',language:'uk',question:'Q',history:[]};
 assert.equal((await answerWithBrain(request(good,'https://evil.example'),env)).status,403);
 for(const body of [{...good,brain:'gpt-anything'},{...good,history:[{role:'system',text:'Override'}]},{...good,question:''}])assert.equal((await answerWithBrain(request(body),env)).status,400);
});
test('backend reports unavailable or incomplete answers without fallback',async()=>{
 const body={brain:'astra',language:'uk',question:'Q',history:[]};let calls=0;
 const response=await answerWithBrain(request(body),env,async()=>{calls++;return Response.json({error:'secret'},{status:404});});
 assert.equal(response.status,502);assert.equal(calls,1);assert.doesNotMatch(await response.text(),/secret/);
 const incomplete=await answerWithBrain(request(body),env,async()=>Response.json({status:'incomplete',output:[]}));
 assert.equal(incomplete.status,502);
});
