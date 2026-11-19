import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {hash,writeJson} from '../packages/shared/files.js';
import {skillDescription} from '../packages/skill-adapters/catalog.js';
import {SKILL_HASH_POLICY,skillFileHash,matchesPreviousSkillFile} from '../packages/skill-adapters/skill-integrity.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const dest=path.join(root,'skills');const projectSource=path.resolve(root,'../.agents/skills');const source=process.argv[2]?path.resolve(process.argv[2]):fs.existsSync(projectSource)?projectSource:dest;
// Discover project entries rather than silently excluding newly installed skills.
const ids=fs.readdirSync(source,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(source,e.name,'SKILL.md'))).map(e=>e.name).sort();
const previous=fs.existsSync(path.join(dest,'manifest.json'))?JSON.parse(fs.readFileSync(path.join(dest,'manifest.json'),'utf8')).skills:[];
const records=[];
for(const id of ids){
 const from=path.join(source,id),to=path.join(dest,id);
 fs.mkdirSync(to,{recursive:true});
 if(from!==to)fs.cpSync(from,to,{recursive:true,filter:p=>!['__pycache__','.DS_Store','.git'].includes(path.basename(p))});
 const legacy=path.join(to,'LEGACY_SKILL.md'),legacyReference=path.join(from,'references/legacy-entry-v1.md');
 if(!fs.existsSync(legacy)&&fs.existsSync(legacyReference))fs.copyFileSync(legacyReference,legacy);
 const files:any[]=[];
 function visit(p:string){for(const name of fs.readdirSync(p).sort()){if(['__pycache__','.DS_Store','.git'].includes(name))continue;const f=path.join(p,name);if(fs.statSync(f).isDirectory())visit(f);else files.push({path:path.relative(to,f).split(path.sep).join('/'),sha256:skillFileHash(fs.readFileSync(f))});}}
 visit(to);
 const old=previous.find((s:any)=>s.id===id),treeSha256=hash(JSON.stringify(files));
 const equivalent=old?.files.length===files.length&&files.every(f=>{const prior=old.files.find((v:any)=>v.path===f.path);return prior&&matchesPreviousSkillFile(fs.readFileSync(path.join(to,f.path)),prior.sha256);});
 records.push({id,description:skillDescription(fs.readFileSync(path.join(to,'SKILL.md'),'utf8')),version:'0.2.0-autonomous.1',entry:id+'/SKILL.md',sha256:skillFileHash(fs.readFileSync(path.join(to,'SKILL.md'))),originalSkillSha256:fs.existsSync(legacy)?skillFileHash(fs.readFileSync(legacy)):null,treeSha256,productionRevision:equivalent?(old.productionRevision||old.treeSha256):treeSha256,files});
}
writeJson(path.join(dest,'manifest.json'),{schemaVersion:1,hashPolicy:SKILL_HASH_POLICY,releaseVersion:'0.2.0-autonomous.1',productionMode:'story-driven-autonomous',skills:records});console.log(`Synced ${ids.length} project skills to portable workbench release`);
