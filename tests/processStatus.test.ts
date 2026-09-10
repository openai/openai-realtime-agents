import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processStatus,type ProcessStatus} from '../src/client/processStatus';
const initial:ProcessStatus={phase:'listening',model:'realtime',since:0};
test('reasoning survives late audio stop and response events',()=>{
 const thinking=processStatus(initial,{phase:'thinking',model:'astra'},10);
 for(const transport of ['output_audio_buffer.stopped','output_audio_buffer.cleared','response.created','output_audio_buffer.started'])assert.deepEqual(processStatus(thinking,{transport},20),thinking);
});
test('voice keeps answer attribution and waits for playback to end',()=>{
 let state=processStatus(initial,{phase:'voicing',model:'sol'},10);
 state=processStatus(state,{transport:'response.created'},20);
 assert.equal(state.model,'sol');assert.equal(state.since,10);
 state=processStatus(state,{transport:'output_audio_buffer.started'},30);
 assert.equal(state.phase,'speaking');assert.equal(state.model,'sol');
 assert.deepEqual(processStatus(state,{transport:'response.done'},40),state);
 assert.equal(processStatus(state,{transport:'output_audio_buffer.stopped'},50).phase,'listening');
});
test('interruption shows new speech and transcription despite old audio events',()=>{
 let state=processStatus(initial,{phase:'thinking',model:'terra'},10);
 state=processStatus(state,{transport:'input_audio_buffer.speech_started'},20);
 assert.equal(state.phase,'hearing');
 state=processStatus(state,{transport:'output_audio_buffer.cleared'},21);
 assert.equal(state.phase,'hearing');
 state=processStatus(state,{transport:'input_audio_buffer.speech_stopped'},30);
 assert.equal(state.phase,'transcribing');
 assert.equal(processStatus(state,{phase:'idle'},40).phase,'idle');
});
