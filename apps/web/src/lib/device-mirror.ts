'use client';

// Mirrors the signed device token so clearing one store does not reset "one question per device".
const KEY = 'cc_device';

export function readMirror(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeMirror(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // private mode: the cookie still works
  }
  try {
    const req = indexedDB.open('chai-connect', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const tx = req.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(token, KEY);
    };
  } catch {
    // IndexedDB unavailable
  }
}

export function readIndexedMirror(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('chai-connect', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const get = req.result.transaction('kv', 'readonly').objectStore('kv').get(KEY);
          get.onsuccess = () => resolve(typeof get.result === 'string' ? get.result : null);
          get.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}
