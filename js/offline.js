const DB_NAME = 'range-tracker';
const STORE  = 'shot-queue';

let db;

export async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
    };
    req.onsuccess  = (e) => { db = e.target.result; resolve(); };
    req.onerror    = (e) => reject(e.target.error);
  });
}

export async function queueShot(shot) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(shot);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

async function getQueue() {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function clearQueue() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

export async function flushQueue(insertFn) {
  const shots = await getQueue();
  if (!shots.length) return 0;
  for (const shot of shots) {
    const { localId, ...data } = shot;
    await insertFn(data.session_id, data.club_id, data.result, data.shot_number);
  }
  await clearQueue();
  return shots.length;
}

export async function getQueueCount() {
  return new Promise((resolve) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(0);
  });
}
