/**
 * 📣 카카오 동의 화면의 '마케팅 정보 수신(선택)' 약관 → 우리 동의 기록(terms_agreements · marketing).
 * 2026-11-04 대표 *"카카오 로그인 시 알림 설정이랑 받을 수 없나? 최대한 받으면 좋겠는데"* → *"응 해줘. 다"*.
 *
 * - 꺼져 있으면(`KAKAO_MARKETING_TERM_TAG` 없음) 카카오를 부르지 않는다 — 로그인 속도 그대로.
 * - 켜져 있으면 응답을 막지 않고(waitUntil) 카카오 `/v2/user/service_terms` 를 한 번 읽는다.
 * - **동의한 경우만** 기록한다. 카카오 화면에서 체크를 안 했다고 '거부' 를 남기지 않는다 — 번호 창의 선택 동의가
 *   따로 있고, 한쪽의 미체크가 다른 쪽의 동의를 덮으면 안 된다(INSERT OR IGNORE · 같은 버전 첫 기록 보존).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { recordTermsAgreements } from '../../../worker/utils/terms-agreements'

export async function recordKakaoMarketingConsent(
  DB: D1Database,
  env: { KAKAO_MARKETING_TERM_TAG?: string },
  userId: string | number,
  getTags: () => Promise<string[]>,
): Promise<boolean> {
  const tag = (env.KAKAO_MARKETING_TERM_TAG || '').trim()
  if (!tag) return false
  try {
    const tags = await getTags()
    if (!tags.includes(tag)) return false
    const rec = await recordTermsAgreements(DB, 'user', userId, [{ doc_type: 'marketing', agreed: true }])
    return rec.includes('marketing')
  } catch {
    return false
  }
}
