import type {Brain} from '../shared/brains';
export type Phase = 'idle'|'connecting'|'listening'|'hearing'|'transcribing'|'thinking'|'voicing'|'speaking';
export type ProcessStatus = {phase:Phase;model:Brain;since:number};
export type ProcessEvent = {phase:Phase;model?:Brain}|{transport:string};
export function processStatus(state:ProcessStatus,event:ProcessEvent,now=Date.now()):ProcessStatus {
 if('phase' in event)return {phase:event.phase,model:event.model??state.model,since:now};
 switch(event.transport){
  case 'input_audio_buffer.speech_started':return {phase:'hearing',model:'realtime',since:now};
  case 'input_audio_buffer.speech_stopped':return {phase:'transcribing',model:'realtime',since:now};
  case 'response.created':
   if(['thinking','voicing','speaking'].includes(state.phase))return state;
   return {phase:'thinking',model:'realtime',since:now};
  case 'output_audio_buffer.started':
   if(['hearing','transcribing'].includes(state.phase) || (state.phase==='thinking' && state.model!=='realtime'))return state;
   return {...state,phase:'speaking',since:now};
  case 'output_audio_buffer.stopped':
  case 'output_audio_buffer.cleared':
   if(state.phase!=='speaking')return state;
   return {...state,phase:'listening',since:now};
  default:return state;
 }
}
