// Original villa geometry and images remain unchanged. New narrative anchors only.
VILLA_MAPS.interior.npcs=[{id:'zhuangyan',x:580,y:560,body:{width:30,height:14}}];
VILLA_MAPS.interior.hotspots.push(
 {id:'zhuangyan',label:'与庄颜交谈',x:580,y:560,range:70},
 {id:'fireplace',label:'看看炉火',x:365,y:365,range:75},
 {id:'window',label:'望向星空',x:1050,y:365,range:80},
 {id:'notebook',label:'翻阅书桌笔记',x:1250,y:640,range:85});
VILLA_MAPS.observatory={title:'天文观测室',caption:'星空没有回答。',spawn:{x:625,y:1050,direction:'up'},walkable:{x:70,y:420,width:1110,height:770},player:{body:{width:30,height:14}},npcs:[],
 obstacles:[{x:320,y:420,width:310,height:190},{x:70,y:420,width:200,height:365},{x:70,y:850,width:265,height:200},{x:830,y:685,width:350,height:350},{x:1010,y:420,width:170,height:240},{x:720,y:420,width:280,height:135},{x:70,y:1070,width:430,height:120},{x:760,y:1070,width:420,height:120}],
 foreground:[{x:320,y:200,width:310,height:410,depth:610},{x:70,y:820,width:265,height:230,depth:1050},{x:830,y:670,width:350,height:365,depth:1035}],
 hotspots:[{id:'telescope',label:'使用望远镜',x:475,y:640,range:85},{id:'chart',label:'核对星图坐标',x:310,y:720,range:85},{id:'broadcast',label:'操作广播控制台',x:790,y:830,range:85}]};
