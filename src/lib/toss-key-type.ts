/**
 * 🛡️ 2026-05-23 client-side Toss 키 type 감지 — server 와 동일 룰.
 *
 * server (src/worker/utils/toss-gateway.ts) detectTossKeyType 과 1:1 매칭.
 * 클라이언트가 server flow 응답을 못 믿을 때 (캐시/race) belt-and-suspenders 로 사용.
 *
 * Toss 공식 키 네이밍 (2024+):
 *   - 'widget' (결제위젯): live_ck_* / test_ck_* / live_wck_* / test_wck_* / legacy *_wt_* *_widget_*
 *     → widgets() API 전용. payment() 호출 시 SDK 가 "결제위젯 연동 키는 지원하지 않습니다" 에러.
 *   - 'gck' (API 개별 연동): live_gck_* / test_gck_*
 *     → payment() V2 전용.
 *   - 'unknown': 알 수 없음 → widgets() default (더 많은 PG 지원).
 */
export type TossClientKeyType = 'widget' | 'gck' | 'unknown' | 'missing'

export function detectTossClientKeyType(key: string | undefined | null): TossClientKeyType {
  if (!key) return 'missing'
  // gck 먼저 (specific) — _ck_ 보다 우선순위 높음.
  if (/_gck_/i.test(key)) return 'gck'
  if (/_ck_|_wck_|_wt_|_widget_/i.test(key)) return 'widget'
  return 'unknown'
}

/**
 * server 응답의 flow 와 클라이언트 키 감지를 조합해 최종 흐름 결정.
 * server flow 가 'redirect' 인데 키가 widget 이면 → 'widget' 으로 강제 (cache miss 대비).
 * server flow 가 'widget' 인데 키가 gck 이면 → 'redirect' 로 강제 (역방향 대비).
 * 일치하면 그대로.
 */
export function resolveTossFlow(
  serverFlow: 'redirect' | 'widget' | 'invalid' | undefined,
  clientKey: string | undefined | null,
): 'redirect' | 'widget' | 'invalid' {
  if (!serverFlow || serverFlow === 'invalid') return serverFlow || 'invalid'
  const t = detectTossClientKeyType(clientKey)
  if (t === 'missing') return 'invalid'
  if (t === 'widget') return 'widget'  // widget 키는 무조건 widgets() API.
  if (t === 'gck') return 'redirect'   // gck 키는 무조건 payment() V2.
  return serverFlow  // unknown — server 신뢰.
}
