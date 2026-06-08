/**
 * 🏭 TAX-1 (2026-06-08) — 도매 정산 성숙 전용 cron (얇은 스케줄러).
 *
 * 기존 `matureSupplierSettlements(DB)` (supply-settlement.ts)는 환불창(available_at)이 지난
 * pending 정산을 available 로 승격하는 **이미 구현된 성숙 함수**다. 이 cron 은 그 함수를
 * 일정 주기로 호출만 한다 — 성숙 로직을 재구현하지 않는다(단일 진실원천 유지).
 *
 * - fail-soft: 실패해도 throw 하지 않음(다음 주기에 재시도, 멱등). 디스코드/로그만.
 * - consumer + wholesale 정산 모두 같은 supplier_settlements 테이블·같은 함수로 성숙(공통).
 *
 * 권장 주기(cadence): **시간별(hourly)** — 브랜드제품(1일창)/일반(7일창) 만기를 적시에 반영.
 *   일배치(daily)로도 동작(정산은 available_at 경과 후 언제든 멱등 승격). 부하 매우 낮음.
 *
 * 등록(오케스트레이터 — scheduled.ts):
 *   import { handleWholesaleSettleTick } from './cron/wholesale-settle-tick'
 *   // 매시 정각(또는 일배치) 분기에 추가:
 *   await handleWholesaleSettleTick(env)
 */
import type { Env } from '../types/env'
import { matureSupplierSettlements } from '../../features/supply/api/supply-settlement'
import { logInfo, logError } from '../utils/logger'
import { sendDiscordAlert } from '../utils/discord-alert'

export async function handleWholesaleSettleTick(env: Env): Promise<{ matured: number }> {
  const DB = env.DB
  try {
    const matured = await matureSupplierSettlements(DB)
    if (matured > 0) {
      logInfo('[Cron] wholesale-settle-tick: matured supplier settlements', { matured })
    }
    return { matured }
  } catch (err) {
    // fail-soft — 다음 주기에 멱등 재시도. 성숙은 돈 흐름이라 실패를 로그/알림으로 가시화.
    logError('[Cron] wholesale-settle-tick failed', { error: String(err) })
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Wholesale Settle Tick Failed',
        `정산 성숙 cron(matureSupplierSettlements) 오류: ${(err as Error)?.message || String(err)}`,
        'error',
      ).catch(() => { /* 알림 실패 무시 */ })
    }
    return { matured: 0 }
  }
}
