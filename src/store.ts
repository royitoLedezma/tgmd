// Datos de la app: carpetas, niños y sesiones de grabación.
// Dos modos:
//  - "local": sin Firebase configurado, todo se guarda en este dispositivo (localStorage).
//  - "nube": con Firebase, se guarda en Firestore (funciona sin señal y sincroniza al volver).
// Los videos NUNCA van a la nube: se guardan en el celular (ver clips.ts).
import { useSyncExternalStore } from 'react'
import { initializeApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from './firebase-config'
import { validateNorms, type Norms } from './calc'

export type Sex = 'M' | 'F' | ''
/** D = derecha, I = izquierda, A = ambidiestro, N = no establecida */
export type Side = 'D' | 'I' | 'A' | 'N' | ''

export interface Folder { id: string; name: string; ownerId: string; createdAt: number }
export interface Kid {
  id: string
  name: string
  birthDate: string // AAAA-MM-DD
  sex: Sex
  hand: Side
  foot: Side
  eye: Side
  turn: Side
  folderId: string | null // null = "Sin carpeta"
  ownerId: string
  createdAt: number
}
export type SessionMode = 'grupal' | 'individual'
export interface Session {
  id: string
  date: string // AAAA-MM-DD
  mode: SessionMode
  kidIds: string[]
  absent: string[]
  ownerId: string
  createdAt: number
}

/** Marca de un criterio: 1 = logrado, 0 = no logrado, null = sin marcar. */
export type Mark = 0 | 1 | null
/** Puntuación de un niño en una sesión. marks["prueba:criterio"] = [intento1, intento2] */
export interface Score {
  id: string // sesion_niño
  sessionId: string
  kidId: string
  marks: Record<string, [Mark, Mark]>
  conclusions?: string
  suggestions?: string
  ownerId: string
  createdAt: number
}
interface Data { folders: Folder[]; kids: Kid[]; sessions: Session[]; scores: Score[] }
interface State extends Data {
  norms: Norms | null
  mode: 'local' | 'nube'
  ready: boolean
  user: { uid: string; name: string; email: string } | null
  error: string | null
}
type Col = keyof Data

// VITE_LOCAL=1 fuerza el modo local (solo para pruebas automáticas).
const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId) && import.meta.env.VITE_LOCAL !== '1'
const LOCAL_KEY = 'tgmd-datos-v1'
const NORMS_KEY = 'tgmd-normas'

let state: State = {
  mode: cloudEnabled ? 'nube' : 'local',
  ready: !cloudEnabled,
  user: cloudEnabled ? null : { uid: 'local', name: 'Este dispositivo', email: '' },
  folders: [],
  kids: [],
  sessions: [],
  scores: [],
  norms: null,
  error: null,
}
const listeners = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state)
}
export const getState = () => state

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es')
const byNewest = (a: Session, b: Session) => b.createdAt - a.createdAt
function sorted(data: Partial<Data>): Partial<Data> {
  const out: Partial<Data> = {}
  if (data.folders) out.folders = [...data.folders].sort(byName)
  if (data.kids) out.kids = [...data.kids].sort(byName)
  if (data.sessions) out.sessions = [...data.sessions].sort(byNewest)
  if (data.scores) out.scores = data.scores
  return out
}

// ---------- Modo local ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      set(sorted({ folders: d.folders || [], kids: d.kids || [], sessions: d.sessions || [], scores: d.scores || [] }))
    }
  } catch { /* datos dañados: se empieza vacío */ }
}
function saveLocal(patch: Partial<Data>) {
  const next: Data = { folders: state.folders, kids: state.kids, sessions: state.sessions, scores: state.scores, ...patch }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch { /* sin espacio */ }
  set(sorted(next))
}

// ---------- Modo nube ----------
let db: Firestore | null = null
let unsubs: Array<() => void> = []

function readError(e: { code?: string; message?: string }) {
  const code = String(e?.code || '')
  set({ error: code.includes('permission-denied')
    ? 'Firebase no deja leer tus datos: revisa que las reglas de Firestore estén publicadas (y actualizadas).'
    : `No se pudieron leer los datos de la nube (${code || e?.message || 'error'}).` })
}

if (cloudEnabled) {
  const app = initializeApp(firebaseConfig)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  const auth = getAuth(app)
  onAuthStateChanged(auth, (u: User | null) => {
    unsubs.forEach((f) => f()); unsubs = []
    if (!u) { set({ user: null, ready: true, folders: [], kids: [], sessions: [], scores: [] }); return }
    set({ user: { uid: u.uid, name: u.displayName || '', email: u.email || '' }, ready: true })
    const listen = (c: Col) => unsubs.push(onSnapshot(
      query(collection(db!, c), where('ownerId', '==', u.uid)),
      (s) => set(sorted({ [c]: s.docs.map((d) => d.data()) } as Partial<Data>)),
      readError,
    ))
    listen('folders'); listen('kids'); listen('sessions'); listen('scores')
    // Tablas normativas privadas del evaluador (guardadas como texto: Firestore no admite listas dentro de listas).
    unsubs.push(onSnapshot(doc(db!, 'norms', u.uid), (d) => {
      try {
        const parsed = d.exists() ? JSON.parse((d.data() as { json: string }).json) : null
        set({ norms: validateNorms(parsed) ? parsed : null })
      } catch { set({ norms: null }) }
    }, readError))
  })
} else {
  loadLocal()
  try {
    const n = JSON.parse(localStorage.getItem(NORMS_KEY) || 'null')
    if (validateNorms(n)) set({ norms: n })
  } catch { /* sin tablas */ }
}

export async function login() {
  if (!cloudEnabled) return
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(getAuth(), provider)
  } catch (e) {
    // Si el navegador bloquea la ventana emergente, se usa la redirección.
    const code = (e as { code?: string }).code || ''
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
      await signInWithRedirect(getAuth(), provider)
    } else {
      throw e
    }
  }
}
export async function logout() {
  if (cloudEnabled) await signOut(getAuth())
}

// ---------- Escritura genérica ----------
// Las escrituras no se esperan: Firestore actualiza la pantalla al instante (también sin señal)
// y sincroniza en segundo plano. Si el servidor rechaza un cambio, se muestra el error.
function bg(p: Promise<unknown>) {
  p.catch((e) => {
    const code = String((e as { code?: string })?.code || '')
    const msg = code.includes('permission-denied')
      ? 'Firebase rechazó el cambio: revisa que las reglas de Firestore estén publicadas (y actualizadas).'
      : code.includes('not-found')
        ? 'No se encontró la base de datos de Firestore: revisa que esté creada.'
        : `No se pudo guardar en la nube (${code || (e as Error)?.message || 'error'}).`
    set({ error: msg })
  })
}
export function clearError() { set({ error: null }) }
const uid = () => state.user?.uid || 'local'

type Item = { id: string }
function put<C extends Col>(c: C, item: Data[C][number]) {
  if (db) bg(setDoc(doc(db, c, (item as Item).id), item))
  else saveLocal({ [c]: [...(state[c] as Item[]).filter((x) => x.id !== (item as Item).id), item] } as Partial<Data>)
}
function patchItem<C extends Col>(c: C, id: string, patch: Partial<Data[C][number]>) {
  if (db) bg(updateDoc(doc(db, c, id), patch as unknown as Record<string, never>))
  else saveLocal({ [c]: (state[c] as Item[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Partial<Data>)
}
function remove(c: Col, id: string) {
  if (db) bg(deleteDoc(doc(db, c, id)))
  else saveLocal({ [c]: (state[c] as Item[]).filter((x) => x.id !== id) } as Partial<Data>)
}

// ---------- Carpetas ----------
export async function createFolder(name: string): Promise<string> {
  const f: Folder = { id: newId(), name: name.trim() || 'Carpeta nueva', ownerId: uid(), createdAt: Date.now() }
  put('folders', f)
  return f.id
}

export async function renameFolder(id: string, name: string) {
  const n = name.trim()
  if (n) patchItem('folders', id, { name: n })
}

/** Elimina una carpeta. keepKids = true pasa sus niños a "Sin carpeta"; false los borra. */
export async function deleteFolder(id: string, keepKids: boolean) {
  const inside = state.kids.filter((k) => k.folderId === id)
  if (db) {
    const b = writeBatch(db)
    inside.forEach((k) => (keepKids ? b.update(doc(db!, 'kids', k.id), { folderId: null }) : b.delete(doc(db!, 'kids', k.id))))
    b.delete(doc(db, 'folders', id))
    bg(b.commit())
  } else {
    const kids = keepKids
      ? state.kids.map((k) => (k.folderId === id ? { ...k, folderId: null } : k))
      : state.kids.filter((k) => k.folderId !== id)
    saveLocal({ folders: state.folders.filter((f) => f.id !== id), kids })
  }
}

// ---------- Niños ----------
export type KidInput = Omit<Kid, 'id' | 'ownerId' | 'createdAt'>

export async function createKid(data: KidInput): Promise<string> {
  const k: Kid = { ...data, name: data.name.trim() || 'Niño nuevo', id: newId(), ownerId: uid(), createdAt: Date.now() }
  put('kids', k)
  return k.id
}
export async function updateKid(id: string, patch: Partial<KidInput>) { patchItem('kids', id, patch) }
export async function deleteKid(id: string) { remove('kids', id) }

// ---------- Sesiones ----------
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function createSession(mode: SessionMode = 'grupal'): string {
  const s: Session = { id: newId(), date: today(), mode, kidIds: [], absent: [], ownerId: uid(), createdAt: Date.now() }
  put('sessions', s)
  return s.id
}
export function updateSession(id: string, patch: Partial<Omit<Session, 'id' | 'ownerId' | 'createdAt'>>) {
  patchItem('sessions', id, patch)
}
export function deleteSession(id: string) {
  state.scores.filter((x) => x.sessionId === id).forEach((x) => remove('scores', x.id))
  remove('sessions', id)
}

// ---------- Puntuaciones ----------
export const scoreId = (sessionId: string, kidId: string) => `${sessionId}_${kidId}`
export function setMarks(sessionId: string, kidId: string, key: string, value: [Mark, Mark]) {
  const id = scoreId(sessionId, kidId)
  const existing = state.scores.find((x) => x.id === id)
  if (db) {
    const base = existing ? {} : { id, sessionId, kidId, ownerId: uid(), createdAt: Date.now() }
    bg(setDoc(doc(db, 'scores', id), { ...base, ownerId: uid(), marks: { [key]: value } }, { merge: true }))
  } else {
    const sc: Score = existing
      ? { ...existing, marks: { ...existing.marks, [key]: value } }
      : { id, sessionId, kidId, ownerId: uid(), createdAt: Date.now(), marks: { [key]: value } }
    saveLocal({ scores: [...state.scores.filter((x) => x.id !== id), sc] })
  }
}

/** Guarda las conclusiones y sugerencias del informe de un niño. */
export function setReportText(sessionId: string, kidId: string, patch: { conclusions?: string; suggestions?: string }) {
  const id = scoreId(sessionId, kidId)
  const existing = state.scores.find((x) => x.id === id)
  if (db) {
    const base = existing ? {} : { id, sessionId, kidId, createdAt: Date.now(), marks: {} }
    bg(setDoc(doc(db, 'scores', id), { ...base, ownerId: uid(), ...patch }, { merge: true }))
  } else {
    const sc: Score = existing ? { ...existing, ...patch } : { id, sessionId, kidId, ownerId: uid(), createdAt: Date.now(), marks: {}, ...patch }
    saveLocal({ scores: [...state.scores.filter((x) => x.id !== id), sc] })
  }
}

const EVAL_KEY = 'tgmd-evaluador'
export function evaluatorName(): string {
  const fallback = state.user && state.user.uid !== 'local' ? state.user.name : ''
  try { return localStorage.getItem(EVAL_KEY) || fallback } catch { return fallback }
}
export function setEvaluatorName(n: string) { try { localStorage.setItem(EVAL_KEY, n) } catch { /* sin espacio */ } }

// ---------- Tablas normativas ----------
/** Guarda las tablas del manual en la cuenta del evaluador. Devuelve false si el archivo no es válido. */
export function saveNorms(text: string): boolean {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return false }
  if (!validateNorms(parsed)) return false
  if (db) bg(setDoc(doc(db, 'norms', uid()), { id: uid(), ownerId: uid(), json: JSON.stringify(parsed), createdAt: Date.now() }))
  else { try { localStorage.setItem(NORMS_KEY, JSON.stringify(parsed)) } catch { /* sin espacio */ } }
  set({ norms: parsed })
  return true
}

// ---------- Respaldo ----------
export function backupJson(): string {
  return JSON.stringify({
    app: 'tgmd', version: 2, fecha: new Date().toISOString(),
    folders: state.folders, kids: state.kids, sessions: state.sessions, scores: state.scores,
  }, null, 2)
}

/** Restaura un respaldo. Agrega o reemplaza por id; no borra lo que ya existe. */
export async function restoreBackup(text: string): Promise<number> {
  const d = JSON.parse(text)
  if (d.app !== 'tgmd') throw new Error('El archivo no es un respaldo de esta app')
  const mine = <T>(xs: T[] | undefined) => (xs || []).map((x) => ({ ...x, ownerId: uid() }))
  const incoming: Data = { folders: mine(d.folders), kids: mine(d.kids), sessions: mine(d.sessions), scores: mine(d.scores) }
  if (db) {
    const b = writeBatch(db)
    ;(Object.keys(incoming) as Col[]).forEach((c) => (incoming[c] as Item[]).forEach((x) => b.set(doc(db!, c, x.id), x)))
    bg(b.commit())
  } else {
    const merge = <T extends Item>(a: T[], b: T[]) => { const m = new Map(a.map((x) => [x.id, x])); b.forEach((x) => m.set(x.id, x)); return [...m.values()] }
    saveLocal({
      folders: merge(state.folders, incoming.folders),
      kids: merge(state.kids, incoming.kids),
      sessions: merge(state.sessions, incoming.sessions),
      scores: merge(state.scores, incoming.scores),
    })
  }
  return incoming.folders.length + incoming.kids.length + incoming.sessions.length + incoming.scores.length
}
