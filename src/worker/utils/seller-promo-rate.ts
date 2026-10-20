/**
 * 매장이 정하는 소개비(promo %) 저장 — **등록과 수정이 같은 함수를 쓴다.**
 *
 * 🩸 2026-09-05: 이 로직이 `POST /products` 안에만 있었다. 그래서 이용권을 한 번 올리면
 *   소개비를 영영 못 바꿨다("이번 주 안 팔리니 올리자"가 불가능). 수정 경로에 같은 블록을
 *   복사하려다 멈췄다 — 게이트 조건과 clamp 범위가 두 벌이 되면 반드시 갈린다(이 레포가
 *   같은 날 `referral_commission_rate` 단위로 네 갈래 난 것을 고친 참이다).
 *
 * ⚠️ **이중 게이트가 이 함수의 존재 이유다.** `platform_settings.seller_promo_field_enabled==='true'`
 *   일 때만 쓴다. 어필리에이트 재원이 아직 플랫폼 부담(`promo_funding_source ≠ 'owner'`)인 동안
 *   열면 **매장이 건 소개비를 유어딜이 대신 문다**(재원 설계의 −14% 누수).
 *   순서: 재원 전환 → 이 게이트 ON. `docs/design/commission-funding-restructure.md` §1.
 *
 * fail-soft: 게이트 OFF·컬럼 부재·에러 전부 **저장 생략**(현행과 동일). 절대 throw 하지 않는다 —
 * 소개비 저장 실패가 상품 등록/수정 자체를 깨면 안 된다.
 */

/** 0~0.5 분수. 범위 밖·비숫자는 저장하지 않는다(서버가 최종 판단 — 클라 플래그 우회 방어). */
export async function applySellerPromoRate(
  db: D1Database,
  productId: number | string,
  sellerId: number | string | null,
  body: { referral_enabled?: boolean; referral_commission_rate?: number },
): Promise<void> {
  if (body.referral_commission_rate === undefined || body.referral_commission_rate === null) return
  try {
    const gate = await db
      .prepare("SELECT value FROM platform_settings WHERE key = 'seller_promo_field_enabled'")
      .first<{ value: string }>()
      .catch(() => null)
    const rate = Number(body.referral_commission_rate)
    if (gate?.value !== 'true' || !Number.isFinite(rate) || rate < 0 || rate > 0.5) return
    const enabled = body.referral_enabled === false || rate === 0 ? 0 : 1
    // 소유권 스코프: sellerId 가 있으면 WHERE 에 포함(수정 경로). 등록 경로는 방금 만든 행이라 id 로 충분.
    if (sellerId != null) {
      await db.prepare(`UPDATE products SET referral_enabled = ?, referral_commission_rate = ? WHERE id = ? AND seller_id = ?`)
        .bind(enabled, rate, productId, sellerId).run()
    } else {
      await db.prepare(`UPDATE products SET referral_enabled = ?, referral_commission_rate = ? WHERE id = ?`)
        .bind(enabled, rate, productId).run()
    }
  } catch { /* 게이트 OFF / 컬럼 부재 — 저장 생략(현행과 동일) */ }
}
