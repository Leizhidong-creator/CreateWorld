import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {packSpriteGrid} from '../packages/assets/sprites.js';
async function source(root:string,rows:number,columns:number,duplicate=false){const width=columns*24,height=rows*32,data=Buffer.alloc(width*height*4,255);for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const shift=duplicate?0:c%3;for(let y=7;y<28;y++)for(let x=7+shift;x<15+shift+(duplicate?0:c%3);x++){const i=((r*32+y)*width+c*24+x)*4;data[i]=40+r*10;data[i+1]=80;data[i+2]=100;}}const p=path.join(root,'synthetic-qa.png');await sharp(data,{raw:{width,height,channels:4}}).png().toFile(p);return p;}
test('direct grid processes synthetic QA fixture without fabricating frames',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-grid-'));try{const s=await source(root,4,4);const r=await packSpriteGrid(s,{kind:'walk',columns:4,rows:4,cellWidth:48,cellHeight:64});const m=await sharp(r.bytes).metadata();assert.equal(m.width,192);assert.equal(m.height,256);assert.equal(m.hasAlpha,true);assert.equal(r.metadata.frames.length,16);assert.equal(r.qa.visualStillRequired,true);assert.equal(new Set(r.qa.frames.map(f=>f.alignedBounds.bottom)).size,1);}finally{fs.rmSync(root,{recursive:true});}});
test('duplicated gait is rejected; special action uses action-specific geometry/events',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-grid-'));try{await assert.rejects(packSpriteGrid(await source(root,4,4,true),{kind:'walk',columns:4,rows:4,cellWidth:48,cellHeight:64}),/Duplicated/);const r=await packSpriteGrid(await source(root,1,4),{kind:'action',columns:4,rows:1,cellWidth:48,cellHeight:64,events:[{frame:2,name:'contact'}]});assert.deepEqual(r.metadata.events,[{frame:2,name:'contact'}]);await assert.rejects(packSpriteGrid(await source(root,1,4),{kind:'action',columns:4,rows:1,cellWidth:48,cellHeight:64,events:[{frame:8,name:'contact'}]}),/event/);}finally{fs.rmSync(root,{recursive:true});}});

test('directional repairs replace only declared gait slots and reject invalid or duplicate coordinates',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-grid-repair-'));
 try{
  const master=await source(root,4,4),spec={kind:'walk' as const,columns:4,rows:4,cellWidth:48,cellHeight:64};
  const repair=path.join(root,'repair.png');
  const rgba=Buffer.alloc(24*32*4);for(let y=7;y<28;y++)for(let x=7;x<16;x++){const i=(y*24+x)*4;rgba[i]=220;rgba[i+1]=100;rgba[i+2]=20;rgba[i+3]=255;}
  await sharp(rgba,{raw:{width:24,height:32,channels:4}}).png().toFile(repair);
  const base=await packSpriteGrid(master,spec),changed=await packSpriteGrid(master,spec,[{row:1,column:3,source:repair}]);
  for(let i=0;i<16;i++)if(i===7)assert.notEqual(changed.qa.frames[i].sha256,base.qa.frames[i].sha256);else assert.equal(changed.qa.frames[i].sha256,base.qa.frames[i].sha256);
  assert.equal(changed.qa.visualStillRequired,true);
  await assert.rejects(packSpriteGrid(master,spec,[{row:4,column:1,source:repair}]),/outside/);
  await assert.rejects(packSpriteGrid(master,spec,[{row:1,column:3,source:repair},{row:1,column:3,source:repair}]),/Duplicate/);
  await assert.rejects(packSpriteGrid(master,spec,[{row:1,column:3,source:repair,rect:{left:-1,top:0,width:10,height:10}}]),/crop/);
 }finally{fs.rmSync(root,{recursive:true});}
});
