import { NovaSource, NovaItem, ResumeEntry } from "../types";

const DB_NAME = "nova_player_db";
const DB_VERSION = 1;
const STORE_NAME = "source_data";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openNovaDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });

  return dbPromise;
}

export async function dbPut(key: string, value: any): Promise<boolean> {
  try {
    const db = await openNovaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("dbPut error:", err);
    return false;
  }
}

export async function dbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openNovaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("dbGet error:", err);
    return null;
  }
}

export async function dbDelete(key: string): Promise<boolean> {
  try {
    const db = await openNovaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("dbDelete error:", err);
    return false;
  }
}

// LocalStorage helpers
export function getDeviceId(): string {
  if (typeof window === "undefined") return "nova-server";
  let id = localStorage.getItem("nova_device_id");
  if (!id) {
    id = "nova-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));
    localStorage.setItem("nova_device_id", id);
  }
  return id;
}

export function loadStoredSources(): NovaSource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("nova_sources");
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveStoredSources(sources: NovaSource[]) {
  if (typeof window === "undefined") return;
  try {
    // Strip large channel lists from localStorage so quota isn't exceeded
    const clean = sources.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      portal: s.portal || "",
      mac: s.mac || "",
      model: s.model || "MAG254",
      server: s.server || "",
      username: s.username || "",
      password: s.password || "",
      url: s.url || "",
      fileName: s.fileName || "",
      fileType: s.fileType || "",
      token: s.token || "",
      session_id: s.session_id || "",
      serial_number: s.serial_number || "",
      lastRefresh: s.lastRefresh || 0,
      liveCategories: s.liveCategories || [],
    }));
    localStorage.setItem("nova_sources", JSON.stringify(clean));
  } catch (err) {
    console.warn("Failed to save sources:", err);
  }
}

export async function saveSourceItemsToDB(sourceId: string, items: NovaItem[]) {
  await dbPut(`source:${sourceId}`, { items });
}

export async function loadSourceItemsFromDB(sourceId: string): Promise<NovaItem[]> {
  const data = await dbGet<{ items: NovaItem[] }>(`source:${sourceId}`);
  return data && Array.isArray(data.items) ? data.items : [];
}

export function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("nova_favorites");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favs: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("nova_favorites", JSON.stringify(favs));
}

export function loadResumeStore(): Record<string, ResumeEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("nova_resume_v7");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveResumeStore(store: Record<string, ResumeEntry>) {
  if (typeof window === "undefined") return;
  localStorage.setItem("nova_resume_v7", JSON.stringify(store));
}
