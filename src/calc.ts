// Cálculos del TGMD-2: edad, puntajes brutos, %, y conversión con las tablas normativas.
// Las tablas NO están en este código (tienen derechos de autor): se cargan desde un archivo
// privado del evaluador y se guardan en su cuenta (colección "norms").
import type { Kid, Score } from './store'
import { SKILLS, maxScore, type Skill } from './skills'
import { ageAt, type Age } from './age'

export interface NormColumn { months: [number, number]; ss: ([number, number] | null)[] }
export interface AeRow { ae: string; range?: [number, number]; max?: number; min?: number }
export interface Norms {
  app: 'tgmd-normas'
  version: number
  percentilBySS: string[]
  locomotor: NormColumn[]
  objectFemale: NormColumn[]
  objectMale: NormColumn[]
  ageEquivalent: { locomotor: AeRow[]; objectFemale: AeRow[]; objectMale: AeRow[] }
  gmq: { sum: number; gmq: number; percentil: string }[]
}

export function validateNorms(d: unknown): d is Norms {
  const n = d as Norms
  return !!n && n.app === 'tgmd-normas' && Array.isArray(n.locomotor) && Array.isArray(n.objectFemale)
    && Array.isArray(n.objectMale) && Array.isArray(n.gmq) && !!n.ageEquivalent && Array.isArray(n.percentilBySS)
}

/** Máximo de las normas: 10 años 11 meses. */
export const MAX_MONTHS = 10 * 12 + 11
export const MIN_MONTHS = 3 * 12

export const ageMonths = (a: Age) => a.years * 12 + a.months
export const monthsText = (m: number) => `${Math.floor(m / 12)}-${m % 12}`
/** "5-9" → 69 meses */
export const aeToMonths = (ae: string) => { const [y, m] = ae.replace(/[<>]/g, '').split('-').map(Number); return y * 12 + (m || 0) }

export function dateFromIso(iso: string) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
export function addMonths(iso: string, n: number): string {
  const d = dateFromIso(iso)
  const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + n)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const markKey = (skillId: string, i: number) => `${skillId}:${i}`

export interface SkillResult { skill: Skill; points: number; max: number; pct: number; unmarked: number }
export interface SubtestResult {
  raw: number; max: number; pct: number
  ss: number | null; percentile: string | null; ae: string | null
}
export interface Result {
  testDate: string
  age: Age | null           // edad real en la fecha del test
  normMonths: number | null // edad usada para las normas (tope 10-11)
  overMax: boolean
  underMin: boolean
  skills: SkillResult[]
  loc: SubtestResult
  obj: SubtestResult
  sumSS: number | null
  gmq: number | null
  gmqPercentile: string | null
  rating: { es: string; en: string } | null
  unmarked: number
  warnings: string[]
}

function lookupSS(cols: NormColumn[], months: number, raw: number): number | null {
  const col = cols.find((c) => months >= c.months[0] && months <= c.months[1])
  if (!col) return null
  const r = Math.max(1, raw)
  for (let i = 0; i < col.ss.length; i++) {
    const range = col.ss[i]
    if (range && r >= range[0] && r <= range[1]) return i + 1
  }
  return null
}

function lookupAE(rows: AeRow[], raw: number): string | null {
  // Si el puntaje no aparece exacto (filas con "—"), se usa la edad más alta cuyo puntaje sea ≤ al obtenido.
  let best: string | null = null
  for (const r of rows) {
    if (r.max !== undefined && raw <= r.max) return r.ae
    if (r.min !== undefined && raw >= r.min) return r.ae
    if (r.range) {
      if (raw >= r.range[0] && raw <= r.range[1]) return r.ae
      if (raw > r.range[1]) best = r.ae
    }
  }
  return best
}

export function ratingFor(gmq: number) {
  if (gmq > 130) return { es: 'Muy superior', en: 'Very superior' }
  if (gmq >= 121) return { es: 'Superior', en: 'Superior' }
  if (gmq >= 111) return { es: 'Sobre el promedio', en: 'Above average' }
  if (gmq >= 90) return { es: 'Promedio', en: 'Average' }
  if (gmq >= 80) return { es: 'Bajo el promedio', en: 'Below average' }
  if (gmq >= 70) return { es: 'Pobre', en: 'Poor' }
  return { es: 'Muy pobre', en: 'Very poor' }
}

export function computeResult(kid: Kid, score: Score | undefined, testDate: string, norms: Norms | null): Result {
  const warnings: string[] = []
  const skills: SkillResult[] = SKILLS.map((sk) => {
    let points = 0, unmarked = 0
    sk.criteria.forEach((_, i) => {
      const v = score?.marks[markKey(sk.id, i)] ?? [null, null]
      v.forEach((x) => { if (x === 1) points++; if (x === null) unmarked++ })
    })
    const max = maxScore(sk)
    return { skill: sk, points, max, pct: (points / max) * 100, unmarked }
  })
  const unmarked = skills.reduce((n, s) => n + s.unmarked, 0)
  if (unmarked) warnings.push(`Faltan ${unmarked} marcas por puntuar: por ahora cuentan como 0.`)

  const sum = (sub: 'loc' | 'obj') => skills.filter((s) => s.skill.subtest === sub).reduce((n, s) => n + s.points, 0)
  const locRaw = sum('loc'), objRaw = sum('obj')

  const age = kid.birthDate ? ageAt(kid.birthDate, dateFromIso(testDate)) : null
  if (!age) warnings.push('Falta la fecha de nacimiento: no se pueden calcular los puntajes estándar.')
  const months = age ? ageMonths(age) : null
  const overMax = months !== null && months > MAX_MONTHS
  const underMin = months !== null && months < MIN_MONTHS
  if (underMin) warnings.push('El niño tiene menos de 3 años: el TGMD-2 no tiene normas para esa edad.')
  const normMonths = months === null || underMin ? null : Math.min(months, MAX_MONTHS)
  if (!kid.sex) warnings.push('Falta el sexo: no se puede convertir Control de Objetos.')
  if (!norms) warnings.push('Faltan las tablas normativas: cárgalas en Ajustes.')

  let locSS: number | null = null, objSS: number | null = null
  let locAE: string | null = null, objAE: string | null = null
  if (norms) {
    locAE = lookupAE(norms.ageEquivalent.locomotor, locRaw)
    if (kid.sex) objAE = lookupAE(kid.sex === 'F' ? norms.ageEquivalent.objectFemale : norms.ageEquivalent.objectMale, objRaw)
    if (normMonths !== null) {
      locSS = lookupSS(norms.locomotor, normMonths, locRaw)
      if (kid.sex) objSS = lookupSS(kid.sex === 'F' ? norms.objectFemale : norms.objectMale, normMonths, objRaw)
    }
  }
  const pctOf = (ss: number | null) => (ss && norms ? norms.percentilBySS[ss - 1] ?? null : null)
  const sumSS = locSS !== null && objSS !== null ? locSS + objSS : null
  const gmqRow = sumSS !== null && norms ? norms.gmq.find((g) => g.sum === sumSS) ?? null : null

  return {
    testDate, age, normMonths, overMax, underMin, skills, unmarked, warnings,
    loc: { raw: locRaw, max: 48, pct: (locRaw / 48) * 100, ss: locSS, percentile: pctOf(locSS), ae: locAE },
    obj: { raw: objRaw, max: 48, pct: (objRaw / 48) * 100, ss: objSS, percentile: pctOf(objSS), ae: objAE },
    sumSS,
    gmq: gmqRow?.gmq ?? null,
    gmqPercentile: gmqRow?.percentil ?? null,
    rating: gmqRow ? ratingFor(gmqRow.gmq) : null,
  }
}
