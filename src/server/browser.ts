import {createConnection} from '@playwright/mcp';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {chromium} from '@playwright/test';
import path from 'node:path';
import {BROWSER_LABELS,type BrowserTool} from '../shared/browser';

type Connection={client:Client;server:Awaited<ReturnType<typeof createConnection>>};
type State={connection?:Promise<Connection>;queue:Promise<unknown>;visible:boolean;status:{busy:boolean;action:string;since:number}};
const globalBrowser=globalThis as typeof globalThis & {vinsonBrowser?:State};
const state=globalBrowser.vinsonBrowser??={queue:Promise.resolve(),visible:false,status:{busy:false,action:'Браузер готовий',since:Date.now()}};
export function browserStatus(){return {...state.status,visible:state.visible};}
async function connection(){
 if(!state.connection)state.connection=(async()=>{
  const server=await createConnection({browser:{browserName:'chromium',userDataDir:path.join(process.cwd(),'.browser-profile'),launchOptions:{headless:!state.visible,executablePath:chromium.executablePath()},contextOptions:{acceptDownloads:false}},outputDir:path.join(process.cwd(),'logs','browser'),saveSession:false,timeouts:{action:10000,navigation:25000}});
  const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);
  const client=new Client({name:'vinson-voice',version:'1.0'});await client.connect(b);
  return {client,server};
 })().catch(e=>{state.connection=undefined;throw e;});
 return state.connection;
}
export async function browserTools():Promise<BrowserTool[]>{
 const {client}=await connection();
 return (await client.listTools()).tools.filter(t=>Object.hasOwn(BROWSER_LABELS,t.name)).map(t=>{
  const schema=structuredClone(t.inputSchema);delete schema.$schema;
  if(schema.properties)delete schema.properties.filename;
  return {name:t.name,description:t.description,inputSchema:schema};
 });
}
export function validateBrowserCall(name:string,args:Record<string,unknown>){
 if(!Object.hasOwn(BROWSER_LABELS,name))throw new Error('Browser tool is not available.');
 if(!args || Array.isArray(args)||typeof args!=='object'||JSON.stringify(args).length>16000)throw new Error('Invalid browser arguments.');
 if('filename' in args || 'paths' in args || 'function' in args)throw new Error('File and code operations are not available.');
 if('url' in args){const url=new URL(String(args.url));if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use a normal HTTP or HTTPS URL.');}
 if(name==='browser_wait_for' && typeof args.time==='number' && (args.time<0||args.time>10))throw new Error('Wait at most 10 seconds per step.');
}
async function exclusive<T>(work:()=>Promise<T>):Promise<T>{
 const next=state.queue.then(work,work);state.queue=next.catch(()=>{});return next;
}
export async function callBrowser(name:string,args:Record<string,unknown>,signal?:AbortSignal):Promise<string>{
 validateBrowserCall(name,args);
 return exclusive(async()=>{
  signal?.throwIfAborted();
  state.status={busy:true,action:BROWSER_LABELS[name],since:Date.now()};
  try{
   const {client}=await connection();signal?.throwIfAborted();
   // Let the current browser action settle before releasing the shared browser.
   // Aborting stops subsequent actions; an already executed click cannot be undone.
   const result=await client.callTool({name,arguments:args},undefined,{timeout:35000});
   signal?.throwIfAborted();
   const content=result.content as Array<{type:string;text?:string}>;
   return JSON.stringify({isError:!!result.isError,content:content.filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,24000)});
  }finally{state.status={busy:false,action:signal?.aborted?'Браузерну задачу зупинено':'Браузер очікує наступну дію',since:Date.now()};}
 });
}
export async function showBrowser(){
 return exclusive(async()=>{
  if(!state.visible){const old=state.connection;state.connection=undefined;if(old){const c=await old;await c.client.close();await c.server.close();}state.visible=true;}
  const {client}=await connection();await client.callTool({name:'browser_snapshot',arguments:{}},undefined,{timeout:35000});
  return {ok:true};
 });
}

