import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.CW_SMOKE_ORIGIN || 'http://127.0.0.1:8787';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
const context = await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});
const page = await context.newPage();
const errors=[], failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
await page.goto(origin+'/#/explore/walls');
await page.getByLabel('账号',{exact:true}).fill('creator');
await page.getByLabel('密码',{exact:true}).fill('createworld');
await page.getByRole('button',{name:'登录并继续',exact:true}).click();
await page.getByRole('button',{name:'开始试玩',exact:true}).click();
const iframe=page.locator('iframe');await iframe.waitFor();
const frame=await iframe.contentFrame();
const canvas=frame.locator('#game');await canvas.waitFor();
await page.waitForTimeout(2000);
await page.screenshot({path:'../outputs/walls-title.png',fullPage:true});
await canvas.press('Space');
await frame.locator('#openingNoticeAcceptButton').click({timeout:15000});
for(let i=0;i<35;i++){
  if(await canvas.evaluate(()=>GameState.scene)==='yard')break;
  await canvas.press('Space');await page.waitForTimeout(850);
}
assert.equal(await canvas.evaluate(()=>GameState.scene),'yard');
for(let i=0;i<6;i++){
  const button=frame.locator('#tutorialContinueButton');
  if(!(await button.isVisible()))break;
  await button.click();await page.waitForTimeout(250);
}
const before=await canvas.evaluate(()=>({x:GameState.player.x,y:GameState.player.y}));
await canvas.focus();await page.keyboard.down('d');await page.waitForTimeout(600);await page.keyboard.up('d');
const after=await canvas.evaluate(()=>({x:GameState.player.x,y:GameState.player.y}));
assert.notDeepEqual(after,before,'keyboard must move the player');
await page.screenshot({path:'../outputs/walls-integrated-desktop.png',fullPage:true});
await page.getByRole('button',{name:'全屏试玩'}).click();
assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
await page.getByRole('button',{name:'退出全屏'}).click();
await page.setViewportSize({width:844,height:476});
await iframe.scrollIntoViewIfNeeded();
const rect=await iframe.boundingBox();assert.ok(rect && Math.abs(rect.width/rect.height-16/9)<.02);
await page.screenshot({path:'../outputs/walls-integrated-mobile.png',fullPage:true});
await page.getByRole('button',{name:'退出试玩',exact:true}).click();assert.equal(await page.locator('iframe').count(),0);
await page.getByRole('button',{name:'开始试玩',exact:true}).click();await page.locator('iframe').waitFor();
const resumed=await page.locator('iframe').contentFrame();await resumed.locator('#game').waitFor();
assert.equal(await resumed.locator('#game').evaluate(()=>CheckpointSystem.hasResume()),true);
const {previewUrl}=await (await context.request.get(origin+'/api/builtin-games/walls')).json();
for(const suffix of ['.git/config','scripts/compliance-check.mjs','../README.md']){
 const response=await context.request.get(previewUrl+suffix);assert.equal(response.status(),404);
}
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
const result={passed:true,checks:['existing explore entry','original runtime and local assets','real keyboard progression to yard','player movement','fullscreen','844x476 viewport with 16:9 game','exit removes runtime','reopen retains original save','private repository paths rejected'],before,after,errors,failed,unverified:['full story and endings','all touch interactions','all scene visual consistency']};
fs.writeFileSync('../outputs/walls-local-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
