import test from 'node:test';
import assert from 'node:assert/strict';
import { Resources } from '../src/resources.js';
globalThis.Image = class {};
test.after(() => { delete globalThis.Image; });

test('audio is registered without downloading before play', async t => {
  t.mock.method(globalThis,'fetch',()=>{throw new Error('Audio must not block startup');});
  const resources=new Resources([{id:'music',type:'audio',src:'music.wav'}],'https://example.test/');
  const progress=[];await resources.load(n=>progress.push(n));
  assert.equal(resources.urls.get('music'),'https://example.test/music.wav');
  assert.deepEqual(progress,[1]);resources.destroy();
});
test('image transient error retries and completes once', async t => {
  let count=0;
  globalThis.Image=class {
    set src(value){queueMicrotask(()=>{if(++count===1)this.onerror?.();else this.onload?.();});}
    removeAttribute(){}
  };
  const resources=new Resources([{id:'scene',type:'image',src:'scene.webp'}],'https://example.test/',{timeoutMs:30});
  const progress=[];await resources.load(n=>progress.push(n));
  assert.equal(count,2);assert.equal(resources.images.size,1);assert.deepEqual(progress,[1]);resources.destroy();
});
test('timeout cancels remaining loads and prevents late progress', async t => {
  const instances=[];
  globalThis.Image=class {
    constructor(){instances.push(this);}
    set src(value){}
    removeAttribute(){this.cancelled=true;}
  };
  const resources=new Resources([{id:'scene',type:'image',src:'scene.webp'},{id:'actor',type:'image',src:'actor.webp'}],'https://example.test/',{timeoutMs:5,attempts:1});
  const progress=[];await assert.rejects(resources.load(n=>progress.push(n)),/超时/);
  for(const image of instances){image.onload?.();assert.equal(image.cancelled,true);}
  assert.deepEqual(progress,[]);assert.equal(resources.abort.signal.aborted,true);
});
test('leaving during load cancels images without retry', async () => {
  let count=0;
  globalThis.Image=class { constructor(){count++;} set src(value){} removeAttribute(){} };
  const resources=new Resources([{id:'scene',type:'image',src:'scene.webp'}],'https://example.test/');
  const pending=resources.load();resources.destroy();
  await assert.rejects(pending,/取消/);assert.equal(count,1);assert.equal(resources.images.size,0);
});
