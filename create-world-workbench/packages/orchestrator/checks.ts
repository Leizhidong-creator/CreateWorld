import {confirmedYamlOrigin,yamlCoverageErrors} from './yaml-production.js';
import {assetBindingErrors} from '../assets/index.js';
import fs from 'node:fs';
import {readJson,hashFile,hash,safePath} from '../shared/files.js';
import {validateConfig} from '../runtime/validate.js';
import {validateJourneys,validateStageOutput} from '../skill-adapters/index.js';
import {readSliceRecord,validateSliceAgainstGame,validateSliceJourneys} from '../content-model/index.js';
import {artDirectionErrors} from './visual-standard.js';
import {PRODUCTION_POLICY} from './production-policy.js';
import {SOURCE_FILE,WORKSPACE_FILE,workspaceFile} from './workspace-layout.js';
import {resolveGame} from './game-config.js';

export function checkProject(workspace:string,release=false){
 const errors:string[]=[],warnings:string[]=[];let game:any,source:any,design:any,journeys:any;
 try{game=resolveGame(workspace);validateConfig(game);}catch(e){errors.push(String(e));}
 try{source=readJson(workspaceFile(workspace,WORKSPACE_FILE.source));const v=validateStageOutput('source',source);if(!v.valid||v.blocked)errors.push(...v.errors,'来源尚未通过');}catch(e){if(release)errors.push('缺少有效source.json');}
 try{design=readJson(workspaceFile(workspace,WORKSPACE_FILE.design));}catch{if(release)errors.push('缺少玩法设计design.json');}
 if(release)errors.push(...artDirectionErrors(design,workspace));
 try{journeys=readJson(workspaceFile(workspace,WORKSPACE_FILE.journeys));const v=validateJourneys(journeys,game);if(!v.valid)errors.push(...v.errors);}catch{errors.push('缺少合法真实输入旅程journeys.json');}
 if(game&&fs.existsSync(workspaceFile(workspace,WORKSPACE_FILE.project))){try{const project=readJson(workspaceFile(workspace,WORKSPACE_FILE.project));if(project.id&&game.id!==project.id)errors.push('game.id必须等于project.json的id，避免不同项目共享存档');}catch{errors.push('项目标识无法读取');}}
 if(game&&fs.existsSync(workspaceFile(workspace,WORKSPACE_FILE.assetsPlan))){try{const plan=readJson(workspaceFile(workspace,WORKSPACE_FILE.assetsPlan));errors.push(...assetBindingErrors(game,Array.isArray(plan)?plan:plan.assets));}catch(e){errors.push('素材计划无法读取：'+String(e));}}

 const scopeFile=workspaceFile(workspace,WORKSPACE_FILE.scope);let scope:any={};try{scope=readJson(scopeFile);}catch{}
 const sceneSlice=scope.mode==='scene-slice',confirmed=!!confirmedYamlOrigin(workspace);
 if(game&&release&&confirmed)errors.push(...yamlCoverageErrors(workspace,game,design,journeys));
 if(game&&sceneSlice){
  const slice=readSliceRecord(workspace);
  if(!slice){
   errors.push('单场景切片缺少 slice.json；请用当前内容 YAML 重新生成切片');
  }else{
   if(scope.sceneId&&scope.sceneId!==slice.sceneId)errors.push(`scope.sceneId=${scope.sceneId} 与切片场景 ${slice.sceneId} 不一致`);
   const sourceFile=workspaceFile(workspace,SOURCE_FILE.contentYaml);
   if(fs.existsSync(sourceFile)){
    const current=hashFile(sourceFile);
    if(current!==slice.source.sha256)errors.push('切片源哈希与当前内容 YAML 不一致；内容已改变，请重新生成切片');
   }else errors.push('切片缺少 sources/game-content.yaml');
   const sliceYaml=workspaceFile(workspace,SOURCE_FILE.sceneSliceYaml),sliceBrief=workspaceFile(workspace,SOURCE_FILE.sceneSliceBrief);
   if(fs.existsSync(sliceYaml)&&fs.existsSync(sliceBrief)){
    const recomputed=hash(fs.readFileSync(sliceYaml,'utf8')+'\n'+fs.readFileSync(sliceBrief,'utf8'));
    if(recomputed!==slice.hashes.slice)errors.push('切片文件与 slice.json 不一致；请重新生成切片');
   }else errors.push('切片缺少 sources/scene-slice.yaml 或 scene-slice.md');
   const report=validateSliceAgainstGame(slice,game);
   errors.push(...report.errors);warnings.push(...report.warnings);
   if(journeys){const coverage=validateSliceJourneys(slice,journeys);errors.push(...coverage.errors);warnings.push(...coverage.warnings);}
  }
 }

 if(game&&release&&!sceneSlice){
  if(!confirmed&&game.scenes.length<PRODUCTION_POLICY.fullGame.minimumScenes)errors.push('正式游戏至少需要'+PRODUCTION_POLICY.fullGame.minimumScenes+'个有效场景');
  if(!confirmed&&!game.minigames?.length)errors.push('首版完整作品必须实际接入简单小游戏');
  if(!confirmed&&(!Array.isArray(design?.mechanics)||!design.mechanics.length))errors.push('缺少剧情驱动的核心机制规格');
  for(const m of design?.mechanics||[]){for(const key of ['id','storyBasis','goal','rules','implementation','tests'])if(!m[key]||(Array.isArray(m[key])&&!m[key].length))errors.push('mechanics.'+m.id+' 缺少 '+key);for(const entry of m.implementation||[])try{safePath(workspace,entry);if(!fs.existsSync(safePath(workspace,entry)))throw Error();}catch{errors.push('机制实现缺失 '+entry);}for(const id of m.tests||[])if(!journeys?.some((j:any)=>j.id===id))errors.push('机制测试缺失 '+id);}
  const allSteps=(journeys||[]).flatMap((j:any)=>j.steps||[]);if((!confirmed||game.minigames?.length)&&!allSteps.some((s:any)=>s.action==='minigame'))errors.push('小游戏没有真实输入测试');
  const used=new Set([game.start?.scene]);for(const s of game.scenes)if(allSteps.some((step:any)=>[...(s.interactions||[]),...(s.exits||[])].some((i:any)=>i.id===step.id)))used.add(s.id);if(!confirmed&&used.size<PRODUCTION_POLICY.fullGame.minimumScenes)errors.push('真实操作路线未覆盖至少'+PRODUCTION_POLICY.fullGame.minimumScenes+'个有效场景');
 }

 if(game){const texts=new Map<string,number>();for(const d of game.dialogues||[])for(const line of d.lines||[]){const t=typeof line==='string'?line:line.text;if(t&&t.length>30)texts.set(t,(texts.get(t)||0)+1);}for(const [text,count]of texts)if(count>1)warnings.push(`较长文本重复${count}次：${text.slice(0,50)}`);warnings.push('游玩时长为估计；自动通关耗时不代表玩家阅读和思考时间。');}
 return{valid:!errors.length,errors,warnings,sceneCount:game?.scenes?.length||0,mechanisms:design?.mechanics?.length||0,scope:sceneSlice?'scene-slice':'full-game'};
}
