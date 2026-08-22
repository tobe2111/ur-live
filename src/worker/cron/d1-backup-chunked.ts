/**
 * 🗄️ **재개 가능한 분할 백업** — 큰 D1 을 여러 회차에 나눠 R2 로 옮긴다.
 *
 * ## 왜 따로 만들었나
 *
 * 기존 `d1-backup.ts` 는 **DB 전체를 문자열 하나로** 만들어 R2 에 올린다. 그게 되던 시절엔
 * 맞는 설계였지만, 2026-08 에 유어애즈 수집 리드가 263 MB 로 자라면서 **워커 메모리(128 MB)를
 * 넘겼다.** 결과는 조용했다 — 예외가 아니라 **워커가 통째로 죽어** 실패 기록도 하트비트도 안 남고,
 * 주간 백업이 08-02 이후 멈춘 걸 3주 동안 아무도 몰랐다.
 *
 * Cloudflare 의 서버측 export API 도 시도했지만 이 크기에선 실패했다(실측: 두 번 다 "Uploaded
 * part 21" 부근에서 `status: error`). 작은 DB 에선 정상이라 크기 문제로 보인다.
 *
 * ## 설계 — **한 회차에 다 하려 하지 않는다**
 *
 * ```
 * 상태(platform_settings)  { date, table, rowid, part }
 * 회차마다   커서에서 이어서 → 예산(시간/파트 수)까지만 쓰고 → 커서 저장하고 종료
 * 완료되면   manifest.json 을 쓰고 커서를 비운다 → 다음 스냅샷은 새 날짜로 시작
 * ```
 *
 * 산출물: `backups/{날짜}/{라벨}/{테이블}.{파트}.sql` + `manifest.json`
 *
 * **메모리 상한은 파트 하나(기본 6 MB)** 다. 테이블이 아무리 커도 워커는 그 이상 안 쥔다.
 *
 * ⚠️ 이 모듈이 **안 하는 것**: 복구(restore). 복구는 `docs/BACKUP_RESTORE.md` 절차대로 사람이
 *    파트를 순서대로 먹인다 — 자동 복구는 잘못 돌면 되돌릴 수 없어서 일부러 안 만든다.
 */
import { logInfo, logError } from '../utils/logger'

interface R2Like {
  put(key: string, body: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  head?(key: string): Promise<{ size: number } | null>
}
interface Env {
  DB?: D1Database
  ADS_DB?: D1Database
  BACKUP_BUCKET?: R2Like
}

/** 한 파트의 최대 크기(문자). 워커 메모리 상한을 정하는 단 하나의 노브. */
const PART_CHARS = 6 * 1024 * 1024
/** 한 회차에 쓸 수 있는 시간. 남으면 커서를 저장하고 다음 회차로 넘긴다. */
const RUN_MS = 20_000
/** 한 번에 읽는 행 수 — 넓은 테이블(50컬럼)도 6 MB 안에 들어오게 보수적으로. */
const PAGE = 500

/** 우리 데이터가 아닌 것 — FTS 그림자·내부 테이블은 복구 시 원본에서 재생성한다. */
function skipTable(name: string, virtual: Set<string>): boolean {
  if (name === '_cf_KV' || name.startsWith('sqlite_')) return true
  const m = name.match(/^(.*)_(data|idx|docsize|config|content)$/)
  return !!m && virtual.has(m[1])
}

/** BLOB 을 문자열로 뭉개지 않는다 — 조용한 데이터 손상 방지(기존 백업과 같은 규칙). */
function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v)) {
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v)
      : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      : Uint8Array.from(v as number[])
    let hex = ''
    for (const b of bytes) hex += b.toString(16).padStart(2, '0')
    return `X'${hex}'`
  }
  return `'${String(v).replace(/'/g, "''")}'`
}

interface Cursor { date: string; ti: number; rowid: number; part: number }

async function readCursor(DB: D1Database, key: string): Promise<Cursor | null> {
  const r = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key)
    .first<{ value: string }>().catch(() => null)
  try { return r?.value ? JSON.parse(r.value) as Cursor : null } catch { return null }
}
async function writeCursor(DB: D1Database, key: string, c: Cursor | null): Promise<void> {
  if (!c) {
    await DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(key).run().catch(() => null)
    return
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(key, JSON.stringify(c)).run().catch(() => null)
}

export interface ChunkedResult {
  label: string; date: string; done: boolean
  tables: number; tableIndex: number; partsWritten: number; bytes: number
  reason: 'complete' | 'budget' | 'no-binding' | 'no-db'
}

/**
 * 한 회차분을 진행한다. **완료 여부를 반환하고, 안 끝났으면 커서를 남긴다.**
 *
 * @param stateDb 커서를 저장할 DB(항상 메인) — 백업 대상과 다를 수 있다.
 */
export async function backupChunked(
  env: Env, opts: { db: D1Database | undefined; label: string; stateDb: D1Database },
): Promise<ChunkedResult> {
  const { db, label, stateDb } = opts
  const empty = (reason: ChunkedResult['reason']): ChunkedResult =>
    ({ label, date: '', done: false, tables: 0, tableIndex: 0, partsWritten: 0, bytes: 0, reason })
  if (!db) return empty('no-db')
  if (!env.BACKUP_BUCKET) return empty('no-binding')

  const bucket = env.BACKUP_BUCKET
  const stateKey = `backup_chunk:${label}`
  const t0 = Date.now()

  // 대상 테이블 목록 — 이름 순서를 고정해야 커서(인덱스)가 회차 사이에 의미를 유지한다.
  const virt = new Set((await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%VIRTUAL TABLE%'",
  ).all<{ name: string }>().catch(() => ({ results: [] }))).results?.map((r) => r.name) || [])
  const all = (await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  ).all<{ name: string }>().catch(() => ({ results: [] }))).results || []
  const tables = all.map((r) => r.name).filter((n) => !skipTable(n, virt))

  let cur = await readCursor(stateDb, stateKey)
  if (!cur) cur = { date: new Date().toISOString().slice(0, 10), ti: 0, rowid: 0, part: 0 }

  let partsWritten = 0
  let bytes = 0

  while (cur.ti < tables.length) {
    if (Date.now() - t0 > RUN_MS) {
      await writeCursor(stateDb, stateKey, cur)
      return { label, date: cur.date, done: false, tables: tables.length, tableIndex: cur.ti, partsWritten, bytes, reason: 'budget' }
    }
    const t = tables[cur.ti]
    const cols = ((await db.prepare(`SELECT name FROM pragma_table_info('${t}')`)
      .all<{ name: string }>().catch(() => ({ results: [] }))).results || []).map((c) => c.name)
    if (!cols.length) { cur.ti++; cur.rowid = 0; cur.part = 0; continue }
    const colList = cols.map((c) => `"${c}"`).join(',')

    // 한 파트를 채운다 — 예산을 넘거나 테이블이 끝나면 멈춘다.
    const buf: string[] = [`-- ${t} part ${cur.part} (rowid > ${cur.rowid})`]
    let size = buf[0].length
    let last = cur.rowid
    let drained = false
    while (size < PART_CHARS && Date.now() - t0 <= RUN_MS) {
      const rows = (await db.prepare(
        `SELECT rowid AS __rid, ${colList} FROM "${t}" WHERE rowid > ? ORDER BY rowid LIMIT ${PAGE}`,
      ).bind(last).all<Record<string, unknown>>().catch(() => ({ results: [] }))).results || []
      if (!rows.length) { drained = true; break }
      for (const r of rows) {
        const line = `INSERT OR IGNORE INTO "${t}" (rowid,${colList}) VALUES (${r.__rid},${cols.map((c) => lit(r[c])).join(',')});`
        buf.push(line); size += line.length + 1
      }
      last = Number(rows[rows.length - 1].__rid)
    }

    if (buf.length > 1) {
      const key = `backups/${cur.date}/${label}/${t}.${String(cur.part).padStart(4, '0')}.sql`
      await bucket.put(key, buf.join('\n'), { httpMetadata: { contentType: 'application/sql' } })
      partsWritten++; bytes += size
      cur.part++
    }
    cur.rowid = last
    if (drained) { cur.ti++; cur.rowid = 0; cur.part = 0 }
  }

  // 전 테이블 완료 — 매니페스트를 쓰고 커서를 비운다(다음 스냅샷은 새 날짜).
  await bucket.put(`backups/${cur.date}/${label}/manifest.json`, JSON.stringify({
    label, date: cur.date, tables, finished_at: new Date().toISOString(),
  }, null, 1), { httpMetadata: { contentType: 'application/json' } })
  await writeCursor(stateDb, stateKey, null)
  logInfo(`[D1 Backup/chunked] ✅ ${label} ${cur.date} — ${tables.length} tables`)
  return { label, date: cur.date, done: true, tables: tables.length, tableIndex: tables.length, partsWritten, bytes, reason: 'complete' }
}

/**
 * cron 진입점 — 메인 DB 와 유어애즈 DB 를 **번갈아** 진행한다.
 * 한 회차에 둘 다 밀면 예산을 반씩 나눠 쓰게 되므로, 안 끝난 쪽을 먼저 민다.
 */
export async function handleChunkedBackup(env: Env): Promise<Record<string, unknown>> {
  const stateDb = env.DB
  if (!stateDb) return { skipped: 'no-state-db' }
  const targets: Array<{ db: D1Database | undefined; label: string }> = [
    { db: env.ADS_DB, label: 'ads' },   // 큰 쪽 먼저 — 여기가 기존 백업이 죽던 원인이다
    { db: env.DB, label: 'main' },
  ]
  for (const t of targets) {
    if (!t.db) continue
    const cur = await readCursor(stateDb, `backup_chunk:${t.label}`)
    if (!cur) continue                       // 진행 중이 아니면 아래 새 시작 루프에서 처리
    const r = await backupChunked(env, { db: t.db, label: t.label, stateDb })
    return r as unknown as Record<string, unknown>   // 진행 중인 것 하나만 밀고 끝낸다
  }
  // 진행 중인 게 없으면 새 스냅샷을 시작한다(큰 쪽부터).
  for (const t of targets) {
    if (!t.db) continue
    const r = await backupChunked(env, { db: t.db, label: t.label, stateDb })
    return r as unknown as Record<string, unknown>
  }
  return { skipped: 'no-targets' }
}
