/**
 * 🚪 2026-10-10 — 매장 사장님·중개사 첫 가입 정리 (대표 *"1,2,5번은 해주고"*).
 *
 * ① **가입 문 하나** — 옛 가입 주소 전부와 영입자 초대 링크가 `/store/new` 로 간다. 옛 문이 하던 일
 *    (영입 귀속 · 지도에 없는 가게)을 새 문이 넘겨받았는지까지 본다 — 문만 합치고 일을 빠뜨리면
 *    영입자가 데려온 매장이 **에러 없이** 귀속을 잃는다.
 * ② **판매자 이용약관 동의** — 새 문에 약관 코드가 0건이던 법적 공백. 화면과 서버가 같은 규칙.
 * ⑤ **중개 승계** — 승계 코드를 고정으로 보여 주고(토스트 한 번 → 놓침), 사장님은 대행사가 정한
 *    조건을 보고 동의해야 신청된다(서버가 같은 조건인지 다시 확인하고 기록).
 *
 * ⚠️ 이 시험이 **못 보는 것**: 실제 D1 에서 귀속 UPDATE 가 맞는 행을 고치는지 · 약관 기록이 실제로
 *   남는지(둘 다 fail-soft 라 실패해도 등록은 성공한다) · 화면 모양. 앞의 둘은 staging 에서
 *   `terms_consents` 와 `sellers.introduced_by_influencer_id` 를 한 번 조회해 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { storeTermsError } from '@/features/seller/api/store-signup-extras'
import { sameBrokerTerms, brokerTermsVersion } from '@/worker/utils/broker-terms-consent'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const ROUTES = read('src/routes/seller.routes.tsx')
const PROSPECTS = read('src/features/seller-prospects/api/seller-prospects.routes.ts')
const STORES = read('src/features/seller/api/seller-stores.routes.ts')
const EXTRAS = read('src/features/seller/api/store-signup-extras.ts')
const MODAL = read('src/components/seller/StoreRegisterModal.tsx')
const CLAIM_PAGE = read('src/pages/StoreClaimPage.tsx')
const CLAIMS = read('src/features/seller/api/seller-store-claims.routes.ts')
const OWNER_PAGE = read('src/pages/StoreOwnerClaimPage.tsx')

describe('① 가입 문 하나 (/store/new)', () => {
  it('옛 가입 주소 넷이 전부 /store/new 로 리다이렉트한다', () => {
    expect(ROUTES).toContain("pathname: '/store/new', search: location.search")
    for (const p of ['/seller/register', '/seller/signup', '/seller/register/business', '/seller/register/supplier']) {
      expect(ROUTES, `${p} 가 리다이렉트가 아니다`).toContain(`<Route path="${p}" element={<LegacySellerRegisterRedirect />} />`)
    }
    expect(ROUTES, '옛 가입 폼이 다시 라우트에 붙었다 — 문이 둘이 된다').not.toContain('<SellerRegisterSupplierPage')
  })

  it('영입자 초대 링크가 /store/new 로 간다 (프리필 쿼리 유지)', () => {
    expect(PROSPECTS).toContain('path: `/store/new?${qs.toString()}`')
    expect(PROSPECTS).not.toContain('/seller/register/supplier?')
    // 로그인 왕복에서 쿼리를 잃으면 프리필이 사라진다.
    expect(CLAIM_PAGE).toContain('`/store/new${window.location.search || \'\'}`')
    expect(CLAIM_PAGE).toContain('/api/prospects/prefill/')
    expect(CLAIM_PAGE).toContain('initialManagerPhone={prospect?.contact_phone || undefined}')
  })

  it('새 문이 영입 귀속을 넘겨받았다 — 옛 문과 같은 규칙, 초대 링크 귀속은 안 덮는다', () => {
    expect(STORES).toContain('await afterStoreCreated(c.env.DB,')
    expect(EXTRAS).toContain('matchProspectOnSignup(DB, p.sellerId, p.managerPhone')
    expect(EXTRAS).toMatch(/introduced_by_influencer_id = \?[\s\S]{0,200}referral_bonus_until = datetime\('now', '\+6 months'\)/)
    expect(EXTRAS, '초대 링크(?ref=) 귀속을 덮어쓴다').toContain('AND introduced_by_influencer_id IS NULL')
    expect(EXTRAS, '에이전시 타입을 걸러내지 않는다(옛 문과 다른 규칙)').toContain("matched.introducerType !== 'agency'")
  })

  it('지도에 없는 가게도 등록할 수 있다 (옛 문이 받던 경우)', () => {
    expect(MODAL).toContain('<ManualPlaceForm')
    expect(MODAL).toContain('지도에 없는 가게예요')
  })
})

describe('② 판매자 이용약관 동의', () => {
  it('서버가 동의 없으면 행을 만들기 전에 거절한다', () => {
    const iCheck = STORES.indexOf('storeTermsError(b.terms_agreed_version)')
    const iInsert = STORES.indexOf('INSERT INTO sellers')
    expect(iCheck, '약관 검사가 없다').toBeGreaterThan(-1)
    expect(iCheck, '약관 검사가 행 생성 뒤에 있다 — 동의 없는 매장이 생긴다').toBeLessThan(iInsert)
    // 🩸 검사를 **부르기만** 하고 결과로 거절하지 않으면 헛돈다(주입이 잡았다) — 거절 줄을 따로 본다.
    const iReject = STORES.indexOf("if (termsErr) return c.json({ success: false, code: 'TERMS_REQUIRED', error: termsErr }, 400)")
    expect(iReject, '약관 검사 결과로 거절하지 않는다').toBeGreaterThan(iCheck)
    expect(iReject).toBeLessThan(iInsert)
    expect(storeTermsError(undefined)).toBeTruthy()
    expect(storeTermsError('')).toBeTruthy()
    expect(storeTermsError('1.0')).toBeNull()
  })

  it('동의를 옛 문과 같은 함수로 기록한다', () => {
    expect(EXTRAS).toContain('recordTermsConsent(DB,')
    expect(EXTRAS).toContain("slug: 'seller'")
  })

  it('화면이 마지막 단계에서 동의를 받고 버전을 보낸다', () => {
    expect(MODAL).toContain('terms_agreed_version: TERMS_CURRENT_VERSION')
    expect(MODAL).toContain("return termsAgreed ? null : '판매자 이용약관에 동의해주세요'")
    expect(MODAL).toMatch(/\{last && \([\s\S]{0,200}checked=\{termsAgreed\}/)
    expect(MODAL).toContain('href="/terms/seller"')
  })
})

describe('⑤ 중개 승계', () => {
  it('등록 완료 페이지가 승계 코드를 고정으로 보여 준다 (토스트 한 번 X)', () => {
    expect(MODAL).toContain('onDone(Number(r.data.data?.seller_id) || undefined, { ownerClaimCode: code })')
    expect(MODAL, '페이지에서도 토스트로만 흘려보낸다').toContain('if (code && !asPage) toast.success')
    expect(CLAIM_PAGE).toContain('if (opts?.ownerClaimCode) { setHandoff(opts.ownerClaimCode); return }')
    expect(CLAIM_PAGE).toContain('<BrokerHandoffPanel code={handoff}')
  })

  it('사장님 조회 응답에 대행사 조건이 실린다 (코드·번호 둘 다)', () => {
    expect((CLAIMS.match(/broker_terms: await brokerTermsView\(c\.env\.DB,/g) ?? []).length).toBe(2)
  })

  it('신청은 지금 조건에 동의해야 되고, 동의가 기록된다', () => {
    expect(CLAIMS).toMatch(/if \(terms && \(b\.broker_terms_agreed !== true \|\| !sameBrokerTerms\(terms, b\.broker_terms_seen\)\)\)/)
    expect(CLAIMS).toContain("code: 'BROKER_TERMS_REQUIRED'")
    const iGate = CLAIMS.indexOf("code: 'BROKER_TERMS_REQUIRED'")
    const iSubmit = CLAIMS.indexOf('await submitStoreClaim(')
    expect(iGate, '동의 검사가 신청서 생성 뒤에 있다').toBeLessThan(iSubmit)
    expect(CLAIMS).toContain('if (terms) await recordBrokerTermsConsent(')
  })

  it('사장님 화면이 조건을 보여 주고 동의 전엔 신청 버튼을 잠근다', () => {
    expect(OWNER_PAGE).toContain('<BrokerTermsConsent terms={brokerTerms}')
    expect(OWNER_PAGE).toContain('disabled={busy || !certUrl || (!!brokerTerms && !termsAgreed)}')
    expect(OWNER_PAGE).toContain('broker_terms_seen: brokerTerms')
    expect(OWNER_PAGE).toContain("code === 'BROKER_TERMS_REQUIRED'")
  })

  it('조건 비교는 값으로 한다 — 그 사이 바뀌면 다시 묻는다', () => {
    const now = { broker_share_pct: 10, influencer_pct_cap: 5 }
    expect(sameBrokerTerms(now, { broker_share_pct: 10, influencer_pct_cap: 5 })).toBe(true)
    expect(sameBrokerTerms(now, { broker_share_pct: 12, influencer_pct_cap: 5 })).toBe(false)
    expect(sameBrokerTerms(now, { broker_share_pct: 10, influencer_pct_cap: null })).toBe(false)
    expect(sameBrokerTerms({ broker_share_pct: 10, influencer_pct_cap: null }, { broker_share_pct: 10, influencer_pct_cap: null })).toBe(true)
    expect(sameBrokerTerms(now, undefined)).toBe(false)
    expect(brokerTermsVersion(now)).toBe('share=10;cap=5')
  })
})
