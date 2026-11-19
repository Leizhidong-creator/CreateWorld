import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const now = () => new Date().toISOString();
export const uid = (prefix: string) => prefix + '_' + crypto.randomUUID().replaceAll('-', '').slice(0, 20);

export function hash(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashFile(file: string) {
  return hash(fs.readFileSync(file));
}

export function safePath(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')) {
    throw new Error('非法相对路径');
  }
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('路径超出项目范围');
  let part = resolved;
  while (part !== path.resolve(root)) {
    if (fs.existsSync(part) && fs.lstatSync(part).isSymbolicLink()) throw new Error('不允许符号链接');
    part = path.dirname(part);
  }
  return resolved;
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}

export function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function hashTree(directory: string): string {
  if (!fs.existsSync(directory)) return hash('missing');
  const records: string[] = [];
  function visit(dir: string) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === '.DS_Store' || name === '.git' || name === 'logs' || name === 'node_modules') continue;
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('产物中不允许符号链接');
      if (stat.isDirectory()) visit(file);
      else records.push(path.relative(directory, file) + ':' + hashFile(file));
    }
  }
  visit(directory);
  return hash(records.join('\n'));
}

export function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('非法标识符');
  return id;
}

export function redact(value: any, key = ''): any {
  if (/access.?token|refresh.?token|authorization|api.?key|id.?token/i.test(key)) return '[REDACTED]';
  if (typeof value === 'string' && (value.startsWith('data:') || (value.length > 10000 && /^[A-Za-z0-9+/=]+$/.test(value)))) {
    return { mediaChars: value.length, sha256: hash(value) };
  }
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return value;
}
