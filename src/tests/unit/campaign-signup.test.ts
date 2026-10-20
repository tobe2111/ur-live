/**
 * 📣 2026-08-09 캠페인 신청(인플루언서 모집) — 공유 모듈 불변식.
 *
 * 지키는 것:
 *  1. 캠페인 코드 정규화/레지스트리 대조 — 미등록·형식위반 코드가 신청 API 를 통과하지 못한다.
 *  2. 택소노미가 influencer-apply.routes(유어애즈 인바운드)와 **글자 단위로 동일** — 갈라지면
 *     캠페인 신청자의 category 가 유어애즈 풀에서 '기타'로 강등된다(조용한 데이터 열화).
 *  3. ref 링크 형식 — `?ref={users.id}` + `&c={campaign}`: ref 는 inflow 검증 정규식(숫자 1~12자리)을,
 *     campaign 은 normalizeAcqSource 형식을 통과해야 클릭이 inflow_clicks 에 캠페인과 함께 적재된다.
 *
 * 이 테스트가 못 막는 것: 라우트 마운트 누락(worker/index.ts)·App.tsx 라우트 누락 — 배선은
 * 정적 텍스트 대조로만 고정한다(아래 wiring 검사).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSignupCampaign, SIGNUP_CAMPAIGNS, CAMPAIGN_CATEGORIES, buildCampaignRefLink } from '@/shared/campaign-signup'

describe('getSignupCampaign — 코드 정규화 + 레지스트리 대조', () => {
  it('등록 캠페인은 대소문자/공백 무관 해석', () => {
    expect(getSignupCampaign('bangbae')?.code).toBe('bangbae')
    expect(getSignupCampaign(' BANGBAE ')?.code).toBe('bangbae')
  })
  it('미등록/형식위반/빈값은 null', () => {
    expect(getSignupCampaign('no-such-campaign')).toBeNull()
    expect(getSignupCampaign('한글코드')).toBeNull()
    expect(getSignupCampaign('a')).toBeNull() // 최소 2자
    expect(getSignupCampaign('')).toBeNull()
    expect(getSignupCampaign(null)).toBeNull()
    expect(getSignupCampaign('bangbae; DROP TABLE')).toBeNull()
  })
  it('레지스트리 코드는 전부 소문자/숫자/하이픈 (inflow_clicks.campaign · normalizeAcqSource 형식)', () => {
    for (const c of SIGNUP_CAMPAIGNS) expect(c.code).toMatch(/^[a-z0-9][a-z0-9-]{1,39}$/)
  })
})

describe('택소노미 — influencer-apply.routes 와 동일 어휘(매칭/풀 정합)', () => {
  const routeSrc = readFileSync('src/features/marketing/api/influencer-apply.routes.ts', 'utf8')
  it('CAMPAIGN_CATEGORIES 의 모든 항목이 인바운드 신청 CATEGORIES 에 존재', () => {
    const m = routeSrc.match(/const CATEGORIES = \[([^\]]+)\]/)
    expect(m).toBeTruthy()
    const routeCats = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect([...CAMPAIGN_CATEGORIES]).toEqual(routeCats)
  })
})

describe('buildCampaignRefLink — inflow 트래킹이 실제로 읽을 수 있는 형식', () => {
  it('ref 는 숫자 그대로, 캠페인은 ?c= 로', () => {
    expect(buildCampaignRefLink(1234, 'bangbae')).toBe('https://urdeal.kr/?ref=1234&c=bangbae')
  })
  it('ref 파라미터 값이 inflow 검증 정규식(^\\d{1,12}$)을 통과', () => {
    const url = new URL(buildCampaignRefLink('567', 'bangbae'))
    expect(url.searchParams.get('ref')).toMatch(/^\d{1,12}$/)
    expect(url.searchParams.get('c')).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/)
  })
})

describe('배선 고정 — 페이지·API·전역 ref 캡처가 실제로 걸려 있다', () => {
  it('worker 에 캠페인 신청 + 어드민 라우트 마운트', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toContain("app.route('/api/campaign', campaignApplyRoutes)")
    expect(w).toContain("app.route('/api/admin/campaign-applications', adminCampaignApplicationsRoutes)")
  })
  it('App.tsx 에 /campaign/:code 라우트(게이트 뒤) + 루트 ?ref 전역 캡처', () => {
    const a = readFileSync('src/App.tsx', 'utf8')
    expect(a).toMatch(/CAMPAIGN_SIGNUP_ENABLED && <Route path="\/campaign\/:code"/)
    expect(a).toContain("captureInflowRef(params.get('ref') || params.get('aff'))")
  })
  it('클라 유입 발사가 캠페인 코드를 함께 보낸다 (?c= → inflow_clicks.campaign)', () => {
    const t = readFileSync('src/utils/affiliate-track.ts', 'utf8')
    expect(t).toContain('campaign: campaignFromUrl()')
  })
})
