import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COMPANY, COMPANY_INFO_LINES, COMPANY_LINKS } from '@/shared/company-info'
import { HOME_FOOTER_LEGAL } from '@/worker/utils/home-footer-noscript'

/**
 * 🏢 마이 정돈 + 홈 맨 아래 회사 정보 — 2026-11-02 대표
 *
 * 대표: *"마이페이지도 되게 필요없이 공백이 많은 느낌인데, 그리고 마이페이지에 '내가 산 것' 이 아니라
 * '마이 딜'로 해줘. 마이페이지 맨 밑에도 엉성하고, 대신 홈 페이지 맨 밑에 회사 정보들을 넣어줘."*
 * + NOL 앱 화면 *"이런 식으로"*.
 *
 * 지키는 것:
 *  ① 폰 홈 맨 아래에 회사 정보가 **실제로 붙어 있다** — 사업자 표시는 사라지면 안 되는 법적 표시다.
 *     (폰 홈엔 하나도 없었다. 마이에서 링크를 걷는 것은 이게 선 뒤에만 안전하다.)
 *  ② 법이 요구하는 항목이 전부 줄에 있다(상호·대표·사업자번호·통신판매업·주소·연락처·호스팅).
 *  ③ 값이 **한 곳**에서 온다 — 화면 SiteFooter·크롤러 noscript 가 SSOT 와 같은 값을 적는다.
 *  ④ 링크는 실재하는 라우트로만 간다.
 *  ⑤ 마이: 맨 아래 잔글씨 링크 뭉치가 사라지고 설정 구역 줄이 됐다 · 구역 제목 mt-6 · 숫자 줄 48px · '마이 딜'.
 *
 * ⚠️ 못 보는 것: 회색 면·줄글이 보기 좋은지(그려서 본다) · 통신판매업 신고번호의 **어느 값이 맞는지**
 *   (레포 안에서 둘로 갈려 있다 — `company-info.ts` 머리말 · 결재 파일). 이 시험은 *화면끼리 같은지*만 본다.
 */
const R = (p: string) => readFileSync(p, 'utf8')
const flat = (s: string) => s.replace(/\s+/g, ' ')

describe('🏢 홈 맨 아래 회사 정보', () => {
  it('① 폰 홈이 CompanyInfoFooter 를 그린다', () => {
    const home = R('src/pages/mobile-home/MobileHomePage.tsx')
    expect(home).toMatch(/import CompanyInfoFooter from '@\/components\/main\/CompanyInfoFooter'/)
    expect(home).toMatch(/<CompanyInfoFooter\b/)
    const comp = R('src/components/main/CompanyInfoFooter.tsx')
    for (const sym of ['COMPANY_INFO_LINES', 'COMPANY_LINKS', 'COMPANY_INTERMEDIARY_NOTICE', 'COMPANY_COPYRIGHT']) {
      expect(comp, `${sym} 를 안 그린다`).toMatch(new RegExp(`\\{${sym}`))
    }
  })

  it('② 법정 표시 항목이 전부 있다 — 비거나 빠지면 실패', () => {
    const text = COMPANY_INFO_LINES.join('\n')
    for (const label of ['상호', '대표', '사업자등록번호', '통신판매업신고', '주소', '메일', '호스팅서비스 제공자', '고객센터']) {
      expect(text, `${label} 줄이 없다`).toContain(label)
    }
    for (const [k, v] of Object.entries(COMPANY)) expect(String(v).trim(), `${k} 가 비었다`).not.toBe('')
  })

  it('③ 다른 화면(SiteFooter)·크롤러 글자가 SSOT 와 같은 값을 적는다', () => {
    const footer = flat(R('src/components/main/SiteFooter.tsx'))
    const crawler = HOME_FOOTER_LEGAL.join(' ')
    for (const v of [COMPANY.legalName, COMPANY.ceo, COMPANY.bizRegNo, COMPANY.mailOrderNo, COMPANY.address, COMPANY.email]) {
      expect(footer, `SiteFooter 에 ${v} 가 없다 — 값이 갈렸다`).toContain(v)
      expect(crawler, `크롤러 푸터에 ${v} 가 없다 — 값이 갈렸다`).toContain(v)
    }
  })

  it('④ 링크는 실재 라우트(또는 공정위 공개 페이지)로만', () => {
    const app = R('src/App.tsx')
    expect(COMPANY_LINKS.length).toBeGreaterThan(4)
    for (const l of COMPANY_LINKS) {
      if (l.external) { expect(l.href).toMatch(/^https:\/\/www\.ftc\.go\.kr\//); continue }
      expect(app, `${l.href} 라우트가 없다`).toContain(`path="${l.href}"`)
    }
    expect(COMPANY_LINKS.filter((l) => l.strong).map((l) => l.href)).toEqual(['/privacy'])
  })
})

describe('🧹 마이 정돈 (2026-11-02)', () => {
  const page = R('src/pages/UserProfilePage.tsx')

  it('⑤ 맨 아래 잔글씨 링크 뭉치가 없고, 고객지원은 설정 구역 줄이다', () => {
    expect(page, '맨 아래 잔글씨 링크(개인정보 등)가 되살아났다').not.toMatch(/userProfile\.privacy/)
    expect(page).not.toMatch(/userProfile\.refundPolicy/)
    expect(page).toMatch(/<ListRow icon=\{rowIcon\(MessageIcon\)\} label=\{t\('userProfile\.kakaoConsult'/)
    expect(page).toMatch(/<ListRow icon=\{rowIcon\(ReceiptIcon\)\}[^\n]*to="\/terms"/)
    // 탈퇴는 남아 있어야 한다(찾을 수는 있어야 한다 — 2026-08-30)
    expect(page).toMatch(/<DeleteAccountLink \/>/)
  })

  it('⑤ 구역 제목 위 여백 24px · 숫자 줄 48px', () => {
    const g = R('src/pages/user-profile/list-grammar.tsx')
    expect(g.match(/mt-6 mb-1 px-4/g)?.length).toBe(2)
    expect(g).not.toMatch(/mt-8 mb-1 px-4/)
    expect(R('src/pages/user-profile/MyStats.tsx')).toMatch(/px-4 min-h-\[48px\] py-2 text-left border-b/)
  })

  it("⑤ 구역 이름은 '마이 딜' (화면·ko 번역)", () => {
    expect(R('src/pages/user-profile/ShoppingGroup.tsx')).toMatch(/t\('shopping\.sectionTitle', \{ defaultValue: '마이 딜' \}\)/)
    const ko = JSON.parse(R('public/locales/ko/translation.json'))
    expect(ko.shopping.sectionTitle).toBe('마이 딜')
  })
})
