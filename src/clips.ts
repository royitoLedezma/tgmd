// Videos grabados: se guardan SOLO en este dispositivo (IndexedDB), nunca en la nube.
// Se guardan separados: "meta" (datos livianos para listar) y "blobs" (el video).
import { useEffect, useState, useSyncExternalStore } from 'react'

export interface ClipMeta {
  key: string // sesion|niño|prueba|intento
  sessionId: string
  kidId: string
  skillId: string
  attempt: number
  status: 'ok' | 'pendiente' // pendiente = se saltó
  mime: string
  size: number
  seconds: number
  createdAt: number
}

export const clipKey = (sessionId: string, kidId: string, skillId: string, attempt: number) =>
  `${sessionId}|${kidId}|${skillId}|${attempt}`

const DB_NAME = 'tgmd-videos'
let dbPromise: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const d = req.result
        const meta = d.createObjectStore('meta', { keyPath: 'key' })
        meta.createIndex('session', 'sessionId')
        d.createObjectStore('blobs')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}
function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return open().then((d) => new Promise<T>((resolve, reject) => {
    const t = d.transaction(stores, mode)
    const r = fn(t)
    t.oncomplete = () => resolve(r ? r.result : (undefined as T))
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  }))
}

// Aviso a las pantallas cuando cambian los videos.
let version = 0
const listeners = new Set<() => void>()
const changed = () => { version++; listeners.forEach((l) => l()) }
function useClipsVersion() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => version)
}

export async function saveClip(meta: Omit<ClipMeta, 'createdAt'>, blob: Blob | null) {
  const full: ClipMeta = { ...meta, createdAt: Date.now() }
  await tx(['meta', 'blobs'], 'readwrite', (t) => {
    t.objectStore('meta').put(full)
    if (blob) t.objectStore('blobs').put(blob, full.key)
    else t.objectStore('blobs').delete(full.key)
  })
  changed()
}

export async function deleteClip(key: string) {
  await tx(['meta', 'blobs'], 'readwrite', (t) => {
    t.objectStore('meta').delete(key)
    t.objectStore('blobs').delete(key)
  })
  changed()
}

export function getClipBlob(key: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(['blobs'], 'readonly', (t) => t.objectStore('blobs').get(key))
}

export function listSessionClips(sessionId: string): Promise<ClipMeta[]> {
  return tx<ClipMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').index('session').getAll(sessionId))
}

export async function deleteSessionClips(sessionId: string) {
  const metas = await listSessionClips(sessionId)
  await tx(['meta', 'blobs'], 'readwrite', (t) => {
    metas.forEach((m) => { t.objectStore('meta').delete(m.key); t.objectStore('blobs').delete(m.key) })
  })
  changed()
}

/** Videos de una sesión, como mapa clave → meta. Se actualiza solo. */
export function useSessionClips(sessionId: string | undefined): Map<string, ClipMeta> | null {
  const v = useClipsVersion()
  const [clips, setClips] = useState<Map<string, ClipMeta> | null>(null)
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    listSessionClips(sessionId)
      .then((xs) => { if (alive) setClips(new Map(xs.map((x) => [x.key, x]))) })
      .catch(() => { if (alive) setClips(new Map()) })
    return () => { alive = false }
  }, [sessionId, v])
  return clips
}

// ---------- Espacio en el celular ----------
export interface StorageInfo { usedMB: number; freeMB: number; persisted: boolean }

export async function storageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null
  const e = await navigator.storage.estimate()
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false
  const used = e.usage || 0
  const quota = e.quota || 0
  return { usedMB: Math.round(used / 1e6), freeMB: Math.max(0, Math.round((quota - used) / 1e6)), persisted }
}

/** Pide al navegador que no borre los videos aunque falte espacio. */
export async function askPersist(): Promise<boolean> {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false } catch { return false }
}

export function useStorageInfo(): StorageInfo | null {
  const v = useClipsVersion()
  const [info, setInfo] = useState<StorageInfo | null>(null)
  useEffect(() => { storageInfo().then(setInfo).catch(() => setInfo(null)) }, [v])
  return info
}
