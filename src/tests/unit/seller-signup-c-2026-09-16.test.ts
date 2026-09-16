/**
 * 🏪 셀러 가입 화면 — 대표 확정 **안 2 + 시각 C** (2026-09-16)
 *
 * 시안·근거: docs/design/seller-signup-documents.md
 * 대표 신고 두 개를 고정한다:
 *   ① *"이 페이지에 전체적으로 다 떠야하는거 아니야? 어디서 뜨는건데?"*
 *      → 영업신고증·정산 계좌가 **이름으로는** 이 화면에 뜬다(첨부 강제는 안 한다 — 당근 모델).
 *   ② *"주소지는 자동으로 API로 입력하게끔"* → 손 타이핑이 아니라 카카오 장소 검색.
 *
 * ⚠️ 이 시험이 **못 막는 것**: 실제로 예쁜지(렌더로 눈으로 봐야 한다) ·
 *   카카오 SDK 가 라이브에서 뜨는지(키가 배포 env 에 있어야 한다).
 *
 * 주입 매니페스트: scripts/mutations/seller-signup-c.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PAGE = read('src/pages/SellerRegisterSupplierPage.tsx')
const FIELDS = read('src/pages/seller-register/RegisterFields.tsx')
const PICKER = read('src/pages/seller-register/AddressPickerField.tsx')
const CERT = read('src/components/BusinessCertUpload.tsx')

describe('가입 화면 — 안 2(다 보이되 지금 낼 것만)', () => {
  it('영업신고증·정산 계좌가 이 화면에 이름으로 뜬다', () => {
    // 🩸 주입이 잡았다: `toContain('laterPermit')` 은 **`laterPermitNote` 에도 걸려서**
    //   행 자체를 다른 항목으로 바꿔치기해도 통과했다. 호출 형태로 앵커를 고정한다.
    expect(PAGE).toContain("t('seller.signup.laterPermit', { defaultValue: '영업신고증' })")
    expect(PAGE).toContain("t('seller.signup.laterBank', { defaultValue: '정산 계좌' })")
    expect(PAGE).toContain('laterSection')
  })

  it('그 셋의 첨부를 강제하지 않는다 — 제출 조건은 필수 5칸 그대로 (당근 모델)', () => {
    // 제출 버튼의 게이트는 `filled`(필수 5) 하나여야 한다. 남은-것 목록이 끼어들면
    // 들여보내고 안에서 채우게 한다는 같은 날 결정과 정면으로 어긋난다.
    const submit = PAGE.slice(PAGE.indexOf('onClick={submit}'))
    expect(submit).not.toContain('laterPermit')
    expect(submit).not.toContain('certUrl')
  })

  it('남은-것 블록이 약관 박스보다 앞에 온다 — 폼 이야기의 일부다', () => {
    expect(PAGE.indexOf('laterSection')).toBeGreaterThan(0)
    expect(PAGE.indexOf('laterSection')).toBeLessThan(PAGE.indexOf('<TermsConsentBox'))
  })
})

describe('가입 화면 — 시각 C(큰 입력)', () => {
  it('입력 값이 크고 굵다 — 채운 칸과 빈 칸이 굵기로 갈린다', () => {
    expect(FIELDS).toMatch(/INPUT\s*=[\s\S]{0,400}?text-\[17px\][\s\S]{0,200}?font-bold/)
    expect(FIELDS).toMatch(/placeholder:font-normal/)
  })

  it('16px 미만으로 내리지 않는다 — iOS 가 포커스 때 화면을 확대한다', () => {
    const m = FIELDS.match(/INPUT\s*=[\s\S]{0,400}?text-\[(\d+(?:\.\d+)?)px\]/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(16)
  })

  it('상자를 없앤 대신 포커스 신호가 있다 — 없으면 키보드 사용자가 위치를 잃는다', () => {
    expect(FIELDS).toContain('group-focus-within:opacity-100')
    expect(FIELDS).toMatch(/<div className="group relative/)
  })

  it('3단계 사다리(정보 입력 → 심사 → 판매 시작)를 지웠다', () => {
    expect(PAGE).not.toContain('seller.signup.step1')
    expect(PAGE).not.toContain('seller.signup.step2')
  })
})

describe('라벨에서 (선택) 을 뺀다 — 두 곳 다', () => {
  it('Field 라벨에 (선택) 이 없다', () => {
    expect(PAGE).not.toMatch(/signup\.cert'[^)]*사업자등록증 사본 \(선택\)/)
  })

  it('BusinessCertUpload 자기 라벨이 겹쳐 뜨지 않는다', () => {
    // 🩸 렌더 실측으로 잡았다: Field 라벨 아래 컴포넌트 라벨이 또 떠서
    //   "(선택)" 이 다른 문으로 되살아났다. 호출부가 hideLabel 을 넘겨야 한다.
    expect(CERT).toContain('hideLabel')
    expect(PAGE).toMatch(/<BusinessCertUpload[^>]*hideLabel/)
  })
})

describe('매장 주소 — 손으로 치지 않는다', () => {
  it('가입 화면이 주소 검색 부품을 쓴다', () => {
    expect(PAGE).toMatch(/<AddressPickerField\b/)
  })

  it('주소는 카카오 장소 검색에서 온다 — 국세청 API 는 주소를 안 준다', () => {
    expect(PICKER).toContain('KakaoMapPicker')
    expect(PICKER).toMatch(/road_address_name/)
  })

  it('지도는 눌러야 뜬다 — 폼에 SDK 를 상시 싣지 않는다', () => {
    expect(PICKER).toMatch(/lazy\(\(\) => import\('@\/components\/KakaoMapPicker'\)\)/)
    expect(PICKER).toMatch(/\{open && \(/)
  })

  it('키가 없으면 직접 입력으로 떨어진다 — 주소 한 칸이 가입을 막지 않는다', () => {
    expect(PICKER).toMatch(/if \(!kakaoJsKey\)/)
  })
})
