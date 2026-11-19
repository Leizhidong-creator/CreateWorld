import { harbor } from './harbor.js';
// A second content pack. Reuses data layout and art, but never imports/patches engine internals.
const data={...harbor,assetBase:undefined};
export const station=structuredClone(data);
station.assetBase=harbor.assetBase;
station.id='orbital-echo-demo';station.title='轨道余声';station.subtitle='ECHOES OF THE ORBITAL STATION';
station.description='废弃中继站发来最后一条讯息。寻找值守员，取回记录，并决定把这段声音交给谁。';
station.alternate={label:'切换配置示例 → 雾港来信',href:'?theme=harbor'};
station.theme.accent='#8bcfc9';station.features.clueNotebook=true;
const replace=text=>text.replaceAll('守灯人','值守员').replaceAll('雾港','中继站').replaceAll('旧码头','停靠平台').replaceAll('旧港','空间站').replaceAll('港口','中继站').replaceAll('小屋','休息舱').replaceAll('档案室','记录室').replaceAll('档案员','记录员').replaceAll('未寄出的信','未发送的记录').replaceAll('铜钥匙','通行卡').replaceAll('信号灯','中继信标').replaceAll('潮汐','轨道').replaceAll('潮声','低频嗡鸣').replaceAll('水面','星海').replaceAll('海面','星海').replaceAll('码头','平台').replaceAll('灯塔','信标').replaceAll('船','飞船').replaceAll('雾','星尘').replaceAll('庭院','中央平台');
function rewrite(value){if(typeof value==='string')return replace(value);if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));return value;}
for(const key of ['scenes','dialogues','items','clues','quests','achievements','endings'])station[key]=rewrite(station[key]);
for(const scene of station.scenes)scene.palette={...scene.palette,floor:'#35434f',floorAlt:'#3b4955',seam:'#26333f',detail:'#617580',wood:'#526571',woodLight:'#8aa9af',woodDark:'#344650',water:'#101c36',wave:'#697ca5',trim:'#91d0cb',leaf:'#3e6170',leafLight:'#649595'};
station.theme.world=station.scenes[1].palette;
station.dialogues.find(d=>d.id==='meet').lines=[{speaker:'值守员',text:'你接到了最后的讯息？记录室仍然封着，通行卡在我这里。'},{speaker:'值守员',text:'取回那份记录，然后重启东北侧的中继信标。让地面知道我们还在。'}];
station.items.find(i=>i.id==='key').description='值守员交给你的旧通行卡。';
station.items.find(i=>i.id==='letter').content='如果接收到这段记录，请重新启动中继信标。有人还在等待返航的坐标。';
