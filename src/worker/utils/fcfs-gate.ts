/**
 * 🎯 2026-07-04 (대표 "다 해줘 이상적으로" — 체험단/추첨 상권 패키지 도구): FCFS 당첨자 전용 결제 게이트.
 *
 * 배경: 추첨(선착순) 상품(product_supply_meta.fcfs_enabled='1')은 응모→어드민 당첨자 선정→
 *   당첨 알림의 결제 딥링크로 구매하는 흐름인데, **서버 어디에도 "당첨자만 결제" 검증이 없어**
 *   비당첨자/미응모자도 링크만 알면 그냥 결제 가능했음(체험단 정원 무의미).
 *
 * 규칙: fcfs_enabled 상품은 fcfs_applications.status ∈ ('selected','paid') 인 유저만 구매 가능.
 *   비-FCFS 상품은 무조건 통과(추가 조회 1회뿐). fail-open — 게이트 조회 인프라 실패가
 *   정상 결제를 막지 않음(접근제어이지 머니 정합이 아님, max_per_person 과 동일 소프트 룰).
 *
 * 배선(3 chokepoint): group-buy /join(딜·토스 공통 사전검증) · /confirm-toss(과금 직전 재검증) ·
 *   order.routes POST /api/orders(일반 배송상품 카트). 결제 완료 시 markFcfsPaid 로 status='paid'
 *   플립 → 어드민이 미결제 당첨자(selected 잔존)를 보고 예비 당첨자 승계 가능.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isDemoSlug } from '../../shared/constants/demo-products'

export const DEMO_PURCHASE_ERROR = '오픈 준비 중인 매장이라 아직 결제할 수 없어요 — 응모하시면 오픈 소식을 알려드릴게요'

/**
 * 결제 직전 데모 판정. 조회가 실패하면 **결제를 막지 않는다**(false) — 그 경우엔 결제 흐름의
 * 다른 조회도 같이 실패하므로 여기서 막는 이득이 없고, 정상 상품까지 막는 손해만 있다.
 * 막는 근거는 오직 실재하는 데모 slug 다.
 */
export async function isDemoProductForPurchase(DB: D1Database, productId: number): Promise<boolean> {
  if (!Number.isFinite(Number(productId))) return false
  const row = await DB.prepare('SELECT slug FROM products WHERE id = ?')
    .bind(Number(productId)).first<{ slug: string | null }>().catch(() => null)
  return isDemoSlug(row?.slug)
}

export async function checkFcfsPurchasable(
  DB: D1Database,
  productId: number,
  userId: string | number | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  // 🧪 2026-10-26 (대표 "데모 숙소에도 실제로 결제가 되면 안돼"): 데모 상품(slug 'demo-*')은 누구도 결제 못 한다.
  //   추첨 게이트만으로는 부족했다 — ① fcfs_enabled 가 안 붙은 데모(숙소 일부·유어샵 예시)는 통과했고
  //   ② 아래 조회가 실패하면 fail-open 이라 통과했다. 데모 판정은 그 둘과 무관하게 **먼저** 한다.
  const demo = await isDemoProductForPurchase(DB, productId)
  if (demo) return { ok: false, error: DEMO_PURCHASE_ERROR, code: 'DEMO_NOT_PURCHASABLE' }
  try {
    const { getSupplyMeta } = await import('./product-supply-meta')
    const meta = await getSupplyMeta(DB, [Number(productId)]).catch(() => null)
    if (meta?.get(Number(productId))?.fcfs_enabled !== '1') return { ok: true }
    if (!userId) {
      return { ok: false, error: '추첨 상품은 응모 후 당첨자만 구매할 수 있습니다 — 로그인 후 응모해주세요', code: 'FCFS_WINNER_ONLY' }
    }
    const row = await DB.prepare(
      'SELECT status FROM fcfs_applications WHERE product_id = ? AND user_id = ? LIMIT 1',
    ).bind(Number(productId), String(userId)).first<{ status: string }>().catch(() => null)
    const st = String(row?.status || '')
    if (st === 'selected' || st === 'paid') return { ok: true }
    return {
      ok: false,
      error: st === 'applied'
        ? '아직 당첨자 발표 전이에요 — 당첨되면 알림으로 결제 링크를 보내드립니다'
        : '추첨 당첨자만 구매할 수 있는 상품입니다 — 먼저 응모해주세요',
      code: 'FCFS_WINNER_ONLY',
    }
  } catch {
    return { ok: true } // fail-open — 인프라 오류가 일반 결제를 막지 않음
  }
}

/** 당첨자 결제 완료 마킹(selected→paid) — 멱등·fail-soft. 예비 당첨자 승계 판단의 근거. */
export async function markFcfsPaid(
  DB: D1Database,
  productId: number,
  userId: string | number,
): Promise<void> {
  try {
    await DB.prepare(
      "UPDATE fcfs_applications SET status = 'paid' WHERE product_id = ? AND user_id = ? AND status = 'selected'",
    ).bind(Number(productId), String(userId)).run()
  } catch { /* fail-soft */ }
}
