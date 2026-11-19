/** Real-model integration probe. Final confirmation is ONLY accepted through the HTTP API. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createWorkbenchApp} from '../apps/server/app.js';
import {writeJson,now} from '../packages/shared/files.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=(name:string)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const dir=path.resolve(option('data')||path.join(root,'data','text-game-probe',new Date().toISOString().replaceAll(':','-')));
const maxMs=Number(option('max-ms')||1_800_000);if(!Number.isFinite(maxMs)||maxMs<1000||maxMs>1_800_000)throw Error('Maximum real execution budget is 30 minutes');
fs.mkdirSync(dir,{recursive:true});const stateFile=path.join(dir,'probe.json');
const state:any=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{startedAt:now(),elapsedMs:0,scope:'原创两场景、唯一结局；真实模型及宿主操作证据',requestedModel:'gpt-6-astra'};
let origin='',previewOrigin='',closing=false,accounting=false;
const token=crypto.randomBytes(24).toString('hex');
const app=createWorkbenchApp({root,dataRoot:dir,token,origin:()=>origin,previewOrigin:()=>previewOrigin,allowedOrigins:[]});
const server=http.createServer(app.handler),preview=http.createServer(app.previewHandler);
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));await new Promise<void>(r=>preview.listen(0,'127.0.0.1',r));
origin='http://127.0.0.1:'+(server.address() as any).port;previewOrigin='http://127.0.0.1:'+(preview.address() as any).port;
writeJson(path.join(dir,'server.json'),{origin,previewOrigin,confirmation:'POST /api/text/projects/:id/confirmations; get CSRF token from /api/bootstrap'});
if(!state.projectId){
 const p=app.text.create({title:'原创验证：归还手提灯',inputKind:'text',sourceText:'暴雨停后，修灯人阿禾在自己家门前捡到邻居小周的手提灯，灯柄刻有小周的名字。阿禾检查灯扣，将松开的灯扣扣好。她走到相邻的小周家门前，将灯交还。小周说明天要带灯去照看温室，向她道谢。阿禾得知灯的用途，放心告别，故事结束。',requirements:'明确限定两个可游玩场景：阿禾家门前、小周家门前。玩家始终控制阿禾，唯一结局是修好并交还手提灯后告别；简单检查、扣灯扣、携带和交付互动即可，不设计独立小游戏或支线。不为标题、暂停、结局单独增加地图场景。画面与操作可简洁，但全文及 YAML 必须完整包含开始、教学、物件归属、重复互动、暂停继续、存档恢复和重开；无无关扩写。所有细节按 Agent 设计注明。'});
 state.projectId=p.id;app.text.start(p.id,{requestKey:'probe-script',kind:'script',baseVersionId:null});
}
console.log(JSON.stringify({data:dir,origin,projectId:state.projectId,maxMs}));
app.service.store.on('update',(e:any)=>{if(e.projectId===state.projectId&&(!e.type.startsWith('model.')||e.type==='model.thread'))console.log(JSON.stringify({type:e.type,message:e.message,data:e.data}));});
let last=Date.now(),lastSaved=0;
async function shutdown(reason:string){
 if(closing)return;closing=true;clearInterval(timer);state.stopReason=reason;state.endedAt=now();
 for(const run of app.text.detail(state.projectId).runs)if(['queued','running'].includes(run.status))app.text.stop(state.projectId,run.id);
 for(const h of app.handoff.get(state.projectId))if(h.gameRun&&['queued','running','validating'].includes(h.gameRun.status))app.service.cancel(h.gameRun.id);
 const detail=app.text.detail(state.projectId);
 state.runs=detail.runs.map(r=>({id:r.id,kind:r.kind,status:r.status,stage:r.stage,error:r.error}));state.versions=detail.versions;state.questions=[...detail.questions,...app.handoff.questions(state.projectId)];state.handoffs=app.handoff.get(state.projectId);
 writeJson(stateFile,state);await app.close();server.closeAllConnections();preview.closeAllConnections();await Promise.all([new Promise<void>(r=>server.close(()=>r())),new Promise<void>(r=>preview.close(()=>r()))]);console.log(JSON.stringify({report:stateFile,reason}));
}
const timer=setInterval(()=>{
 if(closing)return;const time=Date.now();if(accounting)state.elapsedMs+=time-last;last=time;
 const detail=app.text.detail(state.projectId),handoffs=app.handoff.get(state.projectId);
 accounting=detail.runs.some(r=>['queued','running'].includes(r.status))||handoffs.some(h=>h.gameRun&&['queued','running','validating'].includes(h.gameRun.status));
 if(state.elapsedMs>=maxMs){void shutdown('30分钟真实调用预算已用尽；保留实际结果和诊断');return;}
 const scriptRun=detail.runs.find(r=>r.kind==='script');
 if(scriptRun?.status==='completed'&&!detail.runs.some(r=>r.kind==='yaml')&&!handoffs.length){app.text.start(state.projectId,{requestKey:'probe-yaml',kind:'yaml',baseVersionId:detail.project.currentScriptId});}
 state.runs=detail.runs.map(r=>({id:r.id,kind:r.kind,status:r.status,stage:r.stage,error:r.error}));state.versions=detail.versions;state.questions=[...detail.questions,...app.handoff.questions(state.projectId)];state.handoffs=handoffs;
 const y=detail.versions.find(v=>v.id===detail.project.currentYamlId);
 state.awaitingConfirmation=!!y&&!handoffs.length;
 if(y&&!state.announcedYaml){state.announcedYaml=y.id;console.log(JSON.stringify({awaitingUserConfirmation:true,versionId:y.id,bodyHash:y.bodyHash,view:origin+'/api/text/projects/'+state.projectId+'/versions/'+y.id,confirm:origin+'/api/text/projects/'+state.projectId+'/confirmations'}));}
 if(time-lastSaved>3000){writeJson(stateFile,state);lastSaved=time;}
 if(handoffs.some(h=>h.gameRun?.status==='passed'))void shutdown('两场景游戏已通过宿主验收');
},500);
process.on('SIGINT',()=>void shutdown('用户停止验证'));process.on('SIGTERM',()=>void shutdown('进程停止，保留成果'));
