// Exportación a Excel: UN archivo por carpeta (una hoja por niño + "Resumen").
// Los niños sin carpeta van todos juntos en "TGMD2_Sin_carpeta.xlsx".
import { getState, scoreId, evaluatorName, type Kid } from './store'
import { buildGroupWorkbook, workbookBlob, download, safeName, type GroupEntry } from './excel'
import { kidTests } from './report'

/** Los 2 últimos tests puntuados del niño (en cualquier sesión). */
function latestTests(kid: Kid) {
  const { sessions, scores, norms } = getState()
  const withScore = sessions
    .filter((s) => s.kidIds.includes(kid.id) && scores.some((x) => x.id === scoreId(s.id, kid.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  const last = withScore[withScore.length - 1]
  return last ? kidTests(kid, last, sessions, scores, norms) : []
}

export function folderLabel(folderId: string | null) {
  return folderId ? getState().folders.find((f) => f.id === folderId)?.name ?? 'Carpeta' : 'Sin carpeta'
}

async function folderFile(folderId: string | null): Promise<{ name: string; blob: Blob } | null> {
  const kids = getState().kids.filter((k) => (folderId ? k.folderId === folderId : !k.folderId))
  const entries: GroupEntry[] = kids.map((kid) => ({ kid, tests: latestTests(kid) })).filter((e) => e.tests.length)
  if (!entries.length) return null
  const label = folderLabel(folderId)
  const wb = await buildGroupWorkbook(label, evaluatorName(), entries)
  return { name: `TGMD2_${safeName(label)}.xlsx`, blob: await workbookBlob(wb) }
}

/** Descarga el Excel de una carpeta. Devuelve false si no hay niños evaluados. */
export async function exportFolder(folderId: string | null): Promise<boolean> {
  const f = await folderFile(folderId)
  if (!f) return false
  download(f.blob, f.name)
  return true
}

/** Descarga el Excel de las carpetas de estos niños (un .zip si son varias carpetas). */
export async function exportFoldersOf(kids: Kid[]): Promise<boolean> {
  const ids = [...new Set(kids.map((k) => k.folderId ?? null))]
  if (ids.length === 1) return exportFolder(ids[0])
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  let n = 0
  for (const id of ids) {
    const f = await folderFile(id)
    if (f) { zip.file(f.name, await f.blob.arrayBuffer()); n++ }
  }
  if (!n) return false
  download(await zip.generateAsync({ type: 'blob' }), 'TGMD2_carpetas.zip')
  return true
}
