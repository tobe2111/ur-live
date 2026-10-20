/**
 * 🎫 2026-06-17: KT Alpha 교환권(기프티콘) 발송 실패 자동 복구 cron.
 *
 * 사용자 요청 ("가장 이상적으로 해결해줘. 어떻게 해야 문제가 없는지") — voucher 발송 실패가
 * 어드민 수동 재발송에만 의존하던 구조를, 안전 범위에서 자동 자가치유 + 위험 케이스 surface 로 전환.
 *
 * 동작 (매시간):
 *   A. 'failed' 자동 재시도 (안전 — 중복발송 0):
 *      - status='failed' = sendCoupon 이 throw → 절대 발송 안 됨 → 재시도해도 중복 0 (수동 재발송과 동일).
 *      - 가드: retry_count < 3 · 최근 14일 이내 · 유효 폰(01x...) · goods_code 존재.
 *      - exponential backoff: last_retry_at + 2^retry_count 시간 경과분만 (1h → 2h → 4h).
 *      - run 당 최대 20건. CAS(status='failed'→'processing')로 선점 후 sendCoupon. 성공→'sent' / 실패→retry_count 유지(이미 ++됨).
 *      - 3회 소진분은 Discord 1회 요약 (수동 처리 안내).
 *   B. 'processing' 끼임 surface (위험 회피 — 자동 재발송 안 함):
 *      - sendCoupon 직후 UPDATE 전 워커 크래시 시 'processing' 영구 잔존(발송 성공 여부 불명).
 *      - 30분 초과분을 'failed'(retry_count=3=소진) 로 전환 → 실패 목록에 보이되 자동 재발송은 안 함
 *        (중복발송/이중과금 위험 차단). 운영자가 KT Alpha 구매내역 확인 후 수동 재발송.
 *
 * 안전성 요지: 자동 sendCoupon 은 '미발송 확정(failed)' 분에만 → 중복 0.
 *   결과 불명(processing 끼임) 분은 자동 재발송하지 않고 수동 검토로 surface.
 *
 * config 미설정(kt_alpha_user_id/callback_no 누락) 시 전체 skip — retry_count 안 태움.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface FailedVoucher {
  id: number
  goods_code: string
  goods_name: string
  recipient_phone: string
  unit_price: number
  retry_count: number
}

const MAX_RETRY = 3
const PER_RUN = 20
const STUCK_MINUTES = 30
const RECENT_DAYS = 14

// 🛡️ 머니/정합성 룰: 핸들러 inline ALTER 금지 — ensureXxx + WeakSet 메모이즈(per-request DDL).
const _retryColsEnsured = new WeakSet<D1Database>()
async function ensureVoucherRetryColumns(DB: D1Database): Promise<void> {
  if (_retryColsEnsured.has(DB)) return
  for (const sql of [
    `ALTER TABLE voucher_orders ADD COLUMN retry_count INTEGER DEFAULT 0`,
    `ALTER TABLE voucher_orders ADD COLUMN last_retry_at DATETIME`,
  ]) {
    try { await DB.prepare(sql).run() } catch { /* duplicate column — 이미 있음 */ }
  }
  _retryColsEnsured.add(DB)
}

export async function handleKtAlphaVoucherRetry(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    // voucher_orders 테이블 자체가 없는 환경(미적용)은 graceful no-op.
    const tableExists = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='voucher_orders' LIMIT 1"
    ).first().catch(() => null)
    if (!tableExists) return

    await ensureVoucherRetryColumns(DB)

    // ── B. 'processing' 끼임 → 실패(소진)로 surface (자동 재발송 X) ──────────────
    //   sendCoupon 결과 불명 → 중복발송 위험. retry_count=3 으로 자동 재시도 대상에서 제외.
    const stuck = await DB.prepare(
      `UPDATE voucher_orders
          SET status = 'failed',
              retry_count = ${MAX_RETRY},
              failure_reason = '⏳ 처리 중 ${STUCK_MINUTES}분 초과 — 발송 결과 미확인. 중복 발송 방지를 위해 KT Alpha 구매내역 확인 후 수동 재발송하세요.',
              updated_at = datetime('now')
        WHERE source = 'kt_alpha'
          AND status = 'processing'
          AND sent_at IS NULL
          AND created_at < datetime('now', '-${STUCK_MINUTES} minutes')`
    ).run().catch(() => null)
    const stuckCount = stuck?.meta?.changes || 0
    if (stuckCount > 0) logInfo(`[kt-alpha-voucher-retry] ${stuckCount} stuck 'processing' → 'failed' (수동 검토)`)

    // ── A. 'failed' 자동 재시도 (config 있을 때만) ───────────────────────────────
    const settings = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_user_id','kt_alpha_callback_no','kt_alpha_template_id','kt_alpha_banner_id')"
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const sMap: Record<string, string> = {}
    for (const r of (settings.results || [])) sMap[r.key] = r.value
    if (!sMap.kt_alpha_user_id || !sMap.kt_alpha_callback_no) {
      // config 미설정 → 자동 재시도 불가. retry_count 안 태우고 종료(끼임 정리는 위에서 이미 수행).
      if (stuckCount > 0) await alertStuck(env, stuckCount)
      return
    }

    // ── C. 미발송 스위퍼 (2026-07-02, 대표 승인 — KT 발송 waitUntil 이동의 백스톱) ──────────
    //   결제 확정(PAID/DONE) 됐는데 KT 발송이 '시작조차' 안 된 주문을 찾아 재킥. 커버:
    //   ① waitUntil 이동 후 isolate 조기소멸 ② 기존 동기 경로에도 있던 결제커밋~발송 사이 크래시 갭.
    //   이중발송 구조적 0: auto-send 는 발송 시도 시작 시점(INSERT 'processing')에 external_order_id
    //   ('u{oid}-…')를 기록 → 시도 이력이 있는 주문(processing/sent/failed 전부)은 NOT EXISTS 로 제외
    //   (failed 는 위 A 재시도 담당) + auto-send 내부 per-order 가드가 2차 방어.
    //   10분 유예(방금 결제된 waitUntil 진행분과 레이스 방지) · 48h 윈도 · run 당 10건 ·
    //   폰 보유 주문만(shipping_phone 또는 users.phone — 없는 건 스윕해도 발송 불가 + 알림 스팸만 유발).
    try {
      const missed = await DB.prepare(
        `SELECT o.id, o.shipping_phone, o.user_id
           FROM orders o
          WHERE o.status IN ('PAID','DONE')
            AND o.created_at >= datetime('now', '-48 hours')
            AND o.created_at <= datetime('now', '-10 minutes')
            AND EXISTS (
              SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = o.id AND p.kt_alpha_gift_code IS NOT NULL AND p.auto_voucher_send = 1
            )
            AND NOT EXISTS (
              SELECT 1 FROM voucher_orders vo
               WHERE vo.source = 'kt_alpha' AND vo.external_order_id LIKE 'u' || o.id || '-%'
            )
            AND (
              o.shipping_phone GLOB '01[0-9]*'
              OR EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id AND u.phone GLOB '01[0-9]*')
            )
          ORDER BY o.created_at ASC
          LIMIT 10`
      ).all<{ id: number; shipping_phone: string | null; user_id: string | number | null }>()
        .catch(() => ({ results: [] as Array<{ id: number; shipping_phone: string | null; user_id: string | number | null }> }))
      const missedList = missed.results || []
      if (missedList.length > 0) {
        logInfo(`[kt-alpha-voucher-retry] 미발송 스위퍼 — 발송기록 없는 확정주문 ${missedList.length}건 재킥`)
        const { autoSendKtAlphaVouchersForOrders } = await import('../utils/kt-alpha-auto-send')
        await autoSendKtAlphaVouchersForOrders(
          env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
          missedList.map(o => ({ id: Number(o.id), shipping_phone: o.shipping_phone ?? undefined, user_id: o.user_id })),
          String(missedList.find(o => o.user_id != null)?.user_id ?? ''),
        )
      }
    } catch (e) {
      logError('[kt-alpha-voucher-retry] 미발송 스위퍼 실패', { error: (e as Error).message })
    }

    const rows = await DB.prepare(
      `SELECT id, goods_code, goods_name, recipient_phone, unit_price, COALESCE(retry_count, 0) AS retry_count
         FROM voucher_orders
        WHERE source = 'kt_alpha'
          AND status = 'failed'
          AND COALESCE(retry_count, 0) < ${MAX_RETRY}
          AND created_at >= datetime('now', '-${RECENT_DAYS} days')
          AND recipient_phone GLOB '01[0-9]*'
          AND (
            last_retry_at IS NULL OR
            datetime(last_retry_at, '+' || (1 << COALESCE(retry_count, 0)) || ' hours') < datetime('now')
          )
        ORDER BY created_at ASC
        LIMIT ${PER_RUN}`
    ).all<FailedVoucher>().catch(() => ({ results: [] as FailedVoucher[] }))

    const list = rows.results || []
    if (list.length === 0) {
      if (stuckCount > 0) await alertStuck(env, stuckCount)
      return
    }

    const { sendCoupon } = await import('../utils/giftishow-api')
    let healed = 0
    const exhausted: FailedVoucher[] = []

    for (const v of list) {
      // 폰 재검증 (GLOB 통과해도 형식 엄격 검사) — 미통과는 수동 대상이라 건드리지 않음.
      const phone = String(v.recipient_phone).replace(/\D/g, '')
      if (!/^01\d{8,9}$/.test(phone)) continue

      // CAS 선점: failed → processing (retry_count++ · last_retry_at 기록). 동시 cron/수동 재발송과 경합 차단.
      const claim = await DB.prepare(
        `UPDATE voucher_orders
            SET status = 'processing', retry_count = COALESCE(retry_count, 0) + 1,
                last_retry_at = datetime('now'), failure_reason = NULL, updated_at = datetime('now')
          WHERE id = ? AND status = 'failed'`
      ).bind(v.id).run().catch(() => null)
      if (!claim || claim.meta.changes === 0) continue  // 다른 프로세스가 선점 → skip

      const newCount = v.retry_count + 1
      // 🛡️ KT Alpha TRID 20자 제한 (ERR0807). base36 단축.
      const trId = `v${v.id}-${Date.now().toString(36)}`.slice(0, 20)
      try {
        const res = await sendCoupon(env as unknown as Parameters<typeof sendCoupon>[0], {
          goodsCode: v.goods_code,
          phoneNo: phone,
          callbackNo: sMap.kt_alpha_callback_no,
          mmsTitle: '유어딜 교환권',
          mmsMsg: `${v.goods_name} 교환권이 도착했습니다. 30일 이내 사용해주세요.`,
          trId,
          userId: sMap.kt_alpha_user_id,
          orderNo: `v-${v.id}`,
          gubun: 'N',
          templateId: sMap.kt_alpha_template_id || undefined,
          bannerId: sMap.kt_alpha_banner_id || undefined,
        })
        await DB.prepare(
          `UPDATE voucher_orders SET status = 'sent', external_order_id = ?, coupon_code = COALESCE(?, coupon_code),
                  sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).bind(res.orderNo || trId, res.pinNo || null, v.id).run().catch(() => null)
        healed++
      } catch (sendErr) {
        const msg = (sendErr as Error).message.slice(0, 300)
        await DB.prepare(
          `UPDATE voucher_orders SET status = 'failed', failure_reason = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(`자동 재시도 ${newCount}회 실패: ${msg}`, v.id).run().catch(() => null)
        if (newCount >= MAX_RETRY) exhausted.push(v)
      }
    }

    if (healed > 0) logInfo(`[kt-alpha-voucher-retry] healed ${healed}/${list.length}`)

    // Discord 요약 — 자동 복구 불가(3회 소진) + 끼임 surface 분 1회 알림.
    if (exhausted.length > 0 || stuckCount > 0) {
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          const lines: string[] = []
          if (healed > 0) lines.push(`✅ 자동 복구 ${healed}건`)
          if (exhausted.length > 0) {
            lines.push(`🔴 3회 재시도 소진 ${exhausted.length}건 — 수동 처리 필요:`)
            lines.push(exhausted.slice(0, 10).map(d => `  #${d.id} ${d.goods_name}`).join('\n'))
          }
          if (stuckCount > 0) lines.push(`⏳ 처리중 끼임 ${stuckCount}건 → 실패 전환(중복방지 수동 검토)`)
          lines.push('\n/admin/voucher-orders 에서 확인 + 재발송')
          await sendDiscordAlert(
            webhook,
            `🎫 교환권 발송 자동 복구 리포트`,
            lines.join('\n').slice(0, 1800),
            exhausted.length > 0 ? 'error' : 'warn',
          )
        } catch { /* graceful */ }
      }
    }
  } catch (e) {
    logError('[kt-alpha-voucher-retry] failed', { error: (e as Error).message })
  }
}

// config 미설정 등으로 자동 재시도는 못 했지만 끼임 정리만 한 경우의 알림.
async function alertStuck(env: Env, stuckCount: number): Promise<void> {
  const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
  if (!webhook) return
  try {
    const { sendDiscordAlert } = await import('../utils/discord-alert')
    await sendDiscordAlert(
      webhook,
      `🎫 교환권 발송 끼임 정리`,
      `⏳ 처리중 끼임 ${stuckCount}건 → 실패 전환(중복방지 수동 검토).\n/admin/voucher-orders 에서 확인 + 재발송`,
      'warn',
    )
  } catch { /* graceful */ }
}
