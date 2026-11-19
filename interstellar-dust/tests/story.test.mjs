import test from 'node:test';
import assert from 'node:assert/strict';
import {story} from '../content.js';
import {validateConfig} from '../src/validate.js';
import {StoryStore} from '../src/state.js';
import {SaveManager} from '../src/storage.js';
import {canStand,nearestInteraction} from '../src/geometry.js';
const d=id=>story.dialogues.find(d=>d.id===id);
function finish(store,id,choice){const v=d(id);store.commit([...(v.onComplete||[]),...(choice===undefined?[]:v.choices[choice].actions)],v.once?'dialogue:'+id:null);}
const untilMission=s=>{for(const id of ['crop','books','dust'])finish(s,id);finish(s,'decode',0);finish(s,'arrival');finish(s,'mission');};
test('two scenes validate and all dialogue lines fit the concise Chinese budget',()=>{validateConfig(story);assert.equal(story.scenes.length,2);for(const dialog of story.dialogues)for(const line of dialog.lines)assert.ok(line.text.length<=50,dialog.id);});
test('refusing to finish a decision remains recoverable; all eight tasks can complete',()=>{const s=new StoryStore(story),commands=[];s.on('command',a=>commands.push(a));finish(s,'crop');finish(s,'books');finish(s,'dust');finish(s,'decode',1);assert.equal(s.run.flags.coordinates,undefined);finish(s,'decode',0);finish(s,'arrival');finish(s,'mission');finish(s,'goodbye',1);assert.equal(s.run.flags.goodbye,undefined);finish(s,'goodbye',0);assert.ok(commands.some(a=>a.id==='promise'));finish(s,'promise');finish(s,'depart',1);assert.equal(s.run.flags.departed,undefined);finish(s,'depart',0);assert.ok(commands.some(a=>a.type==='ending'&&a.id==='beyond'));assert.ok(Object.values(s.run.quests).every(q=>q==='done'));});
test('story items are awarded once; save restores progress and restart preserves discoveries',()=>{let s=new StoryStore(story);untilMission(s);finish(s,'mission');assert.equal(s.run.items.flight,1);finish(s,'model');const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};const save=new SaveManager(story,storage,()=>{});save.save(s);const data=save.load();s=new StoryStore(story,data.run,data.profile);assert.equal(s.currentQuest().id,'goodbye');assert.equal(s.run.items.flight,1);finish(s,'promise');finish(s,'promise');assert.equal(s.run.items.drawing,1);s.restart();assert.equal(s.run.flags.mission,undefined);assert.ok(s.profile.achievements.rocket);});
test('all exits and interactions have reachable standing positions with actual target selection',()=>{
 const s=new StoryStore(story);untilMission(s);
 for(const scene of story.scenes){
  const solids=scene.objects.filter(o=>o.solid).map(o=>o.solid),step=5,seen=new Set(),queue=[scene.spawn];
  for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){const n={x:p.x+dx,y:p.y+dy},key=n.x+','+n.y;if(seen.has(key)||!canStand(n,scene,solids,7))continue;seen.add(key);queue.push(n);}}
  for(const entry of scene.interactions.filter(e=>s.test(e.when)))assert.ok(queue.some(p=>nearestInteraction(p,scene.interactions,c=>s.test(c))?.id===entry.id),entry.id+' cannot be selected');
  for(const exit of scene.exits){assert.ok(queue.some(p=>nearestInteraction(p,[{...exit,range:exit.range||25}],()=>true)),exit.id);const target=story.scenes.find(s=>s.id===exit.to);assert.ok(canStand(exit.spawn,target,target.objects.filter(o=>o.solid).map(o=>o.solid),7));}
 }
});
