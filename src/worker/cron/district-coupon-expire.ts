/**
 * 🧾 2026-07-13 상권 쿠폰 만료 임박 알림 + 만료 스위퍼 cron (일 1회, stay/meal-voucher expire 와 동시).
 *
 * 배경: 상권 쿠폰(병렬 엔티티)은 만료가 **lazy**(사용 CAS 가 expires_at 검증, /my 는 CASE 로 'expired' 표시)라
 *   ① 만료 임박 사전 알림이 없었고 ② status 가 실제로 'expired' 로 전이되지 않아 리포트/집계가 비결정적일 수 있었다.
 *
 * 이 cron(로직):
 *   1) **만료 임박 알림(D-3, 미사용, 미통지)** — `expiry_notified_at IS NULL` 인 미사용 쿠폰 중 D-3 이내를
 *      CAS(`SET expiry_notified_at WHERE ... IS NULL`)로 선점 후 알림 → **쿠폰당 1회만**(재실행/중복발송 0).
 *      알림톡은 게이트 뒤(env DISTRICT_ALIMTALK_ENABLED + 채널설정) — OFF 면 인앱만(현행과 동일).
 *   2) **만료 스위핑** — `status='unused' AND expires_at<=now` → `status='expired'`. 멱등, **머니 0**
 *      (상권 쿠폰은 원장/딜/유어딜5% 무접촉 — 만료=소멸이라 환불/역전 없음). 사용 CAS 는 이미 만료 가드 보유라
 *      스위핑이 없어도 이중사용 불가 — 스위핑은 리포트 결정론(lapsed 확정)을 위한 정리.
 *
 * ⚠️ 결제/정산 무관. best-effort — 실패해도 다음 실행에서 재시도(선점 CAS 라 중복 알림 없음).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureDistrictTables, notifyDistrictUser, type DistrictAlimtalkEnv } from '../../features/district/api/district-coupon.routes'

const EXPIRING_DAYS = 3 // 만료 임박 임계(D-3)

type ExpiringRow = { id: number; user_id: string; face_value: number; expires_at: string }

export async function runDistrictCouponExpireCron(env: DistrictAlimtalkEnv): Promise<{ expiring: number; notified: number; swept: number }> {
  const DB: D1Database = env.DB
  await ensureDistrictTables(DB)

  // 1) 만료 임박(D-3, 미사용, 미통지) — 선점 CAS 후 알림(쿠폰당 1회).
  const rows = await DB.prepare(
    `SELECT id, user_id, face_value, expires_at
       FROM district_coupons
      WHERE status = 'unused' AND expiry_notified_at IS NULL
        AND expires_at > datetime('now')
        AND expires_at <= datetime('now', '+' || ? || ' days')
      ORDER BY expires_at ASC LIMIT 500`,
  ).bind(EXPIRING_DAYS).all<ExpiringRow>().catch(() => ({ results: [] as ExpiringRow[] }))

  let notified = 0
  for (const r of rows.results || []) {
    // 선점 CAS — 통지 마킹 승자만 발송(동시 실행/재시도 이중발송 0).
    const cas = await DB.prepare(
      "UPDATE district_coupons SET expiry_notified_at = datetime('now') WHERE id = ? AND expiry_notified_at IS NULL",
    ).bind(r.id).run().catch(() => null)
    if (!cas || cas.meta.changes === 0) continue
    const dateStr = String(r.expires_at || '').slice(0, 10)
    try {
      await notifyDistrictUser(
        DB, String(r.user_id), '⏰ 상권 쿠폰 만료 임박',
        `${Number(r.face_value).toLocaleString('ko-KR')}원 상권 쿠폰이 곧 만료돼요 (${dateStr}까지) — 참여 점포에서 사용하세요`,
        { env, kind: 'expiring' },
      )
      notified++
    } catch { /* fail-soft — 개별 알림 실패가 나머지·스위핑 무영향 */ }
  }

  // 2) 만료 스위핑(미사용 + 기한 지남 → 'expired'). 멱등·머니 0.
  const swept = await DB.prepare(
    "UPDATE district_coupons SET status = 'expired' WHERE status = 'unused' AND expires_at <= datetime('now')",
  ).run().catch(() => null)

  return { expiring: (rows.results || []).length, notified, swept: swept?.meta?.changes || 0 }
}
