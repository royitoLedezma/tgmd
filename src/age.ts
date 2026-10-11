// Cálculo de edad exacta (años, meses, días) a una fecha dada.

export interface Age { years: number; months: number; days: number }

export function ageAt(birth: string, on: Date = new Date()): Age | null {
  if (!birth) return null
  const [y, m, d] = birth.split('-').map(Number)
  if (!y || !m || !d) return null
  let years = on.getFullYear() - y
  let months = on.getMonth() + 1 - m
  let days = on.getDate() - d
  if (days < 0) {
    // días del mes anterior a la fecha de evaluación
    days += new Date(on.getFullYear(), on.getMonth(), 0).getDate()
    months -= 1
  }
  if (months < 0) { months += 12; years -= 1 }
  if (years < 0) return null
  return { years, months, days }
}

export function ageText(birth: string, on?: Date): string {
  const a = ageAt(birth, on)
  if (!a) return 'Sin fecha de nacimiento'
  const y = a.years === 1 ? 'año' : 'años'
  const mo = a.months === 1 ? 'mes' : 'meses'
  return `${a.years} ${y} ${a.months} ${mo}`
}

/** El TGMD-2 tiene normas de 3 a 10 años 11 meses. */
export function isOverMax(birth: string, on?: Date): boolean {
  const a = ageAt(birth, on)
  return !!a && (a.years > 10 || (a.years === 10 && a.months > 11))
}
