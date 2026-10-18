/**
 * 🪪 유어딜이 스스로를 소개하는 자리가 사실을 말하는가 (2026-10-18 대표 *"다 개선해줘 계속"*)
 *
 * 라이브 실측(Googlebot·Yeti·OAI-SearchBot 로 31개 화면을 받아 쟀다)에서 기본기는 깨진 곳이
 * 없었는데, **AI 가 인용하는 바로 그 문장**이 틀려 있었다:
 *
 * | 자리 | 종전 | 왜 틀렸나 |
 * |---|---|---|
 * | llms.txt 첫 인용문 · `/about` 크롤러 본문 | "…맛집·뷰티·숙소를 **그룹 특가**로 사는…" | 모여서 사는 구조가 없다(2026-05-30 즉시판매 단일가 · 2026-10-15 `/pass` 제목에서 같은 이유로 `공동구매` 를 뺐다) |
 * | `/introduce` 검색 제목 | "…우리 동네 이용권 **공동구매**" | 같은 이유 |
 * | `/introduce` 화면·FAQ | 친구 초대 보너스 · 7일 이내 환불 · 앱에서 더 편하게 · 전화번호 가입 · 이용권을 "교환권" 으로 | 0.5% 보너스는 안 준다(2026-10-16) · 앱이 없다(2026-09-28) · 가입은 카카오 · 교환권은 기프티콘 |
 * | `/about/print`(공유되는 PDF 소개서) | "입점 수수료 0원" · 도매몰 · 어드민 로그인 버튼 | 판매 수수료가 있다(같은 페이지 표가 10%/5%) · 도매몰은 2026-10-11 철거 |
 * | `/about` | "전부 셀러 대시보드 하나에서" | 셀러 대시보드는 2026-10-12 삭제(마이의 내 가게) |
 *
 * 🔑 **원인은 문구가 아니라 출처 두 벌이었다**: `CONCEPT_ABOUT_LINES` 의 주석이 대조 대상을
 *   `AboutPage.tsx` 라고 적어 뒀는데 `/about` 은 2026-07-19 부터 `AboutServicePage.tsx` 다. 그래서
 *   첫 줄이 noindex 인쇄판의 문장을 따라가 있었다. 그리고 `/introduce` 는 SEO 제목·FAQ 를
 *   i18n 키로 따로 들고 있었는데 **locale 값이 SSOT 의 defaultValue 를 이겨서** 서버 메타와
 *   JS 가 그리는 제목이 서로 달랐다(서버 "…공동구매" ↔ 클라 "우리 동네 공동구매 (맛집·뷰티·숙소)").
 *
 * ⚠️ 이 시험이 못 보는 것: 문구가 *매력적인가* · 이 목록 밖 낱말로 같은 오해를 다시 쓰는 것 ·
 *   AI 가 실제로 그 문장을 인용하는지(외부 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'
import { CONCEPT_ABOUT_LINES, CONCEPT_FAQ } from '@/shared/seo/concept-content'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'

/** 모여서 사는 구조를 말하는 낱말. 공구 서비스(운영자 몰)의 진짜 공동구매는 이 표면에 없다. */
const GROUP_BUY_WORDS = /공동구매|그룹 ?특가|그룹가|동네 공구|함께 사서|함께라서/

/** 소비자 소개 표면 세 곳(실행되는 코드 · 주석 제외). */
const PAGES = ['src/pages/AboutServicePage.tsx', 'src/pages/IntroducePage.tsx', 'src/pages/AboutPage.tsx']

describe('① AI 가 읽는 자기소개 문장', () => {
  it('llms.txt 첫 인용문과 /about 크롤러 본문이 공동구매라고 말하지 않는다', () => {
    const txt = buildLlmsTxt('https://urdeal.kr')
    const quote = txt.split('\n').find(l => l.startsWith('> ')) ?? ''
    expect(quote, '첫 인용문이 비었다(측정 실패)').not.toBe('')
    expect(quote).not.toMatch(GROUP_BUY_WORDS)
    for (const l of CONCEPT_ABOUT_LINES) expect(l).not.toMatch(GROUP_BUY_WORDS)
  })

  it('첫 줄은 지금 /about 의 h1 과 같은 말을 한다 (인쇄판이 아니라)', () => {
    const about = readCode('src/pages/AboutServicePage.tsx')
    // h1 의 핵심 셋: 할인 이용권 · 앱에서 사고 · 매장에서 QR
    expect(about).toMatch(/할인 이용권을/)
    expect(about).toMatch(/앱에서 사고, 매장에서 QR/)
    const first = CONCEPT_ABOUT_LINES[0]
    expect(first).toContain('할인 이용권')
    expect(first).toContain('앱에서 사고')
    expect(first).toContain('매장에서 QR')
  })

  it('/introduce 검색 제목·설명이 공동구매라고 말하지 않는다', () => {
    const s = CONSUMER_SURFACE_SEO['/introduce']
    expect(s.title).not.toMatch(GROUP_BUY_WORDS)
    expect(s.description).not.toMatch(GROUP_BUY_WORDS)
  })
})

describe('② 소개 화면 세 곳이 사실이 아닌 것을 약속하지 않는다', () => {
  it.each(PAGES)('%s — 모여서 사는 구조를 말하지 않는다', (file) => {
    const code = readCode(file)
    // 공구 서비스(운영자 몰 SaaS)는 실재하는 B2B 사업이라 그 한 줄만 허용한다.
    const hits = code.split('\n').filter(l => GROUP_BUY_WORDS.test(l) && !/B2B 공동구매 SaaS/.test(l))
    expect(hits, hits.join('\n')).toEqual([])
  })

  it.each(PAGES)('%s — 주지 않는 보상·없는 비용 면제·사라진 화면을 가리키지 않는다', (file) => {
    const code = readCode(file)
    expect(code).not.toMatch(/친구 초대 보너스|둘 다 보너스|친구가 사면 보너스/) // 2026-10-16 "0.5%는 안 주는 거야"
    expect(code).not.toMatch(/입점 수수료 0원|수수료 ZERO/) // 판매 수수료가 있다
    expect(code).not.toMatch(/['"]\/seller\/login['"]|['"]\/admin\/login['"]|['"]\/group-buy['"]/)
    expect(code).not.toMatch(/도매몰/) // 2026-10-11 철거
    expect(code).not.toMatch(/셀러 대시보드/) // 2026-10-12 삭제
  })

  it('/introduce 가 이용권을 "교환권" 으로, 가입을 "전화번호" 로 부르지 않는다', () => {
    const code = readCode('src/pages/IntroducePage.tsx')
    expect(code).not.toMatch(/교환권/)
    expect(code).not.toMatch(/전화번호만/)
  })
})

describe('③ /introduce 가 제목·FAQ 를 두 벌로 들고 있지 않다', () => {
  it('SEO 는 표를 그대로 쓴다 — i18n 키가 표를 덮어쓰지 못한다', () => {
    const code = readCode('src/pages/IntroducePage.tsx')
    expect(code).toContain("title={CONSUMER_SURFACE_SEO['/introduce'].title}")
    expect(code).not.toMatch(/t\(\s*['"]introduce\./)
  })

  it('FAQ 는 /faq 와 같은 SSOT 에서 고르고, 고른 키가 전부 실재한다', () => {
    const code = readCode('src/pages/IntroducePage.tsx')
    const m = code.match(/INTRODUCE_FAQ_KEYS\s*=\s*\[([^\]]*)\]/)
    expect(m, 'INTRODUCE_FAQ_KEYS 를 못 찾았다').toBeTruthy()
    const keys = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1])
    expect(keys.length).toBeGreaterThanOrEqual(4)
    const known = new Set(CONCEPT_FAQ.map(f => f.key))
    expect(keys.filter(k => !known.has(k))).toEqual([])
    expect(code).toMatch(/CONCEPT_FAQ\.find/)
  })

  it('6개 언어 locale 에 introduce 블록이 남아 있지 않다 (되살아나면 다시 두 벌)', () => {
    for (const l of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const d = JSON.parse(readFileSync(`public/locales/${l}/translation.json`, 'utf-8'))
      expect(d.introduce, l).toBeUndefined()
    }
  })
})
