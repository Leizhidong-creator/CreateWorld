export class Resources {
  constructor(assets,base,{timeoutMs=20000,attempts=2}={}){this.definitions=assets;this.base=base;this.images=new Map();this.urls=new Map();this.abort=new AbortController();this.timeoutMs=timeoutMs;this.attempts=attempts;}
  async load(progress=()=>{}){
    // AudioService streams sound on demand; optional audio must not block play.
    for(const a of this.definitions)this.urls.set(a.id,new URL(a.src,this.base).href);
    const images=this.definitions.filter(a=>a.type==='image');let done=0;
    try{
      await Promise.all(images.map(async a=>{
        let image;
        for(let attempt=0;attempt<this.attempts;attempt++){
          try{image=await this.loadImage(a);break;}
          catch(error){if(this.abort.signal.aborted||attempt===this.attempts-1)throw error;}
        }
        if(this.abort.signal.aborted)return;
        this.images.set(a.id,image);progress(++done/images.length);
      }));
      if(!images.length&&!this.abort.signal.aborted)progress(1);
    }catch(error){
      // Cancel outstanding loads so their progress cannot replace the error UI.
      this.abort.abort();throw error;
    }
  }
  loadImage(asset){
    return new Promise((resolve,reject)=>{
      if(this.abort.signal.aborted){reject(new Error('资源加载已取消'));return;}
      const image=new Image();image.decoding='async';let settled=false;
      const finish=error=>{
        if(settled)return;settled=true;clearTimeout(timer);
        image.onload=image.onerror=null;this.abort.signal.removeEventListener('abort',cancel);
        if(error){image.removeAttribute('src');reject(error);}else resolve(image);
      };
      const cancel=()=>finish(new Error('资源加载已取消'));
      const timer=setTimeout(()=>finish(new Error('图片加载超时：'+asset.id)),this.timeoutMs);
      image.onload=()=>finish();image.onerror=()=>finish(new Error('图片加载失败：'+asset.id));
      this.abort.signal.addEventListener('abort',cancel,{once:true});image.src=this.urls.get(asset.id);
    });
  }
  destroy(){this.abort.abort();this.images.clear();}
}
export class AudioService {
  constructor(resources,settings){this.resources=resources;this.settings=settings;this.music=null;this.musicId=null;this.unlocked=false;this.sounds=new Set();}
  unlock(){this.unlocked=true;if(this.music&&this.settings.music>0)this.music.play().catch(()=>{});}
  setMusic(id){if(id===this.musicId)return;this.music?.pause();this.musicId=id;this.music=null;if(!id)return;const url=this.resources.urls.get(id);if(!url)return;this.music=new Audio(url);this.music.loop=true;this.music.volume=this.settings.music;if(this.unlocked&&this.settings.music>0)this.music.play().catch(()=>{});}
  play(id){if(!this.unlocked||!id||!this.settings.sound)return;const url=this.resources.urls.get(id);if(!url)return;const a=new Audio(url);a.volume=this.settings.sound;this.sounds.add(a);const finish=()=>this.sounds.delete(a);a.onended=finish;a.onerror=finish;a.play().catch(finish);}
  volumes(settings){this.settings=settings;if(this.music){this.music.volume=settings.music;if(settings.music===0)this.music.pause();else if(this.unlocked)this.music.play().catch(()=>{});}}
  suspend(){this.music?.pause();for(const a of this.sounds)a.pause();this.sounds.clear();}
  resume(){if(this.unlocked&&this.music&&this.settings.music>0)this.music.play().catch(()=>{});}
  destroy(){this.suspend();this.music=null;}
}
