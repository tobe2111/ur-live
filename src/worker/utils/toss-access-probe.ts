/**
 * 🌏 토스 접근 점검 — "이 거점에서 나간 호출을 토스가 받아 주는가" (2026-11-24)
 *
 * 토스는 2026-11-09 부터 시크릿 키 호출을 등록된 IP·국가(우리는 "대한민국")에서만 받는다.
 * 우리 워커는 **손님과 가까운 Cloudflare 거점**에서 돌고, 토스 호출도 그 거점에서 나간다.
 * 그래서 새벽 cron 프로브 1회(자기 거점 하나)로는 "해외에서 결제하는 손님" 경로를 알 수 없다.
 * 어드민이 **자기가 닿은 거점에서** 같은 조회를 1회 시켜 보고 거점 이름과 함께 판정을 받는다.
 *
 * 없는 결제키 조회라 부수효과 0. 키 값·IP 는 응답에 넣지 않는다.
 * ⚠️ 못 보는 것: 거점마다 출구 IP 가 여럿이라 1회 통과가 그 거점 전체를 보증하지 않는다.
 */
export type TossAccessVerdict = 'valid' | 'blocked' | 'invalid' | 'unknown'

export function interpretTossLookupCode(code: string | undefined): TossAccessVerdict {
  if (code === 'NOT_FOUND_PAYMENT') return 'valid' // 인증·접근 정책 통과, 그 결제만 없다
  if (code === 'API_KEY_ACCESS_DENIED') return 'blocked' // 이 거점의 출구 IP 가 허용 범위 밖
  if (code === 'UNAUTHORIZED_KEY' || code === 'INVALID_API_KEY' || code === 'HTTP_401') return 'invalid'
  return 'unknown' // NETWORK·5xx·서킷 등 — 차단으로 단정하지 않는다
}
