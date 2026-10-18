// Registro visual (página 3 del informe): fotos por fase con el muñeco de palitos encima.
// Todo vive solo en este celular. En otro dispositivo (la compu) el informe sale con 2 páginas.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from './store'
import { SKILLS, skillById, type Skill } from './skills'
import { Top } from './ui'
import { dateText } from './sessions'
import { JOINTS, Figure, COLORS, FIGURE_OPACITY, lastColor, rememberColor, type FigureColor, VISUAL_SKILLS, dragJoint, stretchJoint, normalizePose, phaseName, phasesOf, startPose, transformPose, type Joint, type Pose } from './pose'
import { deletePhoto, getPhoto, photoId, saveNote, updatePhoto, useBlobUrl, useKidVisual, type KidVisual, type Photo, type SkillNote } from './photos'

export const MAX_VISUAL_SKILLS = 4

/** Foto con su muñeco, ajustada (sin recortar) a una caja de ancho × alto. */
export function PhotoView({ photo, width, height, pose, bg = '#0F1720' }: { photo: Photo; width: number | string; height: number | string; pose?: Pose | null; bg?: string }) {
  const url = useBlobUrl(photo.blob)
  const H = (1000 * photo.h) / photo.w
  const p = pose === undefined ? photo.pose : pose
  return (
    <svg width={width} height={height} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', background: bg }} role="img" aria-label={phaseName(photo.skillId, photo.phase)}>
      {url && <image href={url} x={0} y={0} width={1000} height={H} />}
      {p && <Figure pose={p} color={photo.color} />}
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
          Saca cada foto desde el reproductor de la prueba (botón de cámara) y elige la fase. Luego toca la foto para acomodar el muñeco. Las fotos quedan solo en este celular.
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
                <Link to={`/sesion/${sessionId}/registro/${kidId}/${skill.id}/${ph.id}`} aria-label={`Acomodar muñeco: ${ph.name}`} style={{ borderRadius: 8, overflow: 'hidden', display: 'block', position: 'relative' }}>
                  <PhotoView photo={p} width="100%" height={92} />
                  {p.pose === undefined && <span style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 11, fontWeight: 900, background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 5px' }}>Sin muñeco aún</span>}
                </Link>
              ) : (
                <Link to={`/sesion/${sessionId}/puntuar/${kidId}/${skill.id}`} aria-label={`Sacar foto: ${ph.name}`}
                  style={{ height: 92, borderRadius: 8, border: '1.5px dashed #CBD5DF', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center', padding: 4 }}>
                  Sacar foto
                </Link>
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

// ---------------- Pantalla: acomodar el muñeco sobre la foto ----------------
export function PoseEditor() {
  const { id = '', kidId = '', skillId = '', phase = '' } = useParams()
  const nav = useNavigate()
  const { kids } = useStore()
  const kid = kids.find((k) => k.id === kidId)
  const skill = skillById(skillId)
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined)
  const [pose, setPose] = useState<Pose | null>(null)
  const [active, setActive] = useState<Joint | null>(null)
  const [color, setColor] = useState<FigureColor>('dorado')
  const svgRef = useRef<SVGSVGElement>(null)
  const [stretching, setStretching] = useState(false)
  const [moveAll, setMoveAll] = useState(false) // "Mover todo": arrastrar en cualquier parte mueve el muñeco entero
  // Gestos: un dedo sobre un punto = girar ese tramo; mantener pulsado = estirarlo; dos dedos = agrandar o achicar.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'joint'; j: Joint; stretch: boolean; x0: number; y0: number }
    | { kind: 'pinch'; d0: number; base: Pose }
    | { kind: 'move'; from: [number, number]; base: Pose }
    | null
  >(null)
  const holdTimer = useRef<number | undefined>(undefined)
  const clearHold = () => { if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = undefined } }
  useEffect(() => clearHold, [])
  const back = `/sesion/${id}/registro/${kidId}`

  useEffect(() => {
    let alive = true
    getPhoto(photoId(id, kidId, skillId, phase)).then((p) => {
      if (!alive) return
      setPhoto(p ?? null)
      if (!p) return
      if (p.pose === undefined) {
        // El muñeco empieza mirando a la derecha; si el niño va hacia el otro lado se usa "Voltear".
        const start = startPose(skillId, phase, p.w, p.h)
        const c = p.color ?? lastColor()
        setPose(start); setColor(c)
        updatePhoto(p.id, { pose: start, color: c })
      } else { setPose(p.pose ? normalizePose(p.pose) : null); setColor(p.color ?? 'dorado') }
    }).catch(() => { if (alive) setPhoto(null) })
    return () => { alive = false }
  }, [id, kidId, skillId, phase])

  const H = photo ? (1000 * photo.h) / photo.w : 1000
  const save = (p: Pose | null) => { setPose(p); if (photo) updatePhoto(photo.id, { pose: p }) }
  const pickColor = (c: FigureColor) => { setColor(c); rememberColor(c); if (photo) updatePhoto(photo.id, { color: c }) }
  const toSvg = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const el = svgRef.current, m = el?.getScreenCTM()
    if (!el || !m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [pt.x, pt.y]
  }
  const spread = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1 }
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pose) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {
      // Segundo dedo: se pasa a pellizcar (se deja de mover el punto).
      clearHold()
      gesture.current = { kind: 'pinch', d0: spread(), base: pose }
      setActive(null); setStretching(false)
      return
    }
    const p = toSvg(e), m = svgRef.current?.getScreenCTM()
    if (!p || !m) return
    if (moveAll) { gesture.current = { kind: 'move', from: p, base: pose }; setActive('hip'); return }
    const reach = 30 / m.a // ~30 px de pantalla para tocar una articulación
    let best: Joint | null = null, bd = Infinity
    for (const j of JOINTS) {
      const d = Math.hypot(pose[j][0] - p[0], pose[j][1] - p[1])
      // Entre puntos muy cercanos se prefiere la punta del miembro (mano, pie) antes que la cadera.
      const bias = j === 'hip' ? 1.15 : 1
      if (d * bias < bd) { bd = d * bias; best = j }
    }
    if (!best || bd > reach) return
    gesture.current = { kind: 'joint', j: best, stretch: false, x0: e.clientX, y0: e.clientY }
    setActive(best)
    if (best !== 'hip') {
      holdTimer.current = window.setTimeout(() => {
        const g = gesture.current
        if (g?.kind === 'joint') { g.stretch = true; setStretching(true); try { navigator.vibrate?.(30) } catch { /* sin vibración */ } }
      }, 450)
    }
  }
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g || !pose) return
    if (g.kind === 'pinch') {
      if (pointers.current.size >= 2) setPose(transformPose(g.base, { scale: spread() / g.d0 }))
      return
    }
    if (g.kind === 'move') {
      const p = toSvg(e)
      if (p) setPose(dragJoint(g.base, 'hip', [g.base.hip[0] + p[0] - g.from[0], g.base.hip[1] + p[1] - g.from[1]]))
      return
    }
    // Si el dedo se movió antes de cumplir el tiempo, es un arrastre normal (sin estirar).
    if (!g.stretch && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) clearHold()
    const p = toSvg(e)
    if (!p) return
    setPose(g.stretch ? stretchJoint(pose, g.j, p) : dragJoint(pose, g.j, p))
  }
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    clearHold()
    if (gesture.current && pose) save(pose)
    // Al soltar un dedo del pellizco no se sigue moviendo nada hasta volver a tocar.
    gesture.current = null
    setActive(null); setStretching(false)
  }

  if (photo === undefined) return <div className="empty">Cargando…</div>
  if (!photo || !skill) return (<><Top title="Muñeco" back={back} /><main className="content"><div className="empty">Esta foto ya no está en este celular.</div></main></>)

  const tool: CSSProperties = { height: 46, minWidth: 46, padding: '0 10px', borderRadius: 10, border: '1.5px solid #CBD5DF', background: '#fff', color: '#1B2733', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }
  const op = (o: Parameters<typeof transformPose>[1]) => { if (pose) save(transformPose(pose, o)) }

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
          style={{ width: '100%', maxHeight: '62vh', touchAction: 'none', display: 'block' }} role="img" aria-label="Foto con el muñeco">
          <PhotoImage photo={photo} H={H} />
          {pose && <Figure pose={pose} active={active} stretching={stretching} editing color={color} />}
        </svg>
      </div>

      <div style={{ background: '#fff', padding: '10px 10px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pose ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              {moveAll ? 'Mover todo activado: arrastra en cualquier parte de la foto para mover el muñeco entero. Toca el botón otra vez para volver a mover puntos.' : 'Arrastra un punto para girar ese tramo; mantenlo pulsado (vibra) y arrastra para estirarlo o acortarlo. Pellizca con dos dedos para agrandar o achicar. La cadera mueve todo el muñeco.'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button style={tool} aria-label="Achicar" onClick={() => op({ scale: 1 / 1.08 })}>−</button>
              <button style={tool} aria-label="Agrandar" onClick={() => op({ scale: 1.08 })}>+</button>
              <button style={tool} aria-label="Girar a la izquierda" onClick={() => op({ rotate: -5 })}>⟲</button>
              <button style={tool} aria-label="Girar a la derecha" onClick={() => op({ rotate: 5 })}>⟳</button>
              <button style={tool} onClick={() => op({ flip: true })}>⇋ Voltear</button>
              <button style={{ ...tool, ...(moveAll ? { border: '2px solid #0A6FA8', background: '#E6F1F8', color: '#075A88' } : {}) }} aria-pressed={moveAll} onClick={() => setMoveAll(!moveAll)}>✥ Mover todo</button>
            </div>
            <div role="radiogroup" aria-label="Color del muñeco" style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(COLORS) as FigureColor[]).map((c) => (
                <button key={c} role="radio" aria-checked={color === c} onClick={() => pickColor(c)}
                  style={{ ...tool, flex: 1, ...(color === c ? { border: '2px solid #0A6FA8', background: '#E6F1F8' } : {}) }}>
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 9, background: COLORS[c].near, flex: 'none' }} />
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                    {COLORS[c].label}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{COLORS[c].hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...tool, flex: 1 }} onClick={() => {
                const faceLeft = pose.toeN[0] < pose.ankleN[0]
                const start = startPose(skillId, phase, photo.w, photo.h, faceLeft)
                // Conserva el lugar y el tamaño actuales del muñeco.
                const k = Math.hypot(pose.hip[0] - pose.kneeN[0], pose.hip[1] - pose.kneeN[1]) / (Math.hypot(start.hip[0] - start.kneeN[0], start.hip[1] - start.kneeN[1]) || 1)
                const moved = transformPose(start, { scale: k })
                save(dragJoint(moved, 'hip', pose.hip))
              }}>Postura de referencia</button>
              <button style={{ ...tool, flex: 1 }} onClick={() => save(null)}>Quitar muñeco</button>
            </div>
          </>
        ) : (
          <button style={{ ...tool, width: '100%' }} onClick={() => save(startPose(skillId, phase, photo.w, photo.h))}>Poner muñeco</button>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, height: 3, borderRadius: 2, background: COLORS[color].near, opacity: FIGURE_OPACITY }} />Lado cercano</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 16, height: 3, borderRadius: 2, background: COLORS[color].far, opacity: FIGURE_OPACITY }} />Lado lejano</span>
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
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>Fotos tomadas durante la evaluación, fase por fase. La figura superpuesta muestra la postura de referencia de cada fase.</span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
          {[...new Set(rows.flatMap((r) => r.photos.filter((p) => p.pose).map((p) => p.color ?? 'dorado')))].map((c) => (
            <svg key={c} width="22" height="10" aria-hidden="true"><line x1="2" y1="5" x2="20" y2="5" stroke={COLORS[c].near} strokeOpacity={FIGURE_OPACITY} strokeWidth="3" strokeLinecap="round" /></svg>
          ))}
          Postura de referencia
        </span>
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
