/**
 * 🧹 2026-06-17 (사용자 요청 — 근본 수정): products.description 의 공급사(KT Alpha) 내부
 *   정책 괄호 "(KT Alpha B2B 정책)" / "(KT Alpha B2B 쿠폰 정책)" 만 일괄 제거.
 *
 *   배경: 과거 KT Alpha sync 가 description 에 이 괄호를 박아 저장 → commit addbc2b 가
 *     sync 합성 코드는 고쳤지만 **이미 prod DB 에 저장된 행은 그대로** → 소비자 교환권
 *     상세에 계속 노출. 이 UPDATE 로 데이터 자체를 정정.
 *
 *   특성:
 *     - 정상 문구(환불/사용 안내)·무관 괄호(옵션 등) 보존 — 지정 리터럴만 제거.
 *     - 멱등: WHERE 가 잔여 괄호 보유 행만 매칭 → 2회차 0건.
 *
 *   공용: admin-kt-alpha.routes (수동 버튼/run-all-backfills) + kt-alpha-catalog-sync cron (1회 자동).
 */
export async function cleanupKtAlphaDescriptions(DB: D1Database): Promise<number> {
  const r = await DB.prepare(
    `UPDATE products
        SET description = TRIM(
              REPLACE(
                REPLACE(
                  REPLACE(description, ' (KT Alpha B2B 정책)', ''),
                  '(KT Alpha B2B 정책)', ''),
                '(KT Alpha B2B 쿠폰 정책)', '')
            ),
            updated_at = datetime('now')
      WHERE description LIKE '%(KT Alpha B2B 정책)%'
         OR description LIKE '%(KT Alpha B2B 쿠폰 정책)%'`
  ).run()
  return (r.meta?.changes ?? 0) as number
}
