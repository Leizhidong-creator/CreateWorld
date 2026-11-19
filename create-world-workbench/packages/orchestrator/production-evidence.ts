import {PRODUCTION_POLICY} from './production-policy.js';

export function productionEvidenceErrors(game:any,evidence:any,options:{confirmedYaml?:boolean;sceneSlice?:boolean;sceneId?:string;boundaryEndingId?:string}={}){
 const errors:string[]=[],scenes=new Set([game.start.scene]),observed=new Set<string>();
 for(const journey of evidence.journeys||[]){for(const point of journey.observations||[])if(point.state?.run?.scene){scenes.add(point.state.run.scene);observed.add(point.state.run.scene);}}
 if(options.sceneSlice){
  if(!options.sceneId)errors.push('切片证据检查缺少 sceneId');
  else if(!observed.has(options.sceneId))errors.push('真实操作没有观察到切片场景 '+options.sceneId);
  if(!options.boundaryEndingId)errors.push('切片证据检查缺少边界结局');
  else if(!(evidence.checks?.['ending:'+options.boundaryEndingId]||(evidence.journeys||[]).some((j:any)=>j.endingId===options.boundaryEndingId&&j.status==='passed')))errors.push('真实操作没有到达切片边界结局 '+options.boundaryEndingId);
  if(!evidence.checks?.midRunReload)errors.push('缺少中途存档恢复的真实操作');
  return errors;
 }
 const mechanisms=new Set<string>();
 for(const journey of evidence.journeys||[])for(const action of journey.actions||[])if(action.action==='minigame'&&action.minigameId)mechanisms.add(action.minigameId);
 if(!options.confirmedYaml&&scenes.size<PRODUCTION_POLICY.fullGame.minimumScenes)errors.push('真实通关没有观察到至少'+PRODUCTION_POLICY.fullGame.minimumScenes+'个场景');
 if(options.confirmedYaml)for(const scene of game.scenes||[])if(!observed.has(scene.id))errors.push('最终 YAML 游戏场景缺少实际观察：'+scene.id);
 for(const m of game.minigames||[])if(!mechanisms.has(m.id))errors.push('机制没有真实操作证据：'+m.id);
 if(!evidence.checks?.midRunReload)errors.push('缺少中途存档恢复的真实操作');
 return errors;
}
