/**
 * 📐 태블릿이 헤더와 같은 홈을 본다 (2026-08-24 대표 신고)
 *
 * 대표: *"태블릿으로 볼 때 아직 메인에서 보이는 이용권 UI가 예전 디자인이야."*
 *
 * ## 무엇이 어긋나 있었나
 * 홈은 뷰포트로 두 갈래다(`HomeRoute`). 그런데 경계가 **서로 달랐다**:
 *
 * ```
 * 상단 헤더(DesktopTopNav)   hidden md:block   → 768px 부터 PC 헤더
 * 홈 본문(HomeRoute)         min-width: 1024   → 1024px 부터 PC 본문
 *                            ↑ 768~1023 구간만 헤더는 새 디자인, 본문은 옛 디자인
 * ```
 *
 * 그래서 아이패드 세로(810)에서 **차콜 색면도 히어로도 없이** 흰 배경 옛 구조가 떴다.
 * 두 값은 한 화면의 위아래를 나누는 같은 선이므로 **반드시 같아야 한다.**
 *
 * ## 태블릿 열 수
 * `sm:grid-cols-3` 이 768~1023 에도 걸려 3열이었는데, 편성 섹션은 4개를 뿌린다 —
 * 마지막 하나가 줄에 혼자 남아 오른쪽이 텅 빈다. `md:grid-cols-4` 로 맞춘다.
 *
 * 이 테스트가 **못 막는 것**: 실제 레이아웃 붕괴. 브레이크포인트가 같아도 좁은 폭에서
 *   요소가 겹칠 수 있다 — 값을 바꿨으면 태블릿 폭으로 한 번 렌더해 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/**
 * 주석 제거 — 설명 주석이 판정을 통과시키는 함정(이 레포에서 반복해 겪었다).
 *
 * ⚠️ **줄 단위로만** 지운다. `/*…*\/` 를 정규식으로 통째로 지우면 파일 앞쪽의 블록주석 시작이
 *    뒤쪽 `*\/` 와 짝지어져 **멀쩡한 코드까지 삼킨다** — 이 테스트를 쓰다 실제로 당했다
 *    (`GroupBuyFeed` 의 그리드가 통째로 사라져 "클래스가 없다"고 빨간불이 떴다).
 */
const code = (s: string) =>
  s
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')

const ROUTE = 'src/pages/pc-home/HomeRoute.tsx'
const NAV = 'src/components/main/DesktopTopNav.tsx'
const HERO = 'src/components/home/HomeHeroDefault.tsx'
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const SECTIONS = 'src/components/home/HomeSections.tsx'

describe('홈 본문과 상단 헤더가 같은 경계를 쓴다', () => {
  it('HomeRoute 가 md(768) 에서 PC 홈으로 넘어간다', () => {
    const s = code(read(ROUTE))
    const m = s.match(/useMediaQuery\('\(min-width:\s*(\d+)px\)'\)/)
    expect(m, 'HomeRoute 의 뷰포트 분기를 못 읽었다').toBeTruthy()
    expect(
      Number(m![1]),
      '홈 본문 경계가 헤더(md=768)보다 높다 — 그 사이 구간이 다시 옛 디자인이 된다',
    ).toBe(768)
  })

  it('헤더가 여전히 md 부터 보인다 (한쪽만 바뀌면 같은 사고가 반대로 난다)', () => {
    expect(code(read(NAV)), 'DesktopTopNav 의 `hidden md:block` 이 바뀌었다').toMatch(
      /hidden md:block/,
    )
  })

  it('전역 네비가 태블릿 홈에서 사라지지 않는다', () => {
    // 🩸 이 검사는 **내가 만든 회귀**에서 나왔다. 분기를 md 로 내린 직후 태블릿에 헤더가
    //   통째로 없어졌는데, 원인은 `LEGACY_OWN_HEADER` 에 홈(`/`)이 들어 있어 <lg 에서
    //   `return null` 하고 있었기 때문이다(예전엔 홈이 자체 헤더를 가졌으므로 맞는 규칙이었다).
    //   md~lg 홈은 이제 `PcHomePage` 라 자체 헤더가 없다 — 여기 홈이 다시 들어오면 헤더가 사라진다.
    const s = code(read(NAV))
    const m = s.match(/const LEGACY_OWN_HEADER = \[([^\]]*)\]/)
    expect(m, 'LEGACY_OWN_HEADER 목록을 못 읽었다').toBeTruthy()
    expect(m![1], "홈('/')이 목록에 있으면 태블릿 홈에 헤더가 통째로 사라진다").not.toMatch(/'\/'/)
  })
})

describe('태블릿 폭에서 카드가 줄을 채운다', () => {
  it('PC 딜 그리드가 md 에서 4열이다', () => {
    expect(code(read(FEED)), '태블릿이 sm 규칙(3열)에 걸려 4번째 카드가 외톨이가 된다').toMatch(
      /grid-cols-2 sm:grid-cols-3 md:grid-cols-4/,
    )
  })

  it('편성 섹션 그리드도 같은 열 수다 (한 화면에서 열이 갈리면 안 된다)', () => {
    const s = code(read(SECTIONS))
    const hits = s.match(/grid-cols-2 sm:grid-cols-3 md:grid-cols-4/g) || []
    expect(hits.length, '섹션 그리드 중 일부만 태블릿 4열이다').toBeGreaterThanOrEqual(2)
    expect(s, '섹션에 옛 lg:grid-cols-4 규칙이 남아 열이 갈린다').not.toMatch(
      /grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/,
    )
  })
})

describe('히어로가 태블릿에서도 사진을 보여준다', () => {
  it('사진이 md 부터 보이고 폭은 태블릿에서 좁다', () => {
    const s = code(read(HERO))
    expect(s, '히어로 사진이 다시 lg 전용이 됐다 — 태블릿엔 색면만 남아 허전하다').toMatch(
      /hidden md:block absolute inset-y-0 right-0 w-\[46%\] lg:w-\[54%\]/,
    )
  })
})
