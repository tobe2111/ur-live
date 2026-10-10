/**
 * 🎟️ **카운터 사용 처리 — 상품 PIN 또는 매장 확인코드** (2026-10-10 전수조사)
 *
 * 무인증 경로 `POST /api/vouchers/:code/use`(손님 휴대폰 화면 `/v/:code` 에서 직원이 비밀을 넣는다)의
 * 원자 CAS. 종전 문장은 `store_verify_pin = ?` **하나만** 받았다. 그런데 바로 앞 가드
 * (`voucher-redeem-guard.ts`)는 상품 PIN 이 없을 때 **매장 확인코드**를 통과시킨다 ⇒ 확인코드를 정확히
 * 넣어도 이 UPDATE 가 0행이 되어 *"이미 사용되었거나 PIN 이 틀립니다"* 가 났다. 상품 PIN 은 등록
 * 화면에서 *선택*이라 대부분 비어 있다(라이브 실측 2026-10-10: PIN 보유 상품은 한 매장의 2개뿐)
 * ⇒ **기본 상태에서 이 경로가 통째로 막혀 있었다.** 에러 로그도 없고 "PIN 이 틀렸다" 로만 보인다.
 *
 * ## 규칙
 * 둘 중 **하나**를 받는다 — 상품 PIN(설정된 경우) 또는 그 매장의 확인코드. 둘 다 *매장 쪽 비밀*이라
 * 강도가 같고(같은 rate limit 5/분), 직원이 어느 쪽을 알든 통과한다(비밀이 둘이라 헷갈리던 것도 풀린다).
 * 판정은 **이 한 문장 안에서 원자적으로** 끝난다 — 가드를 믿고 조건을 빼지 않는다
 * (가드는 친절한 거절 문구용이고, 이 문장이 실제 문이다).
 *
 * 🔒 넓히지 않은 것: PIN·확인코드 **둘 다 없는** 상품은 여전히 0행이다(코드만 알면 소각되던 2026-07-02
 *   구멍을 다시 열지 않는다). 플랫폼 상품(`seller_id IS NULL`)은 확인코드가 없으므로 상품 PIN 만 받는다.
 *   빈 문자열은 어느 쪽에서도 비밀로 치지 않는다.
 */
import { ensureRedemptionSettingsTable } from './redemption-settings'

export async function redeemByCounterSecret(DB: D1Database, code: string, secret: string) {
  // 서브쿼리가 참조하는 표가 없으면 문장 자체가 실패한다(가지를 타지 않아도 SQLite 는 prepare 에서 해석한다).
  await ensureRedemptionSettingsTable(DB)
  return DB.prepare(
    `UPDATE vouchers
       SET status = 'used', used_at = datetime('now')
     WHERE code = ?
       AND status = 'unused'
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       AND product_id IN (
         SELECT id FROM products
         WHERE id = vouchers.product_id
           AND (
             (store_verify_pin IS NOT NULL AND store_verify_pin <> '' AND store_verify_pin = ?)
             OR (seller_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM seller_redemption_settings r
                WHERE r.seller_id = products.seller_id
                  AND r.store_code IS NOT NULL AND r.store_code <> '' AND r.store_code = ?
             ))
           )
       )`,
  ).bind(code, secret, secret).run()
}
