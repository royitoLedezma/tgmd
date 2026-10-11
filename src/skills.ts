// Las 12 pruebas del TGMD-2, en el orden de la hoja de documentación.
// Nombres cortos acordados para la app y los informes.
export type Subtest = 'loc' | 'obj'
export interface Skill { id: string; name: string; sheetName: string; subtest: Subtest }

export const SKILLS: Skill[] = [
  { id: 'correr', name: 'Correr', sheetName: 'Correr', subtest: 'loc' },
  { id: 'galopar', name: 'Galopar', sheetName: 'Galope', subtest: 'loc' },
  { id: 'saltar-unipodal', name: 'Saltar (unipodal)', sheetName: 'Salto en un pie', subtest: 'loc' },
  { id: 'brincar', name: 'Brincar', sheetName: 'Saltar sobre un objeto', subtest: 'loc' },
  { id: 'saltar-bipodal', name: 'Saltar (bipodal)', sheetName: 'Salto horizontal', subtest: 'loc' },
  { id: 'deslizar', name: 'Deslizar', sheetName: 'Deslizarse', subtest: 'loc' },
  { id: 'golpear', name: 'Golpear', sheetName: 'Batear', subtest: 'obj' },
  { id: 'driblear', name: 'Driblear', sheetName: 'Dribleo estacionario', subtest: 'obj' },
  { id: 'atrapar', name: 'Atrapar', sheetName: 'Atrapar', subtest: 'obj' },
  { id: 'patear', name: 'Patear', sheetName: 'Patear', subtest: 'obj' },
  { id: 'lanzar', name: 'Lanzar', sheetName: 'Lanzar por encima del brazo', subtest: 'obj' },
  { id: 'rodar', name: 'Rodar', sheetName: 'Lanzar por debajo del brazo', subtest: 'obj' },
]

export const ATTEMPTS = [1, 2] as const
export const CLIPS_PER_KID = SKILLS.length * ATTEMPTS.length // 24

export const skillById = (id: string) => SKILLS.find((s) => s.id === id)
