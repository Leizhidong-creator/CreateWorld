export class Resources {
  constructor(assets,base){this.definitions=assets;this.base=base;this.images=new Map();this.urls=new Map();this.abort=new AbortController();}
  async load(progress=()=>{}){
    let done=0;const total=this.definitions.length;
    await Promise.all(this.definitions.map(async a=>{
      const url=new URL(a.src,this.base).href;this.urls.set(a.id,url);
      if(a.type==='image'){
        const image=new Image();image.decoding='async';
        await new Promise((resolve,reject)=>{
          let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=image.onerror=null;this.abort.signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
          const cancel=()=>finish(new Error('资源加载已取消'));
          const timer=setTimeout(()=>finish(new Error('图片加载超时：'+a.id)),15000);
          image.onload=()=>finish();image.onerror=()=>finish(new Error('图片加载失败：'+a.id+' ('+a.src+')'));
          this.abort.signal.addEventListener('abort',cancel,{once:true});image.src=url;
        });this.images.set(a.id,image);
      }else{
        const res=await fetch(url,{signal:this.abort.signal});if(!res.ok)throw new Error('音频加载失败：'+a.id);await res.arrayBuffer();
      }
      progress(++done/total);
    }));
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
