import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerWithBrain} from '../src/server/brain';
import {validateBrowserCall} from '../src/server/browser';
import {POST} from '../src/app/api/browser/route';
const env={OPENAI_API_KEY:'test',APP_ORIGIN:'https://pc.example'};
const request=()=>new Request('http://localhost:3210/api/brain',{method:'POST',headers:{origin:'https://pc.example'},body:JSON.stringify({brain:'terra',language:'uk',question:'Open the requested page',history:[],browser:true})});
const definition={name:'browser_snapshot',inputSchema:{type:'object' as const,properties:{}}};
test('browser tool loop forwards reasoning and tool evidence before the final answer',async()=>{
 const payloads:any[]=[];let calls=0;
 const response=await answerWithBrain(request(),env,async(_url,init)=>{
  payloads.push(JSON.parse(init?.body as string));
  return Response.json({status:'completed',output:payloads.length===1?[{type:'reasoning',id:'r1',summary:[]},{type:'function_call',call_id:'c1',name:'browser_snapshot',arguments:'{}'}]:[{type:'message',content:[{type:'output_text',text:'Observed the page.'}]}]});
 },{list:async()=>[definition],call:async()=>{calls++;return 'PAGE EVIDENCE';}});
 assert.equal(response.status,200);assert.equal(calls,1);
 assert.equal(payloads[0].tools[0].strict,false);
 assert.ok(payloads[1].input.some((x:any)=>x.type==='reasoning'));
 assert.ok(payloads[1].input.some((x:any)=>x.call_id==='c1' && x.output==='PAGE EVIDENCE'));
});
test('unknown tool calls are not executed and browser loops are bounded',async()=>{
 let calls=0;let rounds=0;
 const response=await answerWithBrain(request(),env,async()=>{rounds++;return Response.json({status:'completed',output:[{type:'function_call',call_id:'c'+rounds,name:'shell',arguments:'{}'}]});},{list:async()=>[definition],call:async()=>{calls++;return '';}});
 assert.equal(calls,0);assert.equal(rounds,13);assert.equal(response.status,502);
});
test('browser API rejects missing or foreign origins before opening a browser',async()=>{
 for(const origin of ['', 'https://evil.example']){const r=await POST(new Request('http://localhost:3210/api/browser',{method:'POST',headers:{origin},body:JSON.stringify({action:'show'})}));assert.equal(r.status,403);}
});
test('browser tool boundary rejects code, files and non-web navigation',()=>{
 for(const [name,args] of [['browser_evaluate',{}],['browser_snapshot',{filename:'secret.txt'}],['browser_navigate',{url:'file:///C:/secret'}],['browser_navigate',{url:'javascript:alert(1)'}],['browser_wait_for',{time:999}] ] as [string,Record<string,unknown>][])assert.throws(()=>validateBrowserCall(name,args));
 assert.doesNotThrow(()=>validateBrowserCall('browser_navigate',{url:'https://example.com'}));
});
