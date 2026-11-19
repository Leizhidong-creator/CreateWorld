import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stringify} from 'yaml';
import {Workbench} from '../packages/orchestrator/service.js';
import {TextWorkflow} from '../packages/text-workflow/service.js';
import {TextGameHandoff} from '../packages/text-workflow/handoff.js';
import {fixtureRunner} from './text-fixtures.js';
import {hash} from '../packages/shared/files.js';
import {productionEvidenceErrors} from '../packages/orchestrator/production-evidence.js';
import {productionPrompt} from '../packages/orchestrator/production-prompt.js';
import {yamlCoverageErrors} from '../packages/orchestrator/yaml-production.js';
import http from 'node:http';
import {createWorkbenchApp} from '../apps/server/app.js';
import {compileGame} from '../packages/compiler/index.js';
import {candidateHash} from '../packages/orchestrator/candidate.js';
import {hashFile,hashTree,writeJson} from '../packages/shared/files.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Synthetic artifact: checks below test host transactions, not model quality.
const yaml=stringify({'规范版本':'1.0','项目':{},'场景':[{id:'S_A'},{id:'S_B'}],'事件':[{id:'E_A'},{id:'E_B'}],'玩法':[],'结局':[{id:'END'}],'主线':['E_A','E_B']});
async function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-handoff-')),game=new Workbench({root,dataRoot:dir,previewOrigin:()=>''});game.maxParallel=0;
 const text=new TextWorkflow({root,dataRoot:dir,store:game.store,runner:fixtureRunner,methods:()=>({'content-standard.md':'fixture','execution-standard.md':'fixture'}),baseline:async()=>({errors:[]})});
 const p=text.create({title:'原创合成协议样例',inputKind:'text',sourceText:'阿禾在门口找到灯，将灯送回邻居家，最后回家。'});
 text.start(p.id,{requestKey:'script',kind:'script',baseVersionId:null});await text.idle();text.start(p.id,{requestKey:'yaml',kind:'yaml',baseVersionId:text.project(p.id).currentScriptId});await text.idle();
 const v=text.version(p.id,text.project(p.id).currentYamlId!);
 fs.writeFileSync(path.join(dir,'text/artifacts',v.id,'game.yaml'),yaml);game.store.patch<any>('text_version',v.id,{bodyHash:hash(yaml)});
 const bridge=new TextGameHandoff(text,game);
 return {dir,game,text,p,bridge,input:{requestKey:'confirm',versionId:v.id,bodyHash:hash(yaml),confirmed:true},cleanup:async()=>{bridge.close();await text.close();await game.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('passed YAML waits for explicit confirmation; confirmation starts exactly one associated game',async()=>{
 const h=await setup();try{
  assert.equal(h.game.store.list('run').length,0);assert.equal(h.bridge.get(h.p.id).length,0);
  assert.throws(()=>h.bridge.confirm(h.p.id,{...h.input,confirmed:false}));
  const a=h.bridge.confirm(h.p.id,h.input),b=h.bridge.confirm(h.p.id,h.input),c=h.bridge.confirm(h.p.id,{...h.input,requestKey:'second-click'});
  assert.equal(a.runId,b.runId);assert.equal(a.runId,c.runId);assert.equal(h.game.store.list('run').length,1);
  assert.equal(h.game.project(a.gameProjectId).sourceText,yaml);assert.equal(h.game.project(a.gameProjectId).scope?.mode,'full-game');
  assert.throws(()=>h.bridge.confirm(h.p.id,{...h.input,bodyHash:'0'.repeat(64)}),/相同确认/);
  assert.throws(()=>h.text.edit(h.p.id,{requestKey:'edit',baseVersionId:h.text.project(h.p.id).currentScriptId,body:'changed'}),/最终 YAML/);
  assert.throws(()=>h.game.updateProject(a.gameProjectId,{sourceText:'changed'}),/锁定/);
  assert.equal(h.game.store.events(h.p.id).some(e=>e.type==='yaml.awaiting_confirmation'),true);
 }finally{await h.cleanup();}
});
test('stale, tampered, failed and cross-project YAML cannot be confirmed',async()=>{
 for(const mode of ['edited','failed','tampered','foreign']){const h=await setup();try{
  if(mode==='edited')h.text.edit(h.p.id,{requestKey:'edit',baseVersionId:h.text.project(h.p.id).currentScriptId,body:'新版正文'});
  if(mode==='failed')h.game.store.patch<any>('text_version',h.input.versionId,{checkStatus:'unreviewed'});
  if(mode==='tampered')fs.appendFileSync(path.join(h.dir,'text/artifacts',h.input.versionId,'game.yaml'),'# tampered');
  const id=mode==='foreign'?h.text.create({title:'其他项目',inputKind:'title'}).id:h.p.id;
  assert.throws(()=>h.bridge.confirm(id,h.input));assert.equal(h.game.store.list('run').length,0);
 }finally{await h.cleanup();}}
});
test('durable confirmed outbox recovers before and after task creation, without replaying stopped runs',async()=>{
 const h=await setup();try{
  const original=h.game.start.bind(h.game);h.game.start=()=>{throw Error('injected delivery failure');};
  const a=h.bridge.confirm(h.p.id,h.input);assert.equal(a.status,'failed');assert.equal(h.game.store.list('run').length,0);
  h.game.start=original;h.game.store.patch<any>('text_handoff',a.id,{status:'dispatching'});h.bridge.close();const b=new TextGameHandoff(h.text,h.game);await Promise.resolve();
  const delivered=b.get(h.p.id)[0];assert.ok(delivered.runId);assert.equal(h.game.store.list('run').length,1);
  b.control(h.p.id,a.id,'stop');b.close();h.game.store.patch<any>('text_handoff',a.id,{status:'dispatching',runId:undefined});
  const c=new TextGameHandoff(h.text,h.game);await Promise.resolve();assert.equal(c.get(h.p.id)[0].gameRun?.status,'cancelled');assert.equal(h.game.store.list('run').length,1);
  c.control(h.p.id,a.id,'resume');assert.equal(c.get(h.p.id)[0].gameRun?.status,'queued');c.close();
 }finally{await h.cleanup();}
});
test('production questions persist, refuse stale answers and resume only the game task',async()=>{
 const h=await setup();try{
  const a=h.bridge.confirm(h.p.id,h.input),runId=a.runId!;
  h.game.store.patch<any>('run',runId,{status:'blocked'});h.game.store.event(a.gameProjectId,runId,'blocked','缺少交还对象的决定',{requiresAnswer:true,reason:'对象冲突',needed:'交给谁？'});
  const q=h.bridge.questions(h.p.id)[0];assert.equal(q.role,'game_maker');assert.throws(()=>h.game.resume(runId),/先回答/);
  h.bridge.close();const b=new TextGameHandoff(h.text,h.game);assert.equal(b.questions(h.p.id)[0].id,q.id);
  const before=h.text.detail(h.p.id).runs.length;const answer={requestKey:'answer',text:'交给邻居小周'};
  b.answer(h.p.id,q.id,answer);b.answer(h.p.id,q.id,answer);assert.equal(h.game.run(runId).status,'queued');assert.equal(h.text.detail(h.p.id).runs.length,before);
  assert.throws(()=>b.answer(h.p.id,q.id,{requestKey:'late',text:'另一人'}),/不再/);b.close();
 }finally{await h.cleanup();}
});
test('confirmed YAML uses two scenes without forced minigame; legacy evidence still requires five',async()=>{
 const h=await setup();try{
  const a=h.bridge.confirm(h.p.id,h.input),revision=h.game.revision(h.game.run(a.runId!).revisionId),w=revision.directory;
  const game={start:{scene:'a'},scenes:[{id:'a'},{id:'b'}],dialogues:[],endings:[{id:'end'}]};
  const evidence={journeys:[{observations:[{state:{run:{scene:'a'}}},{state:{run:{scene:'b'}}}],actions:[]}],checks:{midRunReload:true}};
  assert.deepEqual(productionEvidenceErrors(game,evidence,{confirmedYaml:true}),[]);assert.ok(productionEvidenceErrors(game,evidence).some(e=>e.includes('5')));
  const entries=['S_A','S_B','E_A','E_B','END'].map((sourceId,i)=>({sourceId,targets:[i===4?'/endings/0':'/scenes/'+i%2],journeyIds:['j'],reason:'SYNTHETIC mapping'}));
  const design={yamlCoverage:{yamlHash:hash(yaml),entries}};assert.deepEqual(yamlCoverageErrors(w,game,design,[{id:'j'}]),[]);
  assert.ok(yamlCoverageErrors(w,game,{yamlCoverage:{...design.yamlCoverage,entries:entries.slice(1)}},[{id:'j'}]).some(e=>e.includes('S_A')));
  const prompt=productionPrompt(root,w,h.game.project(a.gameProjectId),h.game.run(a.runId!));assert.ok(prompt.includes('已经由用户确认最终 YAML'));assert.equal(prompt.includes('默认约10分钟、至少5'),false);
  assert.ok(prompt.includes('严格执行技能优先'));assert.ok(prompt.includes('resumeCandidate'),'confirmed YAML retains candidate repair workflow');
 }finally{await h.cleanup();}
});

test('confirmation HTTP contract uses real app guards and returns linked game task without exposing data files',async()=>{
 const h=await setup();h.bridge.close();let origin='';
 const app=createWorkbenchApp({root,dataRoot:h.dir,token:'test-token',origin:()=>origin,previewOrigin:()=> 'http://127.0.0.1:1',allowedOrigins:[]});app.service.maxParallel=0;
 const server=http.createServer(app.handler);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+(server.address() as any).port;
 try{
  const route=origin+'/api/text/projects/'+h.p.id+'/confirmations';
  assert.equal((await fetch(route,{method:'POST',body:JSON.stringify(h.input)})).status,403);
  const headers={'content-type':'application/json','x-csrf-token':'test-token'};
  assert.equal((await fetch(route,{method:'POST',headers:{...headers,origin:'https://bad.example'},body:JSON.stringify(h.input)})).status,403);
  const first=await fetch(route,{method:'POST',headers,body:JSON.stringify(h.input)});assert.equal(first.status,202);const record=await first.json() as any;
  const again=await (await fetch(route,{method:'POST',headers,body:JSON.stringify(h.input)})).json() as any;assert.equal(again.runId,record.runId);
  const links=await (await fetch(origin+'/api/text/projects/'+h.p.id+'/handoffs')).json() as any[];assert.equal(links[0].versionId,h.input.versionId);
  assert.notEqual((await fetch(origin+'/data/workbench.sqlite')).status,200);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await app.close();await h.cleanup();}
});

test('natural-language changes keep the confirmed source and old accepted game without starting text generation',async()=>{
 const h=await setup();try{
  const link=h.bridge.confirm(h.p.id,h.input);h.game.cancel(link.runId!);
  const config=JSON.parse(fs.readFileSync(path.join(root,'fixtures/harbor.json'),'utf8'));config.id=link.gameProjectId;
  const dir=path.join(h.dir,'accepted-fixture'),buildDir=path.join(h.dir,'fixture-build'),evidenceDir=path.join(h.dir,'fixture-evidence');fs.mkdirSync(dir);fs.mkdirSync(evidenceDir);
  writeJson(path.join(dir,'game.json'),config);writeJson(path.join(evidenceDir,'fixture.json'),{scope:'synthetic transaction test'});
  await compileGame({config,assetDir:path.join(root,'fixtures/assets'),outDir:buildDir,revisionId:'fixture_accepted'});
  const buildHash=hashFile(path.join(buildDir,'manifest.json'));
  const revision:any={id:'fixture_accepted',projectId:link.gameProjectId,runId:link.runId,baseRevisionId:null,status:'accepted',title:'fixture',summary:'synthetic',createdAt:new Date().toISOString(),directory:dir,buildDir,evidenceDir,buildHash,acceptance:{version:2,fingerprint:candidateHash(dir),buildHash,evidenceHash:hashTree(evidenceDir)}};
  h.game.store.put('revision',revision);await h.game.rollback(link.gameProjectId,revision.id);
  const before=h.text.detail(h.p.id).runs.length,body=h.text.body(h.p.id,h.input.versionId),oldHash=hashTree(dir);
  const run=h.game.start(link.gameProjectId,'change','修复门口交互距离，保持剧情和结局');
  assert.equal(h.game.revision(run.revisionId).baseRevisionId,revision.id);assert.equal(h.text.detail(h.p.id).runs.length,before);
  assert.equal(h.text.body(h.p.id,h.input.versionId),body);assert.equal(hashTree(dir),oldHash);assert.equal(h.game.project(link.gameProjectId).currentRevisionId,revision.id);
  h.game.cancel(run.id);assert.equal(h.game.project(link.gameProjectId).currentRevisionId,revision.id);
 }finally{await h.cleanup();}
});
