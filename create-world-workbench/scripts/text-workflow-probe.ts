import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../packages/orchestrator/store.js';
import {TextWorkflow} from '../packages/text-workflow/service.js';
import {writeJson,now} from '../packages/shared/files.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data','text-workflow-probe',new Date().toISOString().replaceAll(':','-'));
const maxMs=Number(process.argv.find(x=>x.startsWith('--max-ms='))?.split('=')[1]||300_000);
if(!Number.isFinite(maxMs)||maxMs<1000||maxMs>900_000)throw new Error('max-ms must be 1000..900000');
const store=new Store(dir),service=new TextWorkflow({root,dataRoot:dir,store});
const startedAt=now();let current:string|undefined;let timedOut=false;
const p=service.create({title:'原创验证：送回的灯',inputKind:'text',sourceText:'暴雨后，修灯人阿禾在村口捡到邻居小周掉落的手提灯。灯的外壳刻着小周的名字。阿禾检查灯扣，把松开的灯扣重新扣好，沿村路走到小周家门前，将灯交还。小周说明明早要带灯去照看温室，向阿禾道谢。阿禾回到家中，故事结束。',requirements:'这是原创短样例。主角始终为阿禾，保持上述事实与唯一结局，完整呈现检查、修复、交还；不增加支线或独立小游戏，不延长为大型游戏。'});
const timer=setTimeout(()=>{timedOut=true;if(current)service.stop(p.id,current);},maxMs);
store.on('update',e=>{if(e.type.startsWith('task.')||e.type==='stage.completed'||e.type==='question.created')console.log(JSON.stringify({type:e.type,message:e.message,runId:e.runId}));});
try{
 const first=service.start(p.id,{requestKey:'probe-script',kind:'script',baseVersionId:null});current=first.id;await service.idle();
 if(!timedOut&&service.run(p.id,first.id).status==='completed'){
  const second=service.start(p.id,{requestKey:'probe-yaml',kind:'yaml',baseVersionId:service.project(p.id).currentScriptId});current=second.id;await service.idle();
 }
}catch(e){console.log(JSON.stringify({error:String(e)}));}
finally{clearTimeout(timer);await service.close();const detail=service.detail(p.id);writeJson(path.join(dir,'probe-result.json'),{startedAt,endedAt:now(),maxMs,timedOut,requestedModel:'gpt-6-astra',evidence:'real-model bounded integration probe',project:detail.project,runs:detail.runs,versions:detail.versions.map(v=>({id:v.id,kind:v.kind,checkStatus:v.checkStatus})),questions:detail.questions,runtimeTested:false});store.close();console.log(JSON.stringify({report:path.join(dir,'probe-result.json'),timedOut}));}
