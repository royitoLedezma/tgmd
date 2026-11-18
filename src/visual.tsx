// Registro visual (página 3 del informe): fotos por fase con marcas del evaluador (círculos/óvalos y líneas).
// Todo vive solo en este celular. En otro dispositivo (la compu) el informe sale con 2 páginas.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from './store'
import { SKILLS, skillById, type Skill } from './skills'
import { Top } from './ui'
import { dateText } from './sessions'
import { VISUAL_SKILLS, phaseName, phasesOf } from './phases'
import { MARK_COLORS, MARK_WIDTHS, MarkHandles, Marks, dragHandle, handles, hits, lastStyle, moveMark, newEllipse, newLine, pinchMark, rememberStyle, turnMarks, type Handle, type Mark, type MarkColor, type MarkWidth } from './marks'
import { deletePhoto, getPhoto, imageFromFile, photoId, savePhoto, turnImage, type PhotoTurn, saveNote, updatePhoto, useBlobUrl, useKidVisual, type KidVisual, type Photo, type SkillNote } from './photos'

export const MAX_VISUAL_SKILLS = 4

/** Foto con sus marcas, ajustada (sin recortar) a una caja de ancho × alto. */
export function PhotoView({ photo, width, height, bg = '#0F1720' }: { photo: Photo; width: number | string; height: number | string; bg?: string }) {
  const url = useBlobUrl(photo.blob)
  const H = (1000 * photo.h) / photo.w
  return (
    <svg width={width} height={height} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', background: bg }} role="img" aria-label={phaseName(photo.skillId, photo.phase)}>
      {url && <image href={url} x={0} y={0} width={1000} height={H} />}
      <Marks marks={photo.marks} />
    </svg>
  )
}

export interface VisualRow { skill: Skill; comment: string; photos: Photo[] }

/** Habilidades que van a la página 3: incluidas, con al menos una foto, en el orden del test (máx. 4). */
export function visualRows(v: KidVisual | null): VisualRow[] {
  if (!v) return []
  const rows: VisualRow[] = []
  for (const sk of SKILLS) {
    const note = v.notes.get(sk.id)
    if (note && !note.include) continue
    const photos = phasesOf(sk.id).map((ph) => [...v.photos.values()].find((p) => p.skillId === sk.id && p.phase === ph.id)).filter(Boolean) as Photo[]
    if (photos.length) rows.push({ skill: sk, comment: note?.comment ?? '', photos })
  }
  return rows.slice(0, MAX_VISUAL_SKILLS)
}

// ---------------- Pantalla: registro visual de un niño ----------------
export function VisualScreen() {
  const { id = '', kidId = '' } = useParams()
  const { sessions, kids } = useStore()
  const s = sessions.find((x) => x.id === id)
  const kid = kids.find((k) => k.id === kidId)
  const vis = useKidVisual(id, kidId)
  if (!s || !kid) return (<><Top title="Registro visual" back="/sesiones" /><main className="content"><div className="empty">No se encontró este niño en la sesión.</div></main></>)

  const withPhotos = new Set([...(vis?.photos.values() ?? [])].map((p) => p.skillId))
  const shown = SKILLS.filter((sk) => VISUAL_SKILLS.includes(sk.id) || withPhotos.has(sk.id))
  const included = visualRows(vis)
  const candidates = SKILLS.filter((sk) => withPhotos.has(sk.id) && vis?.notes.get(sk.id)?.include !== false).length

  return (
    <>
      <Top title="Registro visual" sub={`${kid.name} · ${dateText(s.date)}`} back={`/sesion/${s.id}/informe/${kid.id}`} />
      <main className="content">
        <div className="banner info">
          Saca cada foto desde el reproductor de la prueba (botón de cámara) y elige la fase. Luego toca la foto para marcar con círculos o líneas. Las fotos quedan solo en este celular.
        </div>
        {candidates > MAX_VISUAL_SKILLS && (
          <div className="banner warn">Hay {candidates} habilidades con fotos y en la página entran {MAX_VISUAL_SKILLS}. Desmarca las que no quieras mostrar; si no, van las 4 primeras.</div>
        )}
        {shown.map((sk) => (
          <SkillCard key={sk.id} sessionId={s.id} kidId={kid.id} skill={sk} vis={vis} note={vis?.notes.get(sk.id)} inReport={included.some((r) => r.skill.id === sk.id)} />
        ))}
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '4px 8px 12px' }}>
          Para otra habilidad, saca una foto desde su prueba y aparecerá aquí.
        </div>
      </main>
    </>
  )
}

const emptyBtn: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-dark)', fontSize: 13, fontWeight: 900, textDecoration: 'none', cursor: 'pointer' }

/** Botón que abre la galería del celular y entrega la imagen ya preparada. */
function PickImage({ onImage, style, aria, children }: { onImage: (img: { blob: Blob; w: number; h: number }) => unknown; style: CSSProperties; aria: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false)
  return (
    <label aria-label={aria} style={{ ...style, opacity: busy ? 0.5 : 1 }}>
      {busy ? 'Cargando…' : children}
      <input type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = '' // permite volver a elegir la misma imagen
        if (!f) return
        setBusy(true)
        try { await onImage(await imageFromFile(f)) } catch { window.alert('No se pudo abrir esa imagen.') } finally { setBusy(false) }
      }} />
    </label>
  )
}

function SkillCard({ sessionId, kidId, skill, vis, note, inReport }: { sessionId: string; kidId: string; skill: Skill; vis: KidVisual | null; note?: SkillNote; inReport: boolean }) {
  const [comment, setComment] = useState(note?.comment ?? '')
  useEffect(() => { setComment(note?.comment ?? '') }, [note?.comment])
  const phases = phasesOf(skill.id)
  const has = phases.some((ph) => vis?.photos.has(photoId(sessionId, kidId, skill.id, ph.id)))
  const include = note?.include ?? true
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 900 }}>{skill.name}</span>
        {has && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: include ? 'var(--blue-dark)' : 'var(--muted)' }}>
            <input type="checkbox" checked={include} onChange={(e) => saveNote(sessionId, kidId, skill.id, { include: e.target.checked })} style={{ width: 22, height: 22 }} />
            {inReport ? 'En el informe' : include ? 'En el informe (no entra)' : 'No va'}
          </label>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`, gap: 6 }}>
        {phases.map((ph) => {
          const p = vis?.photos.get(photoId(sessionId, kidId, skill.id, ph.id))
          return (
            <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {p ? (
                <Link to={`/sesion/${sessionId}/registro/${kidId}/${skill.id}/${ph.id}`} aria-label={`Marcar foto: ${ph.name}`} style={{ borderRadius: 8, overflow: 'hidden', display: 'block', position: 'relative' }}>
                  <PhotoView photo={p} width="100%" height={92} />
                </Link>
              ) : (
                <div style={{ height: 92, borderRadius: 8, border: '1.5px dashed #CBD5DF', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Link to={`/sesion/${sessionId}/puntuar/${kidId}/${skill.id}`} aria-label={`Sacar foto del video: ${ph.name}`} style={emptyBtn}>Del video</Link>
                  <span style={{ height: 1, background: '#CBD5DF', margin: '0 6px' }} />
                  <PickImage aria={`Subir foto del celular: ${ph.name}`} style={emptyBtn}
                    onImage={(img) => savePhoto({ sessionId, kidId, skillId: skill.id, phase: ph.id, ...img })}>Subir</PickImage>
                </div>
              )}
              <span style={{ fontSize: 12, lineHeight: 1.2, color: 'var(--muted)', textAlign: 'center' }}>{ph.name}</span>
            </div>
          )
        })}
      </div>
      {has && (
        <input aria-label={`Comentario de ${skill.name}`} value={comment} maxLength={140} placeholder="Comentario breve (opcional)"
          onChange={(e) => setComment(e.target.value)} onBlur={() => { if (comment !== (note?.comment ?? '')) saveNote(sessionId, kidId, skill.id, { comment }) }}
          style={{ height: 44, borderRadius: 10, border: '1.5px solid #CBD5DF', padding: '0 12px', fontSize: 15, fontFamily: 'inherit' }} />
      )}
    </div>
  )
}

// ---------------- Pantalla: marcar la foto con círculos/óvalos y líneas ----------------
export function MarkEditor() {
  const { id = '', kidId = '', skillId = '', phase = '' } = useParams()
  const nav = useNavigate()
  const { kids } = useStore()
  const kid = kids.find((k) => k.id === kidId)
  const skill = skillById(skillId)
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined)
  const [marks, setMarks] = useState<Mark[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [style, setStyle] = useState(lastStyle)
  const svgRef = useRef<SVGSVGElement>(null)
  const [u, setU] = useState(2) // unidades de foto por píxel de pantalla (para el tamaño de los agarres)
  // Gestos: un dedo sobre una marca la mueve; sobre un agarre la estira, la redirige o la gira; dos dedos la agrandan y la giran.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'handle'; id: string; h: Handle }
    | { kind: 'move'; id: string; last: [number, number] }
    | { kind: 'pinch'; id: string; base: Mark; d0: number; a0: number }
    | null
  >(null)
  const back = `/sesion/${id}/registro/${kidId}`

  useEffect(() => {
    let alive = true
    getPhoto(photoId(id, kidId, skillId, phase)).then((p) => {
      if (!alive) return
      setPhoto(p ?? null)
      setMarks(p?.marks ?? [])
    }).catch(() => { if (alive) setPhoto(null) })
    return () => { alive = false }
  }, [id, kidId, skillId, phase])

  const H = photo ? (1000 * photo.h) / photo.w : 1000
  const save = (ms: Mark[]) => { setMarks(ms); if (photo) updatePhoto(photo.id, { marks: ms }) }
  const selected = marks.find((m) => m.id === sel) ?? null
  const rotGap = 34 * u

  const toSvg = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [pt.x, pt.y]
  }
  const twoFingers = () => {
    const [a, b] = [...pointers.current.values()]
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
  }
  const replace = (m: Mark) => setMarks((ms) => ms.map((x) => (x.id === m.id ? m : x)))

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const m = svgRef.current?.getScreenCTM()
    const uu = m ? 1 / m.a : u
    if (uu !== u) setU(uu)
    if (pointers.current.size >= 2) {
      if (selected) { const t = twoFingers(); gesture.current = { kind: 'pinch', id: selected.id, base: selected, d0: t.d, a0: t.a } }
      return
    }
    const p = toSvg(e)
    if (!p) return
    if (selected) {
      const h = handles(selected, 34 * uu).find((x) => Math.hypot(x.p[0] - p[0], x.p[1] - p[1]) <= 24 * uu)
      if (h) { gesture.current = { kind: 'handle', id: selected.id, h: h.h }; return }
    }
    // La marca de más arriba (la última) tiene prioridad.
    const hit = [...marks].reverse().find((mk) => hits(mk, p, 18 * uu))
    if (hit) { setSel(hit.id); gesture.current = { kind: 'move', id: hit.id, last: p } }
    else { setSel(null); gesture.current = null }
  }
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    const cur = marks.find((x) => x.id === g.id)
    if (!cur) return
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return
      const t = twoFingers()
      replace(pinchMark(g.base, t.d / g.d0, t.a - g.a0))
      return
    }
    const p = toSvg(e)
    if (!p) return
    if (g.kind === 'handle') replace(dragHandle(cur, g.h, p))
    else { replace(moveMark(cur, p[0] - g.last[0], p[1] - g.last[1])); g.last = p }
  }
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (gesture.current) save(marks)
    gesture.current = null
  }

  const [turning, setTurning] = useState(false)
  const turn = async (op: PhotoTurn) => {
    if (!photo || turning) return
    setTurning(true)
    try {
      const img = await turnImage(photo.blob, op)
      const ms = turnMarks(marks, op, H)
      await savePhoto({ sessionId: id, kidId, skillId, phase, ...img, marks: ms })
      const p = await getPhoto(photo.id)
      setPhoto(p ?? null); setMarks(p?.marks ?? [])
    } catch { window.alert('No se pudo girar la foto.') } finally { setTurning(false) }
  }

  const add = (kind: 'ellipse' | 'line') => {
    const m = kind === 'ellipse' ? newEllipse(H, style) : newLine(H, style)
    save([...marks, m]); setSel(m.id)
  }
  const pick = (patch: { color?: MarkColor; width?: MarkWidth }) => {
    const next = { ...style, ...patch }
    setStyle(next); rememberStyle(next)
    if (selected) save(marks.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)))
  }

  if (photo === undefined) return <div className="empty">Cargando…</div>
  if (!photo || !skill) return (<><Top title="Marcar foto" back={back} /><main className="content"><div className="empty">Esta foto ya no está en este celular.</div></main></>)

  const tool: CSSProperties = { height: 46, minWidth: 46, padding: '0 10px', borderRadius: 10, border: '1.5px solid #CBD5DF', background: '#fff', color: '#1B2733', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
  const on: CSSProperties = { border: '2px solid #0A6FA8', background: '#E6F1F8' }
  const label: CSSProperties = { fontSize: 12, fontWeight: 900, color: 'var(--muted)', width: 52, flex: 'none' }
  const cur = selected ? { color: selected.color, width: selected.width } : style
  const hex = MARK_COLORS[cur.color].hex

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: '#0F1720' }}>
      <header style={{ background: '#fff', padding: 'calc(12px + env(safe-area-inset-top)) 10px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="icon-btn light" aria-label="Volver al registro visual" onClick={() => nav(back)}>✕</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{skill.name} · {phaseName(skillId, phase)}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{kid?.name}</span>
        </div>
        <button className="icon-btn light" aria-label="Listo" onClick={() => nav(back)} style={{ width: 'auto', padding: '0 12px', fontWeight: 900 }}>Listo</button>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, minHeight: 0 }}>
        <svg ref={svgRef} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="xMidYMid meet"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ width: '100%', maxHeight: '58vh', touchAction: 'none', display: 'block', overflow: 'visible' }} role="img" aria-label="Foto con marcas">
          <PhotoImage photo={photo} H={H} />
          <Marks marks={marks} />
          {selected && <MarkHandles m={selected} u={u} rotGap={rotGap} />}
        </svg>
      </div>

      <div style={{ background: '#fff', padding: '10px 10px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', minHeight: 34 }}>
          {!selected ? (marks.length ? 'Toca una marca para elegirla, o agrega otra.' : 'Agrega un círculo o una línea.')
            : selected.type === 'ellipse' ? 'Arrastra el óvalo para moverlo. Los puntos de la derecha y de abajo lo deforman; el de arriba lo gira. Con dos dedos lo agrandas.'
              : 'Arrastra la línea para moverla. Arrastra un extremo para alargarla o cambiar su dirección.'}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={label}>Foto</span>
          <button style={{ ...tool, flex: 1, opacity: turning ? 0.5 : 1 }} disabled={turning} aria-label="Girar la foto a la izquierda" onClick={() => turn('izq')}>⟲ Girar</button>
          <button style={{ ...tool, flex: 1, opacity: turning ? 0.5 : 1 }} disabled={turning} aria-label="Girar la foto a la derecha" onClick={() => turn('der')}>Girar ⟳</button>
          <button style={{ ...tool, flex: 1, opacity: turning ? 0.5 : 1 }} disabled={turning} aria-label="Voltear la foto como espejo" onClick={() => turn('espejo')}>⇋ Voltear</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...tool, flex: 1 }} onClick={() => add('ellipse')}>
            <svg width="22" height="16" aria-hidden="true"><ellipse cx="11" cy="8" rx="9" ry="6" fill="none" stroke={hex} strokeWidth="2" /></svg>+ Círculo
          </button>
          <button style={{ ...tool, flex: 1 }} onClick={() => add('line')}>
            <svg width="22" height="16" aria-hidden="true"><line x1="3" y1="13" x2="19" y2="3" stroke={hex} strokeWidth="2.5" strokeLinecap="round" /></svg>+ Línea
          </button>
        </div>
        <div role="radiogroup" aria-label="Color" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={label}>Color</span>
          {(Object.keys(MARK_COLORS) as MarkColor[]).map((c) => (
            <button key={c} role="radio" aria-checked={cur.color === c} onClick={() => pick({ color: c })} style={{ ...tool, flex: 1, ...(cur.color === c ? on : {}) }}>
              <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, background: MARK_COLORS[c].hex }} />{MARK_COLORS[c].label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Grosor" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={label}>Grosor</span>
          {(Object.keys(MARK_WIDTHS) as MarkWidth[]).map((w, i) => (
            <button key={w} role="radio" aria-checked={cur.width === w} onClick={() => pick({ width: w })} style={{ ...tool, flex: 1, ...(cur.width === w ? on : {}) }}>
              <span aria-hidden="true" style={{ width: 18, height: [1.5, 3, 5][i], borderRadius: 3, background: hex }} />{MARK_WIDTHS[w].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {selected && (
            <button onClick={() => { save(marks.filter((m) => m.id !== selected.id)); setSel(null) }}
              style={{ ...tool, color: '#C2410C' }}>Borrar marca</button>
          )}
          <PickImage aria="Reemplazar foto por otra del celular" style={{ ...tool, marginLeft: selected ? 0 : undefined }} onImage={async (img) => {
            const keep = marks.length > 0 && !window.confirm('¿Quitar las marcas de la foto anterior?\n\nAceptar: la foto nueva queda sin marcas.\nCancelar: se conservan las marcas.')
            await savePhoto({ sessionId: id, kidId, skillId, phase, ...img, ...(keep ? { marks } : {}) })
            const p = await getPhoto(photo.id)
            setPhoto(p ?? null); setMarks(p?.marks ?? []); setSel(null)
          }}>Reemplazar foto</PickImage>
          <button onClick={async () => { if (window.confirm('¿Borrar esta foto del registro visual?')) { await deletePhoto(photo.id); nav(back) } }}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#C2410C', fontSize: 13, fontWeight: 900, height: 40 }}>Borrar foto</button>
        </div>
      </div>
    </div>
  )
}

function PhotoImage({ photo, H }: { photo: Photo; H: number }) {
  const url = useBlobUrl(photo.blob)
  return url ? <image href={url} x={0} y={0} width={1000} height={H} /> : null
}

// ---------------- Página 3 del informe ----------------
export const VISUAL_TITLE = 'Registro visual del movimiento'
export function VisualPageBody({ rows, styles }: { rows: VisualRow[]; styles: { INK: string; MUTED: string; HAIR: string; PANEL: string; SERIF: string; eyebrow: CSSProperties } }) {
  const { INK, MUTED, HAIR, PANEL, SERIF, eyebrow } = styles
  const COLS = 4, GAP = 12, W = 696
  const cellW = (W - GAP * (COLS - 1)) / COLS
  const avail = 770
  const rowH = avail / Math.max(rows.length, 2)
  const photoH = Math.min(cellW * 1.25, rowH - 64)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, lineHeight: 1, color: INK }}>{VISUAL_TITLE}</span>
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>Fotos tomadas durante la evaluación, fase por fase, con marcas del evaluador.</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {rows.map((r) => (
          <div key={r.skill.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, borderBottom: `1px solid ${HAIR}`, paddingBottom: 6 }}>
              <span style={{ ...eyebrow, fontWeight: 700, color: INK, flex: 'none' }}>{r.skill.name}</span>
              {r.comment && <span style={{ fontSize: 13, lineHeight: 1.4 }}>{r.comment}</span>}
            </div>
            <div style={{ display: 'flex', gap: GAP }}>
              {r.photos.map((p) => (
                <div key={p.id} style={{ width: cellW, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <PhotoView photo={p} width={cellW} height={photoH} bg={PANEL} />
                  <span style={{ fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 1.3 }}>{phaseName(p.skillId, p.phase)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
