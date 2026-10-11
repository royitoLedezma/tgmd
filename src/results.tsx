import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore, scoreId, type Kid, type Session } from './store'
import { computeResult, monthsText, addMonths, dateFromIso, type SubtestResult } from './calc'
import { Icon, Top } from './ui'
import { dateText } from './sessions'

function ageLong(a: { years: number; months: number; days: number } | null) {
  if (!a) return '—'
  return `${a.years} ${a.years === 1 ? 'año' : 'años'}, ${a.months} ${a.months === 1 ? 'mes' : 'meses'}, ${a.days} ${a.days === 1 ? 'día' : 'días'}`
}

/** Sesiones anteriores en las que el niño ya fue evaluado. */
export function previousSessions(sessions: Session[], kidId: string, before: Session) {
  return sessions
    .filter((s) => s.id !== before.id && s.kidIds.includes(kidId) && s.date <= before.date)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Aviso si entre este test y el anterior hay menos de 1 mes. */
export function tooSoonWarning(sessions: Session[], kidId: string, current: Session): string | null {
  const prev = previousSessions(sessions, kidId, current)[0]
  if (!prev) return null
  if (current.date < addMonths(prev.date, 1)) {
    return `Último test el ${dateText(prev.date)}: debe pasar al menos 1 mes (desde el ${dateText(addMonths(prev.date, 1))}).`
  }
  return null
}

export function ResultList() {
  const { id = '' } = useParams()
  const { sessions, kids, scores, norms } = useStore()
  const s = sessions.find((x) => x.id === id)
  if (!s) return (<><Top title="Resultados" back="/sesiones" /><main className="content"><div className="empty">Esta sesión ya no existe.</div></main></>)
  const list = s.kidIds.map((k) => kids.find((x) => x.id === k)).filter(Boolean) as Kid[]
  return (
    <>
      <Top title="Resultados" sub={dateText(s.date)} back={`/sesion/${s.id}`} />
      <main className="content">
        {list.length > 0 && (
          <Link to={`/sesion/${s.id}/informe`} className="btn primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Informes y Excel de todo el grupo</Link>
        )}
        {!norms && <div className="banner warn">Faltan las tablas normativas. Cárgalas en <Link to="/ajustes">Ajustes</Link> para ver puntajes estándar, percentiles, edad equivalente y GMQ.</div>}
        {list.map((k) => {
          const r = computeResult(k, scores.find((x) => x.id === scoreId(s.id, k.id)), s.date, norms)
          return (
            <Link key={k.id} to={`/sesion/${s.id}/resultados/${k.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="grow">
                <span className="title">{k.name}</span>
                <span className="meta">
                  {r.gmq !== null ? `GMQ ${r.gmq} · ${r.rating?.es}` : `Locomoción ${r.loc.raw}/48 · Control de objetos ${r.obj.raw}/48`}
                </span>
                {r.unmarked > 0 && <span className="tag-warn">Faltan {r.unmarked} marcas</span>}
              </span>
              {Icon.chevron}
            </Link>
          )
        })}
      </main>
    </>
  )
}

function SubCard({ title, color, ink, r }: { title: string; color: string; ink: string; r: SubtestResult }) {
  const cell = (label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 900 }}>{value}</span>
    </div>
  )
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, borderTop: `5px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: ink, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</span>
        <span style={{ fontSize: 26, fontWeight: 900 }}>{r.pct.toFixed(1)}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {cell('Puntaje bruto', `${r.raw} / ${r.max}`)}
        {cell('Puntaje estándar', r.ss !== null ? String(r.ss) : '—')}
        {cell('Percentil', r.percentile ?? '—')}
        {cell('Edad equivalente', r.ae ?? '—')}
      </div>
    </div>
  )
}

export function ResultView() {
  const { id = '', kidId = '' } = useParams()
  const { sessions, kids, scores, norms } = useStore()
  const s = sessions.find((x) => x.id === id)
  const kid = kids.find((k) => k.id === kidId)
  if (!s || !kid) return (<><Top title="Resultados" back={`/sesion/${id}/resultados`} /><main className="content"><div className="empty">No se encontró.</div></main></>)
  const r = computeResult(kid, scores.find((x) => x.id === scoreId(s.id, kid.id)), s.date, norms)
  const soon = tooSoonWarning(sessions, kid.id, s)
  const next = addMonths(s.date, 3)
  const earliest = addMonths(s.date, 1)
  const nextIsPast = dateFromIso(next) < new Date()
  const nav = useNavigate()

  return (
    <>
      <Top title={kid.name} sub={`Test del ${dateText(s.date)}`} back={`/sesion/${s.id}/resultados`} />
      <main className="content" style={{ gap: 12 }}>
        <div className="card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <span className="meta">Edad en la fecha del test</span>
          <span className="title">{ageLong(r.age)}</span>
          {r.overMax && r.normMonths !== null && <span className="tag-info">Mayor de 10 años: se calcula con normas de {monthsText(r.normMonths)} (10 años 11 meses)</span>}
        </div>

        <button className="btn primary" onClick={() => nav(`/sesion/${s.id}/informe/${kid.id}`)}>Informe gráfico · PDF · Excel</button>
        {r.warnings.map((w) => <div key={w} className="banner warn">{w}</div>)}
        {soon && <div className="banner warn">{soon}</div>}

        <SubCard title="Locomoción" color="#F2A541" ink="#A15C07" r={r.loc} />
        <SubCard title="Control de objetos" color="#0E8F72" ink="#0B7A61" r={r.obj} />

        <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cociente motor grueso (GMQ)</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div><div className="meta" style={{ fontSize: 12, color: 'var(--muted)' }}>Suma estándar</div><div style={{ fontSize: 20, fontWeight: 900 }}>{r.sumSS ?? '—'}</div></div>
            <div><div className="meta" style={{ fontSize: 12, color: 'var(--muted)' }}>GMQ</div><div style={{ fontSize: 20, fontWeight: 900 }}>{r.gmq ?? '—'}</div></div>
            <div><div className="meta" style={{ fontSize: 12, color: 'var(--muted)' }}>Percentil</div><div style={{ fontSize: 20, fontWeight: 900 }}>{r.gmqPercentile ?? '—'}</div></div>
          </div>
          {r.rating && (
            <div style={{ background: 'var(--blue-soft)', color: 'var(--blue-dark)', borderRadius: 10, padding: '10px 12px', fontSize: 17, fontWeight: 900 }}>
              {r.rating.es} <span style={{ fontWeight: 400, fontSize: 14 }}>({r.rating.en})</span>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--muted)' }}>Por habilidad</span>
          {r.skills.map((x) => (
            <div key={x.skill.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 48px', alignItems: 'center', gap: 8, fontSize: 15 }}>
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>{x.skill.name}</span>
                <span style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', marginTop: 4 }}>
                  <span style={{ display: 'block', height: '100%', width: `${x.pct}%`, background: x.skill.subtest === 'loc' ? '#F2A541' : '#0E8F72' }} />
                </span>
              </span>
              <span style={{ textAlign: 'right', fontWeight: 900 }}>{x.points}/{x.max}</span>
              <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{Math.round(x.pct)}%</span>
            </div>
          ))}
        </div>

        <div className="card">
          {Icon.camera}
          <span className="grow">
            <span className="meta">Próximo test sugerido (3 meses)</span>
            <span className="title">{dateText(next)}{nextIsPast ? ' · ya le toca' : ''}</span>
            <span className="meta">Se puede tomar desde el {dateText(earliest)} (mínimo 1 mes)</span>
          </span>
        </div>
      </main>
    </>
  )
}
