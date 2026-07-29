/**
 * 🎟️ 무인증 소각 갭 방어 — 코드 직접입력(staff/카운터) 경로 전용
 *
 * 배경: 코드 입력 엔드포인트는 무인증이고, 사용처리 CAS 가
 * `store_verify_pin IS NULL OR store_verify_pin = ?` 라서 **상품에 PIN 이 없으면**
 * 제출한 pin 이 사실상 무시된다 — 코드만 알면 누구나 소각할 수 있었다.
 * 소비자 셀프 경로는 이미 모드가 강제되지만, 이 카운터 경로에만 no-PIN 갭이 남아 있었다.
 *
 * 판정: 매장이 **strict 모드(scan_only·store_code)** 를 골랐는데 상품 PIN 이 없으면,
 * 제출값이 '매장 확인코드'와 일치할 때만 통과시킨다(카운터 스티커 = 매장 비밀).
 * `scan_only` 도 포함한다 — "직원 확인만" 이라는 의도인데 no-PIN 이면 코드-단독 소각이 되어
 * 의도와 정반대로 동작했다. 매장코드를 요구해야 실제 '직원 확인'이 복원된다.
 *
 * 불변: **self_free(느슨한 매장, 기본값)와 store_verify_pin 이 설정된 상품은 byte-불변**
 * (PIN 이 이미 staff 비밀 역할을 한다). 조회 실패는 fail-open — redemption-settings SSOT 와 같은 사상.
 */

/** 통과면 null, 막아야 하면 사용자에게 보일 사유. */
export async function checkStoreCodeRequired(
  DB: D1Database,
  code: string,
  submittedPin: string | null | undefined,
): Promise<{ code: string; error: string } | null> {
  try {
    const prod = await DB.prepare(
      `SELECT p.seller_id AS seller_id, p.store_verify_pin AS store_verify_pin
         FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code = ?`,
    ).bind(code).first<{ seller_id: number | null; store_verify_pin: string | null }>()

    // 상품 PIN 이 있으면 기존 CAS 가 제 역할을 한다 — 손대지 않는다.
    if (!prod || prod.seller_id == null) return null
    if (prod.store_verify_pin != null && prod.store_verify_pin !== '') return null

    const { getRedemptionSettings } = await import('./redemption-settings')
    const s = await getRedemptionSettings(DB, Number(prod.seller_id))
    if (s.mode === 'self_free') return null
    if (s.store_code && submittedPin === s.store_code) return null

    return { code: 'STORE_CODE_REQUIRED', error: '매장 확인코드를 입력해주세요.' }
  } catch {
    return null // fail-open — 기존 동작 유지
  }
}
