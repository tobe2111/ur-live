/**
 * 🏭 NOTI-1 (2026-06-08) 유통스타트 도매몰 — 재입고 알림 통지 cron.
 *
 * 배경: 판매사가 품절 상품에 `wholesale_restock_subscriptions` 로 "재입고되면 알려주세요" 구독을
 *   남긴다(wholesale-notifications.routes.ts). 실제 재고 갱신 site(공급자/어드민 재고 수정·주문 차감 등)는
 *   여러 곳에 흩어져 있어 hooking 하면 결합도가 높아진다. 대신 이 cron 이 **주기적으로 재고가 회복된
 *   구독을 스캔**해서 통지 → 재고 갱신 코드를 전혀 건드리지 않는다(낮은 결합도, 단일 통지 경로).
 *
 * 동작(멱등·fail-soft):
 *   미통지(notified_at IS NULL) 구독 중 상품 재고가 stock>0 으로 회복된 것을 조인 →
 *   각 판매사에 대시보드 알림('재입고 알림: <상품명>', /wholesale/product/<id> 링크) →
 *   notified_at 을 찍어 재통지 차단(다음 스캔에서 제외). 배치 cap 으로 한 주기 부하 제한.
 *   판매사가 다시 품절 후 재구독하면 라우터의 upsert 가 notified_at 을 NULL 로 리셋 → 다시 통지 대상.
 *
 * 권장 주기(cadence): **15~30분(또는 hourly)**. 재입고는 즉시성이 어느 정도 중요하지만(놓치면
 *   재고 다시 소진), 분 단위까지 필요하진 않음. 일배치로도 동작(멱등). 부하 매우 낮음.
 *
 * 등록(오케스트레이터 — scheduled.ts, ⚠️ 본 PR 미수정 — 리포트에 명시):
 *   import { handleWholesaleRestockNotify } from './cron/wholesale-restock-notify'
 *   // 15~30분(또는 매시) 분기에 추가:
 *   await handleWholesaleRestockNotify(env)
 */
import type { Env } from '../types/env'
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes'
import { logInfo, logError } from '../utils/logger'
import { sendDiscordAlert } from '../utils/discord-alert'

// 한 주기에 처리할 최대 구독 수(통지 폭주·서브요청 한도 보호). 남은 건 다음 주기에 처리(멱등).
const BATCH_CAP = 200

interface RestockRow {
  id: number
  distributor_seller_id: number
  product_id: number
  product_name: string | null
}

export async function handleWholesaleRestockNotify(env: Env): Promise<{ notified: number }> {
  const DB = env.DB
  let notified = 0
  try {
    // 미통지 구독 × 재고 회복(stock>0) 상품 조인. 상품 없거나 재고 0 이면 제외(다음에 회복되면 잡힘).
    const { results } = await DB.prepare(`
      SELECT s.id, s.distributor_seller_id, s.product_id, p.name AS product_name
      FROM wholesale_restock_subscriptions s
      JOIN products p ON p.id = s.product_id
      WHERE s.notified_at IS NULL AND COALESCE(p.stock, 0) > 0
      ORDER BY s.created_at ASC
      LIMIT ?
    `).bind(BATCH_CAP).all<RestockRow>().catch(() => ({ results: [] as RestockRow[] }))

    for (const row of (results ?? [])) {
      const name = row.product_name || '상품'
      // 멱등 가드 — notified_at 을 먼저 원자적으로 claim(아직 미통지일 때만). 동시 cron 중복 통지 차단.
      const claim = await DB.prepare(
        "UPDATE wholesale_restock_subscriptions SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL"
      ).bind(row.id).run().catch(() => null)
      if ((claim?.meta?.changes ?? 0) === 0) continue // 다른 주기/cron 이 이미 처리

      // 통지(fail-soft) — claim 성공 후이므로 알림 실패해도 재통지되지 않음(중복 방지 우선).
      //   재고 다시 소진→재구독 시 라우터 upsert 가 notified_at 리셋 → 회복되면 다시 통지.
      await createDashboardNotification(
        DB, 'seller', String(row.distributor_seller_id), 'wholesale_restock',
        '재입고 알림', `${name} 상품이 재입고되었어요 — 지금 사입할 수 있어요`,
        `/wholesale/product/${row.product_id}`,
      ).catch(() => { /* 알림 실패 무시 — 이미 notified_at claim 됨 */ })
      notified++
    }

    if (notified > 0) logInfo('[Cron] wholesale-restock-notify: notified distributors', { notified })
    return { notified }
  } catch (err) {
    // fail-soft — 다음 주기에 멱등 재시도. 통지 누락 가시화(로그/알림).
    logError('[Cron] wholesale-restock-notify failed', { error: String(err) })
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Wholesale Restock Notify Failed',
        `재입고 알림 cron 오류: ${(err as Error)?.message || String(err)}`,
        'error',
      ).catch(() => { /* 알림 실패 무시 */ })
    }
    return { notified }
  }
}
