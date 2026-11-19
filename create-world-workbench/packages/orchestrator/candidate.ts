import fs from 'node:fs';
import path from 'node:path';
import {readJson,hash,hashFile,hashTree} from '../shared/files.js';
import {artReferenceFingerprint} from './visual-standard.js';
import {CANDIDATE_FILE_ORDER,CANDIDATE_TREES,workspaceFile} from './workspace-layout.js';
import {authoredContentHash} from './game-config.js';
import {loadSkillCatalog} from '../skill-adapters/catalog.js';

export function skillCatalog(root:string){return loadSkillCatalog(path.join(root,'skills'));}
/** Host-side reader for the minigame library index; the model never has to parse the 46KB body to pick one. */
export function minigameCatalog(skillsDir:string){const dir=path.join(skillsDir,'gameplay-design','references');const index=readJson(path.join(dir,'minigame-index.json'));if(!Array.isArray(index.entries)||!index.entries.length)throw Error('小游戏库索引为空');return{...index,file:path.join(dir,'minigame-library.zh-CN.md')};}


export function candidateHash(workspace:string){const files=CANDIDATE_FILE_ORDER.map(file=>[file,fs.existsSync(workspaceFile(workspace,file))?hashFile(workspaceFile(workspace,file)):'missing']);return hash(String(authoredContentHash(workspace))+JSON.stringify(files)+CANDIDATE_TREES.map(tree=>hashTree(path.join(workspace,tree))).join('')+artReferenceFingerprint(workspace));}
