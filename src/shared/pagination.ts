/**
 * request 쿼리 정수 파라미터 파싱 (page/limit/offset/days 등).
 *
 * 배경(2026-07-01 도매몰 라이브 전수조사): `Math.max(1, parseInt(q('page')||'1',10))` 가
 *   비숫자 query('abc')에 parseInt=NaN → Math.max(1,NaN)=NaN → SQL .bind(NaN) → 500 크래시.
 *   순진한 `parseInt(...) || 기본값` 폴백은 **0을 falsy 로 삼켜** `limit=0` 을 기본값으로 튕겨
 *   기존 min-클램프 계약(limit=0 → 1)을 깬다.
 *
 * 규칙: 유한 정수(0·음수 포함)는 그대로 반환(호출부의 Math.max/Math.min 클램프에 위임),
 *   비숫자/부재만 def 로 폴백. → NaN 크래시 제거 + 기존 클램프 의미 100% 보존.
 *
 * 예) const limit = Math.min(200, Math.max(1, intParam(c.req.query('limit'), 50)))
 *     limit 부재 → 50 / limit=0 → 1(클램프) / limit=9999 → 200(클램프) / limit=abc → 50
 */
export function intParam(raw: unknown, def: number): number {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) ? n : def
}
