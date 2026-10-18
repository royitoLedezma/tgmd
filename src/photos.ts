// Fotos del registro visual (página 3 del informe): se guardan SOLO en este celular (IndexedDB), nunca en la nube.
// Cada foto ocupa un casillero: sesión · niño · habilidad · fase. Junto a la foto se guarda la postura del muñeco.
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FigureColor, Pose } from './pose'

export interface Photo {
  id: string // sesion|niño|habilidad|fase
  sk: string // sesion|niño
  sessionId: string
  kidId: string
  skillId: string
  phase: string
  blob: Blob
  w: number
  h: number
  /** Muñeco sobre la foto. undefined = todavía no se acomodó; null = la foto va sin muñeco. */
  pose?: Pose | null
  /** Color del muñeco (dorado si no se eligió). */
  color?: FigureColor
  createdAt: number
}

/** Opciones por habilidad: si va en el informe y un comentario breve. */
export interface SkillNote { id: string; sk: string; include: boolean; comment: string }

export const photoId = (sessionId: string, kidId: string, skillId: string, phase: string) => `${sessionId}|${kidId}|${skillId}|${phase}`
const skKey = (sessionId: string, kidId: string) => `${sessionId}|${kidId}`

const DB_NAME = 'tgmd-fotos'
let dbPromise: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const d = req.result
        d.createObjectStore('photos', { keyPath: 'id' }).createIndex('sk', 'sk')
        d.createObjectStore('notes', { keyPath: 'id' }).createIndex('sk', 'sk')
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

let version = 0
const listeners = new Set<() => void>()
const changed = () => { version++; listeners.forEach((l) => l()) }
function usePhotosVersion() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => version)
}

export async function savePhoto(p: Omit<Photo, 'id' | 'sk' | 'createdAt'>) {
  const full: Photo = { ...p, id: photoId(p.sessionId, p.kidId, p.skillId, p.phase), sk: skKey(p.sessionId, p.kidId), createdAt: Date.now() }
  await tx(['photos'], 'readwrite', (t) => { t.objectStore('photos').put(full) })
  changed()
}

export async function updatePhoto(id: string, patch: Partial<Pick<Photo, 'pose' | 'color'>>) {
  const cur = await tx<Photo | undefined>(['photos'], 'readonly', (t) => t.objectStore('photos').get(id))
  if (!cur) return
  await tx(['photos'], 'readwrite', (t) => { t.objectStore('photos').put({ ...cur, ...patch }) })
  changed()
}

export async function deletePhoto(id: string) {
  await tx(['photos'], 'readwrite', (t) => { t.objectStore('photos').delete(id) })
  changed()
}

export function getPhoto(id: string): Promise<Photo | undefined> {
  return tx<Photo | undefined>(['photos'], 'readonly', (t) => t.objectStore('photos').get(id))
}

export function listKidPhotos(sessionId: string, kidId: string): Promise<Photo[]> {
  return tx<Photo[]>(['photos'], 'readonly', (t) => t.objectStore('photos').index('sk').getAll(skKey(sessionId, kidId)))
}

export async function saveNote(sessionId: string, kidId: string, skillId: string, patch: Partial<Pick<SkillNote, 'include' | 'comment'>>) {
  const id = `${sessionId}|${kidId}|${skillId}`
  const cur = await tx<SkillNote | undefined>(['notes'], 'readonly', (t) => t.objectStore('notes').get(id))
  const next: SkillNote = { id, sk: skKey(sessionId, kidId), include: true, comment: '', ...cur, ...patch }
  await tx(['notes'], 'readwrite', (t) => { t.objectStore('notes').put(next) })
  changed()
}

function listKidNotes(sessionId: string, kidId: string): Promise<SkillNote[]> {
  return tx<SkillNote[]>(['notes'], 'readonly', (t) => t.objectStore('notes').index('sk').getAll(skKey(sessionId, kidId)))
}

/** Borra todas las fotos y notas de una sesión (al eliminar la sesión o sus videos). */
export async function deleteSessionPhotos(sessionId: string) {
  const d = await open()
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(['photos', 'notes'], 'readwrite')
    for (const store of ['photos', 'notes']) {
      const req = t.objectStore(store).openCursor()
      req.onsuccess = () => {
        const c = req.result
        if (!c) return
        if (String(c.key).startsWith(`${sessionId}|`)) c.delete()
        c.continue()
      }
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  changed()
}

export interface KidVisual { photos: Map<string, Photo>; notes: Map<string, SkillNote> }

/** Fotos y notas de un niño en una sesión. null mientras carga. Se actualiza solo. */
export function useKidVisual(sessionId: string, kidId: string): KidVisual | null {
  const v = usePhotosVersion()
  const [data, setData] = useState<KidVisual | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([listKidPhotos(sessionId, kidId), listKidNotes(sessionId, kidId)])
      .then(([ps, ns]) => { if (alive) setData({ photos: new Map(ps.map((p) => [p.id, p])), notes: new Map(ns.map((n) => [n.id.split('|')[2], n])) }) })
      .catch(() => { if (alive) setData({ photos: new Map(), notes: new Map() }) })
    return () => { alive = false }
  }, [sessionId, kidId, v])
  return data
}

/** URL temporal de una imagen guardada (se libera sola). */
export function useBlobUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
