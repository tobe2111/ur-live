/**
 * 🤝 **사장님의 중개 조건 동의** — 2026-10-10 대표 *"1,2,5번은 해주고"* (가입 흐름 ⑤).
 *
 * 대행사가 매장을 대신 등록할 때 **혼자** 정한 두 요율(중개사 몫 % · 인플루언서 상한 %)이, 사장님이
 * 소유권을 넘겨받은 뒤에도 그대로 남는다. 그런데 사장님 화면(`/store/find`)은 그 조건을 **보여 주지도
 * 묻지도 않았다** — 승계 응답에 요율이 아예 없었다. 내 매출에서 나갈 돈을 모른 채 주인이 되는 셈이다.
 *
 * 여기서 하는 것: ① 조회 응답에 조건을 싣고 ② 신청할 때 **지금 그 조건에** 동의했는지 확인하고 ③ 동의를
 * 감사 기록(`terms_consents`, slug `broker-terms`)으로 남긴다.
 * ❌ 하지 않는 것: 요율 계산·지급(`broker-share.ts`, 게이트 `broker_share_enabled` 기본 OFF) · 승인 로직.
 *    **돈은 한 원도 안 움직인다** — 바뀌는 것은 "사장님이 조건을 보고 동의했다" 는 기록이 생긴다는 것뿐이다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { readBrokerTerms } from './broker-share'
import { recordTermsConsent } from './terms-consent'

export interface BrokerTermsView { broker_share_pct: number; influencer_pct_cap: number | null }

/** 중개 매장이면 조건, 아니면 null(직접 매장·조건 없음). */
export async function brokerTermsView(DB: D1Database, sellerId: number): Promise<BrokerTermsView | null> {
  const t = await readBrokerTerms(DB, sellerId).catch(() => null)
  if (!t || t.brokerUserId == null) return null
  return { broker_share_pct: t.sharePct, influencer_pct_cap: t.influencerCapPct }
}

/** 화면이 본 조건(`seen`)이 지금 조건과 같은가 — 그 사이 대행사가 바꿨으면 다시 보여 줘야 한다. */
export function sameBrokerTerms(a: BrokerTermsView, seen: unknown): boolean {
  if (!seen || typeof seen !== 'object') return false
  const s = seen as Record<string, unknown>
  const cap = s.influencer_pct_cap == null ? null : Number(s.influencer_pct_cap)
  return Number(s.broker_share_pct) === a.broker_share_pct && cap === a.influencer_pct_cap
}

export function brokerTermsVersion(t: BrokerTermsView): string {
  return `share=${t.broker_share_pct};cap=${t.influencer_pct_cap ?? 'none'}`
}

export function recordBrokerTermsConsent(DB: D1Database, p: { sellerId: number; userId: number; terms: BrokerTermsView; ip: string | null }) {
  return recordTermsConsent(DB, {
    subjectType: 'seller', subjectId: p.sellerId, userId: p.userId,
    slug: 'broker-terms', version: brokerTermsVersion(p.terms), ip: p.ip,
  })
}
