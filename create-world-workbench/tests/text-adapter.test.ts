import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runCodex} from '../packages/codex-adapter/index.js';

test('text task replaces full-game developer instructions and pins process-scoped model parameters',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-text-rpc-')),previous=process.env.CODEX_BINARY;
 fs.writeFileSync(path.join(dir,'app-server'),`const fs=require('node:fs');const readline=require('node:readline');const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});if(m.method==='thread/start'){fs.writeFileSync('thread.json',JSON.stringify(m.params));send({id:m.id,result:{thread:{id:'synthetic-protocol'},model:'synthetic-protocol'}});}if(m.method==='turn/start'){fs.writeFileSync('turn.json',JSON.stringify(m.params));send({id:m.id,result:{turn:{id:'turn'}}});send({method:'turn/completed',params:{turn:{status:'completed'}}});}});`);
 process.env.CODEX_BINARY=process.execPath;
 try{
  const result=await runCodex({cwd:dir,logDir:path.join(dir,'logs'),prompt:'test-only',taskInstructions:'Only write the rough script. Do not generate game code.'});
  assert.equal(result.model,'synthetic-protocol');
  const thread=JSON.parse(fs.readFileSync(path.join(dir,'thread.json'),'utf8')),turn=JSON.parse(fs.readFileSync(path.join(dir,'turn.json'),'utf8'));
  assert.equal(thread.model,'gpt-6-astra');assert.equal(turn.model,'gpt-6-astra');assert.equal(turn.effort,'medium');
  assert.equal(thread.config['features.multi_agent'],false);assert.equal(thread.developerInstructions,'Only write the rough script. Do not generate game code.');
  assert.equal(thread.developerInstructions.includes('complete game task'),false);
 }finally{if(previous===undefined)delete process.env.CODEX_BINARY;else process.env.CODEX_BINARY=previous;await new Promise(r=>setTimeout(r,200));await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
