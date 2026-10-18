// Muñeco de palitos (vista de costado) para el registro visual.
// Coordenadas en "unidades de foto": 0–1000 a lo ancho de la foto; el alto es 1000·alto/ancho.
// Así las longitudes no se deforman aunque la foto no sea cuadrada.

// Tronco: el pecho es un triángulo hacia abajo (hombros arriba, punta en la cintura = 'back')
// y la cadera es una recta (hipN–hipF) con 'hip' en el centro.
export type Joint =
  | 'hip' | 'back' | 'neck' | 'head'
  | 'shoulderN' | 'shoulderF' | 'hipN' | 'hipF'
  | 'elbowN' | 'handN' | 'elbowF' | 'handF'
  | 'kneeN' | 'ankleN' | 'toeN' | 'kneeF' | 'ankleF' | 'toeF'
export type Pose = Record<Joint, [number, number]>

/** De qué articulación cuelga cada una (la cadera es la raíz). */
export const PARENT: Record<Joint, Joint | null> = {
  hip: null, back: 'hip', neck: 'back', head: 'neck',
  shoulderN: 'neck', shoulderF: 'neck', hipN: 'hip', hipF: 'hip',
  elbowN: 'shoulderN', handN: 'elbowN', elbowF: 'shoulderF', handF: 'elbowF',
  kneeN: 'hipN', ankleN: 'kneeN', toeN: 'ankleN', kneeF: 'hipF', ankleF: 'kneeF', toeF: 'ankleF',
}
export const JOINTS = Object.keys(PARENT) as Joint[]
const children = (j: Joint) => JOINTS.filter((c) => PARENT[c] === j)
function descendants(j: Joint): Joint[] {
  const out: Joint[] = []
  const walk = (x: Joint) => children(x).forEach((c) => { out.push(c); walk(c) })
  walk(j)
  return out
}

// ---------- Postura a partir de ángulos ----------
// Ángulo en grados, medido desde la vertical hacia abajo y girando hacia adelante (el muñeco mira a la derecha):
// 0 = hacia abajo, 90 = hacia adelante, 180 = hacia arriba, −90 = hacia atrás.
type Arm = [number, number] // brazo, antebrazo
type Leg = [number, number, number] // muslo, pierna, pie
interface Spec { trunk: number; neck?: number; armN: Arm; armF: Arm; legN: Leg; legF: Leg }
// Proporciones aproximadas de un niño (alto total ≈ 1).
const L = { shoulder: 0.085, pelvis: 0.06, lowBack: 0.15, upBack: 0.15, neck: 0.1, upArm: 0.14, foreArm: 0.13, thigh: 0.22, shin: 0.21, foot: 0.075 }
const dir = (deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [Math.sin(a), Math.cos(a)] }
const add = (p: [number, number], deg: number, len: number): [number, number] => { const d = dir(deg); return [p[0] + d[0] * len, p[1] + d[1] * len] }

function build(s: Spec): Pose {
  const hip: [number, number] = [0, 0]
  const trunkDeg = 180 - s.trunk // inclinación del tronco hacia adelante
  const back = add(hip, trunkDeg, L.lowBack)
  const neck = add(back, trunkDeg, L.upBack)
  const head = add(neck, s.neck ?? trunkDeg, L.neck)
  // Hombros y cadera a lo ancho, perpendiculares al tronco.
  const side = trunkDeg + 90
  const shoulderN = add(neck, side, L.shoulder), shoulderF = add(neck, side, -L.shoulder)
  const hipN = add(hip, side, L.pelvis), hipF = add(hip, side, -L.pelvis)
  const elbowN = add(shoulderN, s.armN[0], L.upArm), handN = add(elbowN, s.armN[1], L.foreArm)
  const elbowF = add(shoulderF, s.armF[0], L.upArm), handF = add(elbowF, s.armF[1], L.foreArm)
  const kneeN = add(hipN, s.legN[0], L.thigh), ankleN = add(kneeN, s.legN[1], L.shin), toeN = add(ankleN, s.legN[2], L.foot)
  const kneeF = add(hipF, s.legF[0], L.thigh), ankleF = add(kneeF, s.legF[1], L.shin), toeF = add(ankleF, s.legF[2], L.foot)
  return { hip, back, neck, head, shoulderN, shoulderF, hipN, hipF, elbowN, handN, elbowF, handF, kneeN, ankleN, toeN, kneeF, ankleF, toeF }
}

const STAND: Spec = { trunk: 0, armN: [-8, 5], armF: [8, 10], legN: [3, 0, 90], legF: [-3, 0, 90] }

// ---------- Fases por habilidad (con la postura de referencia de cada una) ----------
export interface Phase { id: string; name: string; spec: Spec }
export const PHASES: Record<string, Phase[]> = {
  correr: [
    { id: 'apoyo', name: 'Apoyo anterior', spec: { trunk: 8, armN: [-20, 60], armF: [25, 115], legN: [22, 4, 100], legF: [-15, -95, -10] } },
    { id: 'empuje', name: 'Empuje · rodilla arriba', spec: { trunk: 10, armN: [-45, 45], armF: [45, 140], legN: [88, 2, 80], legF: [-30, -40, -50] } },
    { id: 'vuelo', name: 'Vuelo', spec: { trunk: 10, armN: [-40, 50], armF: [40, 135], legN: [65, -5, 85], legF: [-35, -110, -60] } },
    { id: 'aterrizaje', name: 'Aterrizaje', spec: { trunk: 8, armN: [-30, 55], armF: [35, 125], legN: [25, 6, 100], legF: [-10, -70, -20] } },
  ],
  'saltar-bipodal': [
    { id: 'preparacion', name: 'Preparación', spec: { trunk: 45, neck: 150, armN: [-125, -125], armF: [-118, -118], legN: [62, -28, 90], legF: [58, -30, 88] } },
    { id: 'despegue', name: 'Despegue · extensión', spec: { trunk: 40, neck: 145, armN: [150, 150], armF: [145, 145], legN: [-38, -40, -45], legF: [-34, -36, -40] } },
    { id: 'aterrizaje', name: 'Aterrizaje', spec: { trunk: 30, neck: 155, armN: [-25, -15], armF: [-20, -10], legN: [72, 18, 95], legF: [68, 15, 92] } },
    { id: 'amortiguacion', name: 'Amortiguación', spec: { trunk: 40, neck: 150, armN: [70, 85], armF: [65, 80], legN: [78, -32, 90], legF: [74, -34, 88] } },
  ],
  lanzar: [
    { id: 'preparacion', name: 'Preparación · brazo atrás', spec: { trunk: -8, armN: [-100, 170], armF: [95, 90], legN: [-20, -8, 90], legF: [25, 4, 92] } },
    { id: 'suelte', name: 'Rotación y suelte', spec: { trunk: 12, armN: [150, 115], armF: [-25, 10], legN: [-28, -15, 70], legF: [22, 0, 92] } },
    { id: 'seguimiento', name: 'Seguimiento', spec: { trunk: 35, armN: [45, 15], armF: [-45, -25], legN: [-35, -75, -30], legF: [15, -5, 92] } },
  ],
  atrapar: [
    { id: 'preparacion', name: 'Preparación', spec: { trunk: 5, armN: [18, 110], armF: [22, 112], legN: [6, -4, 90], legF: [-6, -4, 90] } },
    { id: 'extension', name: 'Extensión de brazos', spec: { trunk: 12, armN: [82, 86], armF: [86, 88], legN: [10, -6, 92], legF: [-8, -6, 88] } },
    { id: 'recepcion', name: 'Recepción', spec: { trunk: 6, armN: [35, 125], armF: [38, 128], legN: [8, -10, 90], legF: [-8, -10, 90] } },
  ],
}
const GENERIC: Phase[] = [1, 2, 3, 4].map((n) => ({ id: `f${n}`, name: `Foto ${n}`, spec: STAND }))
/** Habilidades que se ofrecen primero en el registro visual (se entienden bien en foto). */
export const VISUAL_SKILLS = ['correr', 'saltar-bipodal', 'lanzar', 'atrapar']
export const phasesOf = (skillId: string): Phase[] => PHASES[skillId] ?? GENERIC
export const phaseName = (skillId: string, phase: string) => phasesOf(skillId).find((p) => p.id === phase)?.name ?? phase

/** Postura de referencia de una fase, ubicada en el centro de una foto de w×h. */
export function startPose(skillId: string, phase: string, w: number, h: number, faceLeft = false): Pose {
  const spec = phasesOf(skillId).find((p) => p.id === phase)?.spec ?? STAND
  const raw = build(spec)
  const H = (1000 * h) / w
  const ys = JOINTS.map((j) => raw[j][1])
  const top = Math.min(...ys) - 0.07, bottom = Math.max(...ys)
  const size = (H * 0.78) / (bottom - top) // el muñeco ocupa ~78 % del alto de la foto
  const cy = H / 2 - ((top + bottom) / 2) * size
  const out = {} as Pose
  JOINTS.forEach((j) => { out[j] = [500 + (faceLeft ? -1 : 1) * raw[j][0] * size, cy + raw[j][1] * size] })
  return out
}

/** Completa posturas guardadas antes de que existieran los hombros y la cadera a lo ancho. */
export function normalizePose(p: Pose): Pose {
  if (p.shoulderN && p.hipN) return p
  const h = Math.hypot(p.neck[0] - p.hip[0], p.neck[1] - p.hip[1]) / (L.lowBack + L.upBack) || 100
  const t = [(p.neck[0] - p.hip[0]), (p.neck[1] - p.hip[1])], tl = Math.hypot(t[0], t[1]) || 1
  const perp: [number, number] = [-t[1] / tl, t[0] / tl]
  const off = (c: [number, number], k: number): [number, number] => [c[0] + perp[0] * k * h, c[1] + perp[1] * k * h]
  return { ...p, shoulderN: off(p.neck, L.shoulder), shoulderF: off(p.neck, -L.shoulder), hipN: off(p.hip, L.pelvis), hipF: off(p.hip, -L.pelvis) }
}

// ---------- Movimientos ----------
const rot = (p: [number, number], c: [number, number], a: number): [number, number] => {
  const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]
  return [c[0] + x * k - y * s, c[1] + x * s + y * k]
}

/** Arrastra una articulación: gira su segmento alrededor de la articulación de la que cuelga, sin estirarlo.
 *  Lo que cuelga de ella acompaña el giro. La cadera mueve todo el muñeco. */
export function dragJoint(pose: Pose, j: Joint, to: [number, number]): Pose {
  const out = { ...pose }
  const parent = PARENT[j]
  if (!parent) {
    const dx = to[0] - pose.hip[0], dy = to[1] - pose.hip[1]
    JOINTS.forEach((k) => { out[k] = [pose[k][0] + dx, pose[k][1] + dy] })
    return out
  }
  const c = pose[parent]
  const a0 = Math.atan2(pose[j][1] - c[1], pose[j][0] - c[0])
  const a1 = Math.atan2(to[1] - c[1], to[0] - c[0])
  const d = a1 - a0
  ;[j, ...descendants(j)].forEach((k) => { out[k] = rot(pose[k], c, d) })
  return out
}

/** Estira o acorta el tramo que termina en esta articulación: la lleva al dedo y lo que cuelga de ella
 *  se desplaza igual, sin deformarse. En la cadera mueve todo el muñeco. */
export function stretchJoint(pose: Pose, j: Joint, to: [number, number]): Pose {
  if (!PARENT[j]) return dragJoint(pose, j, to)
  const out = { ...pose }
  const dx = to[0] - pose[j][0], dy = to[1] - pose[j][1]
  ;[j, ...descendants(j)].forEach((k) => { out[k] = [pose[k][0] + dx, pose[k][1] + dy] })
  return out
}

/** Gira (grados), agranda (factor) o voltea todo el muñeco alrededor de la cadera. */
export function transformPose(pose: Pose, op: { rotate?: number; scale?: number; flip?: boolean }): Pose {
  const c = pose.hip
  const out = {} as Pose
  JOINTS.forEach((k) => {
    let p = pose[k]
    if (op.flip) p = [2 * c[0] - p[0], p[1]]
    if (op.scale) p = [c[0] + (p[0] - c[0]) * op.scale, c[1] + (p[1] - c[1]) * op.scale]
    if (op.rotate) p = rot(p, c, (op.rotate * Math.PI) / 180)
    out[k] = p
  })
  return out
}

// ---------- Dibujo ----------
/** Dos colores a elección: dorado para ropa oscura, azul para ropa clara. */
export type FigureColor = 'dorado' | 'azul'
export const COLORS: Record<FigureColor, { near: string; far: string; label: string; hint: string }> = {
  dorado: { near: '#F2B33D', far: '#D9822B', label: 'Dorado', hint: 'ropa oscura' },
  azul: { near: '#1E5FD8', far: '#0F2F7A', label: 'Azul', hint: 'ropa clara' },
}
const LAST_COLOR = 'tgmd-color-muneco'
/** Último color elegido (se usa en las fotos nuevas). */
export function lastColor(): FigureColor {
  try { return localStorage.getItem(LAST_COLOR) === 'azul' ? 'azul' : 'dorado' } catch { return 'dorado' }
}
export function rememberColor(c: FigureColor) { try { localStorage.setItem(LAST_COLOR, c) } catch { /* sin almacenamiento */ } }
/** Transparencia del muñeco: es solo una guía, la foto debe verse a través. */
export const FIGURE_OPACITY = 0.7
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Muñeco dibujado como grupo SVG (en unidades de foto): trazo fino, sin borde y semitransparente.
 *  El lado lejano va más claro. Con `editing` se ven los puntos de las articulaciones para arrastrarlos. */
export function Figure({ pose: raw, active, stretching, editing, color = 'dorado' }: { pose: Pose; active?: Joint | null; stretching?: boolean; editing?: boolean; color?: FigureColor }) {
  const pose = normalizePose(raw)
  const { near: NEAR, far: FAR } = COLORS[color]
  const thigh = (dist(pose.hipN, pose.kneeN) + dist(pose.hipF, pose.kneeF)) / 2 || 40
  const sw = Math.max(2, thigh * 0.042)
  const seg = (a: Joint, b: Joint) => `M${pose[a][0]} ${pose[a][1]} L${pose[b][0]} ${pose[b][1]}`
  const far = [seg('shoulderF', 'elbowF'), seg('elbowF', 'handF'), seg('hipF', 'kneeF'), seg('kneeF', 'ankleF'), seg('ankleF', 'toeF')].join(' ')
  const headR = dist(pose.neck, pose.head) * 0.75
  // El cuello llega hasta el borde de la cabeza, no hasta su centro.
  const nk = pose.neck, hd = pose.head, nl = dist(nk, hd) || 1
  const chin: [number, number] = [hd[0] - ((hd[0] - nk[0]) / nl) * headR, hd[1] - ((hd[1] - nk[1]) / nl) * headR]
  const { shoulderN: sN, shoulderF: sF, back: bk } = pose
  const chest = `M${sN[0]} ${sN[1]} L${sF[0]} ${sF[1]} L${bk[0]} ${bk[1]} Z` // triángulo hacia abajo
  const near = [chest, seg('back', 'hip'), seg('hipN', 'hipF'), `M${nk[0]} ${nk[1]} L${chin[0]} ${chin[1]}`, seg('shoulderN', 'elbowN'), seg('elbowN', 'handN'), seg('hipN', 'kneeN'), seg('kneeN', 'ankleN'), seg('ankleN', 'toeN')].join(' ')
  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <g>
      {/* La transparencia va en el grupo para que los cruces no se vean más oscuros. */}
      <g opacity={FIGURE_OPACITY}>
        <path d={far} {...line} stroke={FAR} strokeWidth={sw} />
        <path d={near} {...line} stroke={NEAR} strokeWidth={sw} />
        <circle cx={pose.head[0]} cy={pose.head[1]} r={headR} fill="none" stroke={NEAR} strokeWidth={sw} />
        {editing && JOINTS.filter((j) => j !== 'head').map((j) => (
          <circle key={j} cx={pose[j][0]} cy={pose[j][1]} r={sw * 1.1} fill={j.endsWith('F') && j !== 'shoulderF' && j !== 'hipF' ? FAR : NEAR} />
        ))}
      </g>
      {active && <circle cx={pose[active][0]} cy={pose[active][1]} r={sw * (stretching ? 4.2 : 3.2)} fill="none" stroke={NEAR} strokeWidth={sw * 0.8} strokeDasharray={stretching ? `${sw * 1.6} ${sw * 1.2}` : undefined} />}
    </g>
  )
}
