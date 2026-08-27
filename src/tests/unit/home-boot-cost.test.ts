import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const NAV = 'src/components/main/DesktopTopNav.tsx'
const CARD = 'src/pages/main-home/GroupBuyFeedCard.tsx'
const FEED_ROUTE = 'src/features/group-buy/api/group-buy-public.routes.ts'
const FEED_CRON = 'src/worker/cron/group-buy-feed-cache.ts'

/**
 * 🏠 홈 첫 화면 비용 불변식 (2026-08-27 — 대표 "섹션이 안 보인다 · 로딩이 매우 느려").
 *
 * 진단이 뒤집힌 사건이라 남긴다: 처음엔 **SSR 시드가 콜드 콜로에서 빈다**고 봤는데, 라이브를
 * 실제로 재 보니 시드는 5/5 멀쩡히 실려 있었고 **패널이 뜨는 시각이 2,975ms** 였다.
 * 원인은 데이터가 아니라 **부팅 JS** 였다(프로파일: 한 함수가 self 1,108ms).
 * ⇒ "안 보인다"의 원인을 데이터에서만 찾지 말 것. 아래 셋이 그때 찾은 실제 원인이다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 렌더 시간(ms)은 안 잰다 — 소스의 모양만 본다.
 *    성능 회귀 자체는 배포 후 실측(Playwright)이 유일한 판정이다.
 */
describe('홈 부팅 비용', () => {
  /**
   * ① 의존성 없는 useEffect 안에서 레이아웃을 읽으면 **렌더마다 강제 리플로**가 난다.
   *    실제로 `DesktopTopNav` 의 카테고리 스크롤 화살표 계산이 그랬고, 홈에서 가장 비싼 JS 였다.
   */
  it('DesktopTopNav: 스크롤 화살표 effect 에 의존성 배열이 있다', () => {
    const s = read(NAV)
    const i = s.indexOf('syncCatArrow')
    expect(i).toBeGreaterThan(-1)
    // syncCatArrow 를 부르는 useEffect 를 찾아 그 닫는 부분에 dep 배열이 있는지 본다.
    const eff = s.indexOf('useEffect(', i)
    expect(eff).toBeGreaterThan(-1)
    let d = 0, j = eff + 'useEffect'.length
    while (j < s.length) { const c = s[j]; if (c === '(') d++; else if (c === ')') { d--; if (!d) break } j++ }
    const body = s.slice(eff, j + 1)
    expect(body).toContain('syncCatArrow')
    expect(body).toMatch(/,\s*\[[^\]]*\]\s*\)\s*$/)
  })

  it('DesktopTopNav: resize 리스너를 렌더마다 다시 달지 않는다(useCallback 로 고정)', () => {
    const s = read(NAV)
    expect(s).toMatch(/const syncCatArrow = useCallback\(/)
  })

  /**
   * ② 캐시 COLS ↔ 라이브 buildCols 드리프트.
   *    이 짝은 **두 번** 갈렸다: `images`(2026-08-19 에 수습) · `dominant_color`(2026-05-28 에
   *    라이브에만 들어가고 캐시엔 3개월간 없었다 — 홈 기본 피드가 이 캐시라 값이 한 번도 안 실렸다).
   *    ⚠️ 못 막는 것: 이름이 같아도 **다른 것을 가리키는** 별칭까지는 못 본다.
   */
  it('materialized 피드 캐시 COLS = 라이브 buildCols (컬럼 드리프트 0)', () => {
    /**
     * ⚠️ 콤마로 쪼개지 말 것 — 두 파일 다 컬럼 목록 안에 `${...}` 조건부 조각이 있고,
     *    그 표현식 **안에도 콤마가 있다**. 처음 이 테스트를 콤마 split 로 짰다가 `s.name` 이
     *    통째로 사라져 가짜 빨강이 떴다. 그래서 콤마를 무시하고 `p.x`/`s.x` 토큰만 줍는다.
     */
    const tokens = (src: string, from: string, to: string) => {
      const a = src.indexOf(from)
      const b = src.indexOf(to, a)
      if (a === -1 || b === -1) throw new Error(`컬럼 블록을 못 찾았다(${from}) — 이름이 바뀌었으면 이 테스트를 같이 고쳐라`)
      const region = src.slice(a, b)
      return new Set([...region.matchAll(/\b([ps])\.([a-z_][a-z0-9_]*)/gi)].map(m => `${m[1]}.${m[2]}`))
    }
    // 라이브: buildCols 안에 조건부 `p.dominant_color` 리터럴이 그대로 있다.
    const live = tokens(read(FEED_ROUTE), 'const buildCols = () => `', 's.profile_image AS seller_avatar')
    // 캐시: 조각이 `dominantColorFrag` 로 빠져 있으니 그 정의부터 함께 훑는다.
    const cron = tokens(read(FEED_CRON), 'const dominantColorFrag', 's.profile_image AS seller_avatar')
    expect(live.size).toBeGreaterThan(15)
    expect([...live].filter(c => !cron.has(c)).sort()).toEqual([])
    expect([...cron].filter(c => !live.has(c)).sort()).toEqual([])
  })

  it('피드 캐시가 dominant_color 를 싣는다 (카드가 매번 canvas 로 다시 뽑지 않게)', () => {
    expect(read(FEED_CRON)).toContain('p.dominant_color')
  })

  /**
   * ③ 대표색 추출은 `getImageData` 라 GPU→CPU 리드백을 강제한다 — 첫 화면 그리는 중에
   *    동기로 돌면 그만큼 늦어진다. 쓸 데가 없으면 아예 돌지 않아야 하고, 돌더라도 미뤄야 한다.
   */
  it('GroupBuyFeedCard: 대표색이 이미 있으면 추출 자체를 건너뛴다', () => {
    const s = read(CARD)
    const i = s.indexOf('onCoverLoad={')
    expect(i).toBeGreaterThan(-1)
    const block = s.slice(i, i + 900)
    expect(block).toMatch(/if \(cardColor && p\.dominant_color\) return/)
  })

  it('GroupBuyFeedCard: 추출을 첫 페인트 밖(idle)으로 미룬다', () => {
    const s = read(CARD)
    const i = s.indexOf('onCoverLoad={')
    const block = s.slice(i, i + 900)
    expect(block).toContain('requestIdleCallback')
    // 미루기만 하고 기능을 없애면 안 된다 — 보고 경로가 살아 있어야 한다.
    expect(block).toContain('reportDominantColor')
  })
})
