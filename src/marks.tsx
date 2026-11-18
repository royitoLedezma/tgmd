// Marcas del evaluador sobre la foto: círculos (que se deforman a óvalos) y líneas rectas.
// Coordenadas en "unidades de foto": 0–1000 a lo ancho de la foto; el alto es 1000·alto/ancho.
// El grosor también va en unidades de foto, así la marca se ve igual en el editor y en el informe.

export type MarkColor = 'rojo' | 'azul'
export const MARK_COLORS: Record<MarkColor, { hex: string; label: string }> = {
  rojo: { hex: '#E5322D', label: 'Rojo' },
  azul: { hex: '#1E5FD8', label: 'Azul' },
}
export type MarkWidth = 'fino' | 'medio' | 'grueso'
export const MARK_WIDTHS: Record<MarkWidth, { w: number; label: string }> = {
  fino: { w: 5, label: 'Fino' },
  medio: { w: 9, label: 'Medio' },
  grueso: { w: 15, label: 'Grueso' },
}

export interface EllipseMark { id: string; type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot: number; color: MarkColor; width: MarkWidth }
export interface LineMark { id: string; type: 'line'; x1: number; y1: number; x2: number; y2: number; color: MarkColor; width: MarkWidth }
export type Mark = EllipseMark | LineMark
type P = [number, number]

// ---------- Última elección (para las marcas nuevas) ----------
const PREF = 'tgmd-marcas'
export function lastStyle(): { color: MarkColor; width: MarkWidth } {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) || '{}')
    return { color: v.color === 'azul' ? 'azul' : 'rojo', width: v.width in MARK_WIDTHS ? v.width : 'fino' }
  } catch { return { color: 'rojo', width: 'fino' } }
}
export function rememberStyle(s: { color: MarkColor; width: MarkWidth }) { try { localStorage.setItem(PREF, JSON.stringify(s)) } catch { /* sin almacenamiento */ } }

const newId = () => Math.random().toString(36).slice(2, 10)
export function newEllipse(H: number, s: { color: MarkColor; width: MarkWidth }): EllipseMark {
  const r = Math.min(140, H * 0.18)
  return { id: newId(), type: 'ellipse', cx: 500, cy: H / 2, rx: r, ry: r, rot: 0, ...s }
}
export function newLine(H: number, s: { color: MarkColor; width: MarkWidth }): LineMark {
  return { id: newId(), type: 'line', x1: 330, y1: H / 2, x2: 670, y2: H / 2, ...s }
}

// ---------- Geometría ----------
const rad = (d: number) => (d * Math.PI) / 180
const rotate = (p: P, c: P, a: number): P => {
  const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]
  return [c[0] + x * k - y * s, c[1] + x * s + y * k]
}
/** Lleva un punto a los ejes propios del óvalo (sin giro). */
const toLocal = (m: EllipseMark, p: P): P => { const q = rotate(p, [m.cx, m.cy], -rad(m.rot)); return [q[0] - m.cx, q[1] - m.cy] }

/** Puntos de agarre: en el óvalo, ancho (→), alto (↓) y giro (arriba); en la línea, sus dos extremos. */
export type Handle = 'rx' | 'ry' | 'rot' | 'p1' | 'p2'
export function handles(m: Mark, rotGap: number): { h: Handle; p: P }[] {
  if (m.type === 'line') return [{ h: 'p1', p: [m.x1, m.y1] }, { h: 'p2', p: [m.x2, m.y2] }]
  const c: P = [m.cx, m.cy], a = rad(m.rot)
  return [
    { h: 'rx', p: rotate([m.cx + m.rx, m.cy], c, a) },
    { h: 'ry', p: rotate([m.cx, m.cy + m.ry], c, a) },
    { h: 'rot', p: rotate([m.cx, m.cy - m.ry - rotGap], c, a) },
  ]
}

/** ¿El dedo toca la marca? `tol` en unidades de foto. Dentro del óvalo también cuenta (es más fácil tocarlo). */
export function hits(m: Mark, p: P, tol: number): boolean {
  if (m.type === 'line') {
    const dx = m.x2 - m.x1, dy = m.y2 - m.y1, l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p[0] - m.x1) * dx + (p[1] - m.y1) * dy) / l2))
    return Math.hypot(p[0] - (m.x1 + t * dx), p[1] - (m.y1 + t * dy)) <= tol
  }
  const [x, y] = toLocal(m, p)
  return (x * x) / ((m.rx + tol) ** 2) + (y * y) / ((m.ry + tol) ** 2) <= 1
}

const MIN = 8
/** Arrastra un punto de agarre hasta p. */
export function dragHandle(m: Mark, h: Handle, p: P): Mark {
  if (m.type === 'line') return h === 'p1' ? { ...m, x1: p[0], y1: p[1] } : { ...m, x2: p[0], y2: p[1] }
  const [x, y] = toLocal(m, p)
  if (h === 'rx') return { ...m, rx: Math.max(MIN, Math.abs(x)) }
  if (h === 'ry') return { ...m, ry: Math.max(MIN, Math.abs(y)) }
  // Giro: el agarre está arriba del óvalo, por eso se suma 90°.
  return { ...m, rot: (Math.atan2(p[1] - m.cy, p[0] - m.cx) * 180) / Math.PI + 90 }
}

export function moveMark(m: Mark, dx: number, dy: number): Mark {
  return m.type === 'line' ? { ...m, x1: m.x1 + dx, y1: m.y1 + dy, x2: m.x2 + dx, y2: m.y2 + dy } : { ...m, cx: m.cx + dx, cy: m.cy + dy }
}

/** Pellizco: agranda (k) y gira (a, en grados) la marca alrededor de su centro. */
export function pinchMark(m: Mark, k: number, a: number): Mark {
  if (m.type === 'ellipse') return { ...m, rx: Math.max(MIN, m.rx * k), ry: Math.max(MIN, m.ry * k), rot: m.rot + a }
  const c: P = [(m.x1 + m.x2) / 2, (m.y1 + m.y2) / 2]
  const f = (q: P) => rotate([c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k], c, rad(a))
  const [x1, y1] = f([m.x1, m.y1]), [x2, y2] = f([m.x2, m.y2])
  return { ...m, x1, y1, x2, y2 }
}

// ---------- Dibujo ----------
/** Una marca dibujada en SVG (unidades de foto). Óvalos sin relleno. */
export function MarkShape({ m }: { m: Mark }) {
  const stroke = MARK_COLORS[m.color].hex, sw = MARK_WIDTHS[m.width].w
  if (m.type === 'line') return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  return <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} fill="none" stroke={stroke} strokeWidth={sw} />
}

export function Marks({ marks }: { marks?: Mark[] }) {
  return <>{(marks ?? []).map((m) => <MarkShape key={m.id} m={m} />)}</>
}

/** Agarres de la marca elegida. `u` = cuántas unidades de foto mide un píxel de pantalla. */
export function MarkHandles({ m, u, rotGap }: { m: Mark; u: number; rotGap: number }) {
  const stroke = MARK_COLORS[m.color].hex
  const hs = handles(m, rotGap)
  const r = 11 * u
  const rotH = hs.find((x) => x.h === 'rot')
  return (
    <g>
      {m.type === 'ellipse' && (
        <>
          {/* Contorno de selección punteado */}
          <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} fill="none" stroke="#fff" strokeWidth={1.5 * u} strokeDasharray={`${6 * u} ${5 * u}`} />
          {rotH && <line x1={rotate([m.cx, m.cy - m.ry], [m.cx, m.cy], rad(m.rot))[0]} y1={rotate([m.cx, m.cy - m.ry], [m.cx, m.cy], rad(m.rot))[1]} x2={rotH.p[0]} y2={rotH.p[1]} stroke="#fff" strokeWidth={1.5 * u} />}
        </>
      )}
      {m.type === 'line' && <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#fff" strokeWidth={1.5 * u} strokeDasharray={`${6 * u} ${5 * u}`} />}
      {hs.map(({ h, p }) => (
        <g key={h}>
          <circle cx={p[0]} cy={p[1]} r={r} fill="#fff" stroke={stroke} strokeWidth={2.5 * u} />
          {h === 'rot' && <path d={`M${p[0] - 4.5 * u} ${p[1] + 1 * u} A ${4.5 * u} ${4.5 * u} 0 1 1 ${p[0] + 1 * u} ${p[1] + 4.5 * u}`} fill="none" stroke={stroke} strokeWidth={2 * u} strokeLinecap="round" />}
        </g>
      ))}
    </g>
  )
}
