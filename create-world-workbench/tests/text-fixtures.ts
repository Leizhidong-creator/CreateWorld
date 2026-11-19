// Synthetic transport fixtures only. These are not real generated game content or quality evidence.
import fs from 'node:fs';import path from 'node:path';
import {stringify} from 'yaml';
import {hash,writeJson} from '../packages/shared/files.js';
import type {StageRunner} from '../packages/text-workflow/runner.js';
export function toy(){
 const data:any={'初始配置':{stage:'room',key:false,reward:0},'事件':[{id:'take'},{id:'open'},{id:'again'}],'物件':[{id:'key'}],'状态':[{id:'reward'}],'检查点':[],'玩法':[],'结局':[{id:'end'}]};
 const raw=stringify(data),trace=(p:string)=>({path:p,expected:p.split('/').slice(1).reduce((v,k)=>v[k],data)});
 const eq=(variable:string,value:any)=>({variable,op:'eq',value});
 const model:any={version:1,yamlHash:hash(raw),coverage:[trace('/初始配置'),...['事件','物件','状态','检查点','玩法','结局'].flatMap(k=>data[k].map((_:any,i:number)=>trace('/'+k+'/'+i)))],unknowns:[],
 variables:{stage:{initial:'room',domain:['room','end'],trace:trace('/初始配置')},key:{initial:false,domain:[false,true],trace:trace('/物件/0')},reward:{initial:0,domain:[0,1,2],trace:trace('/状态/0')}},checkpoints:{},
 transitions:[{id:'take',trace:trace('/事件/0'),when:{all:[eq('stage','room'),eq('key',false)]},effects:[{op:'set',variable:'key',value:true},{op:'add',variable:'reward',value:1}],optional:false,kind:'action'},
 {id:'open',trace:trace('/事件/1'),when:{all:[eq('stage','room'),eq('key',true)]},effects:[{op:'set',variable:'stage',value:'end'}],optional:false,kind:'action'},
 {id:'again',trace:trace('/事件/2'),when:eq('key',true),effects:[],optional:true,kind:'repeat'},
 {id:'continue',trace:trace('/初始配置'),when:{all:[]},effects:[],optional:false,kind:'exit_continue',preserve:['stage','key','reward']}],
 goals:[{when:eq('stage','end'),trace:trace('/结局/0')}],invariants:[{id:'one_reward',kind:'reward',when:{variable:'reward',op:'le',value:1},trace:trace('/状态/0')}],recoveryCoverage:[]};return {raw,model};
}
export const fixtureRunner:StageRunner=async ctx=>{
 const w=ctx.workspace,s=ctx.run.stage;const read=(n:string)=>fs.readFileSync(path.join(w,n),'utf8'),put=(n:string,v:string)=>fs.writeFileSync(path.join(w,n),v);
 const review=(file:string,names:string[],bound:string[])=>writeJson(path.join(w,file),{verdict:'passed',issues:[],checks:names.map(name=>({name,locations:['第一幕'],finding:'SYNTHETIC TEST ONLY'})),inputHashes:Object.fromEntries(bound.map(n=>[n,hash(read(n))]))});
 if(s==='creative')writeJson(path.join(w,'creative-handoff.json'),{status:'bypassed',reason:'SYNTHETIC TEST ONLY'});
 else if(s==='read'){
  const sources=[...(ctx.run.input as any).sources||[],...JSON.parse(read('answers.json')).flatMap((x:any)=>x.sources||[])];
  if(!sources.length)return {status:'questions',questions:[{key:'source',role:'reader',shortText:'我需要可读取的正文，你能补充吗？',details:'未取得原文，不能凭名称推断全部事实。',answerMode:'material',choices:[]}]};
  if(fs.existsSync(path.join(w,'creative-handoff.json'))){const h=JSON.parse(read('creative-handoff.json'));for(const excluded of h.sourceExclusions||[]){const i=sources.findIndex((s:any)=>s.id===excluded.id);if(i>=0)sources.splice(i,1);}if(h.status==='ready')sources.push({id:'creative_handoff',text:h.adaptationInput.sourceText,textHash:h.adaptationInput.sourceSha256});}
  writeJson(path.join(w,'reading.json'),{sources:sources.map((x:any)=>({id:x.id,sha256:x.textHash,ranges:[[0,x.text.length]],note:'fixture coverage'})),gaps:[]});put('source-notes.md','原作资料');put('protagonist-experience.md','主角经历');
 }else if(s==='design')put('adaptation-notes.md','拾钥匙，开门，归还信件。');
 else if(s==='write'){
  put('script.md','# 原创样例\n主人公阿禾拾钥匙，打开信箱，将信还给邻居。\n用户修改：'+ctx.run.instruction);put('synopsis.md','阿禾归还信件。');put('changes.md',ctx.run.instruction||'首次粗剧本');
 }else if(s==='review')review('review.json',['source_fidelity','perspective','causality','handoff'],['script.md','input.json']);
 else if(s==='precheck'){put('script.md',read('input-script.md'));put('synopsis.md','阿禾归还信件。');put('changes.md','未改内容');review('precheck.json',['handoff','causality'],['input-script.md','script.md']);}
 else if(s==='expand'){const t=toy();put('game.yaml',t.raw);writeJson(path.join(w,'model.json'),t.model);put('synopsis.md','阿禾归还信件。');}
 else if(s==='audit')review('review.json',['script_coverage','causality','knowledge','model_translation','recovery','optional_independence'],['script.md','game.yaml','model.json','host-checks.json']);
 return {status:'complete',summary:'SYNTHETIC TEST ONLY'};
};
