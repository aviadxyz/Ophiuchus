// STUB. Import from the phone's health app is a stretch goal for a later prompt (REAL_DATA.md,
// path D). Nothing is read, nothing is uploaded and no record is created.

export type HealthImportResult = { ok: false; message: string }

export function importHealthExport(): Promise<HealthImportResult> {
  return Promise.resolve({ ok: false, message: 'Health import is not available yet.' })
}
