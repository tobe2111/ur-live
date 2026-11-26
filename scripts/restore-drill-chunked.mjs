#!/usr/bin/env node
/**
 * 🧯 분할 백업(R2) 복구 연습 — 2026-11-18 대표 *"1,2 모두 이상적으로 해줘"*
 *   (결재 `docs/decisions/archive/2026-11-18-log-retention-and-ads-backup-drill.md` 3번).
 *
 * 왜: 유어애즈 리드 DB(1.25GB)·업체 DB(424MB)는 `cron/d1-backup-chunked.ts` 가 R2 에 조각으로 떠 두지만
 *   **한 번도 되살려 본 적이 없었다.** 되살려 본 적 없는 백업은 백업이라고 부르기 어렵다 — 실제로 이걸 만들다가
 *   그 백업에 **표 구조(CREATE TABLE)가 없다**는 것을 찾았다(같은 날 schema.sql 을 남기도록 고쳤다).
 *
 * 하는 일(라벨마다):
 *   1. 메인 DB `platform_settings.backup_done:<라벨>` 로 마지막 완료 날짜를 찾는다 → 14일보다 오래면 실패.
 *   2. R2 에서 manifest.json · schema.sql · 모든 조각을 받는다(이름은 manifest 의 표별 조각 수로 정해진다).
 *   3. 빈 SQLite 에 구조 → 조각 순서로 되살리고, **표별 행 수 = manifest** · `integrity_check = ok` 를 본다.
 *   로그에는 **개수만** 찍는다(공개 레포 — 데이터 내용은 출력하지 않는다).
 *
 * 쓰기: GitHub Actions `.github/workflows/d1-restore-drill-ads.yml`. 로컬: CF_TOKEN·CF_ACCOUNT 를 주고 `node scripts/restore-drill-chunked.mjs ads`.
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

export const BUCKET = 'ur-live-backups'
export const MAIN_DB_ID = 'd9530ba6-7a26-4c02-9295-3ce5aef112a3' // wrangler.toml production DB
export const MAX_AGE_DAYS = 14

/** 조각 키 — `d1-backup-chunked.ts` 와 같은 규칙(표마다 0 부터 4자리). */
export function partKeys(date, label, manifest) {
  const keys = []
  for (const t of manifest.tables || []) {
    const parts = Number(manifest.counts?.[t]?.[0] || 0)
    for (let i = 0; i < parts; i++) keys.push({ table: t, key: `backups/${date}/${label}/${t}.${String(i).padStart(4, '0')}.sql` })
  }
  return keys
}

/**
 * 되살리고 검증한다. `getObject(key) → string|null`, `doneDate → 'YYYY-MM-DD'|null`.
 * 반환 { ok, problems[], tables, rows } — 던지지 않는다(문제를 모아서 한 번에 보고).
 */
export async function runDrill({ label, doneDate, getObject, dbPath, now = Date.now(), log = () => {} }) {
  const problems = []
  if (!doneDate) return { ok: false, problems: [`${label}: 완료된 백업 기록이 없다(backup_done:${label})`], tables: 0, rows: 0 }
  const age = Math.floor((now - Date.parse(`${doneDate}T00:00:00Z`)) / 86400000)
  if (!(age <= MAX_AGE_DAYS)) problems.push(`${label}: 마지막 완료 백업이 ${age}일 전(${doneDate}) — 한도 ${MAX_AGE_DAYS}일`)
  const base = `backups/${doneDate}/${label}`
  const mText = await getObject(`${base}/manifest.json`)
  if (!mText) return { ok: false, problems: [...problems, `${label}: manifest.json 이 없다(${base})`], tables: 0, rows: 0 }
  const manifest = JSON.parse(mText)
  const schema = await getObject(`${base}/schema.sql`)
  if (!schema || !schema.includes('CREATE TABLE')) {
    return { ok: false, problems: [...problems, `${label}: schema.sql 이 없다 — 표 구조 없이 되살릴 수 없다(2026-11-18 이전 백업이면 다음 완료분부터 생긴다)`], tables: 0, rows: 0 }
  }
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath)
  // node:sqlite 는 시험 번들러가 정적으로 못 묶는다 — 다른 시험들처럼 require 로 연다.
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')
  const db = new DatabaseSync(dbPath)
  try {
    db.exec(schema)
    const keys = partKeys(doneDate, label, manifest)
    let done = 0
    for (const k of keys) {
      const sql = await getObject(k.key)
      if (sql == null) { problems.push(`${label}: 조각이 없다 ${k.table} (${k.key.split('/').pop()})`); continue }
      db.exec('BEGIN'); db.exec(sql); db.exec('COMMIT')
      if (++done % 25 === 0) log(`  ${label}: 조각 ${done}/${keys.length}`)
    }
    let rows = 0
    for (const t of manifest.tables || []) {
      const want = Number(manifest.counts?.[t]?.[1] || 0)
      const got = Number(db.prepare(`SELECT COUNT(*) AS n FROM "${t.replace(/"/g, '""')}"`).get().n)
      rows += got
      if (got !== want) problems.push(`${label}: ${t} 행 수 ${got} ≠ 백업 기록 ${want}`)
    }
    const ic = db.prepare('PRAGMA integrity_check').get()
    const icv = Object.values(ic || {})[0]
    if (icv !== 'ok') problems.push(`${label}: integrity_check = ${icv}`)
    if ((manifest.tables || []).length === 0) problems.push(`${label}: manifest 의 표가 0개 — 백업이 비어 있다`)
    return { ok: problems.length === 0, problems, tables: (manifest.tables || []).length, rows }
  } finally {
    db.close()
  }
}

async function cfGet(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) })
  return r
}

async function main() {
  const token = process.env.CF_TOKEN, account = process.env.CF_ACCOUNT
  if (!token || !account) { console.error('❌ CF_TOKEN / CF_ACCOUNT 가 없다'); process.exit(1) }
  const labels = process.argv.slice(2).length ? process.argv.slice(2) : ['ads', 'company']
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}`
  const q = await fetch(`${api}/d1/database/${MAIN_DB_ID}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: "SELECT key, value FROM platform_settings WHERE key LIKE 'backup_done:%'" }),
    signal: AbortSignal.timeout(30000),
  })
  const qj = await q.json().catch(() => null)
  if (!qj?.success) { console.error('❌ 백업 완료 날짜 조회 실패(D1 권한?):', JSON.stringify(qj?.errors || q.status)); process.exit(1) }
  const done = Object.fromEntries((qj.result?.[0]?.results || []).map((r) => [String(r.key).replace('backup_done:', ''), r.value]))
  const getObject = async (key) => {
    const r = await cfGet(`${api}/r2/buckets/${BUCKET}/objects/${key.split('/').map(encodeURIComponent).join('/')}`, token)
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`R2 읽기 실패 ${r.status} — 토큰에 R2 읽기 권한이 있는지 확인 (${key.split('/').slice(-2).join('/')})`)
    return await r.text()
  }
  let failed = false
  for (const label of labels) {
    console.log(`==> ${label}: 마지막 완료 ${done[label] || '(없음)'}`)
    const res = await runDrill({ label, doneDate: done[label] || null, getObject, dbPath: path.join(process.cwd(), `drill-${label}.db`), log: console.log })
    console.log(`    표 ${res.tables}개 · 행 ${res.rows}`)
    for (const p of res.problems) console.log(`    ❌ ${p}`)
    if (res.ok) console.log(`    ✅ ${label} 백업은 실제로 되살아난다`)
    else failed = true
  }
  process.exit(failed ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error('❌', e?.message || e); process.exit(1) })
