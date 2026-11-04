/**
 * 📞📣 카카오 로그인에서 번호·마케팅 동의 받기 (2026-11-04 대표 *"최대한 받으면 좋겠는데"* → *"응 해줘. 다"*).
 *
 * 전부 **기본 꺼짐**이다 — 콘솔 설정(비즈 앱·검수·약관 등록) 전에 켜면 카카오가 로그인 자체를 거부한다(KOE205).
 * ① 꺼져 있으면 오늘과 한 글자도 다르지 않다(scope · service_terms · id_token 빠른 길)
 * ② 번호 스위치 → scope 에 phone_number + id_token 대신 사용자정보 API(번호가 거기만 있다)
 * ③ 약관 태그 → 동의 화면에 service_terms · 마케팅 태그에 동의한 경우만 marketing 기록(미동의를 '거부' 로 남기지 않는다)
 * ④ 웹 이동과 카톡 간편로그인이 같은 약관을 보낸다
 *
 * ⚠️ 못 보는 것: 카카오 콘솔 실제 설정 · 검수 결과 · 실제 카카오 응답 형식(라이브 첫 로그인으로 확인).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { kakaoLoginScope, kakaoNeedsUserInfo, kakaoServiceTermsParam } from '@/features/auth/services/kakao-login-scope'

vi.mock('@/worker/utils/terms-agreements', () => ({ recordTermsAgreements: vi.fn(async (_db: unknown, _t: string, _id: unknown, a: Array<{ doc_type: string }>) => a.map((x) => x.doc_type)) }))
import { recordKakaoMarketingConsent } from '@/features/auth/services/kakao-marketing-consent'
import { recordTermsAgreements } from '@/worker/utils/terms-agreements'

const routes = readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8')

describe('① 기본 꺼짐 — 오늘과 같다', () => {
  it('scope 는 종전 그대로 · 사용자정보 API 안 부름 · 약관 파라미터 없음', () => {
    expect(kakaoLoginScope({ KAKAO_OIDC_ENABLED: '1' })).toBe('openid,account_email,profile_nickname,profile_image')
    expect(kakaoNeedsUserInfo({})).toBe(false)
    expect(kakaoServiceTermsParam({})).toBeNull()
  })
})

describe('② 번호', () => {
  it('스위치를 켜면 phone_number 를 요청하고 id_token 대신 사용자정보 API', () => {
    expect(kakaoLoginScope({ KAKAO_OIDC_ENABLED: '1', KAKAO_PHONE_SCOPE_ENABLED: 'true' })).toContain(',phone_number')
    expect(kakaoNeedsUserInfo({ KAKAO_PHONE_SCOPE_ENABLED: 'true' })).toBe(true)
    expect(routes).toMatch(/c\.env\.KAKAO_OIDC_ENABLED && !kakaoNeedsUserInfo\(c\.env\) \? kakaoService\.parseIdToken/)
  })
})

describe('③ 약관', () => {
  it('태그는 깨끗한 것만 · authorize 에 service_terms 로 붙인다', () => {
    expect(kakaoServiceTermsParam({ KAKAO_SERVICE_TERMS: ' marketing_v1, bad tag ,service_v1' })).toBe('marketing_v1,service_v1')
    expect(routes).toMatch(/if \(serviceTerms\) authUrl\.searchParams\.set\('service_terms', serviceTerms\)/)
  })
  it('마케팅 태그에 동의했을 때만 기록 · 태그 설정 없으면 카카오를 부르지 않는다', async () => {
    const getTags = vi.fn(async () => ['service_v1', 'marketing_v1'])
    expect(await recordKakaoMarketingConsent({} as never, {}, 1, getTags)).toBe(false)
    expect(getTags).not.toHaveBeenCalled()
    expect(await recordKakaoMarketingConsent({} as never, { KAKAO_MARKETING_TERM_TAG: 'marketing_v1' }, 1, getTags)).toBe(true)
    expect(recordTermsAgreements).toHaveBeenLastCalledWith({}, 'user', 1, [{ doc_type: 'marketing', agreed: true }])
    vi.mocked(recordTermsAgreements).mockClear()
    expect(await recordKakaoMarketingConsent({} as never, { KAKAO_MARKETING_TERM_TAG: 'marketing_v1' }, 1, async () => ['service_v1'])).toBe(false)
    expect(recordTermsAgreements).not.toHaveBeenCalled()
  })
  it('로그인 콜백이 응답을 막지 않고(waitUntil) 기록을 부른다', () => {
    expect(routes).toMatch(/if \(c\.env\.KAKAO_MARKETING_TERM_TAG\) \{ const mp = recordKakaoMarketingConsent\(DB, c\.env, user\.id, \(\) => kakaoService\.getServiceTerms\(accessToken\)\); if \(c\.executionCtx\) c\.executionCtx\.waitUntil\(mp\)/)
  })
})

describe('④ 카톡 간편로그인도 같은 약관', () => {
  it('sdk 티켓에 serviceTerms 를 싣고, 클라이언트가 authorize 에 넘긴다', () => {
    expect(routes).toMatch(/scope: loginScope \|\| '', serviceTerms: serviceTerms \|\| ''/)
    expect(readFileSync('src/lib/kakao-talk-login.ts', 'utf8')).toMatch(/\.\.\.\(t\.serviceTerms \? \{ serviceTerms: t\.serviceTerms \} : \{\}\)/)
  })
})
