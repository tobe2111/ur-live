/**
 * 🧩 KT Alpha 교환권 목록 — **조각 갱신** (2026-11-17 대표 "모두 가장 이상적이고 영구적으로").
 *
 * 왜: 전체 갱신(`runKtAlphaCatalogSync`)은 2,200개를 한 요청에서 다 받는다. 직접 돌리면 26초인데,
 *   cron 이 웹사이트에 맡긴 첫 회차(2026-11-17 12:32)는 다른 작업과 겹쳐 100초를 넘겨 524 로 끊겼고
 *   한 줄도 안 바뀌었다. 그리고 그 전엔 **5월 19일부터 반 년 동안** 비밀값이 없어 매일 조용히 건너뛰었다.
 * ⇒ 매시 한 번, 몇 페이지씩만 받아 넣고 다음 페이지를 기억한다. 한 회차가 실패해도 다음 시간에 **그 자리부터** 잇는다.
 *   한 바퀴를 다 돌면(`pass` 완료) 이번 바퀴에서 안 보인 상품만 내리고 잔액·통계·자동 분류를 한다.
 *   마지막 완료가 20시간 안이면 아무것도 안 한다(KT API 호출 0 — 하루 한 바퀴).
 *
 * 안전:
 *   - 내리기(is_active=0)는 **한 바퀴를 끝까지 돈 뒤에만**, 그리고 이번 바퀴에 받은 수가 KT 가 말한 전체의 80% 이상일 때만
 *     — KT 가 중간에 빈 페이지를 주면 멀쩡한 상품을 대량으로 내리지 않게.
 *   - 커서는 `platform_settings.kt_alpha_sync_cursor`(JSON). 망가졌으면 새 바퀴로 시작한다.
 */
import { listGoods } from '../utils/giftishow-api'
import { upsertCatalogItems, afterCatalogSync, type Env } from './kt-alpha-catalog-sync'

export const KT_CHUNK_PAGES = 6
export const KT_PAGE_SIZE = 100
export const KT_PASS_INTERVAL_HOURS = 20
const CURSOR_KEY = 'kt_alpha_sync_cursor'

export type KtCursor = { pass_started_at: string; next_page: number; total: number; received: number; empty_streak: number }

/** 다음 회차가 할 일 — 순수 함수(시험이 직접 돌린다). */
export function planChunk(cursor: KtCursor | null, lastSyncAt: string | null, nowSql: string, nowMs: number): 'continue' | 'start' | 'idle' {
  if (cursor && cursor.next_page > 0) return 'continue'
  if (!lastSyncAt) return 'start'
  const last = Date.parse(lastSyncAt.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(last)) return 'start'
  void nowSql
  return nowMs - last >= KT_PASS_INTERVAL_HOURS * 3600_000 ? 'start' : 'idle'
}

/** 한 바퀴가 끝났는가 — KT 가 말한 전체를 다 받았거나, 빈 페이지가 연속 2번. */
export function passDone(c: KtCursor): boolean {
  return (c.total > 0 && c.received >= c.total) || c.empty_streak >= 2
}

/** 내려도 안전한 바퀴인가 — 전체를 모르면(0) 내리지 않는다. */
export function safeToDeactivate(c: KtCursor): boolean {
  return c.total > 0 && c.received >= Math.floor(c.total * 0.8)
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  return r?.value ?? null
}
async function writeSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).bind(key, value).run()
}

export async function runKtAlphaCatalogChunk(env: Env, now = new Date()): Promise<Record<string, unknown>> {
  // 비밀값이 없으면 **실패**다(예전처럼 조용한 skip 이 아니다) — 하트비트·cron_failures 에 남는다.
  if (!env.KT_ALPHA_AUTH_CODE) throw new Error('KT_ALPHA_AUTH_CODE 미설정 — KT 목록 갱신 불가')
  let cursor: KtCursor | null = null
  try { cursor = JSON.parse((await readSetting(env, CURSOR_KEY)) || 'null') } catch { cursor = null }
  const nowSql = now.toISOString().slice(0, 19).replace('T', ' ')
  const plan = planChunk(cursor, await readSetting(env, 'kt_alpha_last_sync_at'), nowSql, now.getTime())
  if (plan === 'idle') return { plan }
  if (plan === 'start' || !cursor) cursor = { pass_started_at: nowSql, next_page: 1, total: 0, received: 0, empty_streak: 0 }

  let upserted = 0
  for (let i = 0; i < KT_CHUNK_PAGES && !passDone(cursor); i++) {
    const data = await listGoods(env, { start: cursor.next_page, size: KT_PAGE_SIZE })
    if (cursor.next_page === 1 && data.listNum) cursor.total = data.listNum
    if (!data.goodsList.length) { cursor.empty_streak++ } else {
      cursor.empty_streak = 0
      upserted += await upsertCatalogItems(env, data.goodsList)
      cursor.received += data.goodsList.length
    }
    cursor.next_page++
    await writeSetting(env, CURSOR_KEY, JSON.stringify(cursor))  // 한 페이지마다 저장 — 끊겨도 그 자리부터
  }
  if (!passDone(cursor)) return { plan, upserted, next_page: cursor.next_page, received: cursor.received, total: cursor.total }

  // 한 바퀴 완료 — 이번 바퀴(pass_started_at 이후)에 안 보인 상품만 내린다.
  let deactivated = 0
  if (safeToDeactivate(cursor)) {
    const r = await env.DB.prepare(
      `UPDATE gift_catalog SET is_active = 0, goods_state = 'SUS', updated_at = datetime('now')
        WHERE is_active = 1 AND (sync_at IS NULL OR sync_at < ?)`,
    ).bind(cursor.pass_started_at).run()
    deactivated = Number(r.meta?.changes ?? 0)
  }
  const after = await afterCatalogSync(env, cursor.received)
  await writeSetting(env, CURSOR_KEY, 'null')
  return { plan, done: true, received: cursor.received, total: cursor.total, deactivated, skippedDeactivate: !safeToDeactivate(cursor), ...after }
}
