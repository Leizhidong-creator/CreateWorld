import sharp from 'sharp';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../../outputs/first-room-new/assets/',import.meta.url));
const {data,info}=await sharp(dir+'andy-master.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
function bands(axis:'x'|'y'){
 const n=axis==='x'?info.width:info.height,m=axis==='x'?info.height:info.width,groups:number[][]=[];let begin=-1,last=-1;
 for(let i=0;i<n;i++){let count=0;for(let j=0;j<m;j++){const x=axis==='x'?i:j,y=axis==='x'?j:i;if(data[(y*info.width+x)*4+3]>100)count++;}if(count>3){if(begin<0)begin=i;last=i;}else if(begin>=0&&i-last>12){groups.push([begin,last]);begin=-1;}}if(begin>=0)groups.push([begin,last]);return groups;
}
const xs=bands('x'),ys=bands('y');if(xs.length!==4||ys.length!==4)throw Error('Expected 4x4 separated sprite grid '+JSON.stringify({xs,ys}));
const bounds:any[]=[];
for(const [r,yy]of ys.entries())for(const [c,xx]of xs.entries()){
 let l=info.width,t=info.height,b=0,rr=0;
 for(let y=yy[0];y<=yy[1];y++)for(let x=xx[0];x<=xx[1];x++)if(data[(y*info.width+x)*4+3]>100){l=Math.min(l,x);t=Math.min(t,y);rr=Math.max(rr,x);b=Math.max(b,y);}
 bounds.push({r,c,left:l,top:t,width:rr-l+1,height:b-t+1});
}
const scale=Math.min(27/Math.max(...bounds.map(b=>b.height)),19/Math.max(...bounds.map(b=>b.width)));
const layers=[];
for(const b of bounds){const w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale));const input=await sharp(dir+'andy-master.png').extract({left:b.left,top:b.top,width:b.width,height:b.height}).resize(w,h,{kernel:'nearest',fit:'fill'}).png().toBuffer();layers.push({input,left:b.c*24+Math.round((24-w)/2),top:b.r*32+30-h});}
await sharp({create:{width:96,height:128,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(dir+'andy-low.png');
await sharp(dir+'andy-low.png').resize(192,256,{kernel:'nearest'}).png().toFile(dir+'andy.png');
await fs.writeFile(dir+'packing.json',JSON.stringify({xs,ys,bounds,scale,frame:{width:48,height:64,baseline:60},method:'alpha bounds; uniform scale; nearest sampling; original poses preserved'},null,2));console.log('Packed new 4x4 sprites');
