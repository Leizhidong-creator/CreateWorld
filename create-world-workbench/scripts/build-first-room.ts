import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { compileGame, verifyBuild } from '../packages/compiler/index.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const project=path.resolve(root,'../outputs/first-room-new');
const assets=path.join(project,'assets');
const sourcePath=path.join(root,'content-spec/high-wall-beyond.game.yaml');
const source=await fs.readFile(sourcePath,'utf8'),doc=YAML.parse(source);
for(const id of ['P06','P07','P08'])if(!doc.事件.some((e:any)=>e.id===id))throw Error('Missing YAML event '+id);
const yes=(id:string)=>({flag:id}),no=(id:string)=>({not:yes(id)});
const set=(id:string,value:any=true)=>({type:'flag',id,value});
const say=(id:string,ref:string,lines:string[],onComplete:any[]=[],once=false)=>({id,sourceRefs:[ref],once,lines:lines.map(text=>({speaker:'安迪 · 内心',text})),onComplete});
const start={x:190,y:230};
const config:any={
 id:'high-wall-first-room-new',saveVersion:1,title:doc.项目.名称,subtitle:'第一幕 · 石墙里的晨光',
 description:'在陌生的房间醒来。稳住脚步，看看桌面，再推开那扇门。',durationLabel:'首个互动场景',
 theme:{accent:'#c7b58a',world:{floor:'#33454e',floorAlt:'#60747a',wall:'#18232b',wallTop:'#60747a',shadow:'#18232b',wood:'#786747',trim:'#c7b58a'}},
 player:{character:'C_ANDY',speed:100,radius:6},start:{scene:'S_CELL',position:start},
 features:{map:false,fog:false,tutorial:false,clueNotebook:false},
 assets:[{id:'room',type:'image',src:'room.png'},{id:'andy',type:'image',src:'andy.png'},{id:'tone',type:'audio',src:'room.wav'},{id:'touch',type:'audio',src:'touch.wav'}],
 music:'tone',sounds:{interact:'touch'},
 characters:[{id:'C_ANDY',asset:'andy',frameWidth:48,frameHeight:64,width:48,height:64,atlas:{columns:4,rows:{down:0,left:1,right:2,up:3},fps:6,idleFrame:0}}],
 state:{strict:true,variables:[...['P06','MOVED','P07','P08_STARTED'].map(id=>({id,type:'bool',initial:false})),{id:'V_PHASE',type:'enum',values:['开场','早年'],initial:'开场'}],invariants:[{id:'tutorial-order',if:yes('P07'),then:{all:[yes('P06'),yes('MOVED')]}},{id:'door-order',if:yes('P08_STARTED'),then:yes('P07')}]},
 scenes:[{id:'S_CELL',name:'安迪的房间',width:640,height:360,background:'room',sourceSize:{width:640,height:360},camera:{mode:'fixed'},spawn:start,
 walkPolygon:[{x:30,y:124},{x:612,y:124},{x:612,y:338},{x:30,y:338}],
 collisions:[{x:44,y:102,w:72,h:146},{x:340,y:87,w:78,h:57}],
 objects:[],npcs:[],exits:[],regions:[],landmarks:[],sourceRefs:['S_CELL','P06','P07','P08'],onEnter:[{type:'dialogue',id:'wake'}],
 triggers:[{x:30,y:110,w:159.5,h:218},{x:190.5,y:110,w:419.5,h:218},{x:189.5,y:110,w:1,h:119.5},{x:189.5,y:230.5,w:1,h:97.5}].map((rect,i)=>({id:'move-'+i,rect,when:{all:[yes('P06'),no('MOVED')]},actions:[set('MOVED')]})),
 interactions:[{id:'O_TABLE',name:'旧木桌',label:'调查',rect:{x:340,y:121,w:78,h:23},range:29,sourceRefs:['O_TABLE','P07'],branches:[{when:yes('P07'),actions:[{type:'notice',text:'桌上没有可以带走的东西。该去门边了。'}]},{when:{all:[yes('P06'),yes('MOVED')]},actions:[{type:'dialogue',id:'inspect'}]},{actions:[{type:'notice',text:'先试着走几步，再靠近桌面调查。'}]}]},
 {id:'door',name:'房门',label:'开门',rect:{x:531,y:112,w:53,h:14},range:34,sourceRefs:['P08'],branches:[{when:yes('P07'),actions:[{type:'dialogue',id:'leave'}]},{actions:[{type:'dialogue',id:'wait'}]}]}]}],
 dialogues:[say('wake','P06',['冰冷的床沿硌着手掌。那间手术室的灯光终于从眼前散去……我醒了。','这不是梦。我是安迪，仍被困在黑墙庄园。得出去，也得让外面知道这里发生了什么。','先找到瑞德。他有联系外界的门路。眼下，先站稳，再看看桌面。'],[set('P06'),set('V_PHASE','早年')],true),
 say('inspect','P07',['指尖划过粗糙的木纹，只有几道陈旧的刻痕。桌上没有可以带走的东西。','呼吸慢下来了，脚步也稳了。去门边，先找瑞德。'],[set('P07')],true),
 say('wait','P07',['先别急。走到桌前看看，确认自己已经清醒。']),
 say('leave','P08',['我握紧冰冷的门把，将门推开。先找到瑞德。'],[set('P08_STARTED'),{type:'ending',id:'SCENE_END'}],true)],
 quests:[{id:'wake',title:'醒来 · 理清眼前的处境',initial:true,complete:yes('P06')},{id:'move',title:'试着走几步 · WASD / 方向键 / 摇杆',unlock:yes('P06'),complete:yes('MOVED')},{id:'table',title:'走近木桌 · 按 E / 空格调查',unlock:yes('MOVED'),complete:yes('P07')},{id:'leave',title:'走到房门前 · 按 E / 空格开门',unlock:yes('P07'),complete:yes('P08_STARTED')}],
 items:[],clues:[],achievements:[],minigames:[],
 endings:[{id:'SCENE_END',title:'门外的第一步',sourceRefs:['P08'],when:yes('P08_STARTED'),pages:[{title:'第一幕 · 完成',text:'你已恢复行动，亲自调查桌面，并推开房门。\n\n本场景到这里结束。'}]}]
};
await fs.writeFile(path.join(project,'game.json'),JSON.stringify(config,null,2));
await fs.writeFile(path.join(project,'source.json'),JSON.stringify({source:path.relative(project,sourcePath),sha256:createHash('sha256').update(source).digest('hex'),implemented:['P06','P07'],partial:{id:'P08',only:'门前操作',notCompleted:true},excluded:['P01-P05 前情','走廊','庭院','地图教学','交易及后续剧情'],newAssets:true,agentDesign:['原创独白','房间布局','结束页','新生成背景与四向角色','新合成音效']},null,2));
function wav(seconds:number,touch=false){const rate=22050,n=Math.floor(seconds*rate),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++){const t=i/rate;const v=touch?Math.sin(2*Math.PI*320*t)*Math.exp(-t*35)*.1:(Math.sin(2*Math.PI*65*t)*.015+Math.sin(2*Math.PI*130*t)*.006)*Math.sin(Math.PI*i/n)**2;b.writeInt16LE(Math.round(v*32767),44+i*2);}return b;}
await fs.writeFile(path.join(assets,'room.wav'),wav(8));await fs.writeFile(path.join(assets,'touch.wav'),wav(.14,true));
const out=path.join(project,'play-'+Date.now());
await compileGame({config,assetDir:assets,outDir:out,revisionId:'first-room-new'});
// Compiler bundles legacy control art; this scene uses freshly styled CSS controls only.
for(const name of ['joystick-base.svg','joystick-knob.svg'])await fs.unlink(path.join(out,'runtime/assets',name));
await fs.mkdir(path.join(out,'world-kit'),{recursive:true});
for(const file of await fs.readdir(path.join(root,'packages/source-library/world-kit')))if(/\.(js|css|md)$/.test(file))await fs.copyFile(path.join(root,'packages/source-library/world-kit',file),path.join(out,'world-kit',file));
await fs.writeFile(path.join(out,'runtime/controls.js'),`import {mountWorldControls,assert16x9} from '../world-kit/index.js';
export function mountControls({target,adapter={}}={}){target.classList.add('cw-source-surface');assert16x9(640,360);const c=mountWorldControls({target,keyboard:false,onMove:adapter.onMove,onActionDown:adapter.onActionDown,onActionUp:adapter.onActionUp});return{releaseAll:()=>c.releaseAll(),destroy:()=>c.destroy(),setContext:n=>c.setContext({visible:n.controlsVisible,joystickVisible:n.joystickVisible,actionVisible:n.actionVisible,actionEnabled:n.actionEnabled,actionLabel:n.actionLabel,actionHighlighted:n.actionHighlighted})};}`);
let ui=await fs.readFile(path.join(out,'runtime/ui.js'),'utf8');ui=ui.replace('WASD / 方向键移动 · E / 空格交互 · M 地图','WASD / 方向键移动 · E / 空格交互 · Esc 暂停').replace("'EPILOGUE · '","'SCENE · '").replace("'CURRENT OBJECTIVE'","'第一幕 · 醒来'");await fs.writeFile(path.join(out,'runtime/ui.js'),ui);
const css=await fs.readFile(path.join(out,'runtime/styles.css'),'utf8');await fs.writeFile(path.join(out,'runtime/styles.css'),`@import url('../world-kit/styles.css');\n`+css+`
.psk.cw-source-surface{min-height:0;aspect-ratio:16/9}.toolbar .tool:not(:last-child){display:none}
.cw-source-joystick{background:#18232b99!important;border:2px solid #94a5a166;box-sizing:border-box}.cw-source-joystick:before{content:'✥';position:absolute;inset:0;display:grid;place-items:center;color:#c7b58a77;font-size:36px}.cw-source-joystick-knob{background:#94a5a1!important;border:2px solid #c7b58a;box-sizing:border-box;border-radius:50%;width:38%;height:38%;box-shadow:0 2px 0 #18232b}.cw-source-interaction-key{background:#18232bcc;border-color:#94a5a1;border-radius:18%;box-shadow:none}.cw-source-interaction-key.is-highlighted{background:#60747acc;border-color:#c7b58a;box-shadow:none}
.hud{padding:2% 3%}.toasts{top:24%}.goal{max-width:70vw}
@media(orientation:portrait){.psk.cw-source-surface{height:56.25vw;min-height:0}.title h1{font-size:22px}.panel{padding:10px 14px}.panel h1{font-size:18px}.intro,.ending-copy{font-size:11px;line-height:1.6}.title-facts,.fine{font-size:8px}.button{font-size:10px;padding:5px 10px;min-height:28px}.dialogue-text{font-size:11px;min-height:2.5em}.dialogue-actions{margin-top:4px}.scene-name{font-size:12px}.eyebrow{font-size:7px}.goal{font-size:9px}.toolbar .tool{font-size:9px;padding:5px}.context-label{font-size:10px;padding:4px}.toast{font-size:9px;padding:4px}.panel-head{margin-bottom:8px}}
`);
const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));
await fs.writeFile(path.join(out,'启动说明.txt'),'高墙之外 · 首个互动场景（S_CELL）\n在此目录运行 python -m http.server 8799 --bind 127.0.0.1，再打开 http://127.0.0.1:8799/\nWASD/方向键/摇杆移动；靠近桌面或房门后按 E/空格/交互按钮；Esc 暂停。\n完成桌面调查后开门结束本场景，不含走廊或后续剧情。\n刷新后可继续，重新开始清空本轮。请保留来源声明。\n');
async function files(dir:string):Promise<string[]>{return(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
manifest.files=await Promise.all((await files(out)).filter(p=>path.basename(p)!=='manifest.json').sort().map(async p=>{const b=await fs.readFile(p);return{path:path.relative(out,p).split(path.sep).join('/'),sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length};}));
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));await fs.writeFile(path.join(project,'latest-build.txt'),out);
const verification=await verifyBuild(out);if(!verification.valid)throw Error(verification.errors.join('\n'));console.log(JSON.stringify({out,verified:true}));
await fs.writeFile(path.join(project,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./${path.basename(out)}/"><title>高墙之外 · 首个互动场景</title><a href="./${path.basename(out)}/">开始试玩</a>`);
