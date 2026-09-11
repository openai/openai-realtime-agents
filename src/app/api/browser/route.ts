import {browserTools,callBrowser,browserStatus,showBrowser} from '../../../server/browser';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const origins=['http://localhost:3210','http://127.0.0.1:3210',process.env.APP_ORIGIN];
 if(!origins.includes(request.headers.get('origin')||''))return Response.json({error:'Request must come from your voice app.'},{status:403});
 const headers={'Cache-Control':'no-store'};
 try{
  const raw=await request.text();if(raw.length>20000)return Response.json({error:'Request too large.'},{status:413,headers});
  const body=JSON.parse(raw);
  if(body.action==='status')return Response.json(browserStatus(),{headers});
  if(body.action==='list')return Response.json({tools:await browserTools()},{headers});
  if(body.action==='show')return Response.json(await showBrowser(),{headers});
  if(body.action==='call' && typeof body.name==='string')return Response.json({output:await callBrowser(body.name,body.arguments,request.signal)},{headers});
  return Response.json({error:'Invalid browser request.'},{status:400,headers});
 }catch{return Response.json({error:'Browser action failed or was cancelled. Retry with a fresh page snapshot.'},{status:502,headers});}
}

