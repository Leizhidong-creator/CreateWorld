import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyBuild} from '../packages/compiler/index.js';

const root=fileURLToPath(new URL('../../outputs/first-room-new/',import.meta.url));
const build=(await fs.readFile(path.join(root,'latest-build.txt'),'utf8')).trim();
const design=JSON.parse(await fs.readFile(path.join(root,'design.json'),'utf8'));
design.geometryPlan={viewport:[640,360],spawn:[190,230],bed:[44,102,72,146],table:[340,87,78,57],door:[531,112,53,14],walkPolygon:[[30,124],[612,124],[612,338],[30,338]],stations:{table:[387,157],door:[550,150]}};
design.artDirection.referencePaths=['assets/room.png','assets/andy-master-fixed.png'];
design.artDirection.characterSize='48×64 单元，可见主体约26×52；床72×146，桌78×57（含顶面深度），门约53×98；底部中心脚点，透明基线60；沿用同一世界单位';
design.validation={geometry:'collision-report.json',realInput:'acceptance.json',visual:'review.json',unverified:['真人时长与偏好','完整故事流程','音频主观试听','动作循环逐帧连续视觉审查']};
await fs.writeFile(path.join(root,'design.json'),JSON.stringify(design,null,2));
await fs.writeFile(path.join(root,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./${path.basename(build)}/"><title>高墙之外 · 首个互动场景</title><a href="./${path.basename(build)}/">开始试玩</a>`);
for(const name of ['design.json','source.json','collision.json','collision-report.json','acceptance.json','review.json','asset-production.md'])await fs.copyFile(path.join(root,name),path.join(build,name));
await fs.mkdir(path.join(build,'source'),{recursive:true});
await fs.copyFile(fileURLToPath(new URL('./build-first-room.ts',import.meta.url)),path.join(build,'source/build-first-room.ts'));
await fs.copyFile(fileURLToPath(new URL('./pack-first-room.ts',import.meta.url)),path.join(build,'source/pack-first-room.ts'));
await fs.writeFile(path.join(build,'README.md'),'# 高墙之外 · 第一个互动场景\n\n仅 S_CELL：醒来 → 实际移动 → 靠近桌面调查 → 门前交互结束。源 YAML 的 P06/P07 已实现，P08 仅门前操作，不记完成。\n\n运行 `python -m http.server 8799 --bind 127.0.0.1` 后打开 http://127.0.0.1:8799/ 。不要直接双击 index.html。无需工作台、Node 或在线模型。\n\nWASD/方向键/左下摇杆移动；E/空格/右下按钮交互；Esc 暂停并可保存。刷新后继续。手机建议横屏。\n\n设计、来源和验收记录见同目录 JSON；源码生成脚本见 source/（在原项目中复现）。原生图像母版保存在原项目 outputs/first-room-new/assets/。授权与来源见 SOURCE-NOTICE.zh-CN.md 和 provenance/。\n');
await fs.writeFile(path.join(build,'启动说明.txt'),'在本目录运行 python -m http.server 8799 --bind 127.0.0.1\n打开 http://127.0.0.1:8799/\nWASD/方向键/摇杆移动，E/空格/按钮交互，Esc 暂停。调查桌面后开门结束首场景。\n');
async function list(dir:string):Promise<string[]>{const entries=await fs.readdir(dir,{withFileTypes:true});return(await Promise.all(entries.map(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const manifest=JSON.parse(await fs.readFile(path.join(build,'manifest.json'),'utf8'));
manifest.files=await Promise.all((await list(build)).filter(f=>path.basename(f)!=='manifest.json').sort().map(async f=>{const b=await fs.readFile(f);return{path:path.relative(build,f).split(path.sep).join('/'),sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length};}));
await fs.writeFile(path.join(build,'manifest.json'),JSON.stringify(manifest,null,2));
const result=await verifyBuild(build);if(!result.valid)throw Error(result.errors.join('\n'));
console.log(JSON.stringify({build,verified:true}));
