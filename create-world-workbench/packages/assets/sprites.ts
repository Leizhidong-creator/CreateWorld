import sharp from 'sharp';import crypto from 'node:crypto';
export interface SpriteGrid {columns:number;rows:number;cellWidth:number;cellHeight:number;kind:'walk'|'action'|'static';anchor?:{x:number;y:number};fps?:number;events?:{frame:number;name:string}[]}
export interface SpriteFrameOverride {row:number;column:number;source:string;rect?:{left:number;top:number;width:number;height:number}}
/** Deterministic processing only: remove border-connected white, resize nearest, never synthesize poses. */
export async function packSpriteGrid(source:string,spec:SpriteGrid,overrides:SpriteFrameOverride[]=[]){
 for(const k of ['columns','rows','cellWidth','cellHeight'] as const)if(!Number.isInteger(spec[k])||spec[k]<1||spec[k]>1024)throw Error('Invalid sprite grid '+k);
 if(spec.columns*spec.rows>128)throw Error('Too many frames');if(spec.kind==='walk'&&(spec.columns!==4||spec.rows!==4))throw Error('Walking requires four directions × four frames');
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});const w=info.width,h=info.height;
 if(w%spec.columns||h%spec.rows)throw Error('Source dimensions must divide evenly into frame grid');
 const cw=w/spec.columns,ch=h/spec.rows,frames:any[]=[],composites:any[]=[];
 const replacements=new Map<number,SpriteFrameOverride>();
 for(const frame of overrides){
  if(!Number.isInteger(frame.row)||!Number.isInteger(frame.column)||frame.row<0||frame.row>=spec.rows||frame.column<0||frame.column>=spec.columns)throw Error('Frame override outside grid');
  const key=frame.row*spec.columns+frame.column;if(replacements.has(key))throw Error('Duplicate frame override');
  if(frame.rect){const r=frame.rect;if(![r.left,r.top,r.width,r.height].every(Number.isInteger)||r.left<0||r.top<0||r.width<1||r.height<1)throw Error('Invalid frame override crop');}
  replacements.set(key,frame);
 }
 for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.columns;col++){
 let raw:Buffer;const replacement=replacements.get(row*spec.columns+col);
 if(replacement){
  let input=sharp(replacement.source).ensureAlpha();if(replacement.rect)input=input.extract(replacement.rect);
  raw=await input.resize(cw,ch,{kernel:'nearest',fit:'contain',background:'#00000000'}).raw().toBuffer();
 }else{raw=Buffer.alloc(cw*ch*4);for(let y=0;y<ch;y++)data.copy(raw,y*cw*4,((row*ch+y)*w+col*cw)*4,((row*ch+y)*w+col*cw+cw)*4);}
 const seen=new Uint8Array(cw*ch),queue:number[]=[];const add=(x:number,y:number)=>{if(x<0||x>=cw||y<0||y>=ch)return;const p=y*cw+x,i=p*4;if(seen[p])return;seen[p]=1;if(raw[i+3]<20||(raw[i]>245&&raw[i+1]>245&&raw[i+2]>245)){queue.push(p);raw[i+3]=0;}};
 for(let x=0;x<cw;x++){add(x,0);add(x,ch-1);}for(let y=0;y<ch;y++){add(0,y);add(cw-1,y);}for(let i=0;i<queue.length;i++){const p=queue[i],x=p%cw,y=Math.floor(p/cw);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);}
 let minX=cw,minY=ch,maxX=-1,maxY=-1,count=0;for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(raw[(y*cw+x)*4+3]>32){count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 if(count<8||count>cw*ch*.92)throw Error('Empty frame or missing transparency');if(minX===0||minY===0||maxX===cw-1||maxY===ch-1)throw Error('Sprite touches frame border');
 frames.push({row,col,raw,minX,minY,maxX,maxY,bounds:{minX:minX/cw,minY:minY/ch,maxX:maxX/cw,maxY:maxY/ch}});}
 // Walk sheets often drift within their cells. Translate complete silhouettes to one foot baseline,
 // using one scale for the whole actor. Never synthesize poses or normalize action displacement.
 const anchor=spec.anchor||(spec.kind==='walk'?{x:.5,y:.92}:{x:.5,y:Math.max(...frames.map(f=>f.bounds.maxY))});
 if(![anchor.x,anchor.y].every(n=>Number.isFinite(n)&&n>0&&n<1))throw Error('Invalid anchor');
 const maxWidth=Math.max(...frames.map(f=>f.maxX-f.minX+1)),maxHeight=Math.max(...frames.map(f=>f.maxY-f.minY+1));
 const scale=Math.min((spec.cellWidth*Math.min(anchor.x,1-anchor.x)*2-4)/maxWidth,(spec.cellHeight*anchor.y-3)/maxHeight);
 for(const f of frames){let png:Buffer;
 if(spec.kind==='walk'){
 const width=Math.max(1,Math.round((f.maxX-f.minX+1)*scale)),height=Math.max(1,Math.round((f.maxY-f.minY+1)*scale));
 const sprite=await sharp(f.raw,{raw:{width:cw,height:ch,channels:4}}).extract({left:f.minX,top:f.minY,width:f.maxX-f.minX+1,height:f.maxY-f.minY+1}).resize(width,height,{kernel:'nearest'}).png().toBuffer();
 const left=Math.round(spec.cellWidth*anchor.x-width/2),top=Math.round(spec.cellHeight*anchor.y)-height;
 if(left<1||top<1||left+width>=spec.cellWidth||top+height>=spec.cellHeight)throw Error('Sprite alignment exceeds cell');
 png=await sharp({create:{width:spec.cellWidth,height:spec.cellHeight,channels:4,background:'#00000000'}}).composite([{input:sprite,left,top}]).png().toBuffer();
 f.alignedBounds={left,top,width,height,bottom:top+height};
 }else png=await sharp(f.raw,{raw:{width:cw,height:ch,channels:4}}).resize(spec.cellWidth,spec.cellHeight,{kernel:'nearest'}).png().toBuffer();
 f.sha256=crypto.createHash('sha256').update(png).digest('hex');delete f.raw;composites.push({input:png,left:f.col*spec.cellWidth,top:f.row*spec.cellHeight});}
 if(spec.kind==='walk'){for(let row=0;row<4;row++){const f=frames.filter(f=>f.row===row);if(f[1].sha256===f[3].sha256)throw Error('Duplicated walking phases '+row);}}
 else if(spec.kind==='action'&&new Set(frames.map(f=>f.sha256)).size<2)throw Error('Action has no visible motion');
 for(const e of spec.events||[])if(!Number.isInteger(e.frame)||e.frame<0||e.frame>=frames.length||!e.name)throw Error('Invalid action event');
 const bytes=await sharp({create:{width:spec.columns*spec.cellWidth,height:spec.rows*spec.cellHeight,channels:4,background:'#00000000'}}).composite(composites).png().toBuffer();return{bytes,metadata:{...spec,anchor,frames:frames.map(f=>({x:f.col*spec.cellWidth,y:f.row*spec.cellHeight,w:spec.cellWidth,h:spec.cellHeight}))},qa:{passed:true,scope:'grid-alpha-motion-invariants',frames,visualStillRequired:true}};
}
