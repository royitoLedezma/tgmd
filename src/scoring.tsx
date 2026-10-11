import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore, setMarks, scoreId, type Mark, type Score } from './store'
import { getClipBlob, clipKey, useSessionClips } from './clips'
import { SKILLS, MARKS_PER_KID, skillById, maxScore, type Skill } from './skills'
import { Icon, Top } from './ui'
import { dateText } from './sessions'
import { safeName } from './excel'

const markKey = (skillId: string, i: number) => `${skillId}:${i}`
const EMPTY: [Mark, Mark] = [null, null]

/** Cuántas marcas hay hechas y cuántos puntos suma una prueba (o todas). */
export function progress(score: Score | undefined, skills: Skill[] = SKILLS) {
  let marked = 0, total = 0, points = 0
  for (const sk of skills) sk.criteria.forEach((_, i) => {
    const v = score?.marks[markKey(sk.id, i)] ?? EMPTY
    v.forEach((x) => { total++; if (x !== null) marked++; if (x === 1) points++ })
  })
  return { marked, total, points }
}

// ---------------- Lista de niños para puntuar ----------------
export function ScoreKids() {
  const { id = '' } = useParams()
  const { sessions, kids, scores } = useStore()
  const s = sessions.find((x) => x.id === id)
  if (!s) return (<><Top title="Puntuar" back="/sesiones" /><main className="content"><div className="empty">Esta sesión ya no existe.</div></main></>)
  const sessionKids = s.kidIds.map((k) => kids.find((x) => x.id === k)).filter(Boolean) as typeof kids
  return (
    <>
      <Top title="Puntuar" sub={dateText(s.date)} back={`/sesion/${s.id}`} />
      <main className="content">
        <div className="banner info">Elige un niño. Verás sus videos en cámara lenta y marcarás cada criterio con ✓ o ✗.</div>
        {sessionKids.map((k) => {
          const sc = scores.find((x) => x.id === scoreId(s.id, k.id))
          const p = progress(sc)
          const firstPending = SKILLS.find((sk) => progress(sc, [sk]).marked < progress(sc, [sk]).total) ?? SKILLS[0]
          const complete = p.marked === MARKS_PER_KID
          return (
            <Link key={k.id} to={`/sesion/${s.id}/puntuar/${k.id}/${firstPending.id}`} className={`card${complete ? '' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="grow">
                <span className="title">{k.name}</span>
                <span className="meta">{complete ? 'Puntuación completa' : `${p.marked} de ${MARKS_PER_KID} marcas`}</span>
                <span style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((p.marked / MARKS_PER_KID) * 100)}%`, background: complete ? 'var(--green)' : 'var(--blue)' }} />
                </span>
              </span>
              {complete ? <span style={{ color: 'var(--green)', fontWeight: 900 }}>✓</span> : Icon.chevron}
            </Link>
          )
        })}
      </main>
    </>
  )
}

// ---------------- Reproductor con cámara lenta, cuadro a cuadro y zoom ----------------
const FRAME = 1 / 30
function Player({ blobKey, photoName }: { blobKey: string; photoName: string }) {
  const [toast, setToast] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [speed, setSpeed] = useState(0.5)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const vref = useRef<HTMLVideoElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)

  useEffect(() => {
    let u: string | null = null
    setUrl(null); setMissing(false); setPlaying(false); setTime(0); setZoom(1); setPan({ x: 0, y: 0 })
    getClipBlob(blobKey).then((b) => {
      if (b) { u = URL.createObjectURL(b); setUrl(u) } else setMissing(true)
    }).catch(() => setMissing(true))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [blobKey])

  useEffect(() => { if (vref.current) vref.current.playbackRate = speed }, [speed, url])

  const v = () => vref.current
  // Foto del cuadro actual: se descarga como imagen (aparece en la Galería, álbum Descargas).
  const snap = () => {
    const el = v()
    if (!el || !el.videoWidth) return
    el.pause()
    // Recorta exactamente lo que se ve en pantalla (zoom + desplazamiento).
    const W = el.clientWidth, H = el.clientHeight, vw = el.videoWidth, vh = el.videoHeight
    const s0 = Math.min(W / vw, H / vh)
    const ox = (W - vw * s0) / 2, oy = (H - vh * s0) / 2
    const toVideo = (sx: number, sy: number) => {
      const ex = W / 2 + (sx - W / 2 - pan.x) / zoom, ey = H / 2 + (sy - H / 2 - pan.y) / zoom
      return [Math.min(vw, Math.max(0, (ex - ox) / s0)), Math.min(vh, Math.max(0, (ey - oy) / s0))]
    }
    const [x0, y0] = toVideo(0, 0), [x1, y1] = toVideo(W, H)
    const cw = Math.max(1, Math.round(x1 - x0)), ch = Math.max(1, Math.round(y1 - y0))
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    c.getContext('2d')?.drawImage(el, x0, y0, x1 - x0, y1 - y0, 0, 0, cw, ch)
    c.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `${photoName}_${el.currentTime.toFixed(2).replace('.', 's')}.jpg`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      setToast(zoom > 1 ? 'Foto recortada guardada (Galería › Descargas)' : 'Foto guardada (Galería › Descargas)')
      setTimeout(() => setToast(''), 2500)
    }, 'image/jpeg', 0.92)
  }
  const toggle = () => { const el = v(); if (!el) return; if (el.paused) { el.playbackRate = speed; el.play() } else el.pause() }
  const step = (dir: 1 | -1) => { const el = v(); if (!el) return; el.pause(); el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + dir * FRAME)) }
  const clampPan = (p: { x: number; y: number }, z: number) => {
    const lim = (z - 1) * 160
    return { x: Math.max(-lim, Math.min(lim, p.x)), y: Math.max(-lim, Math.min(lim, p.y)) }
  }
  const setZ = (z: number) => { const nz = Math.max(1, Math.min(4, z)); setZoom(nz); setPan((p) => clampPan(p, nz)) }

  const onDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }
    }
  }
  const onMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      setZ(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d))
    } else if (pointers.current.size === 1 && zoom > 1) {
      setPan((p) => clampPan({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }, zoom))
    }
  }
  const onUp = (e: RPointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null }

  const pill = (on: boolean) => ({
    height: 40, padding: '0 12px', borderRadius: 10, fontSize: 14, fontWeight: on ? 900 : 700,
    border: on ? 'none' : '1.5px solid #CBD5DF', background: on ? '#0A6FA8' : '#fff', color: on ? '#fff' : '#1B2733',
  })
  const sq = { width: 44, height: 40, border: '1.5px solid #CBD5DF', background: '#fff', borderRadius: 10, fontSize: 18, fontWeight: 900, color: '#1B2733' } as const

  return (
    <div>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => setZ(zoom > 1 ? 1 : 2)}
        style={{ position: 'relative', background: '#0F1720', height: '38vh', minHeight: 220, overflow: 'hidden', touchAction: 'none' }}>
        {url && (
          <video ref={vref} src={url} playsInline muted preload="auto"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget
              el.playbackRate = speed
              // Los videos WebM grabados en el celular a veces no traen la duración: se fuerza a calcularla.
              if (!isFinite(el.duration)) {
                const fix = () => { el.removeEventListener('timeupdate', fix); el.currentTime = 0; setDur(el.duration) }
                el.addEventListener('timeupdate', fix)
                el.currentTime = 1e6
              } else setDur(el.duration)
            }}
            onDurationChange={(e) => { if (isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration) }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: pointers.current.size ? 'none' : 'transform .15s' }} />
        )}
        {toast && <div role="status" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: 'rgba(11,122,97,.95)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '6px 10px', borderRadius: 8, zIndex: 2 }}>{toast}</div>}
        {missing && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8C4CF', padding: 20, textAlign: 'center', fontSize: 15 }}>No hay video de este intento en este celular (se saltó, no se grabó o se borró para liberar espacio). Igual puedes marcar los criterios.</div>}
        {url && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,.6)', borderRadius: 12, padding: 4 }}>
            <button aria-label="Alejar" onClick={() => setZ(zoom - 0.5)} style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: '#fff', fontSize: 24, fontWeight: 900 }}>−</button>
            <button aria-label="Restablecer zoom" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ minWidth: 48, height: 40, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 14, fontWeight: 900, borderRadius: 8 }}>{zoom.toFixed(1).replace('.0', '')}×</button>
            <button aria-label="Acercar" onClick={() => setZ(zoom + 0.5)} style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: '#fff', fontSize: 24, fontWeight: 900 }}>+</button>
          </div>
        )}
        {url && (
          <button aria-label={playing ? 'Pausa' : 'Reproducir'} onClick={toggle}
            style={{ position: 'absolute', left: 12, bottom: 12, width: 52, height: 52, borderRadius: 26, border: 'none', background: 'rgba(255,255,255,.92)', fontSize: 20, fontWeight: 900, color: '#0F1720' }}>
            {playing ? '❚❚' : '▶'}
          </button>
        )}
      </div>
      {url && (
        <div style={{ background: '#fff', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--line)' }}>
          <input type="range" aria-label="Posición del video" min={0} max={dur || 0} step={FRAME} value={Math.min(time, dur || 0)}
            onChange={(e) => { const el = v(); if (el) { el.pause(); el.currentTime = Number(e.target.value) } }} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0.25, 0.5, 1].map((sp) => <button key={sp} style={pill(speed === sp)} aria-pressed={speed === sp} onClick={() => setSpeed(sp)}>{sp}×</button>)}
            <span style={{ flex: 1 }} />
            <button aria-label="Cuadro anterior" style={sq} onClick={() => step(-1)}>⏮</button>
            <button aria-label="Cuadro siguiente" style={sq} onClick={() => step(1)}>⏭</button>
            <button aria-label="Sacar foto de este cuadro" style={{ ...sq, background: '#0A6FA8', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={snap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- Puntuar una prueba ----------------
export function ScoreSkill() {
  const { id = '', kidId = '', skillId = '' } = useParams()
  const nav = useNavigate()
  const { sessions, kids, scores } = useStore()
  const s = sessions.find((x) => x.id === id)
  const kid = kids.find((k) => k.id === kidId)
  const skill = skillById(skillId)
  const clips = useSessionClips(id)
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => { setAttempt(1); setOpen(null) }, [skillId, kidId])

  if (!s || !kid || !skill) return (<><Top title="Puntuar" back={`/sesion/${id}/puntuar`} /><main className="content"><div className="empty">No se encontró esta prueba.</div></main></>)

  const sc = scores.find((x) => x.id === scoreId(s.id, kid.id))
  const idx = SKILLS.findIndex((x) => x.id === skill.id)
  const kidIdx = s.kidIds.indexOf(kid.id)
  const nextKid = s.kidIds[kidIdx + 1]
  const p = progress(sc, [skill])
  const pendingMarks = p.total - p.marked
  const hasClip = (a: number) => { const c = clips?.get(clipKey(s.id, kid.id, skill.id, a)); return c?.status === 'ok' && !c.deleted }

  const cycle = (v: Mark): Mark => (v === null ? 1 : v === 1 ? 0 : null)
  const toggle = (i: number, a: 0 | 1) => {
    const cur = sc?.marks[markKey(skill.id, i)] ?? EMPTY
    const next: [Mark, Mark] = [...cur] as [Mark, Mark]
    next[a] = cycle(cur[a])
    setMarks(s.id, kid.id, markKey(skill.id, i), next)
  }
  const go = (sk: Skill) => nav(`/sesion/${s.id}/puntuar/${kid.id}/${sk.id}`, { replace: true })
  const next = () => {
    if (idx < SKILLS.length - 1) go(SKILLS[idx + 1])
    else if (nextKid) nav(`/sesion/${s.id}/puntuar/${nextKid}/${SKILLS[0].id}`, { replace: true })
    else nav(`/sesion/${s.id}/puntuar`)
  }

  const markStyle = (v: Mark) => ({
    width: 52, height: 44, borderRadius: 10, fontSize: 20, fontWeight: 900, flexShrink: 0,
    ...(v === 1 ? { border: 'none', background: '#0B7A61', color: '#fff' }
      : v === 0 ? { border: 'none', background: '#C2410C', color: '#fff' }
        : { border: '2px dashed #F59E0B', background: '#FFFBEB', color: '#B45309' }),
  })
  const word = (v: Mark) => (v === 1 ? 'logrado' : v === 0 ? 'no logrado' : 'sin marcar')

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ background: '#fff', padding: 'calc(12px + env(safe-area-inset-top)) 10px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)' }}>
        <button className="icon-btn light" aria-label="Volver a la lista" onClick={() => nav(`/sesion/${s.id}/puntuar`)}>✕</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontSize: 19, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{kid.name} · {skill.name}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{skill.subtest === 'loc' ? 'Locomoción' : 'Control de objetos'} · prueba {idx + 1} de 12</span>
        </div>
        <button className="icon-btn light" aria-label="Prueba anterior" disabled={idx === 0} onClick={() => go(SKILLS[idx - 1])}>{Icon.back}</button>
        <button className="icon-btn light" aria-label="Prueba siguiente" disabled={idx === SKILLS.length - 1} onClick={() => go(SKILLS[idx + 1])}>{Icon.chevron}</button>
      </header>

      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid var(--line)' }}>
        {SKILLS.map((sk, i) => {
          const q = progress(sc, [sk])
          const done = q.marked === q.total
          const on = sk.id === skill.id
          return (
            <button key={sk.id} onClick={() => go(sk)} aria-label={`${sk.name}${done ? ', completa' : ''}`} aria-current={on}
              style={{ minWidth: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 900, flexShrink: 0,
                border: on ? '2px solid #0A6FA8' : 'none', background: done ? '#DDF3EC' : q.marked ? '#FEF3C7' : '#F4F7FA', color: done ? '#075E4A' : q.marked ? '#92400E' : '#5A6B7B' }}>
              {i + 1}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#fff' }}>
        {([1, 2] as const).map((a) => (
          <button key={a} onClick={() => setAttempt(a)} aria-pressed={attempt === a}
            style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 15, fontWeight: attempt === a ? 900 : 700,
              border: attempt === a ? 'none' : '1.5px solid #CBD5DF', background: attempt === a ? '#0A6FA8' : '#fff', color: attempt === a ? '#fff' : '#1B2733' }}>
            Video intento {a}{hasClip(a) ? '' : ' (sin video)'}
          </button>
        ))}
      </div>

      <Player blobKey={clipKey(s.id, kid.id, skill.id, attempt)} photoName={safeName(`${kid.name}_${skill.name}_I${attempt}`)} />

      <main style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted)', paddingRight: 2 }}>
          <span style={{ width: 52, textAlign: 'center' }}>Int. 1</span><span style={{ width: 52, textAlign: 'center' }}>Int. 2</span>
        </div>
        {skill.criteria.map((c, i) => {
          const v = sc?.marks[markKey(skill.id, i)] ?? EMPTY
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '8px 8px 8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--muted)', width: 14 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{c.short}</span>
                <button aria-label="Ver criterio completo" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: 32, height: 44, border: 'none', background: 'none', color: '#0A6FA8', fontSize: 20, fontWeight: 900, padding: 0 }}>ⓘ</button>
                <button aria-label={`Criterio ${i + 1}, intento 1: ${word(v[0])}`} style={markStyle(v[0])} onClick={() => toggle(i, 0)}>{v[0] === 1 ? '✓' : v[0] === 0 ? '✗' : '·'}</button>
                <button aria-label={`Criterio ${i + 1}, intento 2: ${word(v[1])}`} style={markStyle(v[1])} onClick={() => toggle(i, 1)}>{v[1] === 1 ? '✓' : v[1] === 0 ? '✗' : '·'}</button>
              </div>
              {open === i && <div style={{ fontSize: 14, lineHeight: 1.4, color: '#33414E', background: 'var(--blue-soft)', borderRadius: 8, padding: '8px 10px' }}>{c.full}</div>}
            </div>
          )
        })}
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Toca un cuadro: vacío → ✓ (1) → ✗ (0)</div>
      </main>

      <footer style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid var(--line)', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Puntaje {skill.name}</span>
          <span style={{ fontSize: 24, fontWeight: 900 }}>{p.points} <span style={{ fontSize: 15, color: 'var(--muted)' }}>/ {maxScore(skill)}</span></span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, padding: '6px 10px', borderRadius: 8, ...(pendingMarks ? { background: '#FEF3C7', color: '#92400E' } : { background: '#DDF3EC', color: '#075E4A' }) }}>
          {pendingMarks ? `${pendingMarks} sin marcar` : 'Completo'}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={next} style={{ height: 48, padding: '0 16px', borderRadius: 12, border: 'none', background: '#0A6FA8', color: '#fff', fontSize: 15, fontWeight: 900 }}>
          {idx < SKILLS.length - 1 ? 'Siguiente' : nextKid ? 'Siguiente niño' : 'Terminar'}
        </button>
      </footer>
    </div>
  )
}
