/**
 * 🧭 sitemap 이 제출하는 정적 표면이 크롤러에게 20~40자를 주고 있었다 (2026-10-12)
 *
 * 대표 *"내 판단이 필요한 3가지 모두 가장 이상적으로 해줄 수 없어?"* 의 ②.
 *
 * ## 실측 (Googlebot UA 로 라이브, sitemap 제출 정적 경로 전수)
 *
 *     /join 15 · /terms 15 · /refund 17 · /creators/apply 20 · /privacy 21
 *     /influencer 28 · /creators 28 · /introduce 30 · /experience 33
 *     /area-report 36 · /partners 37 · /region 38
 *     (대조: 같은 날 고친 /faq 1,537자 · /about 288자)
 *
 * 전부 **"색인해 달라" 고 선언한 URL** 이다. 그 상태로는 *"유어딜 입점"*·*"체험단"* 질의에
 * 인용할 문장이 한 줄도 없다.
 *
 * ## 🔴 이 시험의 심장 — 두 벌 금지(클로킹 금지)
 *
 * 크롤러에게만 다른 소개를 주는 것은 구글이 명시적으로 금지한다. 그래서 ①이 **SSOT 의 모든
 * 줄이 그 페이지 소스에 실재하는지** 공백 정규화로 대조한다. 페이지 문구를 고치면 빨간불이
 * 되고, 그때 SSOT 도 같이 고치게 된다 — 그게 두 벌을 못 만들게 하는 유일한 방법이다.
 *
 * ## ⚠️ 못 보는 것
 *
 * - 그 문장이 화면에 **실제로 렌더되는지**(조건부 JSX 안에 있을 수 있다 — 소스 실재만 본다)
 * - 구글이 색인하는지(수일~수주 · 서치콘솔은 대표만 본다)
 * - 🩸 **2026-10-14 정정 — 여기 `/privacy`·`/refund` 가 "일부러 안 했다" 로 적혀 있었다.
 *   사유가 틀렸다**(두 페이지를 읽지 않고 쓴 말이다). 실측하니 통째 문장이 `/privacy` 16개 ·
 *   `/refund` 12개였고 둘 다 SSOT 에 들어왔다. 사유의 전말은 `shared/seo/surface-copy.ts` 머리말 🩸.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SURFACE_COPY, surfaceCopyFor } from '@/shared/seo/surface-copy'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { resolveRegionSeo } from '@/worker/utils/surface-ssr-meta'
import { CONSUMER_TERMS } from '@/pages/terms/consumer-terms-content'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')
/** JSX 는 줄바꿈·들여쓰기로 문장을 쪼갠다 — 비교 전에 공백을 하나로 접는다. */
const flat = (s: string) => s.replace(/\s+/g, ' ')

/**
 * 크롤러가 **실제로 읽는 글자**. 태그를 떼고 **HTML 엔티티를 되돌린다.**
 *
 * 🩸 2026-10-14 — 종전엔 태그만 떼서 `&quot;`·`&amp;` 가 그대로 남았다. 한글 표면 열에는
 *   escape 대상 문자가 **한 글자도 없어서** 아무도 안 밟았는데, `/gdpr`(영문, `("YourDeal")`)
 *   을 넣자 *코드는 멀쩡한데* 빨간불이 났다 — 빌더의 `esc()` 는 옳고 **재는 쪽이 틀렸다.**
 *   크롤러는 엔티티를 디코드해서 읽으므로 그걸 흉내 내야 측정이 사실과 같아진다.
 *
 * ⚠️ `&amp;` 를 **마지막에** 되돌린다 — 먼저 되돌리면 `&amp;quot;`(문자열 그대로의 `&quot;`)가
 *   `"` 로 두 번 디코드된다.
 */
const crawlerText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

describe('① 🔴 SSOT 의 모든 줄이 그 페이지 소스에 실재한다 (클로킹 방지)', () => {
  const entries = Object.entries(SURFACE_COPY)

  it('표를 실제로 읽어 냈다 (0건이면 통과가 아니라 고장)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(10)
    expect(entries.flatMap(([, v]) => v.lines).length).toBeGreaterThanOrEqual(15)
  })

  it.each(entries)('%s — 줄마다 화면 문구와 같은 말', (path, copy) => {
    const sources = copy.source.map(f => flat(read(f))).join('\n')
    for (const line of copy.lines) {
      expect(sources, `${path}: "${line}" 이 ${copy.source.join(', ')} 에 없다 — 화면에 없는 말을 크롤러에게 주고 있다`)
        .toContain(flat(line))
    }
  })

  // 📏 2026-10-12 (대표 "응 모두 해줘"): 길이 **하한**. 처음엔 표면마다 2~3줄(66~126자)이라
  //   "없음" 은 면했지만 여전히 thin 이었다 — `/introduce` 는 **66자**였다. 그 화면에 실제로 있는
  //   문장만 골라 늘렸고(클로킹 가드가 그걸 강제한다) 그 성과가 되돌아가지 못하게 바닥을 박는다.
  //   🔴 **하한을 낮추는 쪽이 회귀다** — 이 숫자를 내리는 PR 은 그 자체로 의심 대상이다.
  it('표면마다 본문 길이 래칫 (줄이 조용히 빠지지 못하게)', () => {
    // 🩸 첫 판은 **전역 하한 110자** 하나였고, 주입이 그게 헛돈다는 걸 잡았다 — 205자인
    //   `/introduce` 에서 한 줄(19자)을 지워도 186자라 통과했다. 하한은 *thin* 은 막지만
    //   *줄이 빠지는 것* 은 못 막는다. ⇒ 표면별 래칫(현재 값을 10자 단위로 내림).
    // 🔴 이 숫자를 **내리는 PR 은 그 자체가 회귀다**. 문구를 고쳐 짧아졌으면 왜 짧아져도 되는지
    //   커밋에 적고 함께 내릴 것. 늘리는 건 자유다.
    const FLOOR: Record<string, number> = {
    '/area-report': 140,
    // 🇪🇺 2026-10-14 — `/gdpr`(영문 법정 문서). 382자이고 전부 `<p>` 통째 문장을 **옮긴** 것이다
    //   (이메일이 든 줄 · 낡았을 수 있는 `Firebase` 줄 · h1 과 겹치는 줄은 일부러 뺐다 — 사유는
    //   `surface-copy.ts` 의 그 항목 주석).
    '/gdpr': 380,
    '/creators': 230,
    '/creators/apply': 150,
    '/experience': 120,
    '/influencer': 230,
    // 2026-10-18 — 화면 문구를 사실대로 고치며 205 → 220자. 래칫 규칙대로 바닥도 따라 올린다
    //   (안 올리면 한 줄을 지워도 202자라 통과했다 — 주입이 잡았다).
    '/introduce': 220,
    '/join': 120,
    // 🏠 2026-10-25 — 사장님 생활 서비스 허브(업종 링크 17개는 따로 붙는다 — 줄 수에 안 든다).
    '/life': 110,
    // 🏠 2026-10-25 — 업체 모집 랜딩(로그인 전 화면 문장).
    '/life/pro': 240,
    '/new-openings': 150,
    '/partners': 230,
    '/region': 110,
    // ⚖️ 2026-10-14 — 법정 문서 둘(본문 6자 · index · sitemap 제출이었다). 전부 그 화면의 문장을
    //   **옮긴** 것이고, `/refund` 는 2026-10-13 결재로 코드의 현행 규칙대로 다시 쓰인 뒤의 글이다.
    //   `/refund` 가 짧은 이유: 가장 값진 두 문장이 **문장 안에 `<span>` 을 품어** 위 ① 의 대조를
    //   통과할 수 없다(평탄화는 공백만 접고 태그는 남긴다 — `surface-copy.ts` 의 그 항목 🩸).
    //   절 제목이 그 자리를 메운다.
    '/privacy': 470,
    '/refund': 210,
    }
    const below = entries
      .map(([path, copy]) => [path, copy.lines.join(' ').length, FLOOR[path] ?? 110] as const)
      .filter(([, n, floor]) => n < floor)
    expect(below, `본문이 짧아졌다: ${below.map(([p, n, f]) => `${p}=${n}자(바닥 ${f})`).join(' · ')}`).toEqual([])
    // 래칫 표가 표면 전부를 덮는가 — 새 표면이 바닥 없이 들어오는 것을 막는다.
    const uncovered = entries.map(([p]) => p).filter(p => !(p in FLOOR))
    expect(uncovered, `래칫 표에 바닥이 없는 표면: ${uncovered.join(' · ')}`).toEqual([])
  })

  it('수치(요율)를 적지 않는다 — 어드민 조정 대상이라 적으면 낡는다', () => {
    for (const [path, copy] of entries) {
      for (const line of copy.lines) expect(line, path).not.toMatch(/\d\s*%/)
    }
  })

  it('모든 키가 서버 메타를 갖는다 — 본문만 있고 메타가 없는 표면 금지', () => {
    // `/region`(인덱스)만 예외다 — 그 표면은 `resolveRegionSeo`(지역 전용 리졸버)가 메타를 낸다.
    const miss = Object.keys(SURFACE_COPY).filter(k => !(k in CONSUMER_SURFACE_SEO) && k !== '/region')
    expect(miss).toEqual([])
    expect(resolveRegionSeo('/region', 'https://urdeal.kr'), '/region 메타 리졸버가 낡았다').toBeTruthy()
  })
})

describe('② 빌더가 실제로 그 문장을 낸다 (출력 판정)', () => {
  it.each(Object.keys(SURFACE_COPY))('%s — noscript 본문이 생긴다', path => {
    const ns = buildStaticSurfaceNoscript(path)
    expect(ns).toContain('<noscript>')
    const text = crawlerText(ns)
    // 라이브 실측 최악이 15자였다 — 그보다 확실히 길어야 의미가 있다.
    expect(text.length, `${path} 본문 ${text.length}자`).toBeGreaterThan(40)
    for (const line of SURFACE_COPY[path].lines) expect(text).toContain(line)
  })

  it('끝 슬래시도 같은 키로 본다', () => {
    // 🩸 빌더 쪽에서 재면 헛돈다 — `buildStaticSurfaceNoscript` 가 **자기도** 끝 슬래시를 떼므로
    //   `surfaceCopyFor` 안의 정규화를 지워도 결과가 같다(주입이 잡았다). 해석기를 직접 잰다.
    expect(surfaceCopyFor('/partners/')).toBe(surfaceCopyFor('/partners'))
    expect(surfaceCopyFor('/partners/')).toBeTruthy()
    expect(buildStaticSurfaceNoscript('/partners/')).toBe(buildStaticSurfaceNoscript('/partners'))
  })

  it('목록에 없는 표면은 삼키지 않는다', () => {
    // 🔀 2026-10-14 재조준 — `/privacy`·`/refund` 가 **표에 들어왔으므로** 예시에서 뺀다.
    //   지키는 불변식은 그대로다: 해석기가 표에 없는 경로까지 삼키지 않는다. 예시를 표 밖
    //   표면으로 갈아 두면 그 불변식이 계속 출력으로 판정된다(주입 `판정이 다른 표면까지
    //   삼킨다` 가 여전히 빨간불이어야 한다).
    for (const p of ['/cart', '/wishlist', '/pass/2919', '/u/jiwon1228', '/notifications']) {
      expect(buildStaticSurfaceNoscript(p), p).toBe('')
      expect(SURFACE_COPY, `${p} 가 표에 들어왔다면 이 예시를 갈아야 한다`).not.toHaveProperty(p)
    }
  })
})

describe('③ 약관은 문서 자체에서 파생한다 — 손으로 요약하지 않는다', () => {
  const ns = buildStaticSurfaceNoscript('/terms')

  it('제목·시행일·버전이 문서 값이다', () => {
    expect(ns).toContain(CONSUMER_TERMS.title)
    expect(ns).toContain(CONSUMER_TERMS.effective)
    expect(ns).toContain(`v${CONSUMER_TERMS.version}`)
  })

  it('조항 제목이 **전부** 실린다 — 조가 늘면 본문도 자동으로 늘어난다', () => {
    const heads = CONSUMER_TERMS.sections.map(s => s.title).filter(Boolean)
    expect(heads.length).toBeGreaterThanOrEqual(10)
    for (const h of heads) expect(ns).toContain(h)
  })

  it('전문(조항 본문)을 쏟지 않는다 — 요약이지 덤프가 아니다', () => {
    const body = CONSUMER_TERMS.sections.flatMap(s => [...(s.paras || []), ...(s.items || [])])
    expect(body.length).toBeGreaterThan(0)
    for (const b of body) expect(ns).not.toContain(b)
  })

  it('판매자 약관도 같은 기제로 — 경로만 다르다', () => {
    expect(buildStaticSurfaceNoscript('/terms/seller')).toContain('<noscript>')
  })
})

describe('④ HTML 탈출 — 문구에 `&`·`<` 가 섞여도 깨지지 않는다', () => {
  it('탐침 문구로 동작을 잰다', () => {
    // 🔑 지금 SSOT 문구엔 `&`·`<` 가 한 글자도 없다 — 상수만 보면 탈출을 없애도 결과가 같다
    //   (2026-10-11 에 같은 자리에서 값을 치렀다). 그래서 `/terms` 를 탐침으로 쓴다: 그 문서의
    //   조항 제목에 괄호가 있고, 탈출이 돌면 `&`·`<` 가 엔티티로 나온다.
    const ns = buildStaticSurfaceNoscript('/terms')
    expect(ns).not.toMatch(/<li>[^<]*<(?!\/li)/)
    const probe = surfaceCopyFor('/partners')
    expect(probe).toBeTruthy()
  })
})
