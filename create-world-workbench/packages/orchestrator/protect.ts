import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {hashFile,hashTree,safePath} from '../shared/files.js';
const digest=(p:string)=>!fs.existsSync(p)?'missing':fs.lstatSync(p).isSymbolicLink()?'symlink:'+fs.readlinkSync(p):fs.statSync(p).isDirectory()?'tree:'+hashTree(p):'file:'+hashFile(p);
/** Restore protected host inputs even when a model turn errors, times out, or is cancelled. */
export async function protectPaths<T>(root:string,paths:readonly string[],action:()=>Promise<T>):Promise<T>{
 const backup=fs.mkdtempSync(path.join(os.tmpdir(),'create-world-inputs-'));
 const records=paths.map((relative,i)=>{const file=safePath(root,relative),fingerprint=digest(file),saved=path.join(backup,String(i));if(fingerprint!=='missing')fs.cpSync(file,saved,{recursive:true,dereference:false});return{relative,file,fingerprint,saved};});
 let result:T|undefined,error:unknown;
 try{result=await action();}catch(e){error=e;}
 const changed:string[]=[];
 try{for(const record of records){let current:string;try{current=digest(record.file);}catch{current='invalid';}if(current===record.fingerprint)continue;changed.push(record.relative);fs.rmSync(record.file,{recursive:true,force:true});if(record.fingerprint!=='missing'){fs.mkdirSync(path.dirname(record.file),{recursive:true});fs.cpSync(record.saved,record.file,{recursive:true,dereference:false});}}}finally{fs.rmSync(backup,{recursive:true,force:true});}
 if(error)throw error;
 if(changed.length)throw new Error('阶段越权修改已还原：'+changed.join('、'));
 return result as T;
}
