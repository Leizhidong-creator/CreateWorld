import type {TextGameHandoff} from './handoff.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {z} from 'zod';
import {TextWorkflow} from './service.js';
import {TextError,idSchema,requestKey} from './contracts.js';

export async function textRoutes(service:TextWorkflow,req:IncomingMessage,res:ServerResponse,parts:string[],url:URL,readBody:()=>Promise<unknown>,handoff?:TextGameHandoff):Promise<boolean>{
 if(parts[1]!=='text')return false;
 const method=req.method||'GET',send=(status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
 try{
  if(parts[2]!=='projects'){send(404,{code:'not_found',error:'接口不存在'});return true;}
  if(parts.length===3){if(method==='GET')send(200,service.list());else if(method==='POST')send(201,service.create(await readBody()));else send(405,{error:'不支持此操作'});return true;}
  const p=service.project(parts[3]),branch=parts[4];
  if(parts.length===4&&method==='GET'){send(200,service.detail(p.id));return true;}
  if(branch==='game-questions'&&handoff){if(parts.length===5&&method==='GET'){send(200,handoff.questions(p.id));return true;}if(parts.length===7&&parts[6]==='answer'&&method==='POST'){send(200,handoff.answer(p.id,parts[5],await readBody()));return true;}}
  if(branch==='game-materials'&&handoff&&parts.length===5&&method==='POST'){send(201,await handoff.upload(p.id,await readBody()));return true;}
  if(branch==='confirmations'&&parts.length===5&&method==='POST'){if(!handoff)throw new TextError('unavailable','游戏交接服务未接入',503);send(202,handoff.confirm(p.id,await readBody()));return true;}
  if(branch==='handoffs'&&handoff){if(parts.length===5&&method==='GET'){send(200,handoff.get(p.id));return true;}if(parts.length===7&&method==='POST'&&['stop','resume'].includes(parts[6])){send(202,handoff.control(p.id,parts[5],parts[6] as 'stop'|'resume'));return true;}}
  if(branch==='sources'&&parts.length===5&&method==='POST'){send(201,await service.upload(p.id,await readBody()));return true;}
  if(branch==='scripts'&&parts.length===5&&method==='POST'){send(201,service.edit(p.id,await readBody()));return true;}
  if(branch==='runs'){
   if(parts.length===5&&method==='POST'){send(202,service.start(p.id,await readBody()));return true;}
   const run=service.run(p.id,parts[5]);
   if(parts.length===6&&method==='GET'){send(200,{run,events:service.store.events(p.id,run.id)});return true;}
   if(parts.length===7&&method==='POST'&&['stop','resume'].includes(parts[6])){send(202,parts[6]==='stop'?service.stop(p.id,run.id):service.resume(p.id,run.id));return true;}
  }
  if(branch==='versions'){
   const v=service.version(p.id,parts[5]);
   if(parts.length===6&&method==='GET'){send(200,{version:v,body:service.body(p.id,v.id)});return true;}
   if(parts.length===7&&parts[6]==='adopt'&&method==='POST'){const input=z.object({requestKey,baseVersionId:idSchema}).parse(await readBody());send(200,service.adopt(p.id,v.id,input));return true;}
   if(parts.length===7&&parts[6]==='download'&&method==='GET'){const body=service.body(p.id,v.id),name=v.kind==='script'?'游戏剧本.md':'游戏内容.yaml';res.writeHead(200,{'content-type':v.kind==='script'?'text/markdown; charset=utf-8':'application/yaml; charset=utf-8','content-disposition':`attachment; filename="${v.id}.${v.kind==='script'?'md':'yaml'}"; filename*=UTF-8''${encodeURIComponent(name)}`,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body);return true;}
  }
  if(branch==='questions'){
   if(parts.length===5&&method==='GET'){send(200,service.detail(p.id).questions);return true;}
   if(parts.length===7&&parts[6]==='answer'&&method==='POST'){send(200,service.answer(p.id,parts[5],await readBody()));return true;}
  }
  if(branch==='events'&&parts.length===5&&method==='GET'){
   const after=Number(req.headers['last-event-id']||url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)throw new TextError('invalid_cursor','无效消息游标',422);
   res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(': connected\n\n');
   const write=(e:any)=>{if(e.projectId===p.id)res.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);};
   // Subscribe before replay; synchronous SQLite replay cannot race a JS callback.
   service.store.on('update',write);const rows=service.store.db.prepare('SELECT id,project_id,run_id,created_at,type,message,data FROM events WHERE project_id=? AND id>? ORDER BY id').all(p.id,after) as any[];
   for(const r of rows)write({id:r.id,projectId:r.project_id,runId:r.run_id,createdAt:r.created_at,type:r.type,message:r.message,data:r.data?JSON.parse(r.data):undefined});
   const timer=setInterval(()=>res.write(': heartbeat\n\n'),20_000);const close=()=>{clearInterval(timer);service.store.off('update',write);service.store.off('text-closing',finish);};const finish=()=>res.end();service.store.once('text-closing',finish);req.on('close',close);return true;
  }
  send(404,{code:'not_found',error:'接口不存在'});return true;
 }catch(e){if(e instanceof z.ZodError)send(422,{code:'invalid_input',error:e.issues.map(x=>x.path.join('.')+': '+x.message).join('; ')});else if(e instanceof TextError)send(e.status,{code:e.code,error:e.message});else send(400,{code:'request_failed',error:e instanceof Error?e.message:String(e)});return true;}
}
