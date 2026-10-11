import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, scoreId, setReportText, type Kid, type Score, type Session } from './store'
import { computeResult, aeToMonths, dateFromIso, type Norms, type Result } from './calc'
import { SKILLS, type Skill } from './skills'
import type { TestData } from './excel'
import { exportFoldersOf, folderLabel } from './exports'

const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const longDate = (iso: string) => { const d = dateFromIso(iso); return `${d.getDate()} / ${MONTHS_LONG[d.getMonth()]} / ${d.getFullYear()}` }

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

// ---------- Borrador automático de conclusiones ----------
export function draftTexts(kid: Kid, t: TestData): { conclusions: string; suggestions: string } {
  const r = t.result
  const name = kid.name.split(' ')[0]
  const sorted = [...r.skills].sort((a, b) => a.pct - b.pct)
  const weak = sorted.filter((x) => x.pct < 75).slice(0, 3)
  const strong = [...r.skills].sort((a, b) => b.pct - a.pct).filter((x) => x.pct >= 85).slice(0, 3)
  const failed = (sk: Skill) => sk.criteria
    .map((c, i) => ({ c, v: t.score?.marks[`${sk.id}:${i}`] ?? [null, null] }))
    .filter((x) => x.v[0] !== 1 && x.v[1] !== 1)
    .map((x) => x.c.short.charAt(0).toLowerCase() + x.c.short.slice(1))
  const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
  const parts: string[] = []
  if (r.rating && r.gmq !== null) parts.push(`${name} obtuvo un cociente motor (GMQ) de ${r.gmq}, en la categoría "${r.rating.es}".`)
  if (strong.length) parts.push(`Sus fortalezas están en ${list(strong.map((x) => x.skill.name.toLowerCase()))}.`)
  if (weak.length) {
    const details = weak.map((x) => { const f = failed(x.skill); return f.length ? `${x.skill.name.toLowerCase()} (${list(f.slice(0, 2))})` : x.skill.name.toLowerCase() })
    parts.push(`El área de mejora está en ${list(details)}.`)
  } else parts.push('Muestra un buen dominio en todas las habilidades evaluadas.')
  const sugg = weak.length
    ? `Enfocar los ejercicios en ${list(weak.map((x) => x.skill.name.toLowerCase()))}, trabajando especialmente ${list([...new Set(weak.flatMap((x) => failed(x.skill).slice(0, 1)))])}. Mantener actividades variadas que refuercen las habilidades ya logradas.`
    : 'Mantener actividades variadas que sostengan su buen nivel e incorporar desafíos de mayor dificultad en coordinación, ritmo y precisión.'
  return { conclusions: parts.join(' '), suggestions: sugg }
}

// ---------- Gráficos ----------
const C = 150, R = 100
const pt = (i: number, v: number) => {
  const a = ((-90 + 60 * i) * Math.PI) / 180
  return `${(C + R * v * Math.cos(a)).toFixed(1)},${(C + R * v * Math.sin(a)).toFixed(1)}`
}
const ring = (v: number) => [0, 1, 2, 3, 4, 5].map((i) => pt(i, v)).join(' ')
const LABEL_POS: { x: number; y: number; anchor: 'middle' | 'start' | 'end'; inline: boolean }[] = [
  { x: 150, y: 22, anchor: 'middle', inline: true },
  { x: 246, y: 92, anchor: 'start', inline: false },
  { x: 246, y: 206, anchor: 'start', inline: false },
  { x: 150, y: 280, anchor: 'middle', inline: true },
  { x: 54, y: 206, anchor: 'end', inline: false },
  { x: 54, y: 92, anchor: 'end', inline: false },
]

function Radar({ skills, cur, prev, fill, stroke }: { skills: Skill[]; cur: Result; prev?: Result; fill: string; stroke: string }) {
  const pctOf = (r: Result, sk: Skill) => (r.skills.find((x) => x.skill.id === sk.id)?.pct ?? 0) / 100
  return (
    <svg width="352" height="222" viewBox="-80 0 460 292" style={{ margin: '14px 0 6px' }} role="img" aria-label="Porcentaje logrado por habilidad">
      <polygon points={ring(1)} fill="none" stroke="#D1D5DB" />
      <polygon points={ring(0.5)} fill="none" stroke="#D1D5DB" strokeDasharray="3 3" />
      {skills.map((_, i) => <line key={i} x1={C} y1={C} x2={pt(i, 1).split(',')[0]} y2={pt(i, 1).split(',')[1]} stroke="#E5E7EB" />)}
      <polygon points={skills.map((sk, i) => pt(i, pctOf(cur, sk))).join(' ')} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={2} />
      {prev && <polygon points={skills.map((sk, i) => pt(i, pctOf(prev, sk))).join(' ')} fill="none" stroke="#1B2733" strokeWidth={1.6} strokeDasharray="5 4" />}
      {skills.map((sk, i) => {
        const p = LABEL_POS[i]
        const pct = `${Math.round(pctOf(cur, sk) * 100)}%`
        return p.inline
          ? <text key={sk.id} x={p.x} y={p.y} fontSize={15} textAnchor={p.anchor} fill="#1B2733">{sk.name} <tspan fontWeight={900}>{pct}</tspan></text>
          : <g key={sk.id}><text x={p.x} y={p.y} fontSize={15} textAnchor={p.anchor} fill="#1B2733">{sk.name}</text><text x={p.x} y={p.y + 18} fontSize={15} fontWeight={900} textAnchor={p.anchor} fill="#1B2733">{pct}</text></g>
      })}
    </svg>
  )
}

function ageDiffText(months: number) {
  const m = Math.abs(months), y = Math.floor(m / 12), mm = m % 12
  const parts = []
  if (y) parts.push(`${y} ${y === 1 ? 'año' : 'años'}`)
  if (mm) parts.push(`${mm} ${mm === 1 ? 'mes' : 'meses'}`)
  if (!parts.length) return 'igual a su edad'
  return `${parts.join(' ')} ${months > 0 ? 'por encima' : 'por debajo'} de su edad`
}

function AgeChart({ tests, sub, light, strong }: { tests: TestData[]; sub: 'loc' | 'obj'; light: string; strong: string }) {
  const items = tests.map((t, i) => {
    const ae = t.result[sub].ae
    const chrono = t.result.normMonths
    if (!ae || chrono === null) return null
    const aeM = ae.startsWith('<') ? aeToMonths(ae) - 1 : ae.startsWith('>') ? aeToMonths(ae) + 1 : aeToMonths(ae)
    return { label: ae.replace('<', '< ').replace('>', '> '), diff: aeM - chrono, color: i === tests.length - 1 ? strong : light, ink: i === tests.length - 1 && sub === 'obj' ? '#fff' : '#1B2733' }
  })
  const valid = items.filter(Boolean) as NonNullable<(typeof items)[number]>[]
  if (!valid.length) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6B7B', fontSize: 13 }}>Sin datos de edad equivalente</div>
  // Margen extra para que la etiqueta de la barra no choque con el borde del gráfico.
  let lo = Math.min(0, Math.floor((Math.min(...valid.map((v) => v.diff)) - 5) / 12))
  let hi = Math.max(0, Math.ceil((Math.max(...valid.map((v) => v.diff)) + 5) / 12))
  if (hi - lo < 2) { if (hi === 0) lo = Math.min(lo, -2); else hi = Math.max(hi, 2) }
  const H = 170, ppy = H / (hi - lo), zeroY = hi * ppy
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i)
  const last = valid[valid.length - 1]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', width: 24, height: H + 6, fontSize: 11, color: '#6B7280', textAlign: 'right' }}>
          {ticks.map((t) => <span key={t} style={{ position: 'absolute', right: 0, top: (hi - t) * ppy - 6 }}>{t > 0 ? `+${t}` : t}</span>)}
        </div>
        <div style={{ flex: 1, position: 'relative', height: H + 6 }}>
          {ticks.map((t) => <div key={t} style={{ position: 'absolute', left: 0, right: 0, top: (hi - t) * ppy, borderTop: '1px dashed #E5E7EB' }} />)}
          {items.map((it, i) => {
            if (!it) return null
            const h = Math.max(2, (Math.abs(it.diff) / 12) * ppy)
            const top = it.diff >= 0 ? zeroY - h : zeroY
            const left = 30 + i * 88
            return (
              <div key={i}>
                <div style={{ position: 'absolute', left, width: 72, top, height: h, background: it.color, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                <div style={{ position: 'absolute', left, width: 72, textAlign: 'center', fontSize: 15, fontWeight: 900, top: it.diff >= 0 ? top - 20 : top + h + 2 }}>{it.label}</div>
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: 0, right: 0, top: zeroY - 2, height: 4, background: '#0A6FA8' }} />
          <div style={{ position: 'absolute', right: 0, top: lo === 0 ? zeroY - 20 : zeroY + 6, fontSize: 12, fontWeight: 900, color: '#0A6FA8' }}>Edad cronológica</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#33414E' }}>{tests.length > 1 ? '2° test' : 'Test'}: <strong>{ageDiffText(last.diff)}</strong></div>
    </div>
  )
}

function Bar({ pct, prev, color }: { pct: number; prev?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 18, background: '#E5E7EB', borderRadius: 9, position: 'relative', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9 }} />
        {prev !== undefined && <div style={{ position: 'absolute', left: `${prev}%`, top: -4, width: 3, height: 26, background: '#1B2733' }} />}
      </div>
      <span style={{ fontSize: 18, fontWeight: 900 }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

// ---------- Informe de una página ----------
export function ReportPage({ kid, tests, sessionId, editable }: { kid: Kid; tests: TestData[]; sessionId: string; editable: boolean }) {
  const cur = tests[tests.length - 1]
  const prev = tests.length > 1 ? tests[0] : undefined
  const r = cur.result
  const [conc, setConc] = useState(cur.score?.conclusions ?? '')
  const [sugg, setSugg] = useState(cur.score?.suggestions ?? '')
  useEffect(() => { setConc(cur.score?.conclusions ?? ''); setSugg(cur.score?.suggestions ?? '') }, [cur.score?.conclusions, cur.score?.suggestions])
  const save = (patch: { conclusions?: string; suggestions?: string }) => setReportText(sessionId, kid.id, patch)
  const loc = SKILLS.filter((s) => s.subtest === 'loc'), obj = SKILLS.filter((s) => s.subtest === 'obj')
  const a = r.age
  const box = { padding: '10px 16px', fontSize: 14, lineHeight: 1.45, minHeight: 90, whiteSpace: 'pre-wrap' as const }
  const area = { ...box, width: '100%', border: 'none', resize: 'vertical' as const, fontFamily: 'inherit', background: '#FFFBEB', boxSizing: 'border-box' as const }

  return (
    <div className="report-page" style={{ width: 816, height: 1056, boxSizing: 'border-box', background: '#fff', fontFamily: 'Lato, sans-serif', color: '#1B2733', padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, color: '#0A6FA8' }}>
        <span>INFORME DE DESARROLLO MOTOR</span>
        <span style={{ fontWeight: 400 }}>{prev ? `1° Test: ${longDate(prev.date)} · 2° Test: ${longDate(cur.date)}` : `Fecha Test: ${longDate(cur.date)}`}</span>
      </div>
      <div style={{ background: '#0A6FA8', color: '#fff', borderRadius: 14, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 900 }}>{kid.name}</span>
          <span style={{ fontSize: 17 }}>Edad: {a ? `${a.years} ${a.years === 1 ? 'año' : 'años'}, ${a.months} ${a.months === 1 ? 'mes' : 'meses'}, ${a.days} ${a.days === 1 ? 'día' : 'días'}` : '—'}</span>
        </div>
        {r.overMax && <span style={{ fontSize: 12, background: 'rgba(255,255,255,.18)', padding: '6px 10px', borderRadius: 8 }}>Calculado con normas de 10 años 11 meses</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 32 }}>
        {([['LOCOMOCIÓN', 'loc', loc, '#F2A541', '#E08E1B', '#C77A12'], ['CONTROL DE OBJETOS', 'obj', obj, '#0E8F72', '#0B7A61', '#0B7A61']] as const).map(([title, k, sks, fill, stroke, ink]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: ink }}>{title}</div>
            <Bar pct={r[k].pct} prev={prev?.result[k].pct} color={fill} />
            {prev && <div style={{ fontSize: 12, color: '#5A6B7B' }}>Línea negra y contorno punteado = 1° test ({prev.result[k].pct.toFixed(1)}%)</div>}
            <Radar skills={[...sks]} cur={r} prev={prev?.result} fill={fill} stroke={stroke} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#0A6FA8' }}>Edad motora vs. edad cronológica</span>
          <span style={{ fontSize: 12, color: '#5A6B7B' }}>Cada línea = 1 año{prev ? ' · claro = 1° test · fuerte = 2° test' : ''}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 32 }}>
          <AgeChart tests={tests} sub="loc" light="#FBDDB2" strong="#F2A541" />
          <AgeChart tests={tests} sub="obj" light="#B5E3D6" strong="#0E8F72" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', border: '2px solid #0A6FA8', borderRadius: 14, overflow: 'hidden', marginTop: 22 }}>
        {([['Conclusiones', conc, setConc, 'conclusions'], ['Sugerencias', sugg, setSugg, 'suggestions']] as const).map(([title, val, setVal, key], i) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', borderRight: i === 0 ? '2px solid #0A6FA8' : 'none' }}>
            <div style={{ background: '#0A6FA8', color: '#fff', fontSize: 16, fontWeight: 900, padding: '8px 16px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{title}</div>
            {editable && <textarea className="screen-only" aria-label={title} value={val} placeholder="Escribe aquí o usa “Sugerir texto”" onChange={(e) => setVal(e.target.value)} onBlur={() => save({ [key]: val })} style={area} rows={5} />}
            <div className={editable ? 'print-only' : ''} style={box}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, lineHeight: 1.45, color: '#33414E', fontStyle: 'italic', marginTop: 'auto' }}>
        <strong>NOTA LEGAL:</strong> Este informe corresponde a una evaluación del desarrollo motor con fines educativos y orientativos. <strong>No constituye un diagnóstico médico.</strong> Los resultados reflejan el desempeño del niño al momento de la evaluación y pueden variar con la práctica, la maduración y el contexto. Para evaluaciones clínicas o diagnósticos específicos, se recomienda acudir a un profesional de la salud especializado.
      </div>
    </div>
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
  const list = (kidId ? [kids.find((k) => k.id === kidId)] : s.kidIds.map((k) => kids.find((x) => x.id === k))).filter(Boolean) as Kid[]

  const suggest = () => {
    list.forEach((k) => {
      const t = kidTests(k, s, sessions, scores, norms)
      const cur = t[t.length - 1]
      if (!cur.score?.conclusions && !cur.score?.suggestions || list.length === 1) setReportText(s.id, k.id, draftTexts(k, cur))
    })
  }
  const excel = async () => {
    setBusy(true)
    try {
      const ok = await exportFoldersOf(list)
      if (!ok) alert('Todavía no hay niños puntuados para exportar.')
    } finally { setBusy(false) }
  }
  const btn = { height: 44, padding: '0 14px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 900 } as const

  return (
    <div style={{ background: '#E3EAF0', minHeight: '100%' }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #E3EAF0', padding: 'calc(10px + env(safe-area-inset-top)) 10px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="icon-btn light" aria-label="Volver" onClick={() => nav(kidId ? `/sesion/${s.id}/resultados/${kidId}` : `/sesion/${s.id}/resultados`)}>✕</button>
        <span style={{ flex: 1, fontWeight: 900, fontSize: 16, minWidth: 120 }}>{kidId ? 'Informe gráfico' : `Informes del grupo (${list.length})`}</span>
        <button style={{ ...btn, background: '#F4F7FA', color: '#1B2733' }} onClick={suggest}>Sugerir texto</button>
        <button style={{ ...btn, background: '#0B7A61', color: '#fff' }} disabled={busy} onClick={excel}>{busy ? 'Generando…' : `Excel de ${[...new Set(list.map((k) => folderLabel(k.folderId)))].join(' + ')}`}</button>
        <button style={{ ...btn, background: '#0A6FA8', color: '#fff' }} onClick={() => window.print()}>PDF / Imprimir</button>
      </div>
      <div className="no-print" style={{ padding: '8px 12px', fontSize: 13, color: '#33414E' }}>
        Toca “Sugerir texto” para un borrador de conclusiones y sugerencias, y edítalo en los recuadros amarillos. Para el PDF, elige “Guardar como PDF” en la ventana de impresión.
      </div>
      <div className="report-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 8px 24px' }}>
        {list.map((k) => {
          const t = kidTests(k, s, sessions, scores, norms)
          return (
            <div key={k.id} className="report-scale" style={{ zoom: scale }}>
              <ReportPage kid={k} tests={t} sessionId={s.id} editable />
            </div>
          )
        })}
      </div>
    </div>
  )
}
