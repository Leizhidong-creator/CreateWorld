import { mountControls } from './controls.js';
export class Input {
  constructor(root,onAction) {
    this.root=root;this.onAction=onAction;this.keys=new Set();this.stick={x:0,y:0};this.held=false;this.blocked=true;this.owner=null;
    this.controller=new AbortController();const opts={signal:this.controller.signal};
    this.controls=mountControls({target:root,adapter:{onMove:p=>{if(!this.blocked){this.stick=p;this.owner='touch';}},onActionDown:()=>{if(!this.blocked){this.held=true;onAction('interact');}},onActionUp:()=>{this.held=false;}}});
    this.down=e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
      if(!root.contains(document.activeElement)&&document.activeElement!==document.body)return;
      const names={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'interact',KeyE:'interact',KeyM:'map',KeyI:'inventory',KeyJ:'achievements',Escape:'pause',KeyP:'pause'};
      const k=names[e.code];if(!k)return;e.preventDefault();
      if(['up','down','left','right'].includes(k)){if(!this.blocked){this.keys.add(e.code);this.owner='keyboard';}return;}
      if(e.repeat)return;
      if(k==='interact'&&!this.blocked)this.held=true;
      onAction(k);
    };
    window.addEventListener('keydown',this.down,opts);
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(e.code==='Space'||e.code==='KeyE')this.held=false;}, {...opts,capture:true});
    for(const event of ['blur','pagehide'])window.addEventListener(event,()=>this.reset(),opts);
    document.addEventListener('visibilitychange',()=>this.reset(),opts);
  }
  vector() {
    if(this.blocked)return {x:0,y:0};
    if(this.owner==='touch')return {x:this.stick.x,y:this.stick.y};
    const has=(a,b)=>this.keys.has(a)||this.keys.has(b);
    let x=Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),y=Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp'));
    const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}return {x,y};
  }
  reset(){this.keys.clear();this.stick={x:0,y:0};this.held=false;this.owner=null;this.controls.releaseAll();}
  block(value){if(this.blocked!==value){this.reset();this.blocked=value;}}
  context(label,visible=true,ready=false){this.controls.setContext({controlsVisible:visible,joystickVisible:visible,actionVisible:visible,actionLabel:label||'交互',actionEnabled:ready,actionHighlighted:ready});}
  destroy(){this.reset();this.controls.destroy();this.controller.abort();}
}
