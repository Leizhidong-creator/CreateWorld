import fs from 'node:fs';
import {readJson,hash,hashFile,writeJson,safePath} from '../shared/files.js';
import {validateConfig} from '../runtime/validate.js';
import {WORKSPACE_FILE,workspaceFile} from './workspace-layout.js';

export function authoredContentHash(workspace:string){const p=workspaceFile(workspace,WORKSPACE_FILE.gameProject);if(!fs.existsSync(p))return null;const doc=readJson(p);return hash(JSON.stringify([hashFile(p),...(doc.parts||[]).map((f:string)=>[f,hashFile(safePath(workspace,f))])]));}
/** Content can be authored as one config or split into referenced fragments. No prescribed chapter order. */
export function composeGame(workspace:string){const projectFile=workspaceFile(workspace,WORKSPACE_FILE.gameProject);if(!fs.existsSync(projectFile))return readJson(workspaceFile(workspace,WORKSPACE_FILE.game));const project=readJson(projectFile),game=structuredClone(project.base);if(!game||!Array.isArray(project.parts))throw Error('game.project.json requires base and parts');for(const relative of project.parts){const fragment=readJson(safePath(workspace,relative));for(const [key,value]of Object.entries(fragment)){if(!Array.isArray(value))throw Error('Content fragments contain only arrays: '+relative+'.'+key);game[key]=[...(game[key]||[]),...value];}}if(fs.existsSync(workspaceFile(workspace,WORKSPACE_FILE.assetPatch))){const saved=readJson(workspaceFile(workspace,WORKSPACE_FILE.assetPatch));if(!Array.isArray(saved)&&saved.sourceHash!==authoredContentHash(workspace))throw Error('内容分片已改变，旧素材坐标补丁不再适用。将仍需保留的补丁合并进分片，然后移除asset-config-patch.json再检查。');for(const patch of (Array.isArray(saved)?saved:saved.patches)){if(patch.characters)for(const c of patch.characters){const target=game.characters.find((x:any)=>x.id===c.id);if(target)Object.assign(target,c);}if(patch.action){const c=game.characters.find((x:any)=>x.id===patch.action.characterId);if(c)c.animations={...(c.animations||{}),[patch.action.name]:patch.action.definition};}if(patch.scene){const s=game.scenes.find((x:any)=>x.id===patch.scene.id);if(s){for(const k of ['background','sourceSize','collisions','walkPolygon','spawn'])if(k in patch.scene)s[k]=patch.scene[k];for(const k of ['exits','interactions'])for(const e of s[k]||[]){const p=patch.scene[k]?.find((x:any)=>x.id===e.id);if(p?.rect)e.rect=p.rect;}}}if(patch.start&&game.start.scene===patch.start.scene)game.start.position=patch.start.position;}}validateConfig(game);return game;}
/** Pure composition for read-only checks. */
export function materializeGameConfig(workspace:string){
 const game=composeGame(workspace);
 // A single game.json is already authoritative; only split projects need materialising.
 if(fs.existsSync(workspaceFile(workspace,WORKSPACE_FILE.gameProject)))writeJson(workspaceFile(workspace,WORKSPACE_FILE.game),game);
 return game;
}
/** Backwards-compatible alias used by production tools. */
export function resolveGame(workspace:string){return materializeGameConfig(workspace);}
