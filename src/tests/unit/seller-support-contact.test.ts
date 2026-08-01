/**
 * ☎️ **운영자 문의 경로** 불변식 〔체크리스트 O9 · X8 확정 ⓒ〕
 *
 * 대표 확정은 *"파일럿은 대표 연락처, **티켓 화면(ⓑ)은 만들지 않는다**"* 였는데,
 * **표시할 곳이 없어** O9 가 🔴 로 남아 있었다 — 확정만 되고 구현이 0이었다.
 *
 * ## 🔴 철거와 맞물린다
 * 지금 **유일하게 작동하는 셀러 문의 경로가 도매 화면 위에 있고**, 철거 PR 이 그 화면을 지운다.
 * 그러면 운영자가 연락할 데가 **완전히 0**이 된다. 이 경로가 그 전에 있어야 한다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 대표가 값을 **안 넣는 것**(미설정이면 화면이 안 그려진다 — 그건 사람의 몫)
 *   - 문의가 실제로 **도달**하는지(O9 완료 판정은 👤 왕복)
 */
import { describe, it, expect } from 'vitest'
import { readCode, usesSymbol, sliceFrom } from '../helpers/source-text'

const api = readCode('src/features/seller/api/seller-gb.routes.ts')
const cmp = readCode('src/components/seller/SellerSupportContact.tsx')
const page = readCode('src/pages/SellerPage.tsx')

describe('🔴 값을 코드에 박지 않는다', () => {
  it('`platform_settings` 에서 읽는다 — 개인정보이고 바뀐다', () => {
    expect(api).toContain("'operator_support_contact'")
  })

  it('🔴 컴포넌트에 연락처 리터럴이 없다', () => {
    // 전화·이메일·카톡 링크가 코드에 박히면 public repo 에 개인정보가 남는다.
    expect(cmp).not.toMatch(/\d{2,3}-\d{3,4}-\d{4}/)          // 전화번호
    expect(cmp).not.toMatch(/[\w.+-]+@(?!.*\bexample\b)[\w-]+\.[a-z]{2,}/i) // 실 이메일
    expect(cmp).not.toMatch(/pf\.kakao\.com|open\.kakao\.com/)  // 카톡 채널
  })
})

describe('🔴 미설정이면 아무것도 안 그린다', () => {
  it('컴포넌트가 null 을 반환한다 — "문의처: (없음)" 은 없느니만 못하다', () => {
    expect(cmp).toMatch(/if \(!contact\) return null/)
  })

  it('API 도 빈 값을 null 로 내린다', () => {
    expect(api).toMatch(/contact \|\| null/)
  })
})

describe('🔴 티켓 화면이 아니다 (대표 확정 ⓑ 금지)', () => {
  it('폼·제출·스레드가 없다 — 보여주기만 한다', () => {
    for (const forbidden of ['<form', 'onSubmit', 'api.post', 'textarea']) {
      expect(cmp, `티켓 UI 신호(${forbidden})가 들어왔다 — 대표 확정 위반`).not.toContain(forbidden)
    }
  })
})

describe('노출 위치·보호', () => {
  it('셀러 인증 뒤에 있다 — 공개되면 스팸 표적이 된다', () => {
    const block = sliceFrom(api, "get('/support-contact'", '})', 900)
    expect(block).toContain('activeSellerId')
    expect(block).toMatch(/401/)
  })

  it('셀러 대시보드에서 실제로 렌더된다 — 컴포넌트만 있고 안 붙으면 없는 것과 같다', () => {
    expect(usesSymbol(page, 'SellerSupportContact')).toBe(true)
  })
})
