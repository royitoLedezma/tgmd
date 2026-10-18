import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, scoreId, setReportText, evaluatorName, type Kid, type Score, type Session, type Side } from './store'
import { computeResult, aeToMonths, dateFromIso, addMonths, type Norms, type Result } from './calc'
import { SKILLS } from './skills'
import type { TestData } from './excel'
import { exportFoldersOf, folderLabel } from './exports'
import { useKidVisual } from './photos'
import { visualRows, VisualPageBody, type VisualRow } from './visual'

/** Tests del niño hasta esta sesión (como máximo los 2 últimos: 1° anterior y 2° actual). */
export function kidTests(kid: Kid, upTo: Session, sessions: Session[], scores: Score[], norms: Norms | null): TestData[] {
  const list = sessions
    .filter((s) => s.kidIds.includes(kid.id) && (s.id === upTo.id || s.date < upTo.date))
    .filter((s) => s.id === upTo.id || scores.some((x) => x.id === scoreId(s.id, kid.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .slice(-2)
  return list.map((s) => {
    const score = scores.find((x) => x.id === scoreId(s.id, kid.id))
    return { date: s.date, score, result: computeResult(kid, score, s.date, norms) }
  })
}

/** Número de evaluación del niño en esta sesión (1 = primera). */
function evalNumber(kid: Kid, upTo: Session, sessions: Session[], scores: Score[]) {
  return sessions.filter((s) => s.kidIds.includes(kid.id) && (s.id === upTo.id || (s.date < upTo.date && scores.some((x) => x.id === scoreId(s.id, kid.id))))).length
}

// ---------- Textos ----------
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const longDate = (iso: string) => { const d = dateFromIso(iso); return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}` }
const ORDINAL = ['', 'Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava', 'Novena', 'Décima']
const evalTitle = (n: number) => (ORDINAL[n] ? `${ORDINAL[n]} evaluación` : `Evaluación N.º ${n}`)
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
const pctText = (p: number) => `${p.toFixed(1)} %`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function preferences(k: Kid): string {
  const part = (v: Side, d: string, i: string, a: string) => (v === 'D' ? d : v === 'I' ? i : v === 'A' ? a : '')
  const xs = [
    part(k.hand, 'mano derecha', 'mano izquierda', 'ambas manos'),
    part(k.foot, 'pie derecho', 'pie izquierdo', 'ambos pies'),
    part(k.eye, 'ojo derecho', 'ojo izquierdo', 'ambos ojos'),
    part(k.turn, 'giro a la derecha', 'giro a la izquierda', 'giro a ambos lados'),
  ].filter(Boolean)
  const s = xs.join(', ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

const LEVELS = ['Muy pobre', 'Pobre', 'Bajo el promedio', 'Promedio', 'Sobre el promedio', 'Superior', 'Muy superior']
const levelIdx = (r: Result) => (r.rating ? LEVELS.indexOf(r.rating.es) : -1)
function expectation(r: Result): string {
  const i = levelIdx(r)
  return i >= 4 ? 'por encima de lo esperado' : i === 3 ? 'acorde a lo esperado' : 'por debajo de lo esperado'
}
function levelPhrase(r: Result): string {
  switch (r.rating?.es) {
    case 'Muy superior': return 'muy superior a lo esperado'
    case 'Superior': return 'superior a lo esperado'
    case 'Sobre el promedio': return 'sobre el promedio'
    case 'Promedio': return 'dentro del promedio'
    case 'Bajo el promedio': return 'bajo el promedio'
    default: return 'por debajo de lo esperado'
  }
}

// ---------- Borrador automático de conclusiones y recomendaciones ----------
export function draftTexts(kid: Kid, t: TestData, prev?: TestData): { conclusions: string; suggestions: string } {
  const r = t.result
  const name = kid.name.split(' ')[0]
  const pron = kid.sex === 'F' ? 'la' : 'lo'
  const p1 = r.rating
    ? `${name} presenta un desarrollo motor ${levelPhrase(r)} para su edad`
    : `${name} logró el ${pctText(r.loc.pct)} en locomoción y el ${pctText(r.obj.pct)} en control de objetos`
  let progress = '.'
  if (prev) {
    const better = r.skills.filter((s) => s.pct > (prev.result.skills.find((x) => x.skill.id === s.skill.id)?.pct ?? 0)).length
    const notWorse = r.skills.every((s) => s.pct >= (prev.result.skills.find((x) => x.skill.id === s.skill.id)?.pct ?? 0))
    progress = notWorse ? ' y mejoró o mantuvo su nivel en todas las habilidades evaluadas.' : better ? ` y mejoró en ${better} de las ${r.skills.length} habilidades evaluadas.` : '.'
  }
  const d = r.loc.pct - r.obj.pct
  const area = Math.abs(d) >= 5 ? `Su principal fortaleza es ${d > 0 ? 'la locomoción' : 'el control de objetos'}.` : 'Muestra un desarrollo equilibrado entre locomoción y control de objetos.'
  const weak = [...r.skills].filter((s) => s.pct < 100).sort((a, b) => a.pct - b.pct).slice(0, 2).map((s) => s.skill.name.toLowerCase())
  const weakText = weak.length === 0 ? 'Domina todas las habilidades evaluadas.'
    : weak.length === 1 ? `La habilidad con mayor margen de mejora es ${weak[0]}.`
    : `Las habilidades con mayor margen de mejora son ${list(weak)}.`
  const conclusions = `${p1}${progress}\n${area} ${weakText}`
  const suggestions = [
    `Mantener una práctica motriz variada: distintos juegos, deportes y entornos que ${pron} desafíen de muchas maneras.`,
    weak.length
      ? `Dar un estímulo extra a ${list(weak)} dentro de esa variedad, sin descuidar las demás experiencias de movimiento.`
      : 'Sumar desafíos nuevos y de mayor dificultad dentro de esa variedad para seguir progresando.',
    'Favorecer el juego libre y activo con otros niños, una fuente valiosa de aprendizaje motor.',
  ].join('\n')
  return { conclusions, suggestions }
}

// ---------- Estilo ----------
const INK = '#16203A', BODY = '#2E3648', MUTED = '#5D6474', HAIR = '#E6E1D7', PANEL = '#F7F4EE'
const GOLD = '#A27C45', GOLD_TXT = '#7E5F2E', STONE = '#8F8778', TRACK = '#ECE7DD'
const SERIF = "'Cormorant Garamond', serif"
const exact: CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
const eyebrow: CSSProperties = { fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }
const pageStyle: CSSProperties = { width: 816, height: 1056, boxSizing: 'border-box', background: '#fff', fontFamily: 'Manrope, sans-serif', color: BODY, padding: '46px 60px 40px', display: 'flex', flexDirection: 'column', gap: 16, ...exact }

function Header({ right }: { right: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...eyebrow, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700, color: INK }}>Informe de desarrollo motor</span>
        <span style={{ color: MUTED }}>{right}</span>
      </div>
      <div style={{ height: 1, background: GOLD }} />
    </div>
  )
}
function Footer({ kid, date, page, total }: { kid: Kid; date: string; page: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px solid ${HAIR}`, paddingTop: 12, fontSize: 12, color: MUTED }}>
      <span>{kid.name} · Informe de desarrollo motor · {longDate(date)}</span>
      <span>{page} / {total}</span>
    </div>
  )
}

// ---------- Escala de nivel general ----------
const SEGMENTS = [15, 10, 10, 21, 10, 10, 14] // ancho proporcional de cada categoría (cociente 55–145)
const gmqPos = (g: number) => Math.max(2, Math.min(98, ((g - 55) / 90) * 100))
function LevelScale({ cur, prev, labels }: { cur: Result; prev?: Result; labels: [string, string] }) {
  const active = levelIdx(cur)
  const curX = cur.gmq !== null ? gmqPos(cur.gmq) : null
  const prevX = prev?.gmq != null ? gmqPos(prev.gmq) : null
  const close = curX !== null && prevX !== null && Math.abs(curX - prevX) < 9
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', height: 40 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 28, display: 'flex', gap: 2, height: 8 }}>
          {SEGMENTS.map((w, i) => <div key={i} style={{ flex: `${w} 1 0`, background: i === active ? GOLD : '#E3DCCF', ...exact }} />)}
        </div>
        {prevX !== null && (
          <div style={{ position: 'absolute', left: `${prevX}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1, whiteSpace: 'nowrap', visibility: close ? 'hidden' : 'visible' }}>{labels[0]}</span>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: `2px solid ${STONE}` }} />
          </div>
        )}
        {curX !== null && (
          <div style={{ position: 'absolute', left: `${curX}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1, whiteSpace: 'nowrap' }}>{labels[1]}</span>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: INK, border: '2px solid #fff', marginTop: -2, ...exact }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 2, fontSize: 12, lineHeight: 1.3, color: MUTED, textAlign: 'center' }}>
        {LEVELS.map((l, i) => <span key={l} style={{ flex: `${SEGMENTS[i]} 1 0`, ...(i === active ? { color: GOLD_TXT, fontWeight: 700 } : {}) }}>{l}</span>)}
      </div>
    </div>
  )
}

// ---------- Tarjeta de área ----------
function AreaCard({ title, cur, prev, sub }: { title: string; cur: Result; prev?: Result; sub: 'loc' | 'obj' }) {
  const c = cur[sub].pct, p = prev?.[sub].pct
  const delta = p !== undefined ? c - p : null
  const base = p !== undefined ? Math.min(c, p) : c
  const skills = cur.skills.filter((s) => s.skill.subtest === sub)
  const full = skills.filter((s) => s.pct >= 100).map((s) => s.skill.name.toLowerCase())
  const best = [...skills].sort((a, b) => b.pct - a.pct)[0]
  const line = full.length === skills.length ? 'Domina por completo todas las habilidades del área.'
    : full.length ? `Domina por completo ${list(full)}.`
    : best ? `Su habilidad más lograda es ${best.skill.name.toLowerCase()} (${Math.round(best.pct)} %).` : ''
  return (
    <div style={{ border: `1px solid ${HAIR}`, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...eyebrow, fontWeight: 700, color: INK }}>{title}</span>
        {p !== undefined && <span style={{ fontSize: 12, color: MUTED }}>antes {pctText(p)}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 600, lineHeight: 1, color: INK }}>{pctText(c)}</span>
        {delta !== null && Math.abs(delta) >= 0.05 && <span style={{ fontSize: 14, fontWeight: 700, color: delta > 0 ? GOLD_TXT : MUTED }}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', height: 14, background: TRACK, ...exact }}>
          <div style={{ width: `${base}%`, height: '100%', background: INK, ...exact }} />
          {delta !== null && delta > 0 && <div style={{ width: `${delta}%`, height: '100%', background: GOLD, ...exact }} />}
          {delta !== null && delta < 0 && <div style={{ width: `${-delta}%`, height: '100%', background: '#CFC8BA', ...exact }} />}
        </div>
      </div>
      {line && <span style={{ fontSize: 13, lineHeight: 1.5, color: BODY }}>{line}</span>}
    </div>
  )
}

// ---------- Edad motora frente a edad real ----------
const ageShort = (m: number) => { const y = Math.floor(m / 12), mm = m % 12; return mm ? `${y} a ${mm} m` : plural(y, 'año', 'años') }
function aeInfo(ae: string | null) {
  if (!ae) return null
  if (ae.startsWith('>')) { const m = Math.ceil(aeToMonths(ae) / 12) * 12; return { m, label: `más de ${plural(m / 12, 'año', 'años')}`, gt: true, lt: false } }
  if (ae.startsWith('<')) { const m = aeToMonths(ae); return { m: m - 1, label: `menos de ${ageShort(m)}`, gt: false, lt: true } }
  const m = aeToMonths(ae); return { m, label: ageShort(m), gt: false, lt: false }
}

function AgeTimeline({ tests, overMax }: { tests: TestData[]; overMax: boolean }) {
  const W = 696, X0 = 170, X1 = 676
  const chrono = tests.map((t) => t.result.normMonths)
  const rows = [
    { label: 'Locomoción', pts: tests.map((t) => aeInfo(t.result.loc.ae)) },
    { label: 'Control de objetos', pts: tests.map((t) => aeInfo(t.result.obj.ae)) },
  ]
  const values = [...chrono.filter((v): v is number => v !== null), ...rows.flatMap((r) => r.pts.filter(Boolean).map((p) => p!.m))]
  const nowAge = chrono[chrono.length - 1]
  if (!values.length || nowAge === null) return <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>Sin datos de edad motora (faltan las tablas o la fecha de nacimiento).</div>
  let lo = Math.floor((Math.min(...values) - 4) / 12) * 12
  let hi = Math.ceil((Math.max(...values) + 4) / 12) * 12
  if (hi - lo < 36) { hi = lo + 36 }
  lo = Math.max(0, lo)
  const x = (m: number) => X0 + ((m - lo) / (hi - lo)) * (X1 - X0)
  const step = (hi - lo) / 12 > 8 ? 24 : 12
  const ticks: number[] = []
  for (let m = lo; m <= hi; m += step) ticks.push(m)
  const two = tests.length > 1
  const anchorFor = (px: number): { x: number; anchor: 'start' | 'middle' | 'end' } => (px > X1 - 50 ? { x: px + 8, anchor: 'end' } : px < X0 + 20 ? { x: px - 6, anchor: 'start' } : { x: px, anchor: 'middle' })
  const pill = overMax ? `Edad de comparación · ${ageShort(nowAge)}` : `Edad actual · ${ageShort(nowAge)}`
  const pillW = pill.length * 6.9 + 26
  const pillX = Math.max(0, Math.min(W - pillW, x(nowAge) - pillW / 2))
  const rowY = [52, 98, 144]
  const diffText = (d: number, open: boolean) => (d === 0 ? 'igual a su edad' : `${d > 0 ? '+' : '−'}${ageShort(Math.abs(d))}${open ? ' o más' : ''}`)

  const Dots = ({ y, pts, gold }: { y: number; pts: ({ m: number; label: string; gt: boolean } | null)[]; gold?: boolean }) => {
    const p0 = two ? pts[0] : null, p1 = pts[pts.length - 1]
    return (
      <g>
        {p0 && p1 && <line x1={x(p0.m)} y1={y} x2={x(p1.m)} y2={y} stroke="#CFC8BA" strokeWidth={2} />}
        {p0 && <circle cx={x(p0.m)} cy={y} r={5} fill="#fff" stroke={STONE} strokeWidth={2} />}
        {p1 && <circle cx={x(p1.m)} cy={y} r={6.5} fill={gold ? GOLD : INK} />}
        {p1?.gt && <path d={`M${x(p1.m) + 11} ${y - 5} L${x(p1.m) + 17} ${y} L${x(p1.m) + 11} ${y + 5}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {p0 && (() => { const a = anchorFor(x(p0.m)); return <text x={a.x} y={y + 22} fontSize={12} fill={MUTED} textAnchor={a.anchor}>{p0.label}</text> })()}
        {p1 && !gold && (() => { const a = anchorFor(x(p1.m)); return <text x={a.x} y={y - 13} fontSize={13} fontWeight={700} fill={INK} textAnchor={a.anchor}>{p1.label}</text> })()}
      </g>
    )
  }

  return (
    <svg width={W} height={196} viewBox={`0 0 ${W} 196`} role="img" aria-label="Edad motora frente a edad real" style={{ display: 'block' }}>
      <g stroke="#EEE9DF" strokeWidth={1}>{ticks.map((m) => <line key={m} x1={x(m)} y1={28} x2={x(m)} y2={172} />)}</g>
      <line x1={X0} y1={172} x2={X1} y2={172} stroke="#B5AD9E" strokeWidth={1} />
      <g fontFamily="Manrope, sans-serif" fontSize={12} fill={MUTED}>
        {ticks.map((m, i) => <text key={m} x={x(m)} y={190} textAnchor={i === ticks.length - 1 ? 'end' : 'middle'}>{i === ticks.length - 1 ? `${m / 12} años` : m / 12}</text>)}
      </g>
      <line x1={x(nowAge)} y1={24} x2={x(nowAge)} y2={172} stroke={GOLD} strokeWidth={2} strokeDasharray="5 4" />
      <rect x={pillX} y={1} width={pillW} height={23} rx={11.5} fill="#fff" stroke={GOLD} strokeWidth={1.5} />
      <text x={pillX + pillW / 2} y={17} fontFamily="Manrope, sans-serif" fontSize={12} fontWeight={700} fill={GOLD_TXT} textAnchor="middle">{pill}</text>
      <g fontFamily="Manrope, sans-serif">
        <text x={0} y={rowY[0] - 4} fontSize={14} fontWeight={700} fill={INK}>{overMax ? 'Edad de comparación' : 'Edad real'}</text>
        <text x={0} y={rowY[0] + 13} fontSize={12} fill={MUTED}>{two ? 'en cada test' : 'el día del test'}</text>
        <Dots y={rowY[0]} gold pts={chrono.map((c) => (c === null ? null : { m: c, label: ageShort(c), gt: false }))} />
        {rows.map((r, i) => {
          const y = rowY[i + 1], last = r.pts[r.pts.length - 1]
          return (
            <g key={r.label}>
              <text x={0} y={y - 4} fontSize={14} fontWeight={700} fill={INK}>{r.label}</text>
              {last && <text x={0} y={y + 13} fontSize={12} fontWeight={700} fill={GOLD_TXT}>{diffText(last.m - nowAge, last.gt || last.lt)}</text>}
              <Dots y={y} pts={r.pts} />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ---------- Página 1: resumen ----------
function PageSummary({ kid, tests, n, total }: { kid: Kid; tests: TestData[]; n: number; total: number }) {
  const cur = tests[tests.length - 1], prev = tests.length > 1 ? tests[0] : undefined
  const r = cur.result, a = r.age
  const name = kid.name.split(' ')[0]
  const labels: [string, string] = !prev ? ['', 'Resultado'] : n <= 2 ? ['1.er test', '2.º test'] : ['Anterior', 'Actual']
  const prefs = preferences(kid)
  const folder = kid.folderId ? folderLabel(kid.folderId) : ''
  const evaluator = evaluatorName()
  let change = `Este informe es su punto de partida: servirá para medir su progreso en las próximas evaluaciones.`
  if (prev?.result.rating && r.rating) {
    const d = levelIdx(r) - levelIdx(prev.result)
    change = d > 0 ? `Desde su evaluación anterior avanzó ${d === 1 ? 'un nivel' : `${d} niveles`}: de «${prev.result.rating.es}» a «${r.rating.es}».`
      : d === 0 ? `Se mantiene en el nivel «${r.rating.es}» respecto a su evaluación anterior.`
      : `Respecto a su evaluación anterior pasó de «${prev.result.rating.es}» a «${r.rating.es}».`
  } else if (prev) change = 'Su progreso respecto a la evaluación anterior se detalla en las áreas y en la segunda página.'
  const facts: [string, string][] = [
    ['Edad', a ? `${plural(a.years, 'año', 'años')}, ${plural(a.months, 'mes', 'meses')}, ${plural(a.days, 'día', 'días')}` : '—'],
    ['Evaluación', longDate(cur.date)],
    ...(prev ? [['Anterior', longDate(prev.date)] as [string, string]] : []),
    ...(folder ? [['Grupo', folder] as [string, string]] : []),
    ...(evaluator ? [['Evaluador', evaluator] as [string, string]] : []),
  ]
  return (
    <div className="report-page" style={pageStyle}>
      <Header right={evalTitle(n)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: SERIF, fontSize: kid.name.length > 22 ? 42 : 52, fontWeight: 600, lineHeight: 1, color: INK }}>{kid.name}</span>
          {kid.birthDate && <span style={{ fontSize: 14 }}><span style={{ color: MUTED }}>Fecha de nacimiento</span>  ·  {longDate(kid.birthDate)}</span>}
          {prefs && <span style={{ fontSize: 14 }}><span style={{ color: MUTED }}>Preferencias</span>  ·  {prefs}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 14, rowGap: 5, fontSize: 12, whiteSpace: 'nowrap', flex: 'none' }}>
          {facts.map(([k, v]) => [<span key={k} style={{ color: MUTED }}>{k}</span>, <span key={k + 'v'} style={{ fontWeight: 600, color: INK, textAlign: 'right' }}>{v}</span>])}
        </div>
      </div>

      <div style={{ background: PANEL, padding: '22px 28px 18px', display: 'flex', flexDirection: 'column', gap: 16, ...exact }}>
        <div style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none', minWidth: 180 }}>
            <span style={{ ...eyebrow, color: MUTED }}>Nivel general</span>
            <span style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, lineHeight: 1.05, color: INK, whiteSpace: 'nowrap' }}>{r.rating?.es ?? '—'}</span>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: '#DCD5C7' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.5 }}>
            {r.rating
              ? <span>{name} tiene un desarrollo motor <strong style={{ color: INK }}>{expectation(r)}</strong> para su edad.</span>
              : <span>No se pudo calcular el nivel general: revisa la fecha de nacimiento, el sexo y las tablas en Ajustes.</span>}
            <span>{change}</span>
          </div>
        </div>
        {r.gmq !== null && <LevelScale cur={r} prev={prev?.result} labels={labels} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
          <AreaCard title="Locomoción" sub="loc" cur={r} prev={prev?.result} />
          <AreaCard title="Control de objetos" sub="obj" cur={r} prev={prev?.result} />
        </div>
        {prev && (
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: MUTED }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, background: INK, ...exact }} />Nivel del {labels[0].toLowerCase()}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, background: GOLD, ...exact }} />Avance en el {labels[1].toLowerCase()}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.1 }}>Edad motora frente a edad real</span>
          {prev && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: MUTED, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${STONE}`, background: '#fff' }} />{labels[0]}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: INK, ...exact }} />{labels[1]}</span>
            </div>
          )}
        </div>
        <AgeTimeline tests={tests} overMax={r.overMax} />
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          {r.overMax
            ? <>Mayor de 10 años: se compara con la edad máxima de las normas (10 años 11 meses).</>
            : <>La línea dorada es su edad de hoy: a la derecha, niños <strong style={{ color: INK }}>mayores</strong>; a la izquierda, menores.</>}
        </span>
      </div>

      <div style={{ marginTop: 'auto' }}><Footer kid={kid} date={cur.date} page={1} total={total} /></div>
    </div>
  )
}

// ---------- Página 2: detalle ----------
function PageDetail({ kid, tests, sessionId, editable, n, total }: { kid: Kid; tests: TestData[]; sessionId: string; editable: boolean; n: number; total: number }) {
  const cur = tests[tests.length - 1], prev = tests.length > 1 ? tests[0] : undefined
  const r = cur.result
  const [conc, setConc] = useState(cur.score?.conclusions ?? '')
  const [sugg, setSugg] = useState(cur.score?.suggestions ?? '')
  useEffect(() => { setConc(cur.score?.conclusions ?? ''); setSugg(cur.score?.suggestions ?? '') }, [cur.score?.conclusions, cur.score?.suggestions])
  const save = (patch: { conclusions?: string; suggestions?: string }) => setReportText(sessionId, kid.id, patch)
  const labels = n <= 2 ? ['1.er test', '2.º test'] : ['Anterior', 'Actual']
  const evaluator = evaluatorName()
  const paras = conc.split('\n').map((s) => s.trim()).filter(Boolean)
  const recs = sugg.split('\n').map((s) => s.trim()).filter(Boolean)
  const area: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px dashed #D9C9A8', background: '#FFFBEB', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55, padding: '8px 10px', resize: 'vertical', color: BODY }
  const subTitle: CSSProperties = { fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.1 }

  const SkillRow = ({ id }: { id: string }) => {
    const s = r.skills.find((x) => x.skill.id === id)!
    const p = prev?.result.skills.find((x) => x.skill.id === id)?.pct
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{s.skill.name}</span>
          <span style={{ fontSize: 12, color: MUTED }}>
            {p !== undefined && (Math.round(p) === Math.round(s.pct) ? 'se mantiene · ' : `antes ${Math.round(p)} % · `)}
            <strong style={{ fontSize: 14, color: INK }}>{Math.round(s.pct)} %</strong>
          </span>
        </div>
        <div style={{ position: 'relative', height: 5, background: TRACK, ...exact }}>
          <div style={{ width: `${s.pct}%`, height: '100%', background: INK, ...exact }} />
          {p !== undefined && <div style={{ position: 'absolute', left: `${p}%`, marginLeft: p >= 99 ? -2 : -1, top: -4, width: 2, height: 13, background: STONE, ...exact }} />}
        </div>
      </div>
    )
  }

  return (
    <div className="report-page" style={pageStyle}>
      <Header right="Detalle por habilidad" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <span style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, lineHeight: 1, color: INK }}>Habilidad por habilidad</span>
        {prev && (
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: MUTED, alignItems: 'center', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, background: STONE, ...exact }} />{labels[0]}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 5, background: INK, ...exact }} />{labels[1]}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 44, marginTop: -6 }}>
        {(['loc', 'obj'] as const).map((sub) => (
          <div key={sub} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <span style={{ ...eyebrow, fontWeight: 700, color: INK, paddingBottom: 8, borderBottom: `1px solid ${HAIR}` }}>{sub === 'loc' ? 'Locomoción' : 'Control de objetos'}</span>
            {SKILLS.filter((s) => s.subtest === sub).map((s) => <SkillRow key={s.id} id={s.id} />)}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 44, marginTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={subTitle}>Conclusiones</span>
          {editable && <textarea className="screen-only" aria-label="Conclusiones" value={conc} rows={7} placeholder="Escribe aquí o usa “Sugerir texto”. Cada línea es un párrafo." onChange={(e) => setConc(e.target.value)} onBlur={() => save({ conclusions: conc })} style={area} />}
          <div className={editable ? 'print-only' : ''}>
            {paras.map((t, i) => <p key={i} style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.65 }}>{t}</p>)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={subTitle}>Recomendaciones</span>
          {editable && <textarea className="screen-only" aria-label="Recomendaciones" value={sugg} rows={7} placeholder="Una recomendación por línea, o usa “Sugerir texto”." onChange={(e) => setSugg(e.target.value)} onBlur={() => save({ suggestions: sugg })} style={area} />}
          <div className={editable ? 'print-only' : ''}>
            {recs.length > 1
              ? recs.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: GOLD, lineHeight: 1.1, flex: 'none', width: 14 }}>{i + 1}</span>
                  <span>{t}</span>
                </div>
              ))
              : recs.map((t, i) => <p key={i} style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.65 }}>{t}</p>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...eyebrow, color: MUTED }}>Próxima evaluación recomendada</span>
          <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: INK, lineHeight: 1.1 }}>{longDate(addMonths(cur.date, 3))}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 250, textAlign: 'center' }}>
          <div style={{ height: 28, borderBottom: `1px solid ${STONE}` }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{evaluator || ' '}</span>
          <span style={{ fontSize: 12, color: MUTED }}>Evaluador</span>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: MUTED }}>
          <strong style={{ color: BODY }}>Nota.</strong> Evaluación del desarrollo motor con fines educativos y orientativos; no constituye un diagnóstico médico. Los resultados reflejan el desempeño del día de la evaluación y pueden variar con la práctica y la maduración. Para una evaluación clínica, consulte a un profesional de la salud.
        </p>
        <Footer kid={kid} date={cur.date} page={2} total={total} />
      </div>
    </div>
  )
}

// ---------- Página 3: registro visual (solo en el celular donde están las fotos) ----------
function PageVisual({ kid, date, rows }: { kid: Kid; date: string; rows: VisualRow[] }) {
  return (
    <div className="report-page" style={pageStyle}>
      <Header right="Registro visual" />
      <VisualPageBody rows={rows} styles={{ INK, MUTED, HAIR, PANEL, SERIF, eyebrow }} />
      <div style={{ marginTop: 'auto' }}><Footer kid={kid} date={date} page={3} total={3} /></div>
    </div>
  )
}

/** Informe completo de un niño: 2 páginas tamaño carta, y una 3.ª si este celular tiene su registro visual. */
export function ReportPages({ kid, tests, sessionId, editable, n }: { kid: Kid; tests: TestData[]; sessionId: string; editable: boolean; n: number }) {
  const rows = visualRows(useKidVisual(sessionId, kid.id))
  const total = rows.length ? 3 : 2
  const cur = tests[tests.length - 1]
  return (
    <>
      <PageSummary kid={kid} tests={tests} n={n} total={total} />
      <PageDetail kid={kid} tests={tests} sessionId={sessionId} editable={editable} n={n} total={total} />
      {rows.length > 0 && <PageVisual kid={kid} date={cur.date} rows={rows} />}
    </>
  )
}

// ---------- Pantalla del informe (uno o todo el grupo) ----------
export function ReportScreen() {
  const { id = '', kidId } = useParams()
  const nav = useNavigate()
  const { sessions, kids, scores, norms } = useStore()
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 16) / 816))
    fit(); window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const s = sessions.find((x) => x.id === id)
  if (!s) return <div className="empty">Esta sesión ya no existe.</div>
  const kidList = (kidId ? [kids.find((k) => k.id === kidId)] : s.kidIds.map((k) => kids.find((x) => x.id === k))).filter(Boolean) as Kid[]

  const suggest = () => {
    const single = kidList.length === 1
    if (single) {
      const t = kidTests(kidList[0], s, sessions, scores, norms), cur = t[t.length - 1]
      if ((cur.score?.conclusions || cur.score?.suggestions) && !window.confirm('¿Reemplazar las conclusiones y recomendaciones que ya escribiste por un texto sugerido?')) return
    }
    kidList.forEach((k) => {
      const t = kidTests(k, s, sessions, scores, norms)
      const cur = t[t.length - 1], prev = t.length > 1 ? t[0] : undefined
      if (single || (!cur.score?.conclusions && !cur.score?.suggestions)) setReportText(s.id, k.id, draftTexts(k, cur, prev))
    })
  }
  const excel = async () => {
    setBusy(true)
    try {
      const ok = await exportFoldersOf(kidList)
      if (!ok) alert('Todavía no hay niños puntuados para exportar.')
    } finally { setBusy(false) }
  }
  const btn = { height: 44, padding: '0 14px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 900 } as const

  return (
    <div style={{ background: '#E3EAF0', minHeight: '100%' }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #E3EAF0', padding: 'calc(10px + env(safe-area-inset-top)) 10px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="icon-btn light" aria-label="Volver" onClick={() => nav(kidId ? `/sesion/${s.id}/resultados/${kidId}` : `/sesion/${s.id}/resultados`)}>✕</button>
        <span style={{ flex: 1, fontWeight: 900, fontSize: 16, minWidth: 120 }}>{kidId ? 'Informe gráfico' : `Informes del grupo (${kidList.length})`}</span>
        <button style={{ ...btn, background: '#F4F7FA', color: '#1B2733' }} onClick={suggest}>Sugerir texto</button>
        {kidId && <button style={{ ...btn, background: '#F4F7FA', color: '#1B2733' }} onClick={() => nav(`/sesion/${s.id}/registro/${kidId}`)}>Registro visual</button>}
        <button style={{ ...btn, background: '#0B7A61', color: '#fff' }} disabled={busy} onClick={excel}>{busy ? 'Generando…' : `Excel de ${[...new Set(kidList.map((k) => folderLabel(k.folderId)))].join(' + ')}`}</button>
        <button style={{ ...btn, background: '#0A6FA8', color: '#fff' }} onClick={() => window.print()}>PDF / Imprimir</button>
      </div>
      <div className="no-print" style={{ padding: '8px 12px', fontSize: 13, color: '#33414E' }}>
        Cada informe tiene 2 páginas, y una 3.ª con el registro visual si este celular tiene sus fotos (botón “Registro visual” en el informe de cada niño). Toca “Sugerir texto” para un borrador de conclusiones y recomendaciones, y edítalo en los recuadros amarillos de la página 2. Para el PDF, elige “Guardar como PDF” en la ventana de impresión.
      </div>
      <div className="report-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 8px 24px' }}>
        {kidList.map((k) => {
          const t = kidTests(k, s, sessions, scores, norms)
          return (
            <div key={k.id} className="report-scale" style={{ zoom: scale, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ReportPages kid={k} tests={t} sessionId={s.id} editable n={evalNumber(k, s, sessions, scores)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
