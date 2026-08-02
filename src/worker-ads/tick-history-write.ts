/**
 * 📼 회차 요약 1줄 저장 — `tick-history.ts`(순수 로직)의 I/O 짝.
 *
 * ⚠️ **절대 던지지 않는다.** 관측이 실패해서 회차가 죽으면 본말전도다.
 * ⚠️ **읽기 1 + 쓰기 1, 회차당 1회.** 여기서 회차마다 여러 번 쓰면 무료 D1 예산을 갉는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { TICK_HISTORY_KEY, appendTick, summarizeTick } from './tick-history'

export async function writeTickSummary(
  DB: D1Database, at: string, hourUTC: number, ran: number,
  beats: ReadonlyArray<{ name: string; ok: boolean; ms: number }>,
): Promise<void> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(TICK_HISTORY_KEY).first<{ value: string }>().catch(() => null)
    const next = appendTick(row?.value, summarizeTick(at, hourUTC, ran, beats))
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(TICK_HISTORY_KEY, next).run().catch(() => undefined)
  } catch { /* 관측 실패가 회차를 막지 않는다 */ }
}
