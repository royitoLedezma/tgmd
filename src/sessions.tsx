import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore, createSession, updateSession, deleteSession, scoreId, type Session, type SessionMode, type Kid, type Folder, type Score } from './store'
import { progress } from './scoring'
import { useSessionClips, deleteSessionClips, useStorageInfo, type ClipMeta } from './clips'
import { CLIPS_PER_KID, MARKS_PER_KID } from './skills'
import { ageText } from './age'
import { Sheet, Icon, Top } from './ui'
import { tooSoonWarning } from './results'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function dateText(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const plural = (n: number) => `${n} ${n === 1 ? 'niño' : 'niños'}`

export function okCount(clips: Map<string, ClipMeta> | null, kidId?: string) {
  if (!clips) return 0
  let n = 0
  clips.forEach((c) => { if (c.status === 'ok' && (!kidId || c.kidId === kidId)) n++ })
  return n
}

// ---------------- Lista de sesiones ----------------
/** Nombre del grupo de la sesión: carpetas involucradas y, para niños sin carpeta, su nombre. */
export function sessionTitle(s: Session, kids: Kid[], folders: Folder[]): string {
  const names: string[] = []
  for (const kid of s.kidIds) {
    const k = kids.find((x) => x.id === kid)
    if (!k) continue
    const n = k.folderId ? folders.find((f) => f.id === k.folderId)?.name ?? 'Carpeta' : k.name
    if (!names.includes(n)) names.push(n)
  }
  if (!names.length) return 'Sesión sin niños'
  return names.length > 3 ? `${names.slice(0, 3).join(' + ')} y ${names.length - 3} más` : names.join(' + ')
}

/** Estado de la sesión: terminada = todos los criterios de todos los niños puntuados. */
export function sessionStatus(s: Session, scores: Score[], clips: Map<string, ClipMeta> | null) {
  if (!s.kidIds.length) return { done: false, label: 'Sin niños' }
  const marked = s.kidIds.reduce((n, k) => n + progress(scores.find((x) => x.id === scoreId(s.id, k))).marked, 0)
  const totalMarks = s.kidIds.length * MARKS_PER_KID
  if (marked >= totalMarks) return { done: true, label: 'Terminada' }
  const videos = okCount(clips), totalVideos = s.kidIds.length * CLIPS_PER_KID
  if (clips && clips.size > 0 && videos < totalVideos) return { done: false, label: 'Falta grabar' }
  return { done: false, label: marked ? 'Falta puntuar' : 'Pendiente' }
}

function SessionCard({ s }: { s: Session }) {
  const { kids, folders, scores } = useStore()
  const clips = useSessionClips(s.id)
  const total = s.kidIds.length * CLIPS_PER_KID
  const done = okCount(clips)
  const st = sessionStatus(s, scores, clips)
  const color = st.done ? '#0B7A61' : '#B45309'
  return (
    <Link to={`/sesion/${s.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', borderLeft: `6px solid ${color}`, background: st.done ? '#F1FAF6' : '#FFFBEB' }}>
      <span className="grow">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="title" style={{ color }}>{sessionTitle(s, kids, folders)}</span>
          <span style={{ fontSize: 12, fontWeight: 900, padding: '3px 8px', borderRadius: 6, background: color, color: '#fff' }}>{st.label}</span>
        </span>
        <span className="meta" style={{ fontWeight: 700, color: '#33414E' }}>{dateText(s.date)} · {plural(s.kidIds.length)}</span>
        <span className="meta">{total ? `${done} de ${total} videos grabados` : 'Sin niños todavía'}</span>
      </span>
      {Icon.chevron}
    </Link>
  )
}

export function SessionList() {
  const { sessions } = useStore()
  const nav = useNavigate()
  return (
    <>
      <Top title="Sesiones" sub="Grabación en la cancha" />
      <main className="content">
        {sessions.length === 0 && (
          <div className="banner info">Una sesión es un día de evaluación. Agregas a los niños (de una o varias carpetas) y grabas sus pruebas.</div>
        )}
        {sessions.map((s) => <SessionCard key={s.id} s={s} />)}
      </main>
      <div className="footer">
        <button className="btn primary" onClick={() => nav(`/sesion/${createSession()}`)}>+ Nueva sesión</button>
      </div>
    </>
  )
}

// ---------------- Detalle de una sesión ----------------
export function SessionView() {
  const { id = '' } = useParams()
  const { sessions, kids, folders } = useStore()
  const nav = useNavigate()
  const s = sessions.find((x) => x.id === id)
  const clips = useSessionClips(id)
  const storage = useStorageInfo()
  const [sheet, setSheet] = useState<null | 'folders' | { folderId: string | null } | 'delete'>(null)
  const [picked, setPicked] = useState<string[]>([])

  if (!s) return (<><Top title="Sesión" back="/sesiones" /><main className="content"><div className="empty">Esta sesión ya no existe.</div></main></>)

  const sessionKids = s.kidIds.map((kid) => kids.find((k) => k.id === kid)).filter(Boolean) as typeof kids
  const setMode = (mode: SessionMode) => updateSession(s.id, { mode })
  const removeKid = (kidId: string) => updateSession(s.id, { kidIds: s.kidIds.filter((x) => x !== kidId), absent: s.absent.filter((x) => x !== kidId) })
  const folderKids = (fid: string | null) => kids.filter((k) => (fid === null ? !k.folderId : k.folderId === fid))
  const addPicked = () => { updateSession(s.id, { kidIds: [...s.kidIds, ...picked.filter((p) => !s.kidIds.includes(p))] }); setPicked([]); setSheet(null) }

  return (
    <>
      <Top title={sessionTitle(s, kids, folders)} sub={sessionKids.length ? `${dateText(s.date)} · ${plural(sessionKids.length)} · ${okCount(clips)} de ${sessionKids.length * CLIPS_PER_KID} videos` : `${dateText(s.date)} · Agrega a los niños`}
        back="/sesiones" right={<button className="icon-btn" aria-label="Opciones de la sesión" onClick={() => setSheet('delete')}>{Icon.trash}</button>} />
      <main className="content">
        <div className="field">
          <label htmlFor="sdate">Fecha del test</label>
          <input id="sdate" className="input" type="date" value={s.date} onChange={(e) => e.target.value && updateSession(s.id, { date: e.target.value })} />
        </div>
        <div className="field">
          <span className="label">¿Cómo vas a grabar?</span>
          <div className="seg c2">
            <button className={s.mode === 'grupal' ? 'on' : ''} aria-pressed={s.mode === 'grupal'} onClick={() => setMode('grupal')}>Grupal · por estaciones</button>
            <button className={s.mode === 'individual' ? 'on' : ''} aria-pressed={s.mode === 'individual'} onClick={() => setMode('individual')}>Individual · por niño</button>
          </div>
          <span className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>
            {s.mode === 'grupal' ? 'Grabas una prueba con todos los niños y luego pasas a la siguiente.' : 'Grabas las 12 pruebas de un niño y luego pasas al siguiente.'}
          </span>
        </div>

        {sessionKids.length > 0 && clips && okCount(clips) >= sessionKids.length * CLIPS_PER_KID && (
          <div className="banner ok"><strong>Grabación completa.</strong> Todos los videos están en este celular. El siguiente paso es puntuarlos.</div>
        )}
        <div className="section-title">Niños en esta sesión</div>
        {sessionKids.map((k) => {
          const done = okCount(clips, k.id)
          const folder = folders.find((f) => f.id === k.folderId)?.name ?? 'Sin carpeta'
          const warn = !k.birthDate ? 'Falta la fecha de nacimiento' : !k.sex ? 'Falta el sexo' : tooSoonWarning(sessions, k.id, s)
          return (
            <div key={k.id} className={`card${warn ? ' warn' : ''}`} style={{ padding: '10px 4px 10px 14px', minHeight: 60 }}>
              <span className="grow">
                <span className="title" style={{ fontSize: 16 }}>{k.name}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="tag-info" style={{ padding: '3px 8px' }}>{folder}</span>
                  <span className="meta">{done} de {CLIPS_PER_KID} videos{s.absent.includes(k.id) ? ' · Ausente' : ''}</span>
                </span>
                {warn ? <span className="tag-warn">{warn}</span> : <span className="meta">{ageText(k.birthDate)}</span>}
              </span>
              <button className="icon-btn light" style={{ background: 'transparent' }} aria-label={`Quitar a ${k.name} de la sesión`} onClick={() => removeKid(k.id)}>✕</button>
            </div>
          )
        })}
        <div className="seg c2">
          <button onClick={() => setSheet('folders')} style={{ color: 'var(--blue)', borderColor: 'var(--blue)', fontWeight: 900 }}>+ De una carpeta</button>
          <button onClick={() => nav(`/nino/nuevo?sesion=${s.id}`)} style={{ color: 'var(--blue)', borderColor: 'var(--blue)', fontWeight: 900 }}>+ Niño nuevo</button>
        </div>
        {storage && (
          <div className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>
            Espacio usado por la app: {storage.usedMB} MB · libre aprox.: {(storage.freeMB / 1000).toFixed(1)} GB
          </div>
        )}
      </main>
      <div className="footer">
        <div className="seg c3" style={{ gap: 8 }}>
          <button className="btn" style={{ background: '#D7263D', color: '#fff', border: 'none', fontSize: 15 }} disabled={!sessionKids.length} onClick={() => nav(`/sesion/${s.id}/grabar`)}>● Grabar</button>
          <button className="btn primary" style={{ border: 'none', fontSize: 15 }} disabled={!sessionKids.length} onClick={() => nav(`/sesion/${s.id}/puntuar`)}>✓ Puntuar</button>
          <button className="btn" style={{ background: '#0B7A61', color: '#fff', border: 'none', fontSize: 15 }} disabled={!sessionKids.length} onClick={() => nav(`/sesion/${s.id}/resultados`)}>Resultados</button>
        </div>
      </div>

      {sheet === 'folders' && (
        <Sheet title="Agregar desde una carpeta" onClose={() => setSheet(null)}>
          {folders.map((f) => (
            <button key={f.id} className="btn soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => { setPicked([]); setSheet({ folderId: f.id }) }}>
              <span>{f.name}</span><span className="meta" style={{ color: 'var(--muted)', fontSize: 13 }}>{plural(folderKids(f.id).length)}</span>
            </button>
          ))}
          <button className="btn soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => { setPicked([]); setSheet({ folderId: null }) }}>
            <span>Sin carpeta</span><span className="meta" style={{ color: 'var(--muted)', fontSize: 13 }}>{plural(folderKids(null).length)}</span>
          </button>
        </Sheet>
      )}
      {sheet && typeof sheet === 'object' && (
        <Sheet title={sheet.folderId ? folders.find((f) => f.id === sheet.folderId)?.name ?? '' : 'Sin carpeta'} onClose={() => setSheet(null)}>
          {folderKids(sheet.folderId).length === 0 && <p>Esta carpeta está vacía.</p>}
          {folderKids(sheet.folderId).map((k) => {
            const inS = s.kidIds.includes(k.id)
            const sel = picked.includes(k.id)
            return (
              <button key={k.id} disabled={inS} aria-pressed={sel}
                onClick={() => setPicked(sel ? picked.filter((x) => x !== k.id) : [...picked, k.id])}
                style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, borderRadius: 12, padding: '0 12px', fontSize: 16, fontWeight: 700, textAlign: 'left',
                  border: sel ? '2px solid var(--blue)' : '1.5px solid var(--line)', background: sel ? 'var(--blue-soft)' : '#fff', opacity: inS ? 0.55 : 1 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15,
                  ...(inS || sel ? { background: 'var(--blue)', color: '#fff' } : { border: '2px solid #9AAAB8' }) }}>{inS || sel ? '✓' : ''}</span>
                <span style={{ flex: 1 }}>{k.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{inS ? 'Ya está en la sesión' : ''}</span>
              </button>
            )
          })}
          <button className="btn primary" disabled={!picked.length} onClick={addPicked}>{picked.length ? `Agregar ${picked.length} a la sesión` : 'Elige uno o más niños'}</button>
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet title="¿Eliminar esta sesión?" onClose={() => setSheet(null)}>
          <p>Se borran también sus {okCount(clips)} videos de este celular. Los niños no se borran.</p>
          <button className="btn danger" onClick={async () => { await deleteSessionClips(s.id); deleteSession(s.id); nav('/sesiones') }}>Sí, eliminar sesión y videos</button>
        </Sheet>
      )}
    </>
  )
}
