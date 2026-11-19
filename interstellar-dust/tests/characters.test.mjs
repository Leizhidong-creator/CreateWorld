import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/render.js';
import {validateConfig} from '../src/validate.js';
import {story} from '../content.js';

function harness(){
  const calls=[],ctx={fillRect(){},drawImage(...args){calls.push(args.slice(1));}};
  return {calls,renderer:new Renderer({getContext:()=>ctx},{images:new Map([['sprite',{}]])},{})};
}
const player={x:100,y:100,facing:'down'};
const legacy={asset:'sprite',frameWidth:32,frameHeight:48,width:32,height:48};
const skill={...legacy,frameWidth:48,frameHeight:64,width:36,height:48,frameCount:4,idleFrame:0,frameDuration:170,footAnchor:{x:24,y:61}};

test('four-frame skill animation retains both gait frames, repeats and returns to neutral',()=>{
  const {renderer:r,calls}=harness();
  for(const t of [0,.171,.341,.511,.681]){r.time=t;r.character(player,skill,true);}
  assert.deepEqual(calls.map(c=>c[0]),[0,48,96,144,0]);
  r.time=.511;r.character(player,skill,false);assert.equal(calls.at(-1)[0],0);
});
test('all facing rows and skill foot anchor map to correct canvas coordinates',()=>{
  const {renderer:r,calls}=harness();
  for(const facing of ['down','left','right','up'])r.character({...player,facing},skill,false);
  assert.deepEqual(calls.map(c=>c[1]),[0,64,128,192]);
  for(const c of calls)assert.deepEqual(c.slice(2),[48,64,82,54,36,48]);
});
test('legacy three-frame sheets keep their cadence, idle column and bottom anchor',()=>{
  const {renderer:r,calls}=harness();
  for(const t of [0,.126,.251,.376]){r.time=t;r.character(player,legacy,true);}
  assert.deepEqual(calls.map(c=>c[0]),[0,32,64,0]);
  r.character(player,legacy,false);assert.deepEqual(calls.at(-1),[32,0,32,48,84,52,32,48]);
});
test('stationary NPC atlas never requests a nonexistent animation column',()=>{
  const {renderer:r,calls}=harness();r.time=123.4;
  for(const moving of [false,true])r.character(player,{...skill,frameCount:1},moving);
  assert.deepEqual(calls.map(c=>c[0]),[0,0]);
});
test('invalid animation metadata fails early instead of rendering out of bounds',()=>{
  for(const patch of [{frameCount:0},{idleFrame:4},{frameDuration:0},{footAnchor:{x:24,y:65}}]){
    const config={...story,characters:story.characters.map(c=>({...c}))};Object.assign(config.characters[0],patch);
    assert.throws(()=>validateConfig(config),/characters\.cooper/);
  }
});
