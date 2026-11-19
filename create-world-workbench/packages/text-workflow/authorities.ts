import fs from 'node:fs';
import path from 'node:path';
import { hashFile, safePath } from '../shared/files.js';
import { TextError } from './contracts.js';

export interface Authority { path: string; repoPath?: string; sha256: string; }

/** Resolve pinned inputs without coupling the workflow to one developer's drive. */
export function resolveAuthority(repo: string, authority: Authority, directory = process.env.CW_TEXT_AUTHORITY_DIR): string {
  const name = path.win32.basename(authority.path);
  const candidates = [
    ...(directory ? [path.resolve(directory, name)] : []),
    path.join(repo, 'create-world-workbench', 'data', 'text-authorities', name),
    ...(authority.repoPath ? [safePath(repo, authority.repoPath)] : []),
    authority.path,
  ];
  const selected = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!selected) throw new TextError('authority_missing', `缺少权威规范 ${name}。请放入工作台 data/text-authorities 或通过 CW_TEXT_AUTHORITY_DIR 指定原文件目录；原哈希校验仍然保留。`, 422);
  if (hashFile(selected) !== authority.sha256) throw new TextError('authority_changed', '权威规范已变化，需先核对版本：' + name, 422);
  return selected;
}
