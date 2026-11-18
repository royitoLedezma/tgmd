// Fases por habilidad para el registro visual (página 3 del informe).

export interface Phase { id: string; name: string }

export const PHASES: Record<string, Phase[]> = {
  correr: [
    { id: 'apoyo', name: 'Apoyo izquierdo' },
    { id: 'vuelo', name: 'Vuelo izquierdo' },
    { id: 'apoyo-der', name: 'Apoyo derecho' },
    { id: 'vuelo-der', name: 'Vuelo derecho' },
  ],
  'saltar-bipodal': [
    { id: 'preparacion', name: 'Preparación' },
    { id: 'despegue', name: 'Despegue · extensión' },
    { id: 'aterrizaje', name: 'Aterrizaje' },
    { id: 'amortiguacion', name: 'Amortiguación' },
  ],
  lanzar: [
    { id: 'preparacion', name: 'Preparación · brazo atrás' },
    { id: 'suelte', name: 'Rotación y suelte' },
    { id: 'seguimiento', name: 'Seguimiento' },
  ],
  atrapar: [
    { id: 'preparacion', name: 'Preparación' },
    { id: 'extension', name: 'Extensión de brazos' },
    { id: 'recepcion', name: 'Recepción' },
  ],
}
const GENERIC: Phase[] = [1, 2, 3, 4].map((n) => ({ id: `f${n}`, name: `Foto ${n}` }))

/** Habilidades que se ofrecen primero en el registro visual (se entienden bien en foto). */
export const VISUAL_SKILLS = ['correr', 'saltar-bipodal', 'lanzar', 'atrapar']
export const phasesOf = (skillId: string): Phase[] => PHASES[skillId] ?? GENERIC
export const phaseName = (skillId: string, phase: string) => phasesOf(skillId).find((p) => p.id === phase)?.name ?? phase
