/** Framework-neutral lifecycle host. Factories return a component with destroy(). */
export class MiniGameHost {
  constructor(container,onResult=()=>{}) {this.container=container;this.onResult=onResult;this.registry=new Map();this.current=null;this.token=0;}
  register(id,loader){if(this.registry.has(id))throw new Error('小游戏重复注册：'+id);this.registry.set(id,loader);return ()=>this.registry.delete(id);}
  async open(id,options={}) {
    this.close();const token=++this.token,abort=new AbortController();
    const current={id,token,abort,component:null,settled:false};this.current=current;
    const settle=(status,data)=>{if(this.current!==current||current.settled)return;current.settled=true;this.close();this.onResult({id,status,data});};
    try {
      const loader=this.registry.get(id);if(!loader)throw new Error('小游戏尚未注册：'+id);
      const module=await loader();if(token!==this.token)return;
      if(typeof module?.mount!=='function')throw new Error('小游戏需要 mount(container, context)');
      const component=await module.mount(this.container,{...options,signal:abort.signal,complete:data=>settle('success',data),fail:data=>settle('failure',data),cancel:()=>settle('cancel')});
      if(this.current!==current){component?.destroy?.();return;}
      current.component=component;
    } catch(error){if(this.current===current)settle('error',{message:error.message});}
  }
  close(){++this.token;const c=this.current;this.current=null;if(c){c.abort.abort();try{c.component?.destroy?.();}finally{this.container.replaceChildren();}}}
  cancel(){const c=this.current;if(!c)return;this.close();this.onResult({id:c.id,status:'cancel'});}
  destroy(){this.close();this.registry.clear();}
}
