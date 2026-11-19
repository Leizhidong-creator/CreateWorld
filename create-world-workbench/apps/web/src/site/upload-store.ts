export type UploadedGame = { id: string; title: string; description: string; filename: string; createdAt: string; file: Blob; playable: boolean };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cw-uploaded-games', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('games', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地作品库，请检查浏览器存储权限。'));
  });
}
export async function uploadedGames(): Promise<UploadedGame[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('games').objectStore('games').getAll();
    request.onsuccess = () => resolve((request.result as UploadedGame[]).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function saveUploadedGame(title: string, description: string, file: File) {
  if (!title.trim()) throw new Error('请填写游戏名称。');
  if (!/\.(html?|zip)$/i.test(file.name)) throw new Error('请选择 HTML 游戏或 ZIP 游戏包。');
  if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('请选择非空且不超过 100 MB 的文件。');
  const game: UploadedGame = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(), filename: file.name, createdAt: new Date().toISOString(), file, playable: /\.html?$/i.test(file.name) };
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('games', 'readwrite');
    transaction.objectStore('games').put(game);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new Error('保存失败，浏览器存储空间可能不足，请重试。'));
  }); } finally { db.close(); }
  window.dispatchEvent(new Event('cw-uploads-changed'));
}
