/**
 * 🧹 cron 실패 일괄 해결 — 조건 계획을 **실제 SQLite** 에 돌려 무엇이 해결되는지 잰다.
 * 지키는 것: 접두·시각 둘 다 필수 · 지금 울리는 경보는 안 건드림 · 다른 접두는 안 건드림 ·
 * 기본은 세기만 · super_admin 게이트 배선.
 * ⚠️ 못 막는 것: 어떤 접두가 '이미 고친 문제' 인지는 판단하지 않는다(그건 사람이 고른다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { planBulkResolve } from '@/worker/utils/cron-failure-bulk'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function seed() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE cron_failures (id INTEGER PRIMARY KEY, job_name TEXT, severity TEXT, resolved INTEGER DEFAULT 0, created_at TEXT)`)
  const rows: [string, string, string][] = [
    ['blocked:ads:enrich', 'warning', '2026-10-10 04:00:00'],
    ['blocked:group_buy', 'warning', '2026-10-14 04:00:00'],
    ['blocked:ads:enrich', 'warning', '2026-10-17 04:00:00'], // 수리 후 — 남아야 함
    ['stale:ads:maintenance', 'warning', '2026-10-12 04:00:00'], // 다른 접두 — 남아야 함
    ['ads:enrich-company', 'error', '2026-10-05 01:00:00'],
    ['blockedXads', 'warning', '2026-10-10 04:00:00'],
    ['blocked:groupXbuy', 'warning', '2026-10-10 04:00:00'], // LIKE '_' 가 아무 글자로 넓어지면 이것도 잡힌다
  ]
  const ins = db.prepare('INSERT INTO cron_failures (job_name, severity, created_at) VALUES (?,?,?)')
  for (const r of rows) ins.run(...r)
  return db
}

function apply(db: InstanceType<typeof DatabaseSync>, input: Parameters<typeof planBulkResolve>[0]) {
  const p = planBulkResolve(input)
  if (!p.ok) throw new Error(p.error)
  const n = (db.prepare(`SELECT COUNT(*) n FROM cron_failures WHERE ${p.where}`).get(...p.binds) as { n: number }).n
  db.prepare(`UPDATE cron_failures SET resolved = 1 WHERE ${p.where}`).run(...p.binds)
  return n
}
const open = (db: InstanceType<typeof DatabaseSync>) =>
  (db.prepare('SELECT job_name, created_at FROM cron_failures WHERE resolved = 0 ORDER BY id').all() as { job_name: string; created_at: string }[])

describe('cron 실패 일괄 해결 계획', () => {
  it('접두·시각 이전만 해결하고 지금 경보·다른 접두는 남긴다', () => {
    const db = seed()
    expect(apply(db, { job_prefix: 'blocked:', before: '2026-10-15' })).toBe(3)
    const left = open(db).map(r => `${r.job_name}@${r.created_at.slice(0, 10)}`)
    expect(left).toContain('blocked:ads:enrich@2026-10-17')
    expect(left).toContain('stale:ads:maintenance@2026-10-12')
    expect(left).toContain('blockedXads@2026-10-10')
  })
  it('밑줄은 글자 그대로 — 아무 글자로 넓어지지 않는다', () => {
    const db = seed()
    expect(apply(db, { job_prefix: 'blocked:group_', before: '2026-10-15' })).toBe(1)
  })
  it('severity 를 주면 그 심각도만', () => {
    const db = seed()
    expect(apply(db, { job_prefix: 'ads:enrich-company', before: '2026-10-08', severity: 'warning' })).toBe(0)
    expect(apply(db, { job_prefix: 'ads:enrich-company', before: '2026-10-08', severity: 'error' })).toBe(1)
  })
  it('접두·시각이 없거나 이상하면 거부한다(전부 해결 불가)', () => {
    expect(planBulkResolve({ before: '2026-10-15' }).ok).toBe(false)
    expect(planBulkResolve({ job_prefix: '', before: '2026-10-15' }).ok).toBe(false)
    expect(planBulkResolve({ job_prefix: '%', before: '2026-10-15' }).ok).toBe(false)
    expect(planBulkResolve({ job_prefix: 'blocked:' }).ok).toBe(false)
    expect(planBulkResolve({ job_prefix: 'blocked:', before: "1' OR 1=1" }).ok).toBe(false)
    expect(planBulkResolve({ job_prefix: 'blocked:', before: '2026-10-15', severity: 'info' }).ok).toBe(false)
  })
  it('기본은 세기만 — dry_run:false 를 명시해야 반영', () => {
    const a = planBulkResolve({ job_prefix: 'blocked:', before: '2026-10-15' })
    const b = planBulkResolve({ job_prefix: 'blocked:', before: '2026-10-15', dry_run: false })
    expect(a.ok && a.dryRun).toBe(true)
    expect(b.ok && b.dryRun).toBe(false)
  })
  it('라우트가 super_admin 게이트와 계획 함수를 거친다', () => {
    const src = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    const i = src.indexOf("post('/cron-failures/bulk-resolve'")
    expect(i).toBeGreaterThan(0)
    const block = src.slice(i, src.indexOf('adminSystemMonitoringRoutes.', i + 10))
    expect(block).toMatch(/role !== 'super_admin'/)
    expect(block).toMatch(/planBulkResolve\(/)
    expect(block).toMatch(/if \(plan\.dryRun\)/)
  })
})
