/**
 * 📮 2026-11-17 푸시 알림 줄 — 결재 2026-11-17-traffic-surge-readiness 2번.
 *
 * 진짜 SQLite(node:sqlite) 위 D1 모양 어댑터(RETURNING 포함)로 돌린다. 지키는 것:
 *  1. 1,000명도 줄에 전부 들어간다 · 같은 tag 는 사람당 한 번(재시도·중복 호출 멱등).
 *  2. 한 번 빼낼 때 limit 명만 보낸다 → 남은 사람은 다음 회차가 보낸다(조용히 빠지는 사람 0).
 *  3. 보내다 실패하면 3번까지 다시, 그 뒤엔 failed.
 *  4. 공구 달성·마일스톤·단골 알림이 요청 안에서 사람마다 sendSystemPush 를 돌지 않는다 · 5분 cron 이 줄을 비운다.
 *
 * 못 막는 것: 실제 웹푸시 전송 성공(sendSystemPush 쪽 책임) · cron 이 실제로 5분마다 도는지(하트비트가 본다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { enqueuePush, drainPushJobs } from '@/worker/utils/push-queue'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1() {
  const db = new DatabaseSync(':memory:')
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    exec() {
      if (args.length > 100) throw new Error('D1_ERROR: too many SQL variables')
      if (/RETURNING/i.test(sql)) return { results: db.prepare(sql).all(...(args as never[])), meta: {} }
      const r = db.prepare(sql).run(...(args as never[]))
      return { meta: { changes: Number(r.changes) } }
    },
    async run() { return this.exec() },
    async all() { return this.exec() },
  })
  const DB = {
    prepare: (sql: string) => stmt(sql),
    async batch(list: ReturnType<typeof stmt>[]) {
      db.exec('BEGIN'); try { const o = list.map((s) => s.exec()); db.exec('COMMIT'); return o } catch (e) { db.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
  return { db, env: { DB } as never }
}
const count = (db: InstanceType<typeof DatabaseSync>, where: string) =>
  Number((db.prepare(`SELECT COUNT(*) n FROM push_jobs WHERE ${where}`).get() as { n: number }).n)

describe('푸시 알림 줄', () => {
  it('1,000명이 전부 들어가고 같은 tag 는 한 번만', async () => {
    const { db, env } = d1()
    const ids = Array.from({ length: 1000 }, (_, i) => i + 1)
    const p = { title: '🎉 공구 성공!', body: 'b', url: '/pass/1', tag: 'gb-achieved-1' }
    expect(await enqueuePush((env as { DB: D1Database }).DB, 'user', ids, p)).toBe(1000)
    expect(await enqueuePush((env as { DB: D1Database }).DB, 'user', ids, p)).toBe(0)
    expect(count(db, "status = 'pending'")).toBe(1000)
  })

  it('한 번에 limit 명만 보내고 남은 사람은 다음 회차가 보낸다', async () => {
    const { db, env } = d1()
    await enqueuePush((env as { DB: D1Database }).DB, 'user', Array.from({ length: 95 }, (_, i) => i + 1), { title: 't', body: 'b', tag: 'x' })
    const got: string[] = []
    const send = async (_e: unknown, _t: unknown, u: string) => { got.push(u) }
    expect((await drainPushJobs(env, 40, send)).sent).toBe(40)
    expect((await drainPushJobs(env, 40, send)).sent).toBe(40)
    expect((await drainPushJobs(env, 40, send)).sent).toBe(15)
    expect((await drainPushJobs(env, 40, send)).sent).toBe(0)
    expect(new Set(got).size).toBe(95)
    expect(count(db, "status = 'sent'")).toBe(95)
  })

  it('실패는 3번까지 다시, 그 뒤엔 failed', async () => {
    const { db, env } = d1()
    await enqueuePush((env as { DB: D1Database }).DB, 'user', [7], { title: 't', body: 'b', tag: 'y' })
    const boom = async () => { throw new Error('push down') }
    for (let i = 0; i < 3; i++) await drainPushJobs(env, 10, boom)
    expect(count(db, "status = 'failed'")).toBe(1)
    expect((await drainPushJobs(env, 10, boom)).failed).toBe(0)
  })

  it('알림 보내는 세 곳이 사람마다 sendSystemPush 를 돌지 않고 줄에 넣는다 · cron 이 줄을 비운다', () => {
    const gb = fs.readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    const sp = fs.readFileSync('src/features/seller-public/api/seller-public.routes.ts', 'utf8')
    expect(gb.match(/enqueuePush\(DB, 'user'/g)?.length).toBe(2)
    expect(gb).not.toMatch(/for \(const (u|p) of (interested|participants) \?\? \[\]\)[\s\S]{0,400}sendSystemPush/)
    expect(sp).toMatch(/enqueuePush\(DB, 'user', ids/)
    expect(sp).not.toMatch(/for \(const f of followers\)[\s\S]{0,600}sendSystemPush/)
    expect(fs.readFileSync('src/worker/scheduled.ts', 'utf8')).toMatch(/safeCron\('push-jobs-drain'/)
  })
})
