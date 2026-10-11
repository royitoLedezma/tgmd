// Las 12 pruebas del TGMD-2, en el orden de la hoja de documentación.
// Nombres cortos acordados para la app y los informes.
// Criterios tomados de la hoja TGMD-2.xlsx del evaluador (con ortografía corregida).
export type Subtest = 'loc' | 'obj'
export interface Criterion { short: string; full: string }
export interface Skill { id: string; name: string; sheetName: string; subtest: Subtest; criteria: Criterion[] }

export const SKILLS: Skill[] = [
  { id: 'correr', name: 'Correr', sheetName: 'Correr', subtest: 'loc', criteria: [
    { short: 'Brazos en oposición, codos doblados', full: 'Brazos se mueven en oposición a las piernas y los codos doblados.' },
    { short: 'Ambos pies en el aire', full: 'Breve periodo donde ambos pies están fuera del suelo.' },
    { short: 'Aterrizaje con talón o punta', full: 'No aterriza delante de la cadera o con pie plano y pesado.' },
    { short: 'Pierna libre a ~90°', full: 'La pierna de no soporte está doblada aproximadamente a 90 grados.' },
  ] },
  { id: 'galopar', name: 'Galopar', sheetName: 'Galope', subtest: 'loc', criteria: [
    { short: 'Brazos a la cintura', full: 'Brazos doblados y levantados a nivel de cintura al momento del despegue.' },
    { short: 'Paso líder + seguidor', full: 'Un paso hacia el frente con el pie líder seguido de un paso del pie seguidor. El pie seguidor va en una posición adyacente o detrás del pie líder.' },
    { short: 'Ambos pies en el aire', full: 'Un periodo breve donde ambos pies están fuera del suelo.' },
    { short: 'Ritmo en 4 galopes', full: 'Mantiene un patrón rítmico por al menos cuatro galopes consecutivos.' },
  ] },
  { id: 'saltar-unipodal', name: 'Saltar (unipodal)', sheetName: 'Salto en un pie', subtest: 'loc', criteria: [
    { short: 'Pierna libre en péndulo', full: 'La pierna libre se mueve hacia el frente en péndulo para producir fuerza.' },
    { short: 'Pie libre detrás del cuerpo', full: 'El pie de no apoyo se mantiene detrás del cuerpo.' },
    { short: 'Brazos flexionados al frente', full: 'Brazos flexionados y se mueven hacia el frente para producir fuerza.' },
    { short: '3 saltos pie preferido', full: 'Despega y aterriza tres veces consecutivas en el pie preferido.' },
    { short: '3 saltos pie no preferido', full: 'Despega y aterriza tres veces consecutivas en el pie no dominante.' },
  ] },
  { id: 'brincar', name: 'Brincar', sheetName: 'Saltar sobre un objeto', subtest: 'loc', criteria: [
    { short: 'Despega en un pie, cae en el otro', full: 'Despega en un pie y aterriza con el pie opuesto.' },
    { short: 'Vuelo más largo que al correr', full: 'Hay un periodo donde ambos pies están fuera del suelo, por un periodo más largo que al correr.' },
    { short: 'Brazo opuesto al frente', full: 'Extensión hacia el frente con el brazo opuesto al pie líder.' },
  ] },
  { id: 'saltar-bipodal', name: 'Saltar (bipodal)', sheetName: 'Salto horizontal', subtest: 'loc', criteria: [
    { short: 'Rodillas flexionadas, brazos atrás', full: 'El movimiento preparatorio incluye flexión de ambas rodillas con los brazos extendidos detrás del cuerpo.' },
    { short: 'Brazos al frente y arriba', full: 'Los brazos se extienden con fuerza hacia el frente terminando extendidos sobre la cabeza. El cuerpo se extiende junto con los brazos.' },
    { short: 'Despega y cae con ambos pies', full: 'Despega y aterriza en ambos pies simultáneamente.' },
    { short: 'Brazos abajo al aterrizar', full: 'Los brazos se mueven hacia abajo durante el aterrizaje.' },
  ] },
  { id: 'deslizar', name: 'Deslizar', sheetName: 'Deslizarse', subtest: 'loc', criteria: [
    { short: 'Cuerpo de lado, hombros alineados', full: 'El cuerpo gira hacia el lado manteniendo los hombros alineados con la línea del piso.' },
    { short: 'Paso y deslice del otro pie', full: 'Un paso hacia el lado con el pie líder seguido por un deslice del otro pie, donde el pie seguidor se acerca al pie líder.' },
    { short: '4 pasos a la derecha', full: 'Un mínimo de cuatro pasos cíclicos continuos hacia la derecha.' },
    { short: '4 pasos a la izquierda', full: 'Un mínimo de cuatro pasos cíclicos continuos hacia la izquierda.' },
  ] },
  { id: 'golpear', name: 'Golpear', sheetName: 'Batear', subtest: 'obj', criteria: [
    { short: 'Mano dominante arriba', full: 'Agarre del bate con la mano dominante sobre la no dominante.' },
    { short: 'Lado no dominante al frente', full: 'El lado no dominante del cuerpo de frente al balón, con los pies en paralelo.' },
    { short: 'Rota cadera y hombros', full: 'Rotación de cadera y hombros en el “swing”.' },
    { short: 'Peso al pie del frente', full: 'Transfiere el peso del cuerpo al pie del frente.' },
    { short: 'Contacta la pelota', full: 'Hay contacto con la pelota con el bate.' },
  ] },
  { id: 'driblear', name: 'Driblear', sheetName: 'Dribleo estacionario', subtest: 'obj', criteria: [
    { short: 'Contacto a la cintura', full: 'El contacto con el balón está al nivel de la cintura.' },
    { short: 'Empuja con los dedos', full: 'Empuja el balón con la yema de los dedos (no le pega con la mano).' },
    { short: 'Bote junto al pie preferido', full: 'El balón tiene contacto con el suelo al frente o al lado del pie del lado preferido.' },
    { short: '4 botes sin moverse', full: 'Mantiene control del balón por cuatro veces consecutivas sin moverse a buscar el balón.' },
  ] },
  { id: 'atrapar', name: 'Atrapar', sheetName: 'Atrapar', subtest: 'obj', criteria: [
    { short: 'Manos al frente, codos flexionados', full: 'Fase de preparación donde ambas manos están frente al cuerpo con codos flexionados.' },
    { short: 'Extiende los brazos', full: 'Los brazos se extienden mientras buscan la pelota.' },
    { short: 'Atrapa con ambas manos', full: 'La pelota es atrapada con ambas manos.' },
  ] },
  { id: 'patear', name: 'Patear', sheetName: 'Patear', subtest: 'obj', criteria: [
    { short: 'Acercamiento rápido y continuo', full: 'Acercamiento al balón rápido y continuo.' },
    { short: 'Paso largo o salto antes', full: 'Antes del contacto con el balón, el niño extiende la pierna o da un salto hacia delante (“leap”).' },
    { short: 'Pie de apoyo junto al balón', full: 'El pie que no patea está ubicado al lado o un poco detrás del balón.' },
    { short: 'Patea con empeine o punta', full: 'Patea el balón con la parte frontal del pie (empeine) o con la punta del pie.' },
  ] },
  { id: 'lanzar', name: 'Lanzar', sheetName: 'Lanzar por encima del brazo', subtest: 'obj', criteria: [
    { short: 'Brazo atrás y arriba', full: 'Inicia con un movimiento hacia atrás y por encima de su brazo/mano.' },
    { short: 'Rota cadera y hombros', full: 'Rota la cadera y los hombros a un punto donde el lado con el que no está lanzando se dirige hacia la pared.' },
    { short: 'Pisa con el pie opuesto', full: 'Transfiere el peso pisando con el pie opuesto.' },
    { short: 'Sigue el movimiento en diagonal', full: 'Hay un “follow-through” o seguimiento una vez lanzada la pelota. Suelta la pelota mientras su brazo se mueve en diagonal al cuerpo hacia el lado que no lanzó.' },
  ] },
  { id: 'rodar', name: 'Rodar', sheetName: 'Lanzar por debajo del brazo', subtest: 'obj', criteria: [
    { short: 'Mano atrás, pecho a los conos', full: 'La mano preferida hace un movimiento hacia atrás llevando la pelota detrás del tronco, mientras su pecho está en dirección a los conos.' },
    { short: 'Pisa con el pie opuesto', full: 'Pisa en dirección frontal a los conos, con el pie opuesto a la mano con la que lanza.' },
    { short: 'Flexiona las rodillas', full: 'Flexiona las rodillas.' },
    { short: 'Suelta cerca del piso', full: 'Deja caer la pelota cerca del piso y la pelota no rebota más de 4 pulgadas (10 cm) del suelo.' },
  ] },
]

export const ATTEMPTS = [1, 2] as const
export const CLIPS_PER_KID = SKILLS.length * ATTEMPTS.length // 24
/** Total de marcas por niño: criterios × 2 intentos (96). */
export const MARKS_PER_KID = SKILLS.reduce((n, s) => n + s.criteria.length * 2, 0)

export const skillById = (id: string) => SKILLS.find((s) => s.id === id)
export const maxScore = (s: Skill) => s.criteria.length * 2
