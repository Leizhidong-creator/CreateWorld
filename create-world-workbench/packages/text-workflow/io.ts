import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hash,safePath} from '../shared/files.js';
import {TextError} from './contracts.js';
import {resolveAuthority} from './authorities.js';
export const python=()=>process.env.CW_TEXT_PYTHON||process.env.CREATE_WORLD_PYTHON||process.env.CW_PYTHON||'python';
export async function extractSource(root:string,file:string){
 const result=await promisify(execFile)(python(),[path.join(root,'packages/text-workflow/extract.py'),file],{encoding:'utf8',timeout:60_000,maxBuffer:20_000_000,windowsHide:true});
 return JSON.parse(result.stdout) as {text:string;units:{label:string;start:number;end:number}[];issues:string[];status:'readable'|'needs_material'};
}
export function readArtifact(root:string,name:string){const p=safePath(root,name);if(!fs.existsSync(p)||!fs.lstatSync(p).isFile())throw new TextError('artifact_missing','缺少产物：'+name,422);if(fs.statSync(p).size>12_000_000)throw new TextError('artifact_large','产物过大：'+name,422);return fs.readFileSync(p,'utf8');}
export function loadMethods(root:string){
 const repo=path.resolve(root,'..'),dir=path.join(repo,'workflows/story-adaptation');
 const lock=JSON.parse(fs.readFileSync(path.join(dir,'sources.lock.json'),'utf8'));
 const files:Record<string,string>={};
 for(const [i,a] of lock.authorities.filter((x:any)=>x.role==='authority').entries()){
  const file=resolveAuthority(repo,a);
  files[i===0?'content-standard.md':'execution-standard.md']=fs.readFileSync(file,'utf8');
 }
 if(!files['content-standard.md']||!files['execution-standard.md'])throw new TextError('authority_missing','缺少两份权威规范',422);
 function collect(folder:string){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isSymbolicLink())throw new TextError('method_link','方法目录不能含符号链接',422);if(entry.isDirectory())collect(file);else if(/\.(md|txt|json)$/.test(entry.name))files['adaptation/'+path.relative(dir,file).split(path.sep).join('/')]=fs.readFileSync(file,'utf8');}}collect(dir);
 files['yaml-audit.md']=fs.readFileSync(path.join(root,'packages/text-workflow/YAML-AUDIT.md'),'utf8');
 return files;
}
export function extractChecker(standard:string){const section=standard.split('## 附录 A：基础检查程序')[1];const code=section?.match(/```python\r?\n([\s\S]*?)\r?\n```/)?.[1];if(!code)throw new TextError('checker_missing','执行标准内嵌检查器不可读取',422);return code+'\n';}
export async function baselineCheck(root:string,workspace:string){
 const standard=readArtifact(workspace,'methods/execution-standard.md');
 const checker=path.join(root,'data','text-checkers',hash(standard)+'.py');fs.mkdirSync(path.dirname(checker),{recursive:true});fs.writeFileSync(checker,extractChecker(standard));
 try{const r=await promisify(execFile)(python(),[checker,path.join(workspace,'game.yaml')],{encoding:'utf8',timeout:60_000,maxBuffer:8_000_000,windowsHide:true});return JSON.parse(r.stdout);}
 catch(e:any){if(e.stdout){try{return JSON.parse(e.stdout);}catch{}}throw new TextError('checker_unavailable','基础检查未完成：'+e.message,422);}
}
