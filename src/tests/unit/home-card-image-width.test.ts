/**
 * 🖼️ 홈 카드 사진을 표시 폭에 맞게 받는다 (2026-08-27 대표 신고)
 *
 * 대표: *"메인페이지 로딩 너무 느려.. 가까운 동네 딜 특히 되게 느려."*
 *
 * ## 무엇이 느렸나
 * 카드 **골격은 SSR 시드로 0.9초에** 떴다. 느린 건 사진이었다 — 첫 화면 사진이 2.5~3.9초에야
 * 도착해 그동안 카드가 빈 채로 남았다. 원인은 네트워크가 아니라 **우리가 너무 큰 걸 요청**한 것:
 *
 * ```
 * 모바일 390  표시 175 × dpr3 = 필요 525  →  받음 800~1200  (1.5~2.3배)
 * 태블릿 810  표시 175 × dpr2 = 필요 350  →  받음 800       (2.3배)
 * PC   1440  표시 322 × dpr1 = 필요 322  →  받음 400       (1.2배, 적정)
 * ```
 *
 * `pc` 는 **카드 룩**(그라데이션·글자색) 플래그인데 이미지 해상도까지 겸하고 있었고,
 * `HomeSections` 가 룩을 위해 `pc` 를 하드코딩으로 넘기는 바람에 모바일·태블릿까지 PC용을 받았다.
 *
 * ## 왜 base 가 곧 표시 폭이어야 하나
 * `cfSrcSet` 은 **x-디스크립터**(1x/2x/3x)를 낸다 — base 가 1x CSS 폭이라는 뜻이다.
 * base 를 표시폭보다 크게 잡으면 그 배수가 3x 에서 그대로 증폭된다(400 → 3x = 1200).
 *
 * 이 테스트가 **못 막는 것**: 실제 바이트. 레이아웃이 바뀌어 표시 폭이 달라지면 여기 숫자도
 *   같이 낡는다 — 열 수를 바꿨으면 브라우저로 `표시폭 × dpr` 대비 요청 폭을 다시 재야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/**
 * 주석 제거 — 설명 주석이 판정을 통과시키는 함정.
 * ⚠️ **줄 단위로만** 지운다. `/*…*\/` 정규식으로 지우면 앞쪽 블록주석 시작이 뒤쪽 `*\/` 와
 *    짝지어져 멀쩡한 코드까지 삼킨다(2026-08-24 에 실제로 당했다).
 */
const code = (s: string) =>
  s
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')

const CARD = 'src/pages/main-home/GroupBuyFeedCard.tsx'
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const SECTIONS = 'src/components/home/HomeSections.tsx'

/** 라이브 실측 표시 폭(px) — 위 표의 근거. */
const SHOWN = { belowLg: 175, lg: 322 }
/** 지원 최대 DPR. 아이폰이 3. */
const MAX_DPR = 3

describe('사진 해상도가 카드 룩 플래그와 분리돼 있다', () => {
  it('카드가 `pc` 가 아니라 `imgWidth` 로 폭을 받는다', () => {
    const s = code(read(CARD))
    expect(s, '`pc ? 400 : 300` 로 되돌아갔다 — 룩 플래그가 다시 해상도를 정한다').not.toMatch(
      /width=\{pc \?/,
    )
    expect(s, 'DealCardMedia 가 imgWidth 를 안 쓴다').toMatch(/width=\{imgWidth\}/)
  })

  it('두 부모가 모두 뷰포트로 폭을 정해 넘긴다', () => {
    for (const f of [FEED, SECTIONS]) {
      const s = code(read(f))
      expect(s, `${f}: lg 미디어쿼리로 폭을 정하지 않는다`).toMatch(
        /useMediaQuery\('\(min-width: 1024px\)'\)/,
      )
      expect(s, `${f}: imgWidth 를 카드에 안 넘긴다`).toMatch(/imgWidth=\{cardImgWidth\}/)
    }
  })
})

describe('요청 폭이 필요 폭을 넘지 않는다', () => {
  /** 소스에서 `cardImgWidth = isLgViewport ? A : B` 의 A·B 를 읽는다. */
  function widths(file: string): { lg: number; belowLg: number } {
    const m = code(read(file)).match(/cardImgWidth\s*=\s*isLgViewport \? (\d+) : (\d+)/)
    if (!m) throw new Error(`${file}: cardImgWidth 를 못 읽었다`)
    return { lg: Number(m[1]), belowLg: Number(m[2]) }
  }

  it('두 부모가 같은 값을 쓴다 (갈리면 같은 화면에서 해상도가 달라진다)', () => {
    expect(widths(FEED)).toEqual(widths(SECTIONS))
  })

  it('base × 최대 dpr 이 필요 폭의 1.3배를 넘지 않는다', () => {
    const w = widths(FEED)
    // 모바일·태블릿: 표시 175. dpr3 이면 필요 525.
    const belowRatio = (w.belowLg * MAX_DPR) / (SHOWN.belowLg * MAX_DPR)
    expect(belowRatio, `lg 미만 base ${w.belowLg} 이 표시폭 ${SHOWN.belowLg} 대비 과하다`).toBeLessThanOrEqual(1.3)
    // PC: 표시 322.
    const lgRatio = w.lg / SHOWN.lg
    expect(lgRatio, `lg base ${w.lg} 이 표시폭 ${SHOWN.lg} 대비 과하다`).toBeLessThanOrEqual(1.3)
  })

  it('그렇다고 필요 폭보다 작지도 않다 (작으면 흐려진다 — 히어로에서 겪은 반대 실수)', () => {
    const w = widths(FEED)
    expect(w.belowLg, 'lg 미만 base 가 표시폭보다 작다').toBeGreaterThanOrEqual(SHOWN.belowLg)
    expect(w.lg, 'lg base 가 표시폭보다 작다').toBeGreaterThanOrEqual(SHOWN.lg)
  })
})
