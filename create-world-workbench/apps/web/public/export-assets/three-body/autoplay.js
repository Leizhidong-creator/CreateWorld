/* Independent demonstration driver. Reads progress, writes only pointer/click/input events. */
(() => {
 'use strict';
 const normalPace=document.documentElement.dataset.demoPace==='normal',demoLabel=normalPace?'正常节奏演示':'快速演示';
 function readingTime(){const text=($('#overlay .thought-bubble span')||$('#overlay .dialogue p')||$('#overlay .comic-box p')||$('#overlay')).textContent.trim();return Math.min(7000,Math.max(2000,700+text.replace(/\s/g,'').length/7*1000));}
 const $=s=>document.querySelector(s),state=()=>window.villaState?.(),joystick=$('#joystick');
 const handLayer=document.createElement('div');handLayer.id='demo-hands';handLayer.setAttribute('aria-hidden','true');
 const hands={};
 for(const name of ['left','right','tap']){const img=new Image();img.src=`assets/demo-hand-${name}.png`;img.className='demo-hand';img.dataset.hand=name;img.alt='';handLayer.append(img);hands[name]=img;}
 const contact=document.createElement('div');contact.className='demo-contact';handLayer.prepend(contact);document.body.append(handLayer);
 const label=document.createElement('span');label.id='demo-label';label.textContent=demoLabel;$('header').prepend(label);
 const POINTER=771;
 // Synthetic pointer events cannot acquire native capture. Only this driver's ID is virtual.
 const nativeCapture=joystick.setPointerCapture.bind(joystick);
 joystick.setPointerCapture=id=>{if(id!==POINTER)nativeCapture(id);};
 let activeTime=0,lastFrame=0,running=false,gripping=false,phase='',lastSignature='',events=[],error=null,completed=false,startedAt=0;
 const readyToRun=()=>state()?.ready&&!state().paused&&!document.hidden&&!$('#help-dialog').open;
 function frame(time){const dt=Math.min(50,time-lastFrame||0);lastFrame=time;if(readyToRun())activeTime+=dt;
  const s=state();if(s?.ready){const signature=[s.scene,s.story.mode,s.story.shot,s.story.caption].join(':');if(signature!==lastSignature){events.push({kind:'scene',signature,at:Math.round(activeTime)});lastSignature=signature;}}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 async function wait(ms){const end=activeTime+ms;while(activeTime<end||!readyToRun())await nextFrame();}
 async function until(predicate,limit=15000){const end=activeTime+limit;while(!predicate()){if(activeTime>end)throw Error(`等待超时：${phase}`);await nextFrame();}}
 function record(kind,detail){events.push({kind,detail,at:Math.round(activeTime)});}
 function setPhase(value){phase=value;record('phase',value);}
 function center(el){const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}
 function handAt(name,x,y,lift=0,scale=1){const img=hands[name],w=img.getBoundingClientRect().width;const tip={left:[.825,.19],right:[.175,.19],tap:[.50,.04]}[name];img.style.transformOrigin=`${tip[0]*100}% ${tip[1]*100}%`;img.style.transform=`translate3d(${x-w*tip[0]}px,${y-w*tip[1]+lift}px,0) scale(${scale})`;img.style.opacity='1';}
 function hide(name){hands[name].style.opacity='0';}
 function pointer(el,type,x,y){el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:POINTER,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));}
 function pulse(x,y){contact.style.left=x+'px';contact.style.top=y+'px';contact.classList.remove('pulse');void contact.offsetWidth;contact.classList.add('pulse');}
 async function tween(ms,draw){const start=activeTime;do{await wait(0);const t=Math.min(1,(activeTime-start)/ms);draw(t);if(t>=1)break;await nextFrame();}while(true);}
 async function tap(el,name='tap',point=null){if(!el||el.hidden)throw Error(`找不到可操作界面：${phase}`);await wait(0);el.scrollIntoView({block:'nearest',inline:'nearest'});let p=point||center(el);
  await tween(90,t=>handAt(name,p.x,p.y,22*(1-t),1-.025*t));pointer(el,'pointerdown',p.x,p.y);pulse(p.x,p.y);await wait(60);pointer(el,'pointerup',p.x,p.y);
  el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:p.x,clientY:p.y,button:0}));record('tap',el.textContent?.trim().slice(0,45)||el.id);
  await tween(80,t=>{handAt(name,p.x,p.y,20*t, .975+.025*t);hands[name].style.opacity=String(1-t);});hide(name);
 }
 function button(text){return [...document.querySelectorAll('#overlay button')].find(b=>b.textContent.trim()===text);}
 async function choose(text,dwell=450){if(normalPace)dwell=Math.max(dwell,readingTime());await wait(Math.max(0,dwell-230));await tap(button(text));}
 async function advance(dwell=800){if(normalPace)dwell=readingTime();await wait(Math.max(0,dwell-230));const o=$('#overlay'),r=o.getBoundingClientRect();await tap(o,'tap',{x:r.x+r.width*.83,y:r.y+r.height*.16});}
 async function finishTalk(){let count=0;while(['thought','dialogue-layer'].includes(state().story.mode)){if(++count>24)throw Error('对白未能结束');await advance(state().story.mode==='thought'?750:900);}}
 function release(){if(gripping){const p=center(joystick);pointer(joystick,'pointerup',p.x,p.y);gripping=false;}hide('left');}
 function grip(dx,dy){const r=joystick.getBoundingClientRect(),p=center(joystick),radius=r.width*28/88;pointer(joystick,'pointerdown',p.x,p.y);gripping=true;pointer(joystick,'pointermove',p.x+dx*radius,p.y+dy*radius);handAt('left',p.x+dx*radius,p.y+dy*radius);}
 async function moveTo(x,y){let previous=state().player,still=0,last=activeTime;const deadline=activeTime+16000;while(true){await wait(0);const s=state(),dx=x-s.player.x,dy=y-s.player.y,distance=Math.hypot(dx,dy);if(distance<4)break;if(activeTime>deadline)throw Error(`行走未到达 ${x},${y}`);
   if(!['world','thought'].includes(s.story.mode)){release();await finishTalk();continue;}
   const elapsed=activeTime-last;last=activeTime;if(Math.hypot(s.player.x-previous.x,s.player.y-previous.y)<.15)still+=elapsed;else still=0;previous={...s.player};
   // A passing NPC can briefly occupy the route: steer around its feet rather than teleport.
   let vx=dx/distance,vy=dy/distance;if(still>250){const n=s.npcs.find(n=>Math.hypot(n.x-s.player.x,n.y-s.player.y)<75);if(n){vx=Math.abs(dx)>Math.abs(dy)?0:1;vy=Math.abs(dx)>Math.abs(dy)?1:0;}}
   const speed=Math.min(1,distance/12);grip(vx*speed,vy*speed);await nextFrame();
  }}
 async function walk(points){setPhase('行走');try{for(const [x,y]of points)await moveTo(x,y);}finally{release();}await nextFrame();}
 async function interact(expected){await finishTalk();await until(()=>state().near===expected,1200);if(normalPace)await wait(450);await tap($('#interact'),'right');}
 async function comics(){setPhase('六幕回忆');let turns=0;while(state().story.mode.startsWith('comic')){if(++turns>35)throw Error('分镜未能结束');if(state().story.mode==='comic-choice')await choose('继续观察对方',900);else await advance(state().story.mode==='comic-feedback'?650:500);}await finishTalk();}
 async function slider(value){const input=$('#overlay input[type="range"]');if(!input)throw Error('未找到调谐旋钮');input.scrollIntoView({block:'nearest'});const r=input.getBoundingClientRect(),from=Number(input.value),point=v=>({x:r.x+8+(r.width-16)*v/100,y:r.y+r.height/2});let p=point(from);await tween(90,t=>handAt('tap',p.x,p.y,20*(1-t)));pointer(input,'pointerdown',p.x,p.y);await tween(normalPace?1400:550,t=>{const v=Math.round(from+(value-from)*t);p=point(v);handAt('tap',p.x,p.y);pointer(input,'pointermove',p.x,p.y);input.value=String(v);input.dispatchEvent(new Event('input',{bubbles:true}));});pointer(input,'pointerup',p.x,p.y);pulse(p.x,p.y);await wait(80);hide('tap');record('slider',value);}
 async function run(){if(running)return;running=true;error=null;completed=false;startedAt=activeTime;events=[];lastSignature='';$('#demo-error')?.remove();label.textContent=demoLabel;
  try{
   await until(()=>state()?.ready);await Promise.all(Object.values(hands).map(img=>img.decode()));await wait(120);
   setPhase('别墅');await finishTalk();await walk([[630,585]]);await interact('zhuangyan');await finishTalk();
   await walk([[650,700],[1220,660]]);await interact('notebook');await choose('翻阅笔记',650);await finishTalk();await comics();
   setPhase('门口会合');await walk([[770,700],[770,870]]);await interact('door');await finishTalk();await walk([[820,880]]);await interact('shiqiang');await finishTalk();
   setPhase('乘车');await until(()=>state().scene==='observatory'&&state().story.mode==='world',14000);
   setPhase('观测');await walk([[750,700],[750,670],[480,654]]);await interact('telescope');await finishTalk();await wait(normalPace?2000:300);await tap($('[aria-label="观测星体 2"]'));await choose('确认目标');await finishTalk();
   setPhase('核对坐标');await walk([[480,670],[288,660],[288,600]]);await interact('chart');await choose('确认载入坐标',650);await finishTalk();
   setPhase('调谐');await walk([[288,660],[750,700],[1067,687]]);await interact('broadcast');await slider(68);await choose('锁定参数',500);await finishTalk();
   setPhase('发送');await choose('确认发送',650);await finishTalk();await choose('最终确认发射',650);await until(()=>state().story.mode==='ending',10000);
   completed=true;setPhase('本篇结束');label.textContent='演示完成';record('complete',Math.round(activeTime-startedAt));
  }catch(e){error=e.message;console.error('自动演示中止',e);label.textContent='演示已停止';const box=document.createElement('div');box.id='demo-error';box.textContent='自动演示遇到问题，可以重新播放。';const restart=document.createElement('button');restart.textContent='重新播放';restart.onclick=()=>location.reload();box.append(restart);$('#app').append(box);}
  finally{release();Object.keys(hands).forEach(hide);running=false;}
 }
 window.autoplayStatus=()=>({pace:normalPace?'normal':'fast',walkSpeed:normalPace?230:345,running,completed,error,phase,elapsedMs:Math.round(activeTime-startedAt),events:events.map(e=>({...e}))});
 document.addEventListener('click',e=>{if(!running&&state()?.story.mode==='ending'&&e.target.closest('#overlay .actions button'))queueMicrotask(run);},true);
 run();
})();
