/**
 * 🤖 `/llms.txt` — AI 에이전트·검색이 읽는 사이트 요약 (2026-10-12, 대표 *"나머진 다 해줘"*)
 *
 * 종전 **404**. 2026-10-12 에 `<noscript>` 요약·`FAQPage` 로 *상세·FAQ 문장*은 배달되게 만들었지만,
 * *"이 사이트가 통째로 무엇인가"* 를 한 장에 말해 주는 자리가 비어 있었다.
 *
 * ## 이 가드가 잠그는 네 가지
 *
 * ① **문구가 한 벌이다** — 소개·Q&A·경로 설명이 전부 기존 SSOT 셋에서 온다. 여기서 손으로 적으면
 *   화면·구조화 데이터·noscript 에 더해 **네 번째 사본**이 생기고 반드시 갈린다.
 * ② **noindex 표면을 권하지 않는다** — 색인 말라고 한 URL 을 AI 에게 "여기를 보라" 고 제출하는 것은
 *   서로 반대되는 신호다(2026-10-11 `ItemList` 와 같은 규율).
 * ③ **색인 대상을 빠뜨리지 않는다** — 표면이 늘었는데 이 파일만 안 따라가는 쪽이 조용하다.
 * ④ **서비스 설명이 맨 앞이다** — 화면 순서를 그대로 쓰면 AI 가 처음 읽는 문장이 "주문을 취소하고
 *   싶어요" 가 된다(첫 판이 실제로 그랬다).
 *
 * ## 못 보는 것
 *
 * `llms.txt` 는 표준이 아니라 관례다 — 이 파일이 있다고 AI 가 읽어 준다는 보장은 없고, 실제 인용
 * 여부는 외부 판정(수일~수주)이다. 라우트가 실제로 200 을 내는지는 배포 후 `curl` 이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { CONCEPT_ABOUT_LINES, CONCEPT_FAQ } from '@/shared/seo/concept-content'
import { readFileSync } from 'node:fs'

const ORIGIN = 'https://urdeal.kr'
const txt = buildLlmsTxt(ORIGIN)
const builder = readCode('src/shared/seo/llms-txt.ts')
const sitemapRoute = readCode('src/worker/routes/sitemap.routes.ts')
const robots = readFileSync('public/robots.txt', 'utf-8')

describe('① 문구가 한 벌 — SSOT 에서만 온다', () => {
  it('소개 5줄이 그대로 들어간다', () => {
    expect(CONCEPT_ABOUT_LINES.length).toBeGreaterThanOrEqual(5)
    for (const line of CONCEPT_ABOUT_LINES) expect(txt, `소개 줄 누락: ${line.slice(0, 20)}…`).toContain(line)
  })

  it('컨셉 FAQ 질문·답변 전부가 들어간다', () => {
    expect(CONCEPT_FAQ.length).toBeGreaterThanOrEqual(14)
    for (const f of CONCEPT_FAQ) {
      expect(txt, `질문 누락: ${f.question}`).toContain(f.question)
      // 답변은 한 줄로 눌러 담으므로 앞 40자로 대조한다(개행만 바뀌었는지 보려는 게 아니다).
      expect(txt, `답변 누락: ${f.question}`).toContain(f.answer.replace(/\s+/g, ' ').trim().slice(0, 40))
    }
  })

  it('빌더가 긴 한글 문장을 직접 적지 않는다 — 구조 라벨만 허용', () => {
    const code = stripComments(builder)
    const longKorean = [...code.matchAll(/'([^']*[가-힣][^']*)'/g)]
      .map((m) => m[1])
      .filter((s) => s.replace(/[^가-힣]/g, '').length > 6)
    expect(longKorean, `SSOT 밖에서 베낀 문구: ${JSON.stringify(longKorean)}`).toEqual([])
  })
})

describe('② noindex 표면을 권하지 않는다', () => {
  it('서버가 noindex 를 내는 표면이 링크에 없다', () => {
    const hidden = Object.keys(CONSUMER_SURFACE_SEO).filter((p) => CONSUMER_SURFACE_SEO[p]?.noindex)
    expect(hidden.length, 'noindex 표면이 0 이면 이 검사가 헛돈다').toBeGreaterThan(0)
    for (const p of hidden) {
      expect(txt, `noindex 표면이 샜다: ${p}`).not.toContain(`${ORIGIN}${p})`)
    }
  })
})

describe('③ 색인 대상을 빠뜨리지 않는다', () => {
  it('루트를 뺀 색인 대상 전부가 절대 URL 링크로 있다', () => {
    const want = Object.keys(CONSUMER_SURFACE_SEO).filter((p) => p !== '/' && !CONSUMER_SURFACE_SEO[p]?.noindex)
    expect(want.length, '대상이 0 이면 이 검사가 헛돈다').toBeGreaterThan(15)
    for (const p of want) expect(txt, `표면 누락: ${p}`).toContain(`](${ORIGIN}${p}):`)
  })

  it('상대 경로 링크가 0 이다 — AI 는 그걸 못 따라간다', () => {
    const rel = [...txt.matchAll(/\]\((?!https?:\/\/)([^)]+)\)/g)].map((m) => m[1])
    expect(rel, `상대 경로: ${JSON.stringify(rel)}`).toEqual([])
  })

  it('origin 을 인자로 받는다 — 도메인을 박아 두지 않는다', () => {
    expect(buildLlmsTxt('https://example.test')).toContain('https://example.test/vouchers')
    expect(stripComments(builder), '도메인이 빌더에 박혀 있다').not.toContain('urdeal.kr')
  })
})

describe('④ 서비스 설명이 FAQ 맨 앞이다', () => {
  it('첫 질문이 서비스 카테고리다', () => {
    const first = txt.slice(txt.indexOf('## 자주 묻는 질문')).match(/^### (.+)$/m)
    expect(first, 'FAQ 섹션을 못 찾았다').not.toBeNull()
    const match = CONCEPT_FAQ.find((f) => f.question === first![1])
    expect(match, `첫 질문이 SSOT 에 없다: ${first![1]}`).toBeDefined()
    expect(match!.category, 'AI 가 처음 읽는 문장이 배송·주문 문의가 됐다').toBe('서비스')
  })

  it('서비스 묶음이 통째로 앞에 온다', () => {
    const order = [...txt.matchAll(/^### (.+)$/gm)].map((m) =>
      CONCEPT_FAQ.find((f) => f.question === m[1])?.category)
    const svc = order.filter((c) => c === '서비스').length
    expect(svc, '서비스 질문을 못 셌다').toBeGreaterThanOrEqual(6)
    expect(order.slice(0, svc).every((c) => c === '서비스'), '서비스 묶음 사이에 다른 카테고리가 끼었다').toBe(true)
  })
})

describe('⑤ 라우트와 robots', () => {
  it('/llms.txt 를 text/plain 으로 서빙한다', () => {
    expect(sitemapRoute).toMatch(/sitemapRoutes\.get\('\/llms\.txt'/)
    const block = sitemapRoute.slice(sitemapRoute.indexOf("sitemapRoutes.get('/llms.txt'"))
    expect(block, 'Content-Type 이 없으면 브라우저·크롤러가 다운로드로 처리할 수 있다')
      .toContain("'Content-Type': 'text/plain; charset=utf-8'")
    expect(block, '빌더를 거치지 않는다').toContain('buildLlmsTxt(')
  })

  it('robots.txt 의 `*` 그룹이 /llms.txt 를 막지 않는다', () => {
    // 🔴 그룹 맥락을 봐야 한다. 이 robots 에는 `Disallow: /` 가 **의도적으로** 있다 — 학습봇
    //   (`GPTBot`·`ClaudeBot`·`CCBot`·`Applebot-Extended`) 전면 차단 그룹이다. 첫 판이 그 줄을
    //   보고 거짓 빨간불을 냈다. 봐야 하는 건 `User-agent: *` 그룹뿐이다.
    //   ⇒ 결과적으로 **검색·인용 봇은 llms.txt 를 읽고 학습봇은 못 읽는다** — 이 레포가 세운
    //     비대칭(인용은 받고 학습은 거부)과 정확히 일치한다.
    const lines = robots.split('\n').filter((l) => !l.trim().startsWith('#') && l.trim())
    const starRules: string[] = []
    let agents: string[] = [], inRules = false
    for (const l of lines) {
      const ua = /^\s*User-agent:\s*(.+)$/i.exec(l)
      if (ua) {
        if (inRules) { agents = []; inRules = false }
        agents.push(ua[1].trim())
        continue
      }
      inRules = true
      if (agents.includes('*')) starRules.push(l)
    }
    expect(starRules.length, '`*` 그룹을 못 찾았다 — robots 모양이 바뀌었다').toBeGreaterThan(10)
    for (const l of starRules) {
      expect(/^\s*Disallow:\s*\/\s*$/.test(l), '`*` 그룹에 전면 차단이 생겼다').toBe(false)
      expect(/^\s*Disallow:.*llms/i.test(l), 'llms.txt 를 막으면 만든 의미가 없다').toBe(false)
    }
  })
})

describe('⑥ 읽기 하한 — 0건이면 통과가 아니라 실패', () => {
  it('생성물과 소스가 실재한다', () => {
    expect(txt.length, '너무 짧다 — 빌더가 비었다').toBeGreaterThan(3000)
    expect(txt.split('\n').length).toBeGreaterThan(40)
    expect(builder.length).toBeGreaterThan(400)
    expect(robots.length).toBeGreaterThan(400)
  })
})
