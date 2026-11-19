import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from 'playwright';
const dir=fileURLToPath(new URL('../../outputs/first-room-new/',import.meta.url));
const build=(await fs.readFile(path.join(dir,'latest-build.txt'),'utf8')).trim();
const url='http://127.0.0.1:8799/'+path.basename(build)+'/';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors:string[]=[],checks:string[]=[];
const observe=(p:Page)=>p.evaluate(()=>(window as any).__CREATE_WORLD_OBSERVE__());
async function drain(p:Page){for(let i=0;i<40;i++){await p.waitForTimeout(70);if((await observe(p)).ui.kind!=='dialogue')return;await p.getByTestId('dialogue-next').click();}throw Error('Dialogue stuck');}
async function walk(p:Page,x:number,y:number){for(const axis of ['x','y'] as const)for(let i=0;i<130;i++){const state=await observe(p),d=(axis==='x'?x:y)-state.run.player[axis];if(Math.abs(d)<2)break;assert.equal(state.ui.kind,null);const key=axis==='x'?(d>0?'ArrowRight':'ArrowLeft'):(d>0?'ArrowDown':'ArrowUp');await p.keyboard.down(key);await p.waitForTimeout(Math.min(80,Math.max(18,Math.abs(d)*10)));await p.keyboard.up(key);if(i===129)throw Error('Route blocked '+JSON.stringify(state.run.player));}}
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(url);await p.getByTestId('start-game').click();await p.getByTestId('dialogue-next').waitFor();
 const initial=(await observe(p)).run.player;await p.keyboard.down('ArrowRight');await p.waitForTimeout(150);await p.keyboard.up('ArrowRight');assert.equal((await observe(p)).run.player.x,initial.x);await drain(p);assert.equal((await observe(p)).run.flags.MOVED,false);checks.push('开场冻结移动，静止不记实操');
 await walk(p,538,230);await walk(p,550,150);assert.equal((await observe(p)).target.id,'door');await p.keyboard.press('e');await drain(p);assert.equal((await observe(p)).run.flags.P07,false);assert.equal((await observe(p)).run.ending,null);checks.push('提前开门不能跳过调查');
 await walk(p,538,230);await walk(p,387,230);await walk(p,387,157);assert.equal((await observe(p)).target.id,'O_TABLE');
 await p.keyboard.press('e');await p.getByTestId('dialogue-next').waitFor();assert.equal((await observe(p)).run.flags.P07,false);
 await p.reload();await p.getByTestId('continue-game').click();await drain(p);assert.equal((await observe(p)).run.flags.P07,true);assert.deepEqual((await observe(p)).run.items,{});checks.push('实际移动与调查后才完成教学；未读完刷新可恢复；不赠送后续物品');
 await p.keyboard.press('e');await p.waitForTimeout(100);assert.equal((await observe(p)).ui.kind,null);await p.waitForTimeout(4400);await p.screenshot({path:path.join(dir,'desktop.png')});
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(450);await p.keyboard.up('ArrowUp');assert.ok((await observe(p)).run.player.y>=149);checks.push('桌子碰撞阻挡');
 await p.keyboard.press('Escape');await p.getByTestId('resume-game').waitFor();const before=(await observe(p)).run.player.x;await p.keyboard.down('ArrowLeft');await p.waitForTimeout(150);await p.keyboard.up('ArrowLeft');assert.equal((await observe(p)).run.player.x,before);await p.getByTestId('save-game').click();await p.getByTestId('resume-game').click();checks.push('暂停隔离输入，手动保存');
 await walk(p,387,230);await walk(p,160,230);await p.keyboard.down('ArrowUp');await p.waitForTimeout(200);await p.keyboard.up('ArrowUp');await p.keyboard.down('ArrowLeft');await p.waitForTimeout(500);await p.keyboard.up('ArrowLeft');assert.ok((await observe(p)).run.player.x>=121);checks.push('床的碰撞阻挡');
 await walk(p,160,250);await walk(p,538,250);await walk(p,550,150);await p.keyboard.press('e');await drain(p);assert.equal((await observe(p)).run.ending,'SCENE_END');assert.equal((await observe(p)).run.flags.P08_STARTED,true);assert.equal((await observe(p)).run.flags.P08,undefined);assert.equal((await observe(p)).run.scene,'S_CELL');await p.screenshot({path:path.join(dir,'completed.png')});checks.push('开门后结束本场景，未伪记走廊与地图教学');
 await p.getByTestId('return-title').click();await p.getByTestId('start-game').click();if((await observe(p)).ui.kind==='confirm')await p.getByRole('button',{name:'确认',exact:true}).click();await p.waitForTimeout(100);assert.equal((await observe(p)).run.flags.P07,false);checks.push('重新开始清空本轮');
 const m=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});m.on('pageerror',e=>errors.push(String(e)));await m.goto(url);await m.getByTestId('start-game').tap();await drain(m);
 const canvas=await m.getByTestId('game-canvas').boundingBox();assert.ok(canvas);assert.ok(Math.abs(canvas.width/canvas.height-16/9)<.01);
 const joy=await m.getByTestId('joystick').boundingBox();assert.ok(joy);const cx=joy.x+joy.width/2,cy=joy.y+joy.height/2,cdp=await m.context().newCDPSession(m);
 async function touch(type:'touchStart'|'touchEnd'|'touchMove'|'touchCancel',x:number,y:number){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});}
 async function axis(a:'x'|'y',target:number){for(let i=0;i<100;i++){const d=target-(await observe(m)).run.player[a];if(Math.abs(d)<3)return;await touch('touchStart',cx,cy);await touch('touchMove',cx+(a==='x'?Math.sign(d)*joy!.width*.43:0),cy+(a==='y'?Math.sign(d)*joy!.width*.43:0));await m.waitForTimeout(Math.min(90,Math.max(25,Math.abs(d)*10)));await touch('touchEnd',cx,cy);}throw Error('Touch route blocked');}
 await axis('x',387);await axis('y',157);assert.equal((await observe(m)).target.id,'O_TABLE');const stopped=(await observe(m)).run.player.x;await m.waitForTimeout(120);assert.equal((await observe(m)).run.player.x,stopped);await m.getByTestId('action-button').tap();await drain(m);assert.equal((await observe(m)).run.flags.P07,true);await m.waitForTimeout(4500);await m.screenshot({path:path.join(dir,'mobile.png')});await m.setViewportSize({width:844,height:390});await m.screenshot({path:path.join(dir,'mobile-landscape.png')});checks.push('390px 16:9；真实触屏摇杆、松手停止、情境键调查；横竖屏');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'acceptance.json'),JSON.stringify({passed:true,url,checks,errors,method:'真实键鼠与CDP触屏，observe只读，无注入状态'},null,2));console.log(JSON.stringify({passed:true,url,checks}));
}finally{await browser.close();}

