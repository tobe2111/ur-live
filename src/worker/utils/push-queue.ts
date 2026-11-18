/**
 * 📮 2026-11-17 푸시 알림 줄 세우기 — 결재 `2026-11-17-traffic-surge-readiness` 2번(대표 *"모두 다 해줘 … 영구적으로"*).
 *
 * 🩸 무엇이 깨져 있었나: 공구 달성·마일스톤·단골 알림이 **요청 안에서** 받는 사람마다 `sendSystemPush` 를 돌렸다.
 *   한 사람 = 수신 설정 조회 + 네이티브 푸시 + 구독 조회 + 구독마다 웹푸시 1번 ≈ 4~5번 외부 호출.
 *   한 요청이 할 수 있는 외부 호출 수에는 상한이 있어서, 받는 사람이 많으면 **뒤쪽 사람은 조용히 못 받았다**
 *   (에러는 `catch { /* ignore *\/ }` 가 삼켰다). 사람이 몰릴수록 더 많이 빠진다.
 *
 * 처방(대량 메일 `bulk_email_jobs` 와 같은 모양):
 *  - `enqueuePush` — 받는 사람 목록을 `push_jobs` 에 넣기만 한다(INSERT 묶음). 같은 `tag` 는 사람당 한 번(UNIQUE → 재시도·중복 호출 멱등).
 *  - `drainPushJobs` — 한 번에 `limit` 명만 선점(CAS)해서 보낸다. 요청 직후 첫 묶음은 그 요청의 waitUntil 이,
 *    나머지는 5분 cron 이 이어 보낸다. 실패는 3번까지 다시, 오래 멈춘 'sending' 은 되살린다, 보낸 지 7일 지난 행은 지운다.
 *
 * ⚠️ 못 하는 것: 알림 순서 보장(먼저 넣은 것부터 보내지만 묶음 사이 순서는 cron 간격에 달린다).
 */
import type { Env } from '../types/env'
import { chunkForBinds } from '../../shared/db/d1-binds'

export interface PushPayload { title: string; body: string; url?: string; tag?: string }
type UserType = 'user' | 'seller'

const MAX_ATTEMPTS = 3
/** 요청 직후 그 요청 안에서 바로 보내는 묶음 크기(작은 알림은 즉시 끝난다). */
export const PUSH_INLINE_BATCH = 10
/** 5분 cron 한 번에 보내는 수 — 한 사람 ≈ 4~5 외부 호출. */
export const PUSH_TICK_BATCH = 40

const ensured = new WeakSet<object>()
export async function ensurePushJobsTable(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS push_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT,
      tag TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_push_jobs_dedupe ON push_jobs(user_type, user_id, tag) WHERE tag IS NOT NULL`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_push_jobs_status ON push_jobs(status, id)`),
  ])
  ensured.add(DB)
}

/** 받는 사람들을 줄에 넣는다. 반환 = 새로 들어간 수(같은 tag 로 이미 있던 사람은 0). */
export async function enqueuePush(
  DB: D1Database,
  userType: UserType,
  userIds: ReadonlyArray<string | number>,
  p: PushPayload,
): Promise<number> {
  const ids = [...new Set(userIds.map((u) => String(u)).filter((u) => u && u !== 'null' && u !== 'undefined'))]
  if (ids.length === 0) return 0
  await ensurePushJobsTable(DB)
  let added = 0
  // 한 문장 = 1행(바인딩 6개)이라 바인딩 한도와 무관하다. batch 하나에 50문장씩 보낸다.
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50)
    const res = await DB.batch(part.map((uid) =>
      DB.prepare(`INSERT OR IGNORE INTO push_jobs (user_type, user_id, title, body, url, tag) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(userType, uid, p.title, p.body, p.url ?? null, p.tag ?? null),
    ))
    added += res.reduce((n, r) => n + Number(r?.meta?.changes ?? 0), 0)
  }
  return added
}

type Sender = (env: Env, userType: UserType, userId: string, p: PushPayload) => Promise<unknown>

/** 줄에서 최대 `limit` 명을 선점해 보낸다. 반환 = { sent, failed }. */
export async function drainPushJobs(env: Env, limit = PUSH_TICK_BATCH, send?: Sender): Promise<{ sent: number; failed: number }> {
  const DB = env.DB
  await ensurePushJobsTable(DB)
  // 오래(10분+) 'sending' 에 멈춘 행은 실행이 중간에 죽은 것 — 다시 줄에 세운다.
  await DB.prepare(`UPDATE push_jobs SET status = 'pending', updated_at = datetime('now')
    WHERE status = 'sending' AND updated_at < datetime('now', '-10 minutes') AND attempts < ?`).bind(MAX_ATTEMPTS).run()
  const claimed = await DB.prepare(`UPDATE push_jobs SET status = 'sending', attempts = attempts + 1, updated_at = datetime('now')
    WHERE id IN (SELECT id FROM push_jobs WHERE status = 'pending' ORDER BY id LIMIT ?) AND status = 'pending'
    RETURNING id, user_type, user_id, title, body, url, tag, attempts`).bind(limit)
    .all<{ id: number; user_type: UserType; user_id: string; title: string; body: string; url: string | null; tag: string | null; attempts: number }>()
  const rows = claimed.results || []
  if (rows.length === 0) return { sent: 0, failed: 0 }
  const doSend: Sender = send ?? (async (e, t, u, p) => {
    const { sendSystemPush } = await import('../../lib/system-push')
    return sendSystemPush(e, t, u, p)
  })
  let sent = 0, failed = 0
  const done: number[] = [], retry: number[] = [], dead: number[] = []
  for (const r of rows) {
    try {
      await doSend(env, r.user_type, r.user_id, { title: r.title, body: r.body, url: r.url ?? undefined, tag: r.tag ?? undefined })
      done.push(r.id); sent++
    } catch {
      (r.attempts >= MAX_ATTEMPTS ? dead : retry).push(r.id); failed++
    }
  }
  const mark = (ids: number[], status: string) => chunkForBinds(ids, 0).map((c) =>
    DB.prepare(`UPDATE push_jobs SET status = '${status}', updated_at = datetime('now') WHERE id IN (${c.map(() => '?').join(',')})`).bind(...c))
  const stmts = [...mark(done, 'sent'), ...mark(retry, 'pending'), ...mark(dead, 'failed')]
  if (stmts.length) await DB.batch(stmts)
  return { sent, failed }
}

/** 보낸 지 7일, 실패 30일 지난 행 정리(표가 쌓이기만 하지 않게). */
export async function cleanupPushJobs(DB: D1Database): Promise<void> {
  await ensurePushJobsTable(DB)
  await DB.prepare(`DELETE FROM push_jobs WHERE (status = 'sent' AND updated_at < datetime('now', '-7 days'))
    OR (status = 'failed' AND updated_at < datetime('now', '-30 days'))`).run()
}
