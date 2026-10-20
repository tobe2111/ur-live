/**
 * 🖼️ **공유 카드 그림의 대체 텍스트**(`og:image:alt`) (2026-10-14 — 대표 *"또 개선점 찾아"*)
 *
 * ## 실측
 * `twitter:card: summary_large_image` 를 내는 소비자 표면 **33곳 전부 `og:image:alt` 가 0건**이었다
 * (Googlebot UA 로 전수). `og:image:width/height` 는 2026-10-12 에 **봇 셸과 `index.html` 둘 다**
 * 선언했는데 **alt 만 빠졌다.** 클라 `<SEO>`(react-helmet)엔 있었으므로 **JS 를 렌더하는 크롤러만**
 * 보고 있었다 — 같은 날 제목에서 고친 *한 URL 두 값* 과 정확히 같은 클래스다.
 *
 * ## 무엇을 잠그나
 * alt 은 `og:image` 를 **고르는 같은 자리**에서 정한다(`shared/og-share-image.ts` `ogImageAlt`).
 * 그림이 셋(브랜드 카드 · 사진 카드 · 유달이 폴백)이고 설명이 각각 다르므로, 두 곳에서 정하면
 * **그림은 바뀌고 alt 은 안 바뀌는 날**이 온다(이 레포가 반복해 밟은 두 벌 클래스).
 *
 * 🔴 `index.html` 은 **정적 HTML 이라 함수를 부를 수 없다** — 그래서 ③이 그 값과 함수 출력을
 *   대조한다. 그 대조가 두 벌을 막는 유일한 수단이다.
 *
 * ⚠️ **값의 크기를 과장하지 않는다**: `og:image:alt` 은 **접근성·견고성** 신호이고 구글 랭킹
 *   요소가 아니다. 얻는 것은 ⓐ 스크린리더가 읽을 것이 생기는 것 ⓑ 카드가 그림을 못 받을 때
 *   대체 텍스트가 뜨는 것, 그 둘이다.
 * ⚠️ **이 시험이 못 보는 것**: 카드를 **그리는** 주체는 카카오·페북·슬랙이고 alt 을 실제로 쓰는지는
 *   그들이 정한다 · 라이브 서빙은 배포 후 UA 실측(E4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ogImageAlt, OG_CARD_W, OG_CARD_H } from '@/shared/og-share-image'
import { readCode, readRaw } from '../helpers/source-text'

const WORKER = 'src/worker/index.ts'
const SEO_TSX = 'src/components/SEO.tsx'
const HTML = 'index.html'

/**
 * **실행되는** 메타만 — 주석 처리된 `<meta>` 는 세지 않는다.
 * 🩸 주입이 가르쳐 준 것: 이 파일의 설명 주석은 `og:image:alt` 를 *백틱으로* 인용하므로 주석을
 *   안 걷어도 결과가 같다. 진짜 위험은 **메타 태그를 주석으로 감싸는 것**이다(흔하다) — 그러면
 *   주석 제거가 없는 파서는 그 태그를 **살아 있는 선언으로 읽고** 라이브엔 없는데 초록이 뜬다.
 *   그래서 파싱을 순수 함수로 빼고 ⑤가 합성 입력으로 **그 동작을 직접** 잰다.
 */
export const parseMetas = (raw: string): string[] =>
  (raw.replace(/<!--[\s\S]*?-->/g, ' ').match(/<meta[^>]*>/g) || [])

const htmlMetas = (): string[] => parseMetas(readRaw(HTML))
const metaContent = (metas: string[], key: string): string | undefined => {
  const re = new RegExp(`(?:property|name)="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
  const hit = metas.find(m => re.test(m))
  return hit ? (hit.match(/content="([^"]*)"/) || [])[1] : undefined
}

describe('og:image:alt — 그림을 고르는 자리에서 정한다 (2026-10-14)', () => {
  it('① `ogImageAlt` 가 그림 셋을 가른다', () => {
    expect(ogImageAlt('https://urdeal.kr/og-image.png', '')).toBe('유어딜 브랜드 카드')
    expect(ogImageAlt('https://urdeal.kr/og-image.svg', '아무 제목')).toBe('유어딜 브랜드 카드')
    expect(ogImageAlt('https://urdeal.kr/cdn-cgi/image/width=1200,fit=pad/assets/mascot/udal-loader-v2.webp', '아무 제목'))
      .toBe('유어딜 마스코트 유달이')
    // 사진 카드는 **제목을 그대로** — 사진 내용을 추측해 적지 않는다.
    expect(ogImageAlt('https://urdeal.kr/cdn-cgi/image/width=1200/x.jpg', '달빛한스푼 닭도리탕')).toBe('달빛한스푼 닭도리탕')
    // 폴백: 제목이 비면 그림을 설명할 말이 없으므로 브랜드로 떨어진다(빈 alt 를 내지 않는다).
    expect(ogImageAlt('https://x/y.jpg', '')).toBe('유어딜 공유 카드')
    expect(ogImageAlt('', '')).toBe('유어딜 공유 카드')
  })

  it('② 봇 셸이 `og:image:alt` 를 **SSOT 함수로** 선언한다', () => {
    const code = readCode(WORKER)
    expect(code, '봇 셸에 og:image:alt 가 없다').toContain('og:image:alt')
    // 🔑 리터럴로 적으면 그림이 바뀌어도 alt 이 안 따라온다 — 함수 호출이어야 한다.
    expect(code).toMatch(/og:image:alt"\s+content="\$\{esc\(ogImageAlt\(/)
    // width/height 와 **같은 자리**에 있는가(그림을 고르는 그 한 줄).
    const line = readRaw(WORKER).split('\n').find(l => l.includes('og:image:alt')) || ''
    expect(line).toContain('og:image:width')
    expect(line).toContain('og:image:height')
  })

  it('③ `index.html` 의 alt 값이 **함수 출력과 같다** (정적 HTML 이라 대조가 유일한 수단)', () => {
    const metas = htmlMetas()
    const img = metaContent(metas, 'og:image')
    const alt = metaContent(metas, 'og:image:alt')
    expect(img, 'index.html 에 og:image 가 없다').toBeTruthy()
    expect(alt, 'index.html 에 og:image:alt 가 없다').toBeTruthy()
    expect(alt).toBe(ogImageAlt(String(img), ''))
    // 선언 치수도 SSOT 와 같은가(2026-10-12 작업의 짝 — 한쪽만 바뀌면 선언이 거짓이 된다).
    expect(metaContent(metas, 'og:image:width')).toBe(String(OG_CARD_W))
    expect(metaContent(metas, 'og:image:height')).toBe(String(OG_CARD_H))
  })

  it('④ 클라 `<SEO>` 도 같은 함수를 쓴다 (한 URL 두 alt 차단)', () => {
    const code = readCode(SEO_TSX)
    expect(code).toContain("from '@/shared/og-share-image'")
    expect(code).toMatch(/og:image:alt"\s+content=\{ogImageAlt\(/)
    expect(code).toMatch(/twitter:image:alt"\s+content=\{ogImageAlt\(/)
    // 🩸 종전엔 **페이지 설명 60자**를 잘라 넣었다 — 그림 설명이 아니고 서버와도 달랐다.
    expect(code).not.toContain('resolvedDescription.slice(0, 60)')
    // 🩸 그리고 도매몰 분기의 고정 문구(`B2B 도매몰`)도 함께 사라졌다(2026-10-11 철거).
    expect(code).not.toContain('B2B 도매몰')
  })

  it('⑤ 측정이 헛돌지 않는다 (index.html 메타 하한 + 판정식 자기검사)', () => {
    const metas = htmlMetas()
    // 🔴 주석 제거가 너무 세서 메타가 통째로 사라지면 ③이 `undefined === undefined` 로 통과한다.
    expect(metas.length).toBeGreaterThanOrEqual(20)
    expect(metaContent(metas, 'twitter:card')).toBe('summary_large_image')
    // 🔑 주석 처리된 메타를 **살아 있는 선언으로 세지 않는가** — 합성 입력으로 동작을 직접 잰다.
    //   (파일 안의 설명 주석은 태그가 아니라 백틱 인용이라 이 성질을 재지 못한다.)
    const probe = '<meta property="og:image" content="x" />\n<!-- <meta property="og:image:alt" content="주석" /> -->'
    const got = parseMetas(probe)
    expect(got.length).toBe(1)
    expect(got.join(' ')).not.toContain('og:image:alt')
    // 반대 방향: 주석이 없으면 둘 다 센다(제거기가 너무 세서 멀쩡한 태그를 먹지 않는가).
    expect(parseMetas(probe.replace(/<!--|-->/g, '')).length).toBe(2)
  })

  it('⑥ 반대 방향 — `og:image` 가 없는 자리에 alt 만 두지 않는다', () => {
    // 🔑 alt 은 그림의 **부속**이다. 그림 없이 alt 만 있으면 아무것도 설명하지 않는다.
    const metas = htmlMetas()
    const hasImg = metas.some(m => /property="og:image"/.test(m))
    const hasAlt = metas.some(m => /property="og:image:alt"/.test(m))
    expect(hasAlt).toBe(hasImg)
    const code = readCode(WORKER)
    if (code.includes('og:image:alt')) expect(code).toContain('og:image" content=')
  })
})
