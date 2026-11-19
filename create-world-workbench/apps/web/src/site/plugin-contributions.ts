export type Contribution = {
  id: string; mode: 'new' | 'remix'; sourceId: string; sourceName: string;
  name: string; kind: string; author: string; version: string; description: string;
  tags: string; integration: string; changes: string; license: string;
  attachment?: File; status: 'draft' | 'submitted'; revision: number; updatedAt: string;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cw-plugin-contributions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('contributions', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他旧版页面后重试。'));
  });
}
export async function readContributions(): Promise<Contribution[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('contributions').objectStore('contributions').getAll();
      request.onsuccess = () => resolve((request.result as Contribution[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveContribution(value: Contribution): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('contributions', 'readwrite');
      transaction.objectStore('contributions').put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('保存已中断'));
    });
  } finally { db.close(); }
}
