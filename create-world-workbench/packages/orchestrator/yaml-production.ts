import fs from 'node:fs';
import path from 'node:path';
import {hash,readJson} from '../shared/files.js';
import {buildContentModel} from '../content-model/index.js';
import type {ConfirmedYamlOrigin} from '../contracts/records.js';

export function confirmedYamlOrigin(workspace:string):ConfirmedYamlOrigin|undefined {
 const file=path.join(workspace,'project.json');
 return fs.existsSync(file)?readJson(file).confirmedYaml:undefined;
}

/** Structural coverage is not a claim that the adaptation is semantically faithful. */
export function yamlCoverageErrors(workspace:string,game:any,design:any,journeys:any[]):string[]{
 const origin=confirmedYamlOrigin(workspace);if(!origin)return [];
 const errors:string[]=[];
 try {
  const text=fs.readFileSync(path.join(workspace,'sources/game-content.yaml'),'utf8');
  if(hash(text)!==origin.yamlHash)return ['最终 YAML 与用户确认的哈希不一致'];
  const doc=buildContentModel(text),coverage=design?.yamlCoverage;
  if(coverage?.yamlHash!==origin.yamlHash||!Array.isArray(coverage?.entries))return ['design.yamlCoverage 缺少最终 YAML 哈希或逐项映射'];
  const required=doc.entities.filter(e=>['scene','event','mechanic','ending'].includes(e.type));
  for(const entity of required){
   const rows=coverage.entries.filter((r:any)=>r.sourceId===entity.id);
   if(rows.length!==1){errors.push('YAML 内容缺少唯一实现映射：'+entity.id);continue;}
   const row=rows[0];
   if(!row.reason?.trim()||!Array.isArray(row.targets)||!row.targets.length)errors.push('YAML 映射缺少实现说明或定位：'+entity.id);
   for(const target of row.targets||[]){
    if(typeof target!=='string'||!target.startsWith('/')||target==='/'||target.includes('__proto__')){errors.push('无效实现定位：'+entity.id);continue;}
    let value=game;for(const key of target.slice(1).split('/').map((s:string)=>s.replaceAll('~1','/').replaceAll('~0','~'))){if(value===null||typeof value!=='object'||!Object.hasOwn(value,key)){value=undefined;break;}value=value[key];}
    if(value===undefined)errors.push('YAML 映射定位不存在：'+entity.id+' '+target);
   }
   if(!Array.isArray(row.journeyIds)||!row.journeyIds.length||row.journeyIds.some((id:string)=>!journeys?.some(j=>j.id===id)))errors.push('YAML 内容缺少操作检查关联：'+entity.id);
  }
  for(const row of coverage.entries)if(!required.some(e=>e.id===row.sourceId))errors.push('YAML 映射含未知内容：'+row.sourceId);
 }catch(e){errors.push('最终 YAML 覆盖检查失败：'+String(e));}
 return errors;
}

export function yamlReviewErrors(workspace:string,report:any){
 const origin=confirmedYamlOrigin(workspace);if(!origin)return [];
 const coverage=readJson(path.join(workspace,'design.json')).yamlCoverage;
 const review=report.yamlReview,errors:string[]=[];
 if(review?.yamlHash!==origin.yamlHash||!Array.isArray(review?.findings))return ['独立内容审阅缺少 YAML 绑定和逐项结论'];
 for(const item of coverage?.entries||[]){const finding=review.findings.find((r:any)=>r.sourceId===item.sourceId);if(!finding||finding.passed!==true||!finding.evidence?.trim())errors.push('独立内容审阅未通过或缺少具体依据：'+item.sourceId);}
 return errors;
}

export const confirmedYamlInstruction=`本项目已经由用户确认最终 YAML。sources/game-content.yaml 是固定内容依据，禁止重新改编主线、增加场景凑数或强加小游戏；无固定场景数量或时长。本任务的明确范围优先于 PRODUCTION-CONTRACT 与技能参考中的五场景、十分钟和强制小游戏默认值。YAML 规定的玩法必须完整实现；操作、布局和美术细化仍遵循其自由设计边界。后续 change 任务按明确的自然语言要求在旧游戏上局部优化，不重新生成 YAML，不改写原始档案；如与固定剧情事实或结局冲突，用 cw_block 集中提问。
在 design.json 中提供 yamlCoverage={yamlHash:最终源SHA256,entries:[{sourceId:源场景/事件/玩法/结局ID,targets:[game.json内JSON Pointer],journeyIds:[真实操作旅程ID],reason:具体实现和保留语义说明}]}。每项恰好一条映射，菜单/演出可映射到对应标题、对白、UI或结局实现，不强行变成可行走地图。不能用存在映射代替独立内容审阅。小游戏仅按 YAML 内容决定，不能因为库的默认数量删改已有玩法。独立审阅要逐项核对映射、缺失和擅增内容、认知与隐藏目的，并核对用户后续修改的实际范围。review.json 增加 yamlReview={yamlHash,findings:[{sourceId,passed:boolean,evidence:对照实际实现的具体依据}]}，逐项覆盖 yamlCoverage.entries；不得只检查 ID 是否存在。`;

export const confirmedYamlReviewInstruction=`只审阅，不改候选。用户已确认 sources/game-content.yaml；本作场景、时长和小游戏范围由此确定，不套用技能或旧制作合同的五场景、十分钟、强制小游戏门槛。逐项读取原 YAML、design.yamlCoverage、实际实现和宿主操作证据，检查主线、可选内容、认知与隐藏目的、失败恢复、缺失与擅增内容。菜单和演出不必成为可行走地图。后续游戏修改还须核对当前任务的明确修改要求，不能因局部优化改变固定剧情与结局。只写 review.json，增加 yamlReview={yamlHash:最终源哈希,findings:[{sourceId,passed:boolean,evidence:实际实现对照依据}]}，覆盖所有 yamlCoverage.entries；存在 ID 或映射不代表内容正确。`;
