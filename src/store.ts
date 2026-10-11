// Datos de la app: carpetas y niños.
// Dos modos:
//  - "local": sin Firebase configurado, todo se guarda en este dispositivo (localStorage).
//  - "nube": con Firebase, se guarda en Firestore (funciona sin señal y sincroniza al volver).
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

interface State {
  mode: 'local' | 'nube'
  ready: boolean
  user: { uid: string; name: string; email: string } | null
  folders: Folder[]
  kids: Kid[]
}

const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
const LOCAL_KEY = 'tgmd-datos-v1'

let state: State = {
  mode: cloudEnabled ? 'nube' : 'local',
  ready: !cloudEnabled,
  user: cloudEnabled ? null : { uid: 'local', name: 'Este dispositivo', email: '' },
  folders: [],
  kids: [],
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

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es')

// ---------- Modo local ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      set({ folders: (d.folders || []).sort(byName), kids: (d.kids || []).sort(byName) })
    }
  } catch { /* datos dañados: se empieza vacío */ }
}
function saveLocal(folders: Folder[], kids: Kid[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ folders, kids })) } catch { /* sin espacio */ }
  set({ folders: [...folders].sort(byName), kids: [...kids].sort(byName) })
}

// ---------- Modo nube ----------
let db: Firestore | null = null
let unsubs: Array<() => void> = []

if (cloudEnabled) {
  const app = initializeApp(firebaseConfig)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  const auth = getAuth(app)
  onAuthStateChanged(auth, (u: User | null) => {
    unsubs.forEach((f) => f()); unsubs = []
    if (!u) { set({ user: null, ready: true, folders: [], kids: [] }); return }
    set({ user: { uid: u.uid, name: u.displayName || '', email: u.email || '' }, ready: true })
    const mine = (c: string) => query(collection(db!, c), where('ownerId', '==', u.uid))
    unsubs.push(onSnapshot(mine('folders'), (s) => set({ folders: s.docs.map((d) => d.data() as Folder).sort(byName) })))
    unsubs.push(onSnapshot(mine('kids'), (s) => set({ kids: s.docs.map((d) => d.data() as Kid).sort(byName) })))
  })
} else {
  loadLocal()
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

// ---------- Acciones ----------
const uid = () => state.user?.uid || 'local'

export async function createFolder(name: string): Promise<string> {
  const f: Folder = { id: newId(), name: name.trim() || 'Carpeta nueva', ownerId: uid(), createdAt: Date.now() }
  if (db) await setDoc(doc(db, 'folders', f.id), f)
  else saveLocal([...state.folders, f], state.kids)
  return f.id
}

export async function renameFolder(id: string, name: string) {
  const n = name.trim()
  if (!n) return
  if (db) await updateDoc(doc(db, 'folders', id), { name: n })
  else saveLocal(state.folders.map((f) => (f.id === id ? { ...f, name: n } : f)), state.kids)
}

/** Elimina una carpeta. keepKids = true pasa sus niños a "Sin carpeta"; false los borra. */
export async function deleteFolder(id: string, keepKids: boolean) {
  const inside = state.kids.filter((k) => k.folderId === id)
  if (db) {
    const b = writeBatch(db)
    inside.forEach((k) => (keepKids ? b.update(doc(db!, 'kids', k.id), { folderId: null }) : b.delete(doc(db!, 'kids', k.id))))
    b.delete(doc(db, 'folders', id))
    await b.commit()
  } else {
    const kids = keepKids
      ? state.kids.map((k) => (k.folderId === id ? { ...k, folderId: null } : k))
      : state.kids.filter((k) => k.folderId !== id)
    saveLocal(state.folders.filter((f) => f.id !== id), kids)
  }
}

export type KidInput = Omit<Kid, 'id' | 'ownerId' | 'createdAt'>

export async function createKid(data: KidInput): Promise<string> {
  const k: Kid = { ...data, name: data.name.trim() || 'Niño nuevo', id: newId(), ownerId: uid(), createdAt: Date.now() }
  if (db) await setDoc(doc(db, 'kids', k.id), k)
  else saveLocal(state.folders, [...state.kids, k])
  return k.id
}

export async function updateKid(id: string, patch: Partial<KidInput>) {
  if (db) await updateDoc(doc(db, 'kids', id), patch)
  else saveLocal(state.folders, state.kids.map((k) => (k.id === id ? { ...k, ...patch } : k)))
}

export async function deleteKid(id: string) {
  if (db) await deleteDoc(doc(db, 'kids', id))
  else saveLocal(state.folders, state.kids.filter((k) => k.id !== id))
}

// ---------- Respaldo ----------
export function backupJson(): string {
  return JSON.stringify({ app: 'tgmd', version: 1, fecha: new Date().toISOString(), folders: state.folders, kids: state.kids }, null, 2)
}

/** Restaura un respaldo. Agrega o reemplaza por id; no borra lo que ya existe. */
export async function restoreBackup(text: string): Promise<number> {
  const d = JSON.parse(text)
  if (d.app !== 'tgmd') throw new Error('El archivo no es un respaldo de esta app')
  const folders: Folder[] = (d.folders || []).map((f: Folder) => ({ ...f, ownerId: uid() }))
  const kids: Kid[] = (d.kids || []).map((k: Kid) => ({ ...k, ownerId: uid() }))
  if (db) {
    const b = writeBatch(db)
    folders.forEach((f) => b.set(doc(db!, 'folders', f.id), f))
    kids.forEach((k) => b.set(doc(db!, 'kids', k.id), k))
    await b.commit()
  } else {
    const fm = new Map(state.folders.map((f) => [f.id, f])); folders.forEach((f) => fm.set(f.id, f))
    const km = new Map(state.kids.map((k) => [k.id, k])); kids.forEach((k) => km.set(k.id, k))
    saveLocal([...fm.values()], [...km.values()])
  }
  return folders.length + kids.length
}
