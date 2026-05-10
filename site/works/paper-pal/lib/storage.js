/**
 * Paper Pal · IndexedDB 存储
 * --------------------------------------------------
 * 持久化 Notebook(论文集),含全文与解读结果,支持历史恢复。
 *
 * 数据模型:
 * notebook = {
 *   id: 'nb_xxx',
 *   name: '我的论文集',
 *   createdAt, updatedAt,
 *   sources: [{
 *     id, title, fileName, fileSize,
 *     fullText, truncated,
 *     enabled, addedAt,
 *     summary, cards, pm   // 解读结果(可空)
 *   }],
 *   activeSourceId,
 *   chatHistory: [{role, content}]
 * }
 */

const DB_NAME = 'paperpal';
const DB_VERSION = 1;
const STORE = 'notebooks';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode) {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============ 公共 API ============

/** 生成 id */
export function genId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 保存(整张表更新) */
export async function saveNotebook(nb) {
  nb.updatedAt = Date.now();
  const store = await tx('readwrite');
  return reqToPromise(store.put(nb));
}

/** 加载 */
export async function loadNotebook(id) {
  const store = await tx('readonly');
  return reqToPromise(store.get(id));
}

/** 列出所有(按 updatedAt 降序),为列表展示精简字段 */
export async function listNotebooks() {
  const store = await tx('readonly');
  const all = await reqToPromise(store.getAll());
  return all
    .map(nb => ({
      id: nb.id,
      name: nb.name,
      sourceCount: (nb.sources || []).length,
      updatedAt: nb.updatedAt,
      createdAt: nb.createdAt,
      preview: (nb.sources || []).slice(0, 3).map(s => s.title).join(' · '),
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** 删除 */
export async function deleteNotebook(id) {
  const store = await tx('readwrite');
  return reqToPromise(store.delete(id));
}

// ============ 工厂方法 ============

export function newNotebook(name) {
  return {
    id: genId('nb'),
    name: name || `论文集 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sources: [],
    activeSourceId: null,
    chatHistory: [],
  };
}

export function newSource({ title, fileName, fileSize, fullText, truncated }) {
  return {
    id: genId('s'),
    title: title || fileName || '未命名论文',
    fileName: fileName || '',
    fileSize: fileSize || 0,
    fullText: fullText || '',
    truncated: !!truncated,
    enabled: true,
    addedAt: Date.now(),
    summary: '',
    cards: null,
    pm: '',
  };
}