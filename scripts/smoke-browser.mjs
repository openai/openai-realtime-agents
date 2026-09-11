import {RealtimeAgent,RealtimeSession,tool} from '@openai/agents/realtime';
process.loadEnvFile('.env.local');
const base='http://127.0.0.1:3210';
async function browser(body){const r=await fetch(base+'/api/browser',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('Browser HTTP '+r.status);return r.json();}
const definitions=(await browser({action:'list'})).tools;
let calls=0;
const agent=new RealtimeAgent({name:'Browser smoke',instructions:'Use browser tools to inspect the requested page. First navigate and then take a snapshot. Only visit example.com. Answer briefly in Ukrainian using the observed heading. Do not answer from memory.',tools:definitions.map(d=>tool({name:d.name,description:d.description,parameters:d.inputSchema,strict:false,execute:async args=>{calls++;console.log('TOOL '+d.name);return (await browser({action:'call',name:d.name,arguments:args})).output;}}))});
const session=new RealtimeSession(agent,{transport:'websocket',model:'gpt-realtime-2.1',tracingDisabled:true,config:{outputModalities:['text']}});
const done=new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(new Error('Smoke timed out')),45000);
 session.on('error',()=>{clearTimeout(timeout);reject(new Error('Realtime smoke error'));});
 session.on('transport_event',e=>{if(e.type==='response.done' && calls>=2){const messages=(e.response?.output||[]).filter(x=>x.type==='message');if(messages.length){clearTimeout(timeout);console.log(JSON.stringify({calls,output:messages}));resolve();}}});
});
try{await session.connect({apiKey:process.env.OPENAI_API_KEY});session.sendMessage('Відкрий https://example.com і прочитай заголовок сторінки.');await done;}finally{session.close();}
