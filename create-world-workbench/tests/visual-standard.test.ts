import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { artDirectionErrors, artReferenceFingerprint, visualReviewErrors, visualReviewScreenshots, VISUAL_CHECKS } from '../packages/orchestrator/visual-standard.js';
import { candidateHash, productionPrompt } from '../packages/orchestrator/autonomous-contract.js';

test('formal art specification requires shared visual references and concrete cross-asset rules', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-art-'));
  try {
    assert.match(artDirectionErrors({},root).join('\n'),/缺少统一美术规格/);
    const art={pixelPolicy:'640x360 native pixel clusters',camera:'orthographic top down',characterSize:'32px tall, feet anchor',
      palette:['#334452','#9eafb5'],lighting:'upper-left cool light',detailDensity:'large flat clusters, no dense noise',
      assetReuse:'compare old actor with scene at runtime size before reuse',referencePaths:['style.svg']};
    assert.match(artDirectionErrors({artDirection:art},root).join('\n'),/参考不存在/);
    fs.writeFileSync(path.join(root,'style.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>');
    assert.deepEqual(artDirectionErrors({artDirection:art},root),[]);
    assert.match(artDirectionErrors({artDirection:{...art,lighting:''}},root).join('\n'),/lighting/);
    assert.match(artDirectionErrors({artDirection:{...art,referencePaths:['../outside.svg']}},root).join('\n'),/路径无效/);
    fs.writeFileSync(path.join(root,'design.json'),JSON.stringify({artDirection:art}));
    const before=artReferenceFingerprint(root),candidate=candidateHash(root);
    assert.match(productionPrompt(process.cwd(),root,{},{}),/统一美术是正式交付条件/);
    fs.appendFileSync(path.join(root,'style.svg'),'\n');
    assert.notEqual(artReferenceFingerprint(root),before);
    assert.notEqual(candidateHash(root),candidate,'reference changes invalidate old accepted evidence');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('visual acceptance rejects a blanket pass, missing scenes, false checks and unrelated screenshots', () => {
  const game={start:{scene:'cell'},scenes:[{id:'cell'},{id:'yard'}]};
  const shots=[{path:'cell.png',label:'scene-cell'},{path:'yard.png',label:'scene-yard'}];
  assert.ok(visualReviewErrors(game,{passed:true,visualPassed:true},shots).length);
  const report={visualConsistency:game.scenes.map(s=>({sceneId:s.id,screenshot:s.id+'.png',
    checks:Object.fromEntries(VISUAL_CHECKS.map(key=>[key,{passed:true,observation:'Fixture observation for '+key}]))}))};
  assert.deepEqual(visualReviewErrors(game,report,shots),[]);
  report.visualConsistency[1].checks.lighting.passed=false;
  assert.match(visualReviewErrors(game,report,shots).join('\n'),/yard.*lighting/);
  report.visualConsistency[1].checks.lighting.passed=true;
  report.visualConsistency[1].screenshot='cell.png';
  assert.match(visualReviewErrors(game,report,shots).join('\n'),/对应的宿主运行截图/);
  report.visualConsistency.pop();
  assert.match(visualReviewErrors(game,report,shots).join('\n'),/yard.*合成美术审阅/);
});

test('review image selection covers later scenes instead of only the first eight shots', () => {
  const game={start:{scene:'s0'},scenes:Array.from({length:10},(_,i)=>({id:'s'+i}))};
  const shots=[...Array.from({length:12},(_,i)=>({path:'extra'+i+'.png',label:'mechanism-'+i})),
    ...game.scenes.map(s=>({path:s.id+'.png',label:'scene-'+s.id}))];
  const selected=visualReviewScreenshots(game,shots);
  assert.equal(selected.length,10);
  for(const scene of game.scenes)assert.ok(selected.some(s=>s.label==='scene-'+scene.id));
});
