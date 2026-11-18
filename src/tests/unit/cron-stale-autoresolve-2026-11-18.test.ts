/**
 * ✅ 2026-11-18 회복한 작업의 멈춤 경보는 저절로 닫힌다 — 라이브: 미해결 cron_failures 281건 중 대부분이 이미 회복한 `stale:*`.
 * 진짜 SQLite 로 감시 함수를 그대로 돌린다:
 *  1. 지금 신선한 작업의 옛 `stale:` 행 → 닫힘 · 사라진 작업의 행 → 닫힘
 *  2. 지금도 멈춘 작업의 행 → 열린 채 · `stale:`/`blocked:` 가 아닌 실패(예: api:*) → 건드리지 않음
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { handleCronStaleWatch } from '@/worker/cron/cron-stale-watch'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind: (...a: unknown[]) => { args = a; return st },
        first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
        all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
        run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
    batch: async (sts: Array<{ run: () => Promise<unknown> }>) => Promise.all(sts.map((s) => s.run())),
  } as unknown as D1Database
}

describe('멈춤 경보 자동 종료', () => {
  it('회복한·사라진 작업의 경보만 닫는다', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
      CREATE TABLE cron_failures (id INTEGER PRIMARY KEY, job_name TEXT, error_message TEXT, stack TEXT, context TEXT, severity TEXT, resolved INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`)
    const now = Date.now()
    const beat = (name: string, at: number) => db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)')
      .run(`cron_hb:${name}`, JSON.stringify({ at: new Date(at).toISOString(), ok: true, ms: 10, cron: '*/5 * * * *', g: 5 }))
    beat('job-fresh', now - 60_000)
    beat('job-stuck', now - 3 * 3600_000) // 10일이면 '은퇴' 로 분류돼 판정에서 빠진다(의도된 규칙)
    const open = (job: string) => db.prepare('INSERT INTO cron_failures (job_name, error_message, severity) VALUES (?, ?, ?)').run(job, 'x', 'warning')
    open('stale:job-fresh'); open('stale:job-gone'); open('stale:job-stuck'); open('api:[seller]')
    await handleCronStaleWatch({ DB: d1(db) } as never)
    const state = Object.fromEntries((db.prepare("SELECT job_name, MIN(resolved) r FROM cron_failures GROUP BY job_name").all() as Array<{ job_name: string; r: number }>).map((x) => [x.job_name, x.r]))
    expect(state['stale:job-fresh']).toBe(1)
    expect(state['stale:job-gone']).toBe(1)
    expect(state['stale:job-stuck']).toBe(0)
    expect(state['api:[seller]']).toBe(0)
  })
})
