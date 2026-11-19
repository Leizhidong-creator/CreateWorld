import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateConfig } from '../runtime/validate.js';
import { frameFor } from '../runtime/animation.js';
import sharp from 'sharp';

export interface BuildManifest {schemaVersion:1;status:'candidate';revisionId:string;configHash:string;runtimeVersion:string;files:Array<{path:string;sha256:string;bytes:number}>;extensions:string[];}
export interface CompileOptions {config:any;assetDir:string;outDir:string;revisionId:string;extensionsDir?:string;}
const runtimeDir=fileURLToPath(new URL('../runtime/',import.meta.url));
const provenanceDir=fileURLToPath(new URL('../../provenance/',import.meta.url));
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const relative=(name:string)=>{
  if(typeof name!=='string'||!name||name.includes('\\')||name.includes('\0')||/[\x00-\x1f:?#%]/.test(name)||path.posix.isAbsolute(name)||name.split('/').some(s=>!s||s.startsWith('.')||['logs','node_modules'].includes(s)))throw Error('必须使用安全相对路径：'+name);
  return name;
};
async function safeFile(root:string,name:string){
  relative(name);let current=path.resolve(root);
  if((await fs.lstat(current)).isSymbolicLink())throw Error('资源根目录不可为符号链接');
  for(const segment of name.split('/')){current=path.join(current,segment);if((await fs.lstat(current)).isSymbolicLink())throw Error('拒绝符号链接：'+name);}
  const stat=await fs.stat(current);if(!stat.isFile())throw Error('不是普通文件：'+name);if(stat.size>64*1024*1024)throw Error('单个资源超过64MB：'+name);return current;
}
function jsonOnly(v:any,at='config'):void{
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error(at+' 数字无效');return;}
  if(typeof v!=='object'||v instanceof URL)throw Error(at+' 必须为JSON数据，代码通过extensions注册');
  for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error(at+' 保留字段');jsonOnly(x,at+'.'+k);}
}
function assertMedia(name:string,type:string,b:Buffer){
  const ext=path.extname(name).toLowerCase();const head=b.subarray(0,24);
  if(type==='image'){
    if(ext==='.svg'){const text=b.toString('utf8');if(!/<svg[\s>]/i.test(text)||/<(?:script|foreignObject|iframe|image)\b|\son\w+\s*=|(?:href|src)\s*=|url\s*\(|<!ENTITY|<!DOCTYPE/i.test(text))throw Error('SVG含外部或可执行内容：'+name);return;}
    const ok=(ext==='.png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(['.jpg','.jpeg'].includes(ext)&&b[0]===255&&b[1]===216)||(ext==='.webp'&&head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WEBP')||(ext==='.gif'&&/^GIF8[79]a/.test(head.toString('ascii')));
    if(!ok)throw Error('图片扩展名/签名不匹配：'+name);
  }else{
    const s=head.toString('ascii');const ok=(ext==='.wav'&&s.startsWith('RIFF')&&s.slice(8,12)==='WAVE')||(['.ogg','.opus'].includes(ext)&&s.startsWith('OggS'))||(ext==='.mp3'&&(s.startsWith('ID3')||b[0]===255&&(b[1]&224)===224))||(['.m4a','.mp4'].includes(ext)&&s.slice(4,8)==='ftyp');if(!ok)throw Error('音频扩展名/签名不匹配：'+name);
  }
}
async function listFiles(root:string,prefix=''):Promise<string[]>{const result:string[]=[];for(const entry of(await fs.readdir(path.join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=prefix?prefix+'/'+entry.name:entry.name;if(entry.isSymbolicLink())throw Error('构建中含符号链接：'+name);if(entry.isDirectory())result.push(...await listFiles(root,name));else if(entry.isFile())result.push(name);else throw Error('构建含非普通文件：'+name);}return result;}
async function copyFile(source:string,destination:string){await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(source,destination);}
function collectActions(config:any):any[]{const result:any[]=[];function walk(v:any){if(!v||typeof v!=='object')return;if(typeof v.type==='string')result.push(v);for(const x of Object.values(v))if(typeof x==='object')Array.isArray(x)?x.forEach(walk):walk(x);}walk(config);return result;}
export async function compileGame({config,assetDir,outDir,revisionId,extensionsDir}:CompileOptions){
  jsonOnly(config);validateConfig(config);if(!revisionId)throw Error('缺少revisionId');
  const data=structuredClone(config);delete data.assetBase;delete data.alternate; // base is owned by the relocatable output.
  const extensionDefs=data.extensions||[];if(!Array.isArray(extensionDefs))throw Error('extensions 必须为数组');
  if((data.minigames.length||collectActions(data).some(a=>a.type==='custom'))&&!extensionDefs.length)throw Error('custom/minigame 必须有已实现的 extensions 模块');
  const assets:Array<{src:string;file:string;bytes:Buffer}>=[];const assetById=new Map<string,{file:string;bytes:Buffer}>();
  for(const a of data.assets){const file=await safeFile(assetDir,a.src),bytes=await fs.readFile(file);assertMedia(a.src,a.type,bytes);assets.push({src:a.src,file,bytes});assetById.set(a.id,{file,bytes});}
  // Decode every declared image and check all referenced source rectangles against the actual image size.
  const dimensions=new Map<string,{width:number;height:number}>();
  for(const a of data.assets.filter((a:any)=>a.type==='image')){const m=await sharp(assetById.get(a.id)!.bytes).metadata();if(!m.width||!m.height)throw Error('图片无法解码：'+a.id);dimensions.set(a.id,{width:m.width,height:m.height});}
  for(const c of data.characters){const size=dimensions.get(c.asset);if(!size)throw Error('角色资源必须是图片：'+c.id);const frames=c.atlas?.directions?Object.values(c.atlas.directions).flat():['down','left','right','up'].flatMap(d=>Array.from({length:c.atlas?.columns||3},(_,i)=>frameFor(c,d,true,i/(c.atlas?.fps||8))));for(const f of frames as any[])if(!['x','y','w','h'].every(k=>Number.isFinite(f[k]))||f.w<=0||f.h<=0||f.x<0||f.y<0||f.x+f.w>size.width||f.y+f.h>size.height)throw Error('角色帧越出图片：'+c.id);}
  for(const c of data.characters)for(const [name,a]of Object.entries(c.animations||{}) as [string,any][]){const size=dimensions.get(a.asset);if(!size||!Array.isArray(a.frames)||!a.frames.length||!Number.isFinite(a.fps)||a.fps<=0)throw Error('动作资源/帧无效：'+c.id+'/'+name);for(const f of a.frames)if(!['x','y','w','h'].every(k=>Number.isFinite(f[k]))||f.x<0||f.y<0||f.w<=0||f.h<=0||f.x+f.w>size.width||f.y+f.h>size.height)throw Error('动作帧越出图片：'+name);for(const e of a.events||[])if(!Number.isInteger(e.frame)||e.frame<0||e.frame>=a.frames.length||typeof e.name!=='string')throw Error('动作事件无效：'+name);}
  const extensionFiles:Array<{name:string;file:string}>=[];
  if(extensionDefs.length){if(!extensionsDir)throw Error('缺少 extensionsDir');const ids=new Set();for(const def of extensionDefs){if(!def.id||ids.has(def.id)||!String(def.entry).endsWith('.js'))throw Error('扩展id/entry非法');ids.add(def.id);await safeFile(extensionsDir,def.entry);}for(const name of await listFiles(extensionsDir)){if(!/\.(js|json|css)$/.test(name))throw Error('扩展目录只接收js/json/css：'+name);const file=await safeFile(extensionsDir,name);const source=await fs.readFile(file,'utf8');if(/(?:https?:|\/\/)[^\s'"`]+/.test(source.replace(/^\s*\/\/.*$/gm,'')))throw Error('扩展包含远程引用：'+name);for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)){const imported=match[1]!;if(!imported.startsWith('./')&&!imported.startsWith('../'))throw Error('扩展只能相对导入：'+imported);const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),imported));await safeFile(extensionsDir,resolved);}extensionFiles.push({name,file});}}
  const configText=JSON.stringify(data,null,2)+'\n',configHash=hash(configText);
  await fs.mkdir(path.dirname(path.resolve(outDir)),{recursive:true});
  await fs.mkdir(outDir,{recursive:false});
  try{
    await fs.writeFile(path.join(outDir,'config.json'),configText);
    await copyFile(path.join(provenanceDir,'export-notice.md'),path.join(outDir,'SOURCE-NOTICE.zh-CN.md'));
    for(const name of ['source.json','legacy-kit-license-notice.txt'])await copyFile(path.join(provenanceDir,name),path.join(outDir,'provenance',name));
    await fs.writeFile(path.join(outDir,'启动说明.txt'),'本游戏为独立静态 HTML5 工程。\n在解压目录运行 python3 -m http.server 8000，然后打开 http://127.0.0.1:8000\n无需 Codex、工作台或远程 CDN；请通过本地 HTTP 打开，不要直接双击 index.html。\nWASD/方向键移动，E/空格交互，M 地图，I 物品，J 成就，Esc 暂停。\n源码来源与适用限制见 SOURCE-NOTICE.zh-CN.md 及 provenance/，请保留这些文件。\n');
    for(const a of assets)await copyFile(a.file,path.join(outDir,'assets',a.src));
    for(const name of await listFiles(runtimeDir))if(/\.(js|css|svg)$/.test(name))await copyFile(path.join(runtimeDir,name),path.join(outDir,'runtime',name));
    for(const ext of extensionFiles)await copyFile(ext.file,path.join(outDir,'extensions',ext.name));
    const title=String(data.title).replace(/[&<>"']/g,(c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    await fs.writeFile(path.join(outDir,'index.html'),`<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; font-src 'self';"><title>${title}</title><link rel="stylesheet" href="./runtime/styles.css"></head><body><main id="game" aria-label="游戏"></main><script type="module" src="./bootstrap.js"></script></body></html>\n`);
    await fs.writeFile(path.join(outDir,'bootstrap.js'),`import {createGame} from './runtime/engine.js';\nconst config=await(await fetch('./config.json')).json();\nconfig.assetBase=new URL('./assets/',document.baseURI);\nconst game=createGame(config,{target:document.querySelector('#game')});\nconst freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\nObject.defineProperty(window,'__CREATE_WORLD_OBSERVE__',{value:()=>freeze(game.observe()),writable:false,configurable:false});\nObject.defineProperty(window,'__CREATE_WORLD_STATE__',{get:()=>freeze(game.observe()),configurable:false});\nfor(const extension of config.extensions||[]){const mod=await import('./extensions/'+extension.entry);if(typeof mod.default!=='function')throw Error('扩展必须默认导出注册函数：'+extension.id);await mod.default(game);}\nawait game.start();\nwindow.addEventListener('pagehide',()=>game.save());\n`);
    const files=[];for(const name of await listFiles(outDir)){const bytes=await fs.readFile(path.join(outDir,name));files.push({path:name,sha256:hash(bytes),bytes:bytes.length});}
    const manifest:BuildManifest={schemaVersion:1,status:'candidate',revisionId,configHash,runtimeVersion:'2.0.0',files,extensions:extensionDefs.map((x:any)=>x.id)};
    await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    return {manifest,entryPath:path.join(path.resolve(outDir),'index.html'),configHash};
  }catch(error){await fs.writeFile(path.join(outDir,'BUILD_FAILED.txt'),String(error));throw error;}
}
export async function verifyBuild(outDir:string):Promise<{valid:boolean;errors:string[];manifest?:BuildManifest}>{
  const errors:string[]=[];let manifest:BuildManifest|undefined;
  try{const text=await fs.readFile(await safeFile(outDir,'manifest.json'),'utf8');manifest=JSON.parse(text);if(!manifest||manifest.schemaVersion!==1||manifest.status!=='candidate'||!Array.isArray(manifest.files))throw Error('清单结构非法');const names=new Set<string>();for(const f of manifest.files){relative(f.path);if(f.path==='manifest.json'||names.has(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('清单路径重复或哈希非法');names.add(f.path);const bytes=await fs.readFile(await safeFile(outDir,f.path));if(hash(bytes)!==f.sha256||bytes.length!==f.bytes)errors.push('文件被修改：'+f.path);}for(const name of await listFiles(outDir))if(name!=='manifest.json'&&!names.has(name))errors.push('未声明文件：'+name);if(hash(await fs.readFile(path.join(outDir,'config.json')))!==manifest.configHash)errors.push('配置哈希不匹配');for(const required of ['index.html','bootstrap.js','config.json','runtime/engine.js'])if(!names.has(required))errors.push('缺少必需文件：'+required);
  }catch(e){errors.push(String(e));}
  return{valid:errors.length===0,errors,manifest};
}
