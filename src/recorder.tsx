import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, updateSession, type Session, type Kid } from './store'
import { useSessionClips, saveClip, getClipBlob, clipKey, askPersist, type ClipMeta } from './clips'
import { SKILLS, ATTEMPTS, CLIPS_PER_KID, skillById } from './skills'

interface Slot { kidId: string; skillId: string; attempt: number }
const first = (name: string) => name.split(' ')[0]

/** Orden de grabación según el modo de la sesión. */
function buildOrder(s: Session): Slot[] {
  const out: Slot[] = []
  if (s.mode === 'grupal') {
    for (const sk of SKILLS) for (const kid of s.kidIds) for (const a of ATTEMPTS) out.push({ kidId: kid, skillId: sk.id, attempt: a })
  } else {
    for (const kid of s.kidIds) for (const sk of SKILLS) for (const a of ATTEMPTS) out.push({ kidId: kid, skillId: sk.id, attempt: a })
  }
  return out
}

/** Siguiente video por grabar después de "from" (salta grabados, saltados y ausentes). */
function nextSlot(order: Slot[], s: Session, clips: Map<string, ClipMeta>, from: Slot | null, includeSkipped = false): Slot | null {
  const key = (x: Slot) => clipKey(s.id, x.kidId, x.skillId, x.attempt)
  const start = from ? order.findIndex((x) => key(x) === key(from)) : -1
  for (let i = 1; i <= order.length; i++) {
    const x = order[(start + i + order.length) % order.length]
    if (s.absent.includes(x.kidId)) continue
    const c = clips.get(key(x))
    if (!c || (includeSkipped && c.status === 'pendiente')) return x
  }
  return null
}

/** Siguiente en el orden, aunque ya esté grabado (para seguir en orden después de elegir uno a mano). */
function followingSlot(order: Slot[], s: Session, from: Slot): Slot | null {
  const key = (x: Slot) => `${x.kidId}|${x.skillId}|${x.attempt}`
  const start = order.findIndex((x) => key(x) === key(from))
  for (let i = start + 1; i < order.length; i++) {
    if (!s.absent.includes(order[i].kidId)) return order[i]
  }
  return null
}

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || ''
}

export function Recorder() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { sessions, kids } = useStore()
  const s = sessions.find((x) => x.id === id)
  const clips = useSessionClips(id)
  const order = useMemo(() => (s ? buildOrder(s) : []), [s])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const [camError, setCamError] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cur, setCur] = useState<Slot | null>(null)
  const [log, setLog] = useState<{ slot: Slot; ok: boolean }[]>([])
  const [picker, setPicker] = useState<Slot | null>(null)
  const [review, setReview] = useState<{ slot: Slot; url: string } | null>(null)
  // manual = el evaluador eligió qué grabar: se sigue en orden desde ahí, aunque ya esté grabado.
  const [manual, setManual] = useState(false)

  const kidOf = useCallback((kidId: string): Kid | undefined => kids.find((k) => k.id === kidId), [kids])

  // Primer video por grabar, cuando ya se cargó la lista de videos.
  const initialized = useRef(false)
  useEffect(() => {
    if (s && clips && !initialized.current) {
      initialized.current = true
      setCur(nextSlot(order, s, clips, null) ?? nextSlot(order, s, clips, null, true))
    }
  }, [s, clips, order])

  // Cámara trasera, sin sonido, 720p.
  useEffect(() => {
    let cancelled = false
    askPersist()
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    }).catch((e) => {
      setCamError(String(e?.name) === 'NotAllowedError'
        ? 'La app no tiene permiso para usar la cámara. Actívalo en los permisos del sitio (candado junto a la dirección) y vuelve a entrar.'
        : 'No se pudo abrir la cámara de este dispositivo.')
    })
    // Mantener la pantalla encendida mientras se graba.
    let lock: { release: () => Promise<void> } | null = null
    const nav2 = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav2.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      lock?.release().catch(() => {})
    }
  }, [])

  // Al volver de la pantalla final, la vista de cámara se vuelve a conectar.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  })

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250)
    return () => clearInterval(t)
  }, [recording])

  if (!s) return <main className="content"><div className="empty">Esta sesión ya no existe.</div></main>

  const nextFor = (from: Slot, updated: Map<string, ClipMeta>) =>
    (manual ? followingSlot(order, s, from) : null) ?? nextSlot(order, s, updated, from)
  const goNext = (from: Slot, updated: Map<string, ClipMeta>) => {
    const n = nextFor(from, updated)
    if (!n || (manual && !followingSlot(order, s, from))) setManual(false)
    setCur(n)
  }
  const pick = (slot: Slot) => { setManual(true); setCur(slot) }
  const jumpToPending = () => { setManual(false); setCur(clips ? nextSlot(order, s, clips, cur) : null) }

  const start = () => {
    const stream = streamRef.current
    if (!stream || !cur) return
    const mimeType = pickMime()
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2_500_000 })
    chunks.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
    const slot = cur
    rec.onstop = async () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || mimeType || 'video/webm' })
      const seconds = Math.round((Date.now() - startedAt.current) / 1000)
      const key = clipKey(s.id, slot.kidId, slot.skillId, slot.attempt)
      const meta: ClipMeta = { key, sessionId: s.id, kidId: slot.kidId, skillId: slot.skillId, attempt: slot.attempt, status: 'ok', mime: blob.type, size: blob.size, seconds, createdAt: Date.now() }
      await saveClip(meta, blob)
      setLog((l) => [...l, { slot, ok: true }])
      const updated = new Map(clips ?? []); updated.set(key, meta)
      goNext(slot, updated)
    }
    recRef.current = rec
    startedAt.current = Date.now()
    setElapsed(0)
    rec.start(1000)
    setRecording(true)
  }
  const stop = () => { recRef.current?.stop(); setRecording(false) }

  const skip = async () => {
    if (!cur || recording) return
    const key = clipKey(s.id, cur.kidId, cur.skillId, cur.attempt)
    const updated = new Map(clips ?? [])
    if (!updated.get(key)) {
      const meta: ClipMeta = { key, sessionId: s.id, kidId: cur.kidId, skillId: cur.skillId, attempt: cur.attempt, status: 'pendiente', mime: '', size: 0, seconds: 0, createdAt: Date.now() }
      await saveClip(meta, null)
      updated.set(key, meta)
      setLog((l) => [...l, { slot: cur, ok: false }])
    }
    goNext(cur, updated)
  }

  const openReview = async (slot: Slot) => {
    const blob = await getClipBlob(clipKey(s.id, slot.kidId, slot.skillId, slot.attempt))
    if (blob) setReview({ slot, url: URL.createObjectURL(blob) })
  }
  const closeReview = () => { if (review) URL.revokeObjectURL(review.url); setReview(null) }

  const label = (x: Slot) => `${first(kidOf(x.kidId)?.name ?? '?')} · ${skillById(x.skillId)?.name} I${x.attempt}`
  const total = s.kidIds.length * CLIPS_PER_KID
  const done = clips ? [...clips.values()].filter((c) => c.status === 'ok').length : 0
  const pending = clips ? [...clips.values()].filter((c) => c.status === 'pendiente').length : 0
  const curExists = cur && clips?.get(clipKey(s.id, cur.kidId, cur.skillId, cur.attempt))?.status === 'ok'
  const after = cur && clips ? nextFor(cur, clips) : null
  const lastOk = [...log].reverse().find((l) => l.ok)
  const absentNames = s.absent.map((k) => first(kidOf(k)?.name ?? '')).filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0F1720', color: '#fff', display: 'flex', flexDirection: 'column', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ padding: 'calc(14px + env(safe-area-inset-top)) 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="icon-btn" aria-label="Salir de la grabación" disabled={recording} onClick={() => nav(`/sesion/${s.id}`)}>✕</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#B8C4CF' }}>
            <span>{s.mode === 'grupal' ? 'Grupal · por estaciones' : 'Individual · por niño'}</span>
            <span>{done} de {total} videos</span>
          </div>
          <div style={{ height: 6, background: '#2A3642', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${total ? Math.round((done / total) * 100) : 0}%`, background: '#3DD6A3' }} />
          </div>
        </div>
      </div>

      {cur ? (
        <>
          <button onClick={() => !recording && setPicker(cur)} disabled={recording}
            style={{ margin: '0 16px', background: '#fff', color: '#1B2733', border: 'none', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{kidOf(cur.kidId)?.name}</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#0A6FA8' }}>{skillById(cur.skillId)?.name} · Intento {cur.attempt}</span>
              {curExists && <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Ya está grabado: si grabas, se reemplaza</span>}
            </span>
            {!recording && <span style={{ fontSize: 12, fontWeight: 900, color: '#0A6FA8', textAlign: 'center' }}>⇄<br />Cambiar</span>}
          </button>
          {manual && !recording && (
            <button onClick={jumpToPending} style={{ margin: '8px 16px 0', background: 'transparent', color: '#8CC8F0', border: '1.5px solid #2A3642', borderRadius: 12, height: 40, fontSize: 14, fontWeight: 700 }}>
              {clips && nextSlot(order, s, clips, cur) ? 'Ir a lo que falta grabar →' : 'Listo, terminar →'}
            </button>
          )}

          <div style={{ flex: 1, position: 'relative', margin: '12px 16px', borderRadius: 16, overflow: 'hidden', background: '#1C2731', border: `3px solid ${recording ? '#FF4D5E' : '#1C2731'}` }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,.55)', borderRadius: 8, padding: '6px 10px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {recording ? <><span style={{ width: 10, height: 10, borderRadius: 5, background: '#FF4D5E' }} /> Grabando 00:{String(elapsed).padStart(2, '0')}</> : 'Listo para grabar'}
            </div>
            {camError && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', fontSize: 15 }}>{camError}</div>}
          </div>

          <div style={{ textAlign: 'center', fontSize: 14, color: '#B8C4CF' }}>Después: <strong style={{ color: '#fff' }}>{after ? label(after) : 'fin de la sesión'}</strong></div>

          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'center' }}>
            <button onClick={skip} disabled={recording} style={{ justifySelf: 'start', background: '#2A3642', color: '#fff', border: 'none', borderRadius: 12, padding: '0 16px', height: 48, fontSize: 15, fontWeight: 700 }}>Saltar</button>
            <button aria-label={recording ? 'Detener y guardar' : 'Grabar'} disabled={!!camError} onClick={recording ? stop : start}
              style={{ justifySelf: 'center', width: 84, height: 84, borderRadius: 42, border: '5px solid #fff', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: camError ? 0.4 : 1 }}>
              <span style={recording ? { width: 30, height: 30, borderRadius: 6, background: '#FF4D5E' } : { width: 62, height: 62, borderRadius: 31, background: '#FF4D5E' }} />
            </button>
            <button onClick={() => setPicker(cur)} disabled={recording} style={{ justifySelf: 'end', background: '#2A3642', color: '#fff', border: 'none', borderRadius: 12, padding: '0 16px', height: 48, fontSize: 15, fontWeight: 700 }}>Elegir</button>
          </div>

          <div style={{ padding: '0 16px calc(12px + env(safe-area-inset-bottom))', display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 30 }}>
            {lastOk && !recording && (
              <button onClick={() => openReview(lastOk.slot)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#1F3A33', color: '#8FE8C8' }}>
                ▶ Ver último: {label(lastOk.slot)}
              </button>
            )}
            {log.slice(-2).filter((l) => !l.ok).map((l, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 700, padding: '6px 8px', borderRadius: 8, background: '#FEF3C7', color: '#92400E' }}>Pendiente: {label(l.slot)}</span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={pending ? '#FBBF24' : '#3DD6A3'} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.5 3.5L17 9" /></svg>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{pending ? 'Grabación casi completa' : '¡Sesión grabada!'}</div>
          <div style={{ fontSize: 16, color: '#D5DDE4', lineHeight: 1.45 }}>
            {done} de {total} videos grabados{absentNames.length ? ` · Ausentes: ${absentNames.join(', ')}` : ''}.<br />
            {pending ? `${pending} quedaron pendientes porque los saltaste.` : 'Los videos quedaron guardados en este celular.'}
          </div>
          {pending > 0 && clips && (
            <button className="btn" style={{ background: '#fff', color: '#0F1720' }} onClick={() => { setManual(false); setCur(nextSlot(order, s, clips, null, true)) }}>
              Grabar los {pending} pendientes
            </button>
          )}
          <button className="btn" style={{ background: '#2A3642', color: '#fff' }} onClick={() => setPicker(order[0])}>Volver a grabar uno</button>
          <button className="btn" style={{ background: '#0A6FA8', color: '#fff' }} onClick={() => nav(`/sesion/${s.id}/puntuar`)}>Ir a puntuar los videos</button>
          <button className="btn" style={{ background: 'transparent', color: '#B8C4CF', border: '1.5px solid #2A3642' }} onClick={() => nav(`/sesion/${s.id}`)}>Terminar por ahora</button>
        </div>
      )}

      {picker && clips && (
        <Picker session={s} kids={s.kidIds.map((k) => kidOf(k)).filter(Boolean) as Kid[]} clips={clips} initial={picker}
          onClose={() => setPicker(null)} onPick={(slot) => { pick(slot); setPicker(null) }} />
      )}

      {review && (
        <div className="overlay" style={{ justifyContent: 'center' }}>
          <div className="sheet" style={{ borderRadius: 20, margin: 16, width: 'auto' }}>
            <h2>{label(review.slot)}</h2>
            <video src={review.url} controls autoPlay playsInline style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '55vh' }} />
            <button className="btn primary" onClick={closeReview}>Está bien</button>
            <button className="btn ghost" onClick={() => { pick(review.slot); closeReview() }}>Volver a grabarlo</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Picker({ session: s, kids, clips, initial, onClose, onPick }: {
  session: Session; kids: Kid[]; clips: Map<string, ClipMeta>; initial: Slot; onClose: () => void; onPick: (s: Slot) => void
}) {
  const [kidId, setKid] = useState(initial.kidId)
  const [skillId, setSkill] = useState(initial.skillId)
  const [attempt, setAttempt] = useState(initial.attempt)
  const st = (kid: string, sk: string, a: number) => clips.get(clipKey(s.id, kid, sk, a))?.status
  const skillState = (kid: string, sk: string) => {
    const n = ATTEMPTS.filter((a) => st(kid, sk, a) === 'ok').length
    return n === 2 ? 2 : n
  }
  const toggleAbsent = (kid: string) => updateSession(s.id, { absent: s.absent.includes(kid) ? s.absent.filter((x) => x !== kid) : [...s.absent, kid] })
  const chip = (on: boolean) => ({
    minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '0 4px',
    border: on ? 'none' : '1.5px solid #CBD5DF', background: on ? '#0A6FA8' : '#fff', color: on ? '#fff' : '#1B2733',
  })

  return (
    <div className="overlay" style={{ color: '#1B2733' }}>
      <button className="backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet" style={{ gap: 10 }}>
        <h2>¿Qué grabas ahora?</h2>
        <span className="label">1 · Niño</span>
        {kids.map((k) => {
          const abs = s.absent.includes(k.id)
          const sel = kidId === k.id
          const n = SKILLS.filter((sk) => skillState(k.id, sk.id) === 2).length
          return (
            <div key={k.id} style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setKid(k.id)} aria-pressed={sel}
                style={{ flex: 1, minHeight: 52, borderRadius: 12, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
                  border: sel ? 'none' : abs ? '1.5px solid #F59E0B' : '1.5px solid #CBD5DF', background: sel ? '#0A6FA8' : abs ? '#FFFBEB' : '#fff', color: sel ? '#fff' : abs ? '#92400E' : '#1B2733' }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{k.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{abs ? 'Ausente' : `${n} de 12 pruebas`}</span>
              </button>
              <button onClick={() => toggleAbsent(k.id)}
                style={{ width: 84, minHeight: 52, borderRadius: 12, fontSize: 13, fontWeight: 700, border: abs ? 'none' : '1.5px solid #CBD5DF', background: abs ? '#B45309' : '#F4F7FA', color: abs ? '#fff' : '#5A6B7B' }}>
                {abs ? 'Volvió' : 'Ausente'}
              </button>
            </div>
          )
        })}
        <span className="label">2 · Prueba</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {SKILLS.map((sk) => {
            const n = skillState(kidId, sk.id)
            const sel = skillId === sk.id
            return (
              <button key={sk.id} onClick={() => setSkill(sk.id)} aria-pressed={sel}
                style={{ ...chip(sel), ...(!sel && n === 2 ? { border: 'none', background: '#DDF3EC', color: '#075E4A' } : {}), ...(!sel && n === 1 ? { borderColor: '#0E8F72', color: '#075E4A' } : {}) }}>
                {n === 2 ? '✓ ' : n === 1 ? '½ ' : ''}{sk.name}
              </button>
            )
          })}
        </div>
        <span style={{ fontSize: 12, color: '#5A6B7B' }}>✓ grabada · ½ falta un intento · sin marca = pendiente</span>
        <span className="label">3 · Intento</span>
        <div className="seg c2">
          {ATTEMPTS.map((a) => (
            <button key={a} className={attempt === a ? 'on' : ''} aria-pressed={attempt === a} onClick={() => setAttempt(a)}>
              Intento {a}{st(kidId, skillId, a) === 'ok' ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button className="btn" style={{ background: '#D7263D', color: '#fff' }}
          onClick={() => { if (s.absent.includes(kidId)) toggleAbsent(kidId); onPick({ kidId, skillId, attempt }) }}>
          Grabar: {first(kids.find((k) => k.id === kidId)?.name ?? '')} · {skillById(skillId)?.name} I{attempt}
        </button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
