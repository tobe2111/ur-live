/**
 * 🛡️ 2026-05-23 v3 (사용자 진단 + 에러 증거 종합 후 정정):
 *
 * 결정적 증거:
 *   1) PaymentDemoPage 가 'test_gck_docs_*' 로 widgets() API 성공
 *   2) 사용자 /toss-debug 가 'test_gck_P9B...' 로 widgets() 성공
 *   3) 사용자 production payment() V2 호출 → "결제위젯 연동 키는 지원하지 않습니다" 에러
 *
 * → '_gck_' prefix 는 **결제위젯 (widget) 키**. payment() V2 는 다른 prefix.
 * → 이전 가정 (_gck_ = API 개별) 거꾸로였음. 정정.
 *
 * 안전한 default:
 *   - 알려진 widget prefix 모두 → 'widget'
 *   - 그 외 unknown → 'widget' (widgets() 가 더 범용)
 *   - missing → 'invalid'
 */
export type TossClientKeyType = 'widget' | 'unknown' | 'missing'

export function detectTossClientKeyType(key: string | undefined | null): TossClientKeyType {
  if (!key) return 'missing'
  // _gck_/_ck_/_wck_/_wt_ 모두 widget 키 prefix (Toss 가 widgets API 로 처리)
  if (/_gck_|_ck_|_wck_|_wt_|_widget_/i.test(key)) return 'widget'
  return 'unknown'
}

/**
 * 모든 키 → widgets() API 강제 (다른 옵션 제거).
 * payment() V2 경로는 코드에서 완전 폐기. variantKey 'DEFAULT' 가 SDK 기본값.
 */
export function resolveTossFlow(
  _serverFlow: 'redirect' | 'widget' | 'invalid' | undefined,
  clientKey: string | undefined | null,
): 'redirect' | 'widget' | 'invalid' {
  const t = detectTossClientKeyType(clientKey)
  if (t === 'missing') return 'invalid'
  return 'widget'  // 모든 키 widgets() API.
}
