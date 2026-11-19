import type {CodexOptions,CodexResult} from '../codex-adapter/index.js';

/** Recover an expired thread once; network/quota/tool errors are not thread loss. */
export async function withThreadRecovery(
 options:CodexOptions,
 invoke:(options:CodexOptions)=>Promise<CodexResult>,
 record:(threadId:string,reason:string)=>void,
):Promise<CodexResult>{
 try{return await invoke(options);}
 catch(error){
  const reason=String(error);
  if(!options.threadId||options.signal?.aborted||!/(thread|conversation).*(not found|expired|does not exist|不存在|失效)/i.test(reason))throw error;
  record(options.threadId,reason);
  return invoke({...options,threadId:undefined,prompt:options.prompt+'\n原线程已失效。请先核对当前工作区的任务、成果与诊断，再从有效产物继续同一个任务，不重跑已完成的文本阶段。'});
 }
}
