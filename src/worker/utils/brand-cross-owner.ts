/**
 * 🏷️ **점주가 다른 가맹점끼리 이용권 사용 + 쓴 지점 정산** — 브랜드 전 지점 사용의 3단계
 *   (결재 `docs/decisions/2026-10-18-franchise-cross-owner-redeem.md` — 대표 "결재해줄게" + ①②③ 권장안).
 *
 * ## 규칙 (대표 확정)
 * ① **받는 지점이 고른다.** 받는 지점 주인이 "다른 점주 이용권 받기"를 켠 지점만 받는다
 *    (`seller_meta.brand_cross_owner_accept = '1'`). 남이 정한 가격·구성으로 손님을 받게 되므로 그 점주의 결정이다.
 * ② **판매 때 이미 나간 비용이 붙은 이용권은 받지 않는다.** 소개비·중개사 몫이 판 지점 계정에서 이미 빠졌다면
 *    매출만 다른 점주에게 넘기면 판 지점이 비용만 떠안는다. 그런 이용권은 같은 주인 지점에서만 쓴다
 *    (원장을 되돌리는 코드가 필요 없다).
 * ③ **수수료는 쓴 지점의 채널 요율.** 정산받는 매장(`merchant_id`)이 쓴 지점이 되므로
 *    `recordVoucherUsedLedger` 의 `channelPlatformRate(merchant_id)` 가 자연히 그 지점 요율을 고른다 — 별도 코드 없음.
 *
 * ## 게이트
 * `platform_settings.brand_cross_owner_redeem_enabled === 'true'` 일 때만 다른 점주 지점이 받는다.
 * **기본 OFF = 1·2단계와 byte-동일**(같은 주인 지점만, 정산은 판 지점). 켜는 것은 대표다(staging 실결제 뒤).
 *
 * ## 쓴 지점 기록 (정산의 근거)
 * 사용이 확정되는 순간(CAS 성공 직후) `voucher_redeem_stores` 에 어느 지점이 받았는지 적는다.
 * 정산 두 레일이 **같은 기록**을 읽는다 — Rail B(사용 순간 원장 `merchant:N`)와 Rail A(주간 `restaurant_settlements`).
 * 둘이 갈리면 같은 매출이 두 지점으로 간다. 그래서 SQL 조각(`REDEEM_STORE_SETTLEMENT_SQL`)과 함수
 * (`settlementMerchantFor`) 를 이 파일 하나에 둔다.
 * ⚠️ 정산은 **게이트를 다시 보지 않는다** — 어느 지점이 손님을 받았는지는 사용 순간의 사실이다. 사용 뒤 게이트를 꺼도
 *    이미 받은 지점이 정산받는다(롤백 = 앞으로의 사용만 막는다. 결재 파일 '롤백').
 */
import { ensureSellerMetaTable } from './seller-meta'
import { dbKey } from './d1-read-replica'
import { swallow } from './swallow'

export const CROSS_OWNER_GATE_KEY = 'brand_cross_owner_redeem_enabled'
export const CROSS_OWNER_ACCEPT_META = 'brand_cross_owner_accept'

/** 게이트 — 조회 실패·미설정은 OFF(fail-closed). */
export async function isCrossOwnerRedeemEnabled(DB: D1Database): Promise<boolean> {
  const r = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(CROSS_OWNER_GATE_KEY).first<{ value: string | null }>().catch(() => null)
  return r?.value === 'true'
}

/** 받는 지점의 동의(①). 행 없음·조회 실패는 꺼짐. */
export async function isCrossOwnerAccepting(DB: D1Database, sellerId: number): Promise<boolean> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) return false
  await ensureSellerMetaTable(DB)
  const r = await DB.prepare('SELECT value FROM seller_meta WHERE seller_id = ? AND key = ? LIMIT 1')
    .bind(sellerId, CROSS_OWNER_ACCEPT_META).first<{ value: string | null }>().catch(() => null)
  return r?.value === '1'
}

const _ensured = new WeakSet<object>()
export async function ensureRedeemStoreTable(DB: D1Database): Promise<void> {
  if (_ensured.has(dbKey(DB))) return
  _ensured.add(dbKey(DB))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_redeem_stores (
    voucher_id INTEGER PRIMARY KEY,
    store_seller_id INTEGER NOT NULL,
    sold_seller_id INTEGER NOT NULL,
    cross_owner INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('redeem-stores:create'))
}

/**
 * ② 판매 때 이미 나간 비용이 있나 — 소개비·중개사 몫(`influencer_attributions`, 회수 안 된 것)과
 * 추천 적립(`affiliate_earnings`, 취소 안 된 것). 그 주문에 하나라도 있으면 다른 점주 지점은 받지 않는다.
 * 테이블이 아예 없으면 비용도 없다(false). 그 밖의 조회 실패는 **있다고 본다**(fail-closed — 받지 않는다).
 */
export async function voucherHasSunkCost(DB: D1Database, voucherId: number): Promise<boolean> {
  if (!Number.isFinite(voucherId) || voucherId <= 0) return true
  const v = await DB.prepare('SELECT order_id FROM vouchers WHERE id = ? LIMIT 1')
    .bind(voucherId).first<{ order_id: number | null }>().catch(() => undefined)
  if (v === undefined) return true
  if (!v || v.order_id == null) return false
  const probe = async (sql: string): Promise<boolean> => {
    try {
      const r = await DB.prepare(sql).bind(v.order_id).first()
      return !!r
    } catch (e) {
      return !/no such table/i.test(String((e as Error)?.message || e))
    }
  }
  if (await probe(`SELECT 1 FROM influencer_attributions
                    WHERE order_id = ? AND COALESCE(status, '') <> 'clawed_back' AND COALESCE(commission_amount, 0) > 0 LIMIT 1`)) return true
  if (await probe(`SELECT 1 FROM affiliate_earnings
                    WHERE order_id = ? AND COALESCE(status, '') NOT IN ('cancelled', 'refunded', 'reversed') AND COALESCE(commission, 0) > 0 LIMIT 1`)) return true
  return false
}

/** 지점의 주인 user id — `brand-wide-redeem.ts` 의 `STORE_OWNER_SQL` 과 같은 규칙(순환 import 를 피해 이 파일에 둔다). */
const OWNER_OF = `COALESCE(NULLIF(s.linked_user_id, 0), (
  SELECT o.user_id FROM seller_operators o
   WHERE o.seller_id = s.id AND o.role = 'owner' AND o.revoked_at IS NULL
   ORDER BY o.granted_at LIMIT 1))`

/**
 * 사용이 확정된 직후(CAS 성공) 어느 지점이 받았는지 적는다. 판 지점 자신이 받았으면 **행을 지운다**
 * — 사용 취소 뒤 다시 쓰는 경우 옛 기록이 정산을 엉뚱한 지점으로 보내지 않게.
 * `cross_owner` 는 쓰는 순간의 주인으로 정한다(주인을 모르면 0 — 정산은 판 지점 그대로).
 */
export async function recordVoucherRedeemStore(
  DB: D1Database, p: { voucherId: number; soldSellerId: number | null; storeSellerId: number | null },
): Promise<void> {
  if (!Number.isFinite(p.voucherId) || p.voucherId <= 0 || p.soldSellerId == null || p.storeSellerId == null) return
  await ensureRedeemStoreTable(DB)
  if (Number(p.soldSellerId) === Number(p.storeSellerId)) {
    await DB.prepare('DELETE FROM voucher_redeem_stores WHERE voucher_id = ?').bind(p.voucherId).run()
      .catch(swallow('redeem-stores:clear'))
    return
  }
  const owners = await DB.prepare(
    `SELECT s.id AS id, ${OWNER_OF} AS owner_id FROM sellers s WHERE s.id IN (?, ?)`,
  ).bind(Number(p.soldSellerId), Number(p.storeSellerId))
    .all<{ id: number; owner_id: number | null }>().catch(() => ({ results: [] as Array<{ id: number; owner_id: number | null }> }))
  const ownerOf = new Map((owners.results || []).map((r) => [Number(r.id), r.owner_id == null ? null : Number(r.owner_id)]))
  const a = ownerOf.get(Number(p.soldSellerId)) ?? null
  const b = ownerOf.get(Number(p.storeSellerId)) ?? null
  const cross = a != null && b != null && a !== b ? 1 : 0
  await DB.prepare(
    `INSERT OR REPLACE INTO voucher_redeem_stores (voucher_id, store_seller_id, sold_seller_id, cross_owner, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  ).bind(p.voucherId, Number(p.storeSellerId), Number(p.soldSellerId), cross).run()
    .catch(swallow('redeem-stores:record'))
}

/**
 * Rail A(주간 정산) 의 "정산받는 지점" — 별칭 `v`(vouchers)·`p`(products). 다른 점주 지점이 받은 이용권만 그 지점으로.
 * ⚠️ 이 조각을 쓰는 쿼리는 실행 전에 `ensureRedeemStoreTable` 을 불러야 한다(테이블이 없으면 쿼리가 던진다).
 */
export const REDEEM_STORE_SETTLEMENT_SQL = `COALESCE((SELECT r.store_seller_id FROM voucher_redeem_stores r
  WHERE r.voucher_id = v.id AND r.cross_owner = 1), p.seller_id)`

/** Rail B(사용 순간 원장) 의 정산받는 지점 — Rail A 와 같은 기록을 읽는다. 조회 실패는 판 지점 그대로. */
export async function settlementMerchantFor(DB: D1Database, voucherId: number, fallback: number | null): Promise<number | null> {
  if (!Number.isFinite(voucherId) || voucherId <= 0) return fallback
  await ensureRedeemStoreTable(DB)
  const r = await DB.prepare('SELECT store_seller_id FROM voucher_redeem_stores WHERE voucher_id = ? AND cross_owner = 1 LIMIT 1')
    .bind(voucherId).first<{ store_seller_id: number }>().catch(() => null)
  return r?.store_seller_id ? Number(r.store_seller_id) : fallback
}
