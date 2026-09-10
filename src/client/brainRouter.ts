import {BRAINS,parseBrainCommand,type Brain,type Turn} from '../shared/brains';
type Ports = {
 configure:(brain:Brain)=>void;
 interrupt:()=>void;
 speak:(text:string)=>void;
 history:(excludeItemId?:string)=>Turn[];
 onMode:(brain:Brain)=>void;
 onPending:(brain:Brain|null)=>void;
 onAnswer:(brain:Brain)=>void;
 onError:(message:string)=>void;
 request:(brain:Exclude<Brain,'realtime'>,question:string,history:Turn[],signal:AbortSignal)=>Promise<string>;
};
export class VoiceBrainRouter {
 mode:Brain;
 private generation=0;
 private controller:AbortController|null=null;
 private seen=new Set<string>();
 private closed=false;
 constructor(mode:Brain,private ports:Ports,private language:string){this.mode=mode;}
 cancelPending(){
  this.generation++;
  this.controller?.abort();this.controller=null;
  this.ports.onPending(null);
 }
 select(mode:Brain,announce=false){
  if(this.closed)return;
  this.cancelPending();this.ports.interrupt();this.mode=mode;
  this.ports.configure(mode);this.ports.onMode(mode);this.ports.onError('');
  if(announce)this.ports.speak(this.language==='uk'?'Підключено '+BRAINS[mode].label+'.':'Switched to '+BRAINS[mode].label+'.');
 }
 async transcript(text:string,itemId:string){
  if(this.closed || this.seen.has(itemId) || !text.trim())return;
  this.seen.add(itemId);
  if(this.seen.size>500)this.seen.delete(this.seen.values().next().value!);
  const command=parseBrainCommand(text);
  if(command){
   this.select(command.brain,!command.question);
   if(command.question){
    if(command.brain==='realtime')this.ports.speak(''); // caller requests a normal response to this user's full turn
    else await this.ask(command.question,itemId);
   }
  }else if(this.mode!=='realtime')await this.ask(text,itemId);
 }
 private async ask(question:string,itemId:string){
  if(this.mode==='realtime' || this.closed)return;
  this.cancelPending();
  const version=this.generation;
  const brain=this.mode;
  const controller=new AbortController();this.controller=controller;
  this.ports.onPending(brain);this.ports.onError('');
  try{
   const answer=await this.ports.request(brain,question,this.ports.history(itemId),controller.signal);
   if(this.closed || version!==this.generation || controller.signal.aborted)return;
   this.controller=null;this.ports.onPending(null);this.ports.onAnswer(brain);this.ports.speak(answer);
  }catch{
   if(this.closed || version!==this.generation || controller.signal.aborted)return;
   this.controller=null;this.ports.onPending(null);
   const message=this.language==='uk'?'Не вдалося отримати відповідь від '+BRAINS[brain].label+'. Спробуй ще раз або перемкни режим.':'Could not get an answer from '+BRAINS[brain].label+'. Try again or switch modes.';
   this.ports.onError(message);this.ports.speak(message);
  }
 }
 close(){this.closed=true;this.cancelPending();}
}
