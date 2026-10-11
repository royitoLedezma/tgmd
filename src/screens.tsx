import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useStore, createFolder, renameFolder, deleteFolder, createKid, updateKid, deleteKid,
  backupJson, restoreBackup, login, logout, type Kid, type Sex, type Side,
} from './store'
import { ageText, isOverMax } from './age'
import { Sheet, Icon } from './ui'
import { useCanInstall, installApp, isInstalled } from './install'

const NONE = 'sin'
const plural = (n: number) => `${n} ${n === 1 ? 'niño' : 'niños'}`

function missing(k: Kid): string | null {
  if (!k.birthDate) return 'Falta la fecha de nacimiento'
  if (!k.sex) return 'Falta el sexo (necesario para Control de Objetos)'
  return null
}

function Top({ title, sub, back, right }: { title: string; sub?: string; back?: string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="top">
      {back && <button className="icon-btn" aria-label="Volver" onClick={() => nav(back)}>{Icon.back}</button>}
      <div className="grow"><h1>{title}</h1>{sub && <span className="sub">{sub}</span>}</div>
      {right}
    </header>
  )
}

// ---------------- Carpetas ----------------
export function FolderList() {
  const { folders, kids } = useStore()
  const nav = useNavigate()
  const canInstall = useCanInstall()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const noFolder = kids.filter((k) => !k.folderId).length

  const create = async () => {
    const id = await createFolder(name)
    setCreating(false); setName('')
    nav(`/carpeta/${id}`)
  }

  return (
    <>
      <Top title="Carpetas" sub={`${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'} · ${plural(kids.length)}`} />
      <main className="content">
        {canInstall && !isInstalled() && (
          <button className="btn primary" style={{ background: 'var(--green)' }} onClick={installApp}>Instalar la app en este celular</button>
        )}
        {folders.length === 0 && <div className="banner info">Crea una carpeta por cliente o grupo (por ejemplo, "Olimpic") para tener a los niños ordenados.</div>}
        {folders.map((f) => {
          const n = kids.filter((k) => k.folderId === f.id).length
          return (
            <Link key={f.id} to={`/carpeta/${f.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              {Icon.folder('#0A6FA8')}
              <span className="grow"><span className="title">{f.name}</span><span className="meta">{plural(n)}</span></span>
              {Icon.chevron}
            </Link>
          )
        })}
        <Link to={`/carpeta/${NONE}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          {Icon.folder('#9AAAB8')}
          <span className="grow"><span className="title">Sin carpeta</span><span className="meta">{plural(noFolder)}</span></span>
          {Icon.chevron}
        </Link>
      </main>
      <div className="footer">
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nueva carpeta</button>
      </div>
      {creating && (
        <Sheet title="Nueva carpeta" onClose={() => setCreating(false)}>
          <div className="field">
            <label htmlFor="fname">Nombre de la carpeta</label>
            <input id="fname" className="input" autoFocus placeholder="Ej. Olimpic" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          </div>
          <button className="btn primary" onClick={create}>Crear</button>
        </Sheet>
      )}
    </>
  )
}

type KidSheet = { kid: Kid; view: 'menu' | 'move' | 'delete' } | null

export function FolderView() {
  const { id = NONE } = useParams()
  const { folders, kids } = useStore()
  const nav = useNavigate()
  const isNone = id === NONE
  const folder = folders.find((f) => f.id === id)
  const list = kids.filter((k) => (isNone ? !k.folderId : k.folderId === id))
  const [kidSheet, setKidSheet] = useState<KidSheet>(null)
  const [folderSheet, setFolderSheet] = useState<null | 'menu' | 'rename' | 'delete'>(null)
  const [newName, setNewName] = useState('')

  if (!isNone && !folder) {
    return (<><Top title="Carpeta" back="/" /><main className="content"><div className="empty">Esta carpeta ya no existe.</div></main></>)
  }
  const title = isNone ? 'Sin carpeta' : folder!.name
  const moveTo = async (folderId: string | null) => { if (kidSheet) await updateKid(kidSheet.kid.id, { folderId }); setKidSheet(null) }

  return (
    <>
      <Top title={title} sub={plural(list.length)} back="/"
        right={!isNone && <button className="icon-btn" aria-label="Opciones de la carpeta" onClick={() => setFolderSheet('menu')}>{Icon.more}</button>} />
      <main className="content">
        {list.length === 0 && <div className="empty">Esta carpeta está vacía</div>}
        {list.map((k) => {
          const warn = missing(k)
          return (
            <div key={k.id} className={`card${warn ? ' warn' : ''}`} style={{ minHeight: 60, padding: '10px 6px 10px 14px' }}>
              <Link to={`/nino/${k.id}`} className="grow" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="title" style={{ fontSize: 16 }}>{k.name}</span>
                {warn ? <span className="tag-warn">{warn}</span>
                  : <span className="meta">{ageText(k.birthDate)} · {k.sex === 'M' ? 'Masculino' : 'Femenino'}</span>}
                {!warn && isOverMax(k.birthDate) && <span className="tag-info">Mayor de 10 años: normas de 10 años 11 meses</span>}
              </Link>
              <button className="icon-btn light" aria-label={`Opciones de ${k.name}`} onClick={() => setKidSheet({ kid: k, view: 'menu' })}>{Icon.more}</button>
            </div>
          )
        })}
        <button className="btn dashed" onClick={() => nav(`/nino/nuevo?carpeta=${id}`)}>+ Agregar niño</button>
      </main>

      {kidSheet?.view === 'menu' && (
        <Sheet title={kidSheet.kid.name} onClose={() => setKidSheet(null)}>
          <button className="btn soft" onClick={() => nav(`/nino/${kidSheet.kid.id}`)}>Editar datos</button>
          <button className="btn soft" onClick={() => setKidSheet({ ...kidSheet, view: 'move' })}>Mover a otra carpeta</button>
          {!isNone && <button className="btn soft" onClick={() => moveTo(null)}>Quitar de la carpeta</button>}
          <button className="btn soft danger-text" onClick={() => setKidSheet({ ...kidSheet, view: 'delete' })}>Eliminar niño</button>
        </Sheet>
      )}
      {kidSheet?.view === 'move' && (
        <Sheet title={`Mover ${kidSheet.kid.name} a…`} onClose={() => setKidSheet(null)}>
          {folders.filter((f) => f.id !== id).map((f) => (
            <button key={f.id} className="btn soft" onClick={() => moveTo(f.id)}>{f.name}</button>
          ))}
          {!isNone && <button className="btn soft" onClick={() => moveTo(null)}>Sin carpeta</button>}
          {folders.filter((f) => f.id !== id).length === 0 && isNone && <p>Primero crea una carpeta.</p>}
        </Sheet>
      )}
      {kidSheet?.view === 'delete' && (
        <Sheet title={`¿Eliminar a ${kidSheet.kid.name}?`} onClose={() => setKidSheet(null)}>
          <p>Se borran sus datos y evaluaciones. No se puede deshacer.</p>
          <button className="btn danger" onClick={async () => { await deleteKid(kidSheet.kid.id); setKidSheet(null) }}>Sí, eliminar</button>
        </Sheet>
      )}

      {folderSheet === 'menu' && (
        <Sheet title={title} onClose={() => setFolderSheet(null)}>
          <button className="btn soft" onClick={() => { setNewName(title); setFolderSheet('rename') }}>Cambiar nombre</button>
          <button className="btn soft danger-text" onClick={() => setFolderSheet('delete')}>Eliminar carpeta</button>
        </Sheet>
      )}
      {folderSheet === 'rename' && (
        <Sheet title="Cambiar nombre" onClose={() => setFolderSheet(null)}>
          <div className="field">
            <label htmlFor="rname">Nombre</label>
            <input id="rname" className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <button className="btn primary" onClick={async () => { await renameFolder(id, newName); setFolderSheet(null) }}>Guardar</button>
        </Sheet>
      )}
      {folderSheet === 'delete' && (
        <Sheet title={`¿Eliminar la carpeta ${title}?`} onClose={() => setFolderSheet(null)}>
          {list.length > 0 ? (
            <>
              <p>Tiene {plural(list.length)}. ¿Qué hacemos con ellos?</p>
              <button className="btn soft" onClick={async () => { await deleteFolder(id, true); nav('/') }}>Pasarlos a “Sin carpeta”</button>
              <button className="btn danger" onClick={async () => { await deleteFolder(id, false); nav('/') }}>Eliminar carpeta y niños</button>
            </>
          ) : (
            <button className="btn danger" onClick={async () => { await deleteFolder(id, true); nav('/') }}>Sí, eliminar</button>
          )}
        </Sheet>
      )}
    </>
  )
}

// ---------------- Ficha del niño ----------------
function Seg<T extends string>({ value, options, onChange, cols }: { value: T; options: [T, string][]; onChange: (v: T) => void; cols: 2 | 3 | 4 }) {
  return (
    <div className={`seg c${cols}`}>
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

export function KidForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { kids, folders } = useStore()
  const nav = useNavigate()
  const existing = kids.find((k) => k.id === id)
  const startFolder = params.get('carpeta')
  const [name, setName] = useState(existing?.name ?? '')
  const [birthDate, setBirth] = useState(existing?.birthDate ?? '')
  const [sex, setSex] = useState<Sex>(existing?.sex ?? '')
  const [hand, setHand] = useState<Side>(existing?.hand ?? '')
  const [foot, setFoot] = useState<Side>(existing?.foot ?? '')
  const [eye, setEye] = useState<Side>(existing?.eye ?? '')
  const [turn, setTurn] = useState<Side>(existing?.turn ?? '')
  const [folderId, setFolderId] = useState<string>(existing ? existing.folderId ?? NONE : startFolder ?? NONE)
  const [saving, setSaving] = useState(false)

  if (id && id !== 'nuevo' && !existing) {
    return (<><Top title="Niño" back="/" /><main className="content"><div className="empty">No se encontró a este niño.</div></main></>)
  }
  const backTo = `/carpeta/${existing ? existing.folderId ?? NONE : startFolder ?? NONE}`
  const sides: [Side, string][] = [['D', 'Derecha'], ['I', 'Izquierda'], ['A', 'Ambidiestro'], ['N', 'No establecida']]

  const save = async () => {
    setSaving(true)
    const data = { name, birthDate, sex, hand, foot, eye, turn, folderId: folderId === NONE ? null : folderId }
    if (existing) await updateKid(existing.id, data)
    else await createKid(data)
    nav(`/carpeta/${folderId}`)
  }

  return (
    <>
      <Top title={existing ? 'Editar niño' : 'Niño nuevo'} back={backTo} />
      <main className="content" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="kname">Nombre</label>
          <input id="kname" className="input" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kbirth">Fecha de nacimiento</label>
          <input id="kbirth" className="input" type="date" value={birthDate} onChange={(e) => setBirth(e.target.value)} />
          {birthDate && <span className="meta" style={{ fontSize: 14, color: 'var(--muted)' }}>Edad hoy: {ageText(birthDate)}</span>}
          {birthDate && isOverMax(birthDate) && <span className="tag-info">Mayor de 10 años: se calculará con normas de 10 años 11 meses</span>}
        </div>
        <div className="field">
          <span className="label">Sexo</span>
          <Seg cols={2} value={sex} onChange={setSex} options={[['M', 'Masculino'], ['F', 'Femenino']]} />
        </div>
        <div className="field">
          <span className="label">Mano preferida</span>
          <Seg cols={2} value={hand} onChange={setHand} options={sides} />
        </div>
        <div className="field">
          <span className="label">Pie preferido</span>
          <Seg cols={2} value={foot} onChange={setFoot} options={sides} />
        </div>
        <div className="field">
          <span className="label">Ojo preferido</span>
          <Seg cols={2} value={eye} onChange={setEye} options={sides} />
        </div>
        <div className="field">
          <span className="label">Giro preferido</span>
          <Seg cols={2} value={turn} onChange={setTurn} options={sides} />
        </div>
        <div className="field">
          <label htmlFor="kfolder">Carpeta</label>
          <select id="kfolder" className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            <option value={NONE}>Sin carpeta</option>
          </select>
        </div>
        {(!sex || !birthDate) && <div className="banner warn">Puedes guardar igual, pero la fecha de nacimiento y el sexo son necesarios para calcular los resultados.</div>}
      </main>
      <div className="footer">
        <button className="btn primary" disabled={saving || !name.trim()} onClick={save}>{existing ? 'Guardar cambios' : 'Guardar niño'}</button>
      </div>
    </>
  )
}

// ---------------- Ajustes ----------------
export function Settings() {
  const { mode, user, folders, kids } = useStore()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  const download = () => {
    const blob = new Blob([backupJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `respaldo-tgmd-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const n = await restoreBackup(await file.text())
      setMsg({ kind: 'ok', text: `Respaldo cargado: ${n} registros.` })
    } catch (e) {
      setMsg({ kind: 'warn', text: e instanceof Error ? e.message : 'No se pudo leer el archivo.' })
    }
  }

  return (
    <>
      <Top title="Ajustes" />
      <main className="content">
        <div className="section-title">Cuenta</div>
        {mode === 'local' ? (
          <div className="banner warn">Modo local: los datos se guardan solo en este dispositivo. Cuando conectemos Firebase podrás verlos también en la computadora.</div>
        ) : (
          <div className="card">
            <span className="grow"><span className="title">{user?.name || 'Sesión iniciada'}</span><span className="meta">{user?.email}</span></span>
            <button className="btn ghost" style={{ width: 'auto', padding: '0 14px', height: 44, fontSize: 15 }} onClick={logout}>Salir</button>
          </div>
        )}
        <InstallBlock />
        <div className="section-title">Respaldo</div>
        <div className="banner info">Guarda una copia de tus carpetas y niños ({folders.length} carpetas, {plural(kids.length)}) en un archivo. Puedes subirlo a tu Drive.</div>
        <button className="btn primary" onClick={download}>Descargar respaldo</button>
        <label className="btn ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Cargar un respaldo
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => restore(e.target.files?.[0])} />
        </label>
        {msg && <div className={`banner ${msg.kind}`}>{msg.text}</div>}
        <div className="section-title">Versión</div>
        <div className="meta" style={{ color: 'var(--muted)', fontSize: 14 }}>Etapa 1 · Carpetas y niños</div>
      </main>
    </>
  )
}

function InstallBlock() {
  const can = useCanInstall()
  if (isInstalled()) return null
  return (
    <>
      <div className="section-title">Instalar en el celular</div>
      {can ? (
        <button className="btn primary" onClick={installApp}>Instalar app</button>
      ) : (
        <div className="banner info">
          Abre esta página en <strong>Chrome</strong>, toca los tres puntos ⋮ (arriba a la derecha) y elige
          <strong> “Instalar app”</strong> o <strong>“Agregar a la pantalla principal”</strong>.
        </div>
      )}
    </>
  )
}

export function Login() {
  const [err, setErr] = useState('')
  return (
    <main className="content" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16, minHeight: '100%' }}>
      <img src="./icon.svg" alt="" width={88} height={88} />
      <h1 style={{ margin: 0, fontSize: 28 }}>TGMD-2</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 16 }}>Entra con tu cuenta de Google para ver tus carpetas en el celular y en la computadora.</p>
      <button className="btn primary" onClick={() => login().catch((e) => {
        const code = String(e?.code || '')
        if (code.includes('popup-closed') || code.includes('cancelled-popup')) return
        if (code.includes('unauthorized-domain')) setErr('Falta autorizar esta dirección en Firebase (Authentication → Configuración → Dominios autorizados).')
        else if (code.includes('operation-not-allowed')) setErr('Falta activar el inicio de sesión con Google en Firebase (Authentication → Método de acceso).')
        else setErr(`No se pudo iniciar sesión. Intenta otra vez. (${code || 'error'})`)
      })}>Entrar con Google</button>
      {err && <div className="banner warn">{err}</div>}
    </main>
  )
}
