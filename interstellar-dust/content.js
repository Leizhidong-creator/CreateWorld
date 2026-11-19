const flag=id=>({flag:id}),not=id=>({not:flag(id)}),all=(...conditions)=>({all:conditions});
const F=id=>({type:'flag',id}),D=id=>({type:'dialogue',id}),N=text=>({type:'notice',text});
const line=(speaker,text)=>({speaker,text});
const dialogue=(id,lines,onComplete=[],extra={})=>({id,lines:lines.map(([s,t])=>line(s,t)),onComplete,...extra});
const world={floor:'#ad9060',floorAlt:'#b79b6c',seam:'#93774f',detail:'#c6ac7a',wall:'#403d35',wallTop:'#736b50',shadow:'#242b2b',wood:'#796044',woodLight:'#a7895e',woodDark:'#4a3d30',cloth:'#52686a',trim:'#e6bd79',water:'#35545e',wave:'#749194',leaf:'#76764c',leafLight:'#a5a06b',roof:'#48585d',roofLight:'#758487'};
export const geometry={earth:[[80,60,240,175],[55,390,310,225],[480,75,180,135],[920,65,280,175],[960,400,130,65]],room:[[45,65,80,160],[185,20,165,70],[470,60,125,80]]};
const solids=(scene)=>geometry[scene].map(([x,y,w,h],i)=>({id:scene+'-solid-'+i,asset:'invisible',x,y,w,h,solid:{x,y,w,h}}));
const bounds=(w,h)=>[[0,0,w,12],[0,0,12,h],[w-12,0,12,h],[0,h-12,w,12]].map(([x,y,w,h],i)=>({id:'edge-'+i,asset:'invisible',x,y,w,h,solid:{x,y,w,h}}));
const characters=['cooper','murph','brand'].map(id=>({id,asset:id,frameWidth:48,frameHeight:64,width:id==='murph'?30:36,height:id==='murph'?40:48,frameCount:id==='cooper'?4:1,idleFrame:0,frameDuration:170,footAnchor:{x:24,y:61}}));
export const story={
 id:'interstellar-dust-v1',saveVersion:1,title:'尘埃之外',subtitle:'BEYOND THE DUST · 序章',
 description:'玉米正在枯萎，尘埃却留下了方向。\n成为库珀，在一间小小的卧室里，找到通往群星的第一条路。',
 assetBase:new URL('./assets/',import.meta.url),theme:{accent:'#efc58c',world},
 player:{character:'cooper',speed:145,radius:7},start:{scene:'earth',position:{x:400,y:340}},
 features:{map:true,fog:false,tutorial:true,clueNotebook:true},music:'ambient',sounds:{notice:'notice',interact:'tap',achievement:'success'},
 assets:[...characters.map(c=>({id:c.id,type:'image',src:'characters/'+(c.id==='cooper'?'cooper':c.id+'-static')+'/atlas.png'})),...['ambient','notice','tap','success'].map(id=>({id,type:'audio',src:id+'.wav'})),...['earth','room'].map(id=>({id,type:'image',src:id+'/scene.png'})),{id:'invisible',type:'image',src:'invisible.svg'}],characters,
 scenes:[
 {id:'earth',name:'地球 · 尘土中的家园',width:1280,height:720,background:'earth',spawn:{x:400,y:340},collisions:[],objects:[...solids('earth'),...bounds(1280,720)],
 regions:[{id:'field',x:45,y:360,w:365,h:285},{id:'home',x:65,y:45,w:300,h:275},{id:'base',x:820,y:70,w:390,h:290},{id:'truck',x:900,y:370,w:255,h:175}],
 landmarks:[{x:200,y:270,label:'家'},{x:215,y:630,label:'玉米田'},{x:1060,y:280,label:'坐标终点',when:flag('coordinates')},{x:1030,y:490,label:'皮卡'}],
 npcs:[{id:'professor',character:'brand',x:1050,y:280,facing:'left',when:flag('coordinates')},{id:'murph-out',character:'murph',x:400,y:300,facing:'down',when:not('crop')}],
 interactions:[
 {id:'crop',rect:{x:325,y:440,w:40,h:80},range:40,label:'检查',name:'枯萎的玉米',branches:[{when:flag('crop'),actions:[N('叶片上覆着细灰。墨菲还在房间里等你。')]},{actions:[D('crop')]}]},
 {id:'murph-outside',rect:{x:388,y:275,w:24,h:30},range:40,label:'交谈',name:'墨菲',when:not('crop'),actions:[D('outside')]},
 {id:'brand',rect:{x:1037,y:253,w:26,h:30},range:42,label:'交谈',name:'布兰德教授',when:flag('coordinates'),branches:[{when:flag('mission'),actions:[D('brand-repeat')]},{when:flag('found'),actions:[D('mission')]},{actions:[D('arrival')]}]},
 {id:'truck',rect:{x:980,y:455,w:85,h:20},range:35,label:'出发',name:'等候的皮卡',branches:[{when:flag('goodbye'),actions:[D('depart')]},{when:flag('mission'),actions:[N('先回家吧。还有一些话，不能留在路上。')]},{actions:[N('发动机还能用。现在先看看田里的收成。')]}]},
 {id:'shed',rect:{x:525,y:207,w:80,h:15},range:30,label:'调查',name:'旧机棚',actions:[D('shed')]},
 {id:'base-door',rect:{x:1020,y:232,w:80,h:16},range:28,label:'查看',name:'无标识的建筑',when:not('coordinates'),actions:[N('门没有标识。没有线索，你无法确认这里是什么地方。')]}
 ],
 exits:[{id:'go-home',rect:{x:180,y:233,w:44,h:25},range:28,label:'墨菲的房间',to:'room',spawn:{x:320,y:290},when:flag('crop'),lockedText:'先检查房屋南侧田地东缘的玉米。'}],
 triggers:[{id:'first-wind',rect:{x:380,y:320,w:60,h:70},actions:[N('风又大了。先去西南边的田地，看看还剩下多少收成。')]},{id:'horizon',rect:{x:650,y:590,w:180,h:70},wait:3,actions:[{type:'discover',id:'horizon'},N('远处已看不清地平线。你仍然抬头找了一会儿天空。')]}]},
 {id:'room',name:'家 · 墨菲的房间',width:640,height:360,background:'room',spawn:{x:320,y:290},collisions:[],objects:[...solids('room'),...bounds(640,360)],
 regions:[{id:'books',x:160,y:80,w:205,h:120},{id:'dust',x:350,y:125,w:110,h:110},{id:'desk',x:455,y:130,w:145,h:85},{id:'murph',x:210,y:180,w:150,h:110}],
 landmarks:[{x:320,y:328,label:'下楼'},{x:255,y:110,label:'书架'},{x:535,y:150,label:'书桌'}],
 npcs:[{id:'murph',character:'murph',x:270,y:225,facing:'right'}],
 interactions:[
 {id:'books',rect:{x:195,y:88,w:140,h:24},range:38,label:'调查',name:'掉下来的书',branches:[{when:flag('books'),actions:[N('书没有被碰过。那道看不见的力量，还在这里。')]},{actions:[D('books')]}]},
 {id:'dust',rect:{x:370,y:150,w:60,h:50},range:35,label:'观察',name:'地板上的沙尘',branches:[{when:flag('dust'),actions:[N('窄、窄、宽；宽、窄、宽。先把这些重复纹路记到书桌的纸上。')]},{when:flag('books'),actions:[D('dust')]},{actions:[N('光里有几道不寻常的沙纹。先看看墨菲说的书架。')]}]},
 {id:'desk',rect:{x:480,y:138,w:95,h:14},range:32,label:'记录',name:'摊开的笔记本',branches:[{when:flag('coordinates'),actions:[N('坐标已经记下。地图上出现了东北方向的终点。')]},{when:flag('dust'),actions:[D('decode')]},{actions:[N('纸上是墨菲画的星星。你还没有找到值得记下的规律。')]}]},
 {id:'murph',rect:{x:258,y:200,w:24,h:28},range:40,label:'交谈',name:'墨菲',branches:[{when:flag('goodbye'),actions:[D('after-goodbye')]},{when:flag('mission'),actions:[D('goodbye')]},{when:flag('coordinates'),actions:[D('murph-coordinate')]},{actions:[D('murph-room')]}]},
 {id:'model',rect:{x:567,y:107,w:23,h:15},range:34,label:'端详',name:'桌角的模型火箭',actions:[D('model')]}
 ],exits:[{id:'leave-home',rect:{x:290,y:325,w:60,h:20},range:20,label:'农场',to:'earth',spawn:{x:200,y:282}}],triggers:[]}
 ],
 dialogues:[
 dialogue('outside',[['墨菲','爸，书又掉下来了。'],['库珀','等我看看玉米。然后你带我去，别先替它找个鬼。'],['墨菲','那你也别先替它找个借口。']]),
 dialogue('crop',[['库珀','昨天这片叶子还是绿的。'],['墨菲','把灰擦掉，它会好吗？'],['库珀','……不会。走吧，带我看看你的房间。']],[F('crop'),{type:'clue',id:'blight'}],{once:true}),
 dialogue('murph-room',[['墨菲','我把书放回去了。它们又掉在同样的位置。'],['库珀','好。这次我们先看发生了什么。']]),
 dialogue('books',[['墨菲','看，我没碰它。'],['库珀','窗没开，架子也没歪。'],['墨菲','现在你信了？'],['库珀','我信你看见了什么。再看看地上的灰。']],[F('books')],{once:true}),
 dialogue('dust',[['库珀','这些灰没有顺着风落。它们排成了线。'],['墨菲','而且有的宽，有的窄。'],['库珀','像是重力在改变落点。把顺序记下来，我们试着读它。']],[F('dust'),{type:'clue',id:'gravity'}],{once:true}),
 dialogue('decode',[['墨菲','如果窄的是一种数，宽的是另一种呢？'],['库珀','两组数字……它们能落在地图上。'],['墨菲','那就不是鬼在扔书。有人想让我们去那里。']],[],{choices:[{label:'按两组数字标出坐标',actions:[F('coordinates'),{type:'clue',id:'coordinates'},N('已标记东北方向的坐标终点。按 M 查看地图。')]},{label:'再观察一次沙纹',actions:[N('窄与宽反复交替。准备好后，再来书桌记录。')]}]}),
 dialogue('murph-coordinate',[['墨菲','坐标是我们一起找到的。'],['库珀','当然。我不会把这算成一个人的发现。']]),
 dialogue('arrival',[['布兰德','这里不接待迷路的人。'],['库珀','我不是迷路。有人把这里的坐标留在了我女儿的房间。'],['布兰德','坐标？那么，你找到的是 NASA。我们还在工作。']],[F('found')],{once:true}),
 dialogue('mission',[['库珀','田里的玉米正在死。你们在这里能做什么？'],['布兰德','为它再也长不出来的那一天做准备。地球留给我们的时间不多了。'],['库珀','离开地球？最近的星球也救不了那些孩子。'],['布兰德','土星附近有一个虫洞。它通向遥远的星系，那里可能有可居住的世界。'],['库珀','可能。'],['布兰德','是的。我不能给你保证。但我们需要一个飞行员。'],['库珀','我得先回家。']],[F('mission'),{type:'clue',id:'wormhole'},{type:'give',id:'flight'}],{once:true}),
 dialogue('brand-repeat',[['布兰德','飞行资料交给你了。'],['库珀','我知道。但我还得把另一件事做完。']]),
 dialogue('goodbye',[['墨菲','你把坐标带走了，现在还要把自己带走。'],['库珀','我想找到一个能让你长大的地方。'],['墨菲','我就在这里长大。'],['库珀','我知道。'],['墨菲','那就别把出发说得像回家一样容易。']],[],{choices:[{label:'蹲下来，认真向她告别',actions:[D('promise')]},{label:'先留下来陪她一会儿',actions:[N('你没有催她。准备好时，再和墨菲说话。')]}]}),
 dialogue('promise',[['库珀','它不容易。我也害怕。'],['墨菲','……你会记得这个房间吗？'],['库珀','书架，地板，还有你画的星星。都会记得。']],[F('goodbye'),{type:'give',id:'drawing'}],{once:true}),
 dialogue('after-goodbye',[['墨菲','门别关太用力。'],['库珀','好。']]),
 dialogue('depart',[['库珀','窗户还亮着。'],['库珀','我把那张星空画放进衣袋，发动了车。']],[],{choices:[{label:'为了他们，启程',actions:[F('departed'),{type:'ending',id:'beyond'}]},{label:'再看一眼家',actions:[N('引擎暂时熄了火。你还可以回去。')]}]}),
 dialogue('shed',[['库珀','旧扳手还在。以前修一台机器，就能知道明天会好一点。']],[{type:'discover',id:'shed'}],{once:true}),
 dialogue('model',[['墨菲','我把底座修好了。这次它不会倒。'],['库珀','比我第一次做的结实。']],[{type:'discover',id:'model'}],{once:true})
 ],
 quests:[
 {id:'crop',initial:true,title:'检查西南玉米田东缘的枯叶',target:{scene:'earth',region:'field'},complete:flag('crop')},
 {id:'books',title:'回家，调查墨菲房间的书架',unlock:{quest:'crop'},target:{scene:'room',region:'books'},complete:flag('books')},
 {id:'dust',title:'观察房间中央的沙尘纹路',unlock:{quest:'books'},target:{scene:'room',region:'dust'},complete:flag('dust')},
 {id:'coordinates',title:'到书桌记录纹路，寻找坐标',unlock:{quest:'dust'},target:{scene:'room',region:'desk'},complete:flag('coordinates')},
 {id:'found',title:'沿东北小路，寻找坐标终点',unlock:{quest:'coordinates'},target:{scene:'earth',region:'base'},complete:flag('found')},
 {id:'mission',title:'听布兰德说完他的计划',unlock:{quest:'found'},target:{scene:'earth',region:'base'},complete:flag('mission')},
 {id:'goodbye',title:'回到家中，与墨菲告别',unlock:{quest:'mission'},target:{scene:'room',region:'murph'},complete:flag('goodbye')},
 {id:'depart',title:'走向东南的皮卡，准备出发',unlock:{quest:'goodbye'},target:{scene:'earth',region:'truck'},complete:flag('departed')}
 ],
 items:[{id:'flight',name:'飞行资料',icon:'▤',description:'布兰德交来的任务摘要。',content:'目的：穿过土星附近的虫洞，寻找可居住的星球。\n\n结果未知。出发之前，先回家。'},{id:'drawing',name:'墨菲的星空画',icon:'✧',description:'折过几次的纸上，有一间房子和许多星星。',content:'房子画得很小。窗户涂得很亮。'}],
 clues:[{id:'blight',name:'枯萎的作物',description:'擦掉沙尘也不能让叶片恢复。粮食危机已经来到家门口。'},{id:'gravity',name:'重力异常',description:'书无故掉落，沙尘排成宽窄不同的线。库珀推测落点受到异常重力影响。'},{id:'coordinates',name:'沙尘中的坐标',description:'把宽窄纹路分组读取，得到通往东北的坐标。已在地图标出对应区域。'},{id:'wormhole',name:'土星附近的虫洞',description:'据布兰德教授介绍，虫洞通向遥远星系；寻找宜居世界是人类生存的希望。'}],
 achievements:[{id:'repair',title:'曾经的日常',icon:'⚙',description:'在旧机棚里找到过去的生活。',when:{discovered:'shed'}},{id:'rocket',title:'她的第一艘飞船',icon:'↑',description:'留意墨菲修好的模型。',when:{discovered:'model'}},{id:'sky',title:'仍然仰望',icon:'✧',description:'在南方荒原停留，看向看不清的地平线。',when:{discovered:'horizon'}}],
 endings:[{id:'beyond',title:'尘埃之外',when:flag('goodbye'),pages:[{title:'离开，是为了让他们留下',text:'车轮压过干裂的土地。那间亮着灯的房间，一点点退到后视镜之外。\n你没有找到答案。但你决定出发。'},{title:'第一条路，通向群星',text:'前方是土星附近的虫洞，是尚无人知晓的世界。\n库珀带着人类的希望，也带着一张小小的星空画。\n\n序章完 · 谢谢游玩'}]}],minigames:[]
};

// Scope scene entity IDs while leaving dialogue/flag identifiers stable.
for(const scene of story.scenes){
 for(const kind of ['objects','npcs','interactions','exits','regions','triggers'])
  for(const entity of scene[kind]||[])entity.id=scene.id+'-'+kind+'-'+entity.id;
}
for(const quest of story.quests)if(quest.target)quest.target.region=quest.target.scene+'-regions-'+quest.target.region;
