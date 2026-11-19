import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import type {Project,Run,Task,Revision,WorkEvent} from '../contracts/index.js';
import {now} from '../shared/files.js';
export class Store extends EventEmitter {
 db:DatabaseSync;
 constructor(public root:string){super();fs.mkdirSync(root,{recursive:true});this.db=new DatabaseSync(path.join(root,'workbench.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT,body TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS record_project ON records(kind,project_id); CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT,run_id TEXT,created_at TEXT,type TEXT,message TEXT,data TEXT);`);}
 get<T>(kind:string,id:string):T|undefined{const row=this.db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind,id) as any;return row?JSON.parse(row.body):undefined;}
 require<T>(kind:string,id:string):T{const r=this.get<T>(kind,id);if(!r)throw new Error('未找到 '+kind+' '+id);return r;}
 list<T>(kind:string,projectId?:string):T[]{const rows=projectId?this.db.prepare('SELECT body FROM records WHERE kind=? AND project_id=? ORDER BY updated_at DESC').all(kind,projectId):this.db.prepare('SELECT body FROM records WHERE kind=? ORDER BY updated_at DESC').all(kind);return rows.map((r:any)=>JSON.parse(r.body));}
 put<T extends {id:string;projectId?:string}>(kind:string,value:T){this.db.prepare('INSERT INTO records(kind,id,project_id,body,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET project_id=excluded.project_id,body=excluded.body,updated_at=excluded.updated_at').run(kind,value.id,value.projectId??(kind==='project'?value.id:null),JSON.stringify(value),now());return value;}
 patch<T extends {id:string;projectId?:string}>(kind:string,id:string,change:Partial<T>):T{return this.put(kind,{...this.require<T>(kind,id),...change});}
 event(projectId:string,runId:string|undefined,type:string,message:string,data?:unknown){const createdAt=now();const info=this.db.prepare('INSERT INTO events(project_id,run_id,created_at,type,message,data) VALUES(?,?,?,?,?,?)').run(projectId,runId??null,createdAt,type,message,data===undefined?null:JSON.stringify(data));const event:WorkEvent={id:Number(info.lastInsertRowid),projectId,runId,createdAt,type,message,data};this.emit('update',event);return event;}
 events(projectId:string,runId?:string,after=0):WorkEvent[]{const rows=runId?this.db.prepare('SELECT * FROM events WHERE project_id=? AND run_id=? AND id>? ORDER BY id DESC LIMIT 500').all(projectId,runId,after):this.db.prepare('SELECT * FROM events WHERE project_id=? AND id>? ORDER BY id DESC LIMIT 500').all(projectId,after);return rows.reverse().map((r:any)=>({id:r.id,projectId:r.project_id,runId:r.run_id,createdAt:r.created_at,type:r.type,message:r.message,data:r.data?JSON.parse(r.data):undefined}));}
 transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 recover(){const runs=this.list<Run>('run').filter(r=>['queued','running','validating'].includes(r.status));for(const run of runs){this.patch<Run>('run',run.id,{status:'failed',error:'上次工作台退出，任务已保留。点击继续会核验产物并从中断处恢复。',updatedAt:now()});for(const task of this.list<Task>('task',run.projectId).filter(t=>t.runId===run.id&&['running','validating'].includes(t.status)))this.patch<Task>('task',task.id,{status:'failed',error:'执行进程中断'});this.patch<Project>('project',run.projectId,{status:'failed',updatedAt:now()});this.event(run.projectId,run.id,'recovered','检测到中断的制作任务，等待继续。');}return runs.length;}
 close(){this.db.close();}
}
