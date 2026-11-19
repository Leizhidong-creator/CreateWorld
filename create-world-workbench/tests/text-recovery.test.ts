import test from 'node:test';
import assert from 'node:assert/strict';
import {withThreadRecovery} from '../packages/orchestrator/resume-model.js';

const request={cwd:'fixture',logDir:'fixture',prompt:'continue',threadId:'expired'};
test('expired game thread continues existing workspace once, without regenerating text',async()=>{
 const calls:any[]=[],reasons:any[]=[];
 const result=await withThreadRecovery(request,async input=>{calls.push(input);if(input.threadId)throw Error('thread not found');return {threadId:'new',model:'fixture',final:'',status:'completed',images:[],items:[]};},(...reason)=>reasons.push(reason));
 assert.equal(result.threadId,'new');assert.equal(calls.length,2);assert.equal(calls[1].cwd,request.cwd);assert.equal(calls[1].threadId,undefined);assert.ok(calls[1].prompt.includes('有效产物'));assert.equal(reasons.length,1);
});
test('network or quota errors and cancelled requests do not trigger thread recovery loops',async()=>{
 for(const message of ['Codex 请求超时: thread/resume','quota exceeded','tool failed']){let calls=0;await assert.rejects(withThreadRecovery(request,async()=>{calls++;throw Error(message);},()=>assert.fail('unexpected fallback')));assert.equal(calls,1);}
 const abort=new AbortController();abort.abort();let calls=0;await assert.rejects(withThreadRecovery({...request,signal:abort.signal},async()=>{calls++;throw Error('thread not found');},()=>assert.fail('unexpected fallback')));assert.equal(calls,1);
 let attempts=0;await assert.rejects(withThreadRecovery(request,async()=>{attempts++;throw Error('thread not found');},()=>{}));assert.equal(attempts,2);
});
