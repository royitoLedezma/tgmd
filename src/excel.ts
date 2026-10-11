// Exporta la hoja de documentación TGMD-2 en el formato Excel del evaluador.
// Usa la plantilla public/plantilla-tgmd2.xlsx y la rellena con los datos.
import type ExcelJS from 'exceljs'
import type { Kid, Score, Side } from './store'
import type { Result } from './calc'
import { SKILLS } from './skills'
import { dateFromIso } from './calc'

/** Fila del primer criterio de cada prueba en la hoja. */
const FIRST_ROW: Record<string, number> = {
  correr: 20, galopar: 26, 'saltar-unipodal': 32, brincar: 39, 'saltar-bipodal': 44, deslizar: 50,
  golpear: 58, driblear: 65, atrapar: 71, patear: 76, lanzar: 82, rodar: 88,
}

export interface TestData { date: string; score: Score | undefined; result: Result }

function ageLabel(r: Result) {
  if (!r.age) return 'Edad: —'
  const a = r.age
  let t = `Edad: ${a.years} años ${a.months} meses ${a.days} días`
  if (r.overMax) t += ' (normas 10-11)'
  return t
}

function sideMarks(ws: ExcelJS.Worksheet, row: number, cols: [string, string, string], side: Side) {
  const labels = ['Derecha', 'Izquierda', 'No establecida']
  const on = [side === 'D' || side === 'A', side === 'I' || side === 'A', side === 'N']
  cols.forEach((c, i) => { ws.getCell(`${c}${row}`).value = `${on[i] ? '☒' : '☐'} ${labels[i]}` })
}

export async function buildWorkbook(kid: Kid, evaluator: string, tests: TestData[]): Promise<ExcelJS.Workbook> {
  const ExcelJSMod = (await import('exceljs')).default
  const res = await fetch(`${import.meta.env.BASE_URL}plantilla-tgmd2.xlsx`)
  const wb = new ExcelJSMod.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  const ws = wb.worksheets[0]
  ws.name = kid.name.slice(0, 28).replace(/[\\/?*[\]:]/g, ' ') || 'TGMD'

  // Sección I
  ws.getCell('D4').value = evaluator
  ws.getCell('I4').value = kid.name
  if (kid.birthDate) {
    const [y, m, d] = kid.birthDate.split('-').map(Number)
    ws.getCell('D5').value = d
    ws.getCell('E5').value = m
    ws.getCell('F5').value = y
  }
  ws.getCell('H5').value = kid.sex === 'M' ? 'X' : ''
  ws.getCell('J5').value = kid.sex === 'F' ? 'X' : ''

  // Sección II: dos evaluaciones (columnas C-F y G-J)
  const blocks = [
    { age: 'D7', ss: 'D', pct: 'E', ae: 'F', sum: 'D11', gmq: 'D12', gmqP: 'E12', rate: ['D13', 'E13'], date: 'H18', marks: ['H', 'I'] },
    { age: 'I7', ss: 'H', pct: 'I', ae: 'J', sum: 'H11', gmq: 'H12', gmqP: 'I12', rate: ['H13', 'I13'], date: 'K18', marks: ['K', 'L'] },
  ]
  // Corrige la fórmula de la 2ª evaluación (sumaba percentiles en vez de puntajes estándar).
  ws.getCell('I11').value = null
  ws.getCell('H11').value = { formula: 'IF(AND(ISNUMBER(H9),ISNUMBER(H10)),H9+H10,"")' }
  ws.getCell('D11').value = { formula: 'IF(AND(ISNUMBER(D9),ISNUMBER(D10)),D9+D10,"")' }

  tests.slice(0, 2).forEach((t, bi) => {
    const b = blocks[bi]
    const r = t.result
    ws.getCell(b.age).value = ageLabel(r)
    ;([['loc', 9], ['obj', 10]] as const).forEach(([k, row]) => {
      const sub = r[k]
      ws.getCell(`${b.ss}${row}`).value = sub.ss ?? ''
      ws.getCell(`${b.pct}${row}`).value = sub.percentile ?? ''
      ws.getCell(`${b.ae}${row}`).value = sub.ae ?? ''
    })
    ws.getCell(b.gmq).value = r.gmq ?? ''
    ws.getCell(b.gmqP).value = r.gmqPercentile ?? ''
    ws.getCell(b.rate[0]).value = r.rating?.en ?? ''
    ws.getCell(b.rate[1]).value = r.rating ? `[${r.rating.es}]` : ''
    const [yy, mm, dd] = t.date.split('-').map(Number)
    ws.getCell(b.date).value = new Date(Date.UTC(yy, mm - 1, dd))
    ws.getCell(b.date).numFmt = 'dd/mm/yyyy'
    // Marcas por criterio e intento
    for (const sk of SKILLS) {
      sk.criteria.forEach((_, i) => {
        const v = t.score?.marks[`${sk.id}:${i}`] ?? [null, null]
        const row = FIRST_ROW[sk.id] + i
        ws.getCell(`${b.marks[0]}${row}`).value = v[0] ?? ''
        ws.getCell(`${b.marks[1]}${row}`).value = v[1] ?? ''
      })
    }
  })
  // Valores ya calculados en las fórmulas (para que se vean bien aunque el programa no recalcule).
  const num = (ref: string) => { const v = ws.getCell(ref).value; return typeof v === 'number' ? v : 0 }
  const setF = (ref: string, result: number | string) => {
    const cell = ws.getCell(ref)
    const v = cell.value as { formula?: string } | null
    if (v && typeof v === 'object' && 'formula' in v && v.formula) cell.value = { formula: v.formula, result } as ExcelJS.CellFormulaValue
  }
  const totals: Record<'loc' | 'obj', [number, number]> = { loc: [0, 0], obj: [0, 0] }
  for (const sk of SKILLS) {
    const first = FIRST_ROW[sk.id], n = sk.criteria.length, tRow = first + n
    let a = 0, b = 0
    for (let r = first; r < tRow; r++) {
      const ra = num(`H${r}`) + num(`I${r}`), rb = num(`K${r}`) + num(`L${r}`)
      setF(`J${r}`, ra); setF(`M${r}`, rb); a += ra; b += rb
    }
    const max = n * 2
    setF(`J${tRow}`, a); setF(`M${tRow}`, b); setF(`N${tRow}`, a); setF(`Q${tRow}`, b)
    setF(`P${tRow}`, (a / max) * 100); setF(`S${tRow}`, (b / max) * 100)
    totals[sk.subtest][0] += a; totals[sk.subtest][1] += b
  }
  ;([['loc', 55, 'C9', 'G9'], ['obj', 93, 'C10', 'G10']] as const).forEach(([k, row, c1, c2]) => {
    const [a, b] = totals[k]
    setF(`J${row}`, a); setF(`M${row}`, b); setF(`N${row}`, a); setF(`Q${row}`, b)
    setF(`P${row}`, (a / 48) * 100); setF(`S${row}`, (b / 48) * 100)
    setF(c1, a); setF(c2, b)
  })
  setF('D11', tests[0]?.result.sumSS ?? '')
  setF('H11', tests[1]?.result.sumSS ?? '')
  setF('N18', tests[0] ? dateFromIso(tests[0].date).toLocaleDateString('es') : '')
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true }

  if (tests.length < 2) {
    ws.getCell('I7').value = 'Edad: '
    ws.getCell('K18').value = null
  }

  // Sección IV: mano y pie preferidos
  sideMarks(ws, 16, ['C', 'D', 'E'], kid.hand)
  sideMarks(ws, 17, ['C', 'D', 'E'], kid.foot)
  if (tests.length > 1) { sideMarks(ws, 16, ['G', 'H', 'I'], kid.hand); sideMarks(ws, 17, ['G', 'H', 'I'], kid.foot) }

  return wb
}

export const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

export async function workbookBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
