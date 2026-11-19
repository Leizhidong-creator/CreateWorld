import test from 'node:test';import assert from 'node:assert/strict';
import {redact} from '../packages/shared/files.js';import {runCodex} from '../packages/codex-adapter/index.js';
test('event logs redact token keys and large media while retaining useful fields',()=>{const v=redact({accessToken:'secret',nested:{api_key:'secret',model:'m'},result:'iVBOR'+'a'.repeat(20000)});assert.equal(v.accessToken,'[REDACTED]');assert.equal(v.nested.api_key,'[REDACTED]');assert.equal(v.nested.model,'m');assert.ok(v.result.sha256);});
test('cancelled Codex invocation never starts a process',async()=>{const c=new AbortController();c.abort();await assert.rejects(runCodex({cwd:'/tmp/unused',prompt:'unused',logDir:'/tmp/unused',signal:c.signal}),/制作已停止/);});

test('host work does not consume the model thinking timeout',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-rpc-clock-'));const previous=process.env.CODEX_BINARY;
 // Use the current Node executable plus an `app-server` entry script. This is
 // spawn-compatible on Windows, where .cmd shims cannot be spawned directly.
 fs.writeFileSync(path.join(root,'app-server'),`const readline=require('node:readline');const send=x=>process.stdout.write(JSON.stringify(x)+String.fromCharCode(10));readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'fixture-thread'},model:'test-only'}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({id:900,method:'item/tool/call',params:{tool:'slow_host',arguments:{}}});}else if(m.id===900)send({method:'turn/completed',params:{turn:{status:'completed'}}});});
`,{mode:0o755});process.env.CODEX_BINARY=process.execPath;
 try{const result=await runCodex({cwd:root,prompt:'test',logDir:path.join(root,'log'),timeoutMs:3000,hostTools:[{name:'slow_host',description:'Test only',schema:{type:'object'},execute:async()=>{await new Promise(r=>setTimeout(r,4500));return{text:'completed'};}}]});assert.equal(result.status,'completed');}catch(error){console.error(fs.readFileSync(path.join(root,'log/events.jsonl'),'utf8'));throw error;}finally{if(previous===undefined)delete process.env.CODEX_BINARY;else process.env.CODEX_BINARY=previous;await new Promise(r=>setTimeout(r,200));fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('aborting a running turn interrupts the Codex child',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-rpc-abort-'));const previous=process.env.CODEX_BINARY;
 fs.writeFileSync(path.join(root,'app-server'),`const readline=require('node:readline');const send=x=>process.stdout.write(JSON.stringify(x)+String.fromCharCode(10));readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'fixture-thread'},model:'test-only'}});else if(m.method==='turn/start')send({id:m.id,result:{turn:{id:'turn'}}});});
`);
 process.env.CODEX_BINARY=process.execPath;
 try{
  const controller=new AbortController(),started=Date.now();
  const run=runCodex({cwd:root,prompt:'test',logDir:path.join(root,'log'),signal:controller.signal,timeoutMs:60000});
  setTimeout(()=>controller.abort(),300);
  await assert.rejects(run,/制作已停止/);
  assert.ok(Date.now()-started<5000,'abort must not wait for the model timeout');
 }finally{if(previous===undefined)delete process.env.CODEX_BINARY;else process.env.CODEX_BINARY=previous;await new Promise(r=>setTimeout(r,200));fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
