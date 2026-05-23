/**
 * 🛡️ 2026-05-23 v2 — defensive default 변경 (사용자 신고 "여전히 동일 에러"):
 *   unknown prefix → 'widget' (이전 serverFlow 신뢰 → 회귀 위험)
 *   이제 명시적 _gck_ 만 'redirect'. 그 외 모든 케이스는 widget API 사용.
 *
 * 이유:
 *   payment() V2 는 widget 키 거부 시 SDK 가 명확한 에러.
 *   widgets() API 는 거의 모든 키 type 에서 시도 가능 + 명확한 에러.
 *   기본을 widget 으로 강제 → "결제위젯 연동 키는 지원하지 않습니다" 영구 차단.
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
 * 최종 흐름 결정 (defensive — widget 우선):
 *   - missing → 'invalid'
 *   - gck → 'redirect' (payment V2 — gck 만 명시적 지원)
 *   - 그 외 (widget / unknown) → 'widget' (widgets() API)
 *
 * server 의 serverFlow 값은 무시. 키 prefix 만으로 결정 →
 * 캐시 / race condition / server 옛 코드 영향 0.
 */
export function resolveTossFlow(
  _serverFlow: 'redirect' | 'widget' | 'invalid' | undefined,
  clientKey: string | undefined | null,
): 'redirect' | 'widget' | 'invalid' {
  const t = detectTossClientKeyType(clientKey)
  if (t === 'missing') return 'invalid'
  if (t === 'gck') return 'redirect'
  return 'widget'  // widget / unknown — widgets() API 강제.
}
