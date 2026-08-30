/**
 * 🔘 버튼 체계 불변식 (2026-08-30 신설)
 *
 * ■ 막으려는 사고
 *   1) **`border: 0` 축약형** — 이 파일을 쓰다가 실제로 만든 버그다. 축약형은
 *      border-style 까지 `none` 으로 리셋하는데, Tailwind preflight 가 모든 요소에
 *      깔아 둔 `border-style: solid` 를 지운다. 그러면 `border border-gray-200` 을
 *      붙인 테두리 버튼이 width 만 1px 이고 style 은 none 이라 **선이 조용히 사라진다.**
 *      (VoucherRedeemModal 의 '닫기' 가 그럴 뻔했다.)
 *   2) **눌림/전환 규칙 소실** — 전역 `button:not(:disabled)` 규칙이 버튼의 '느낌'
 *      전부다. 지우면 앱 전체가 다시 뻣뻣해지는데 에러는 안 난다.
 *   3) **reduced-motion 미존중** — 움직임 민감 사용자에게 스케일 애니메이션이 남는다.
 *
 * ■ 이 테스트가 못 막는 것
 *   - Tailwind 가 안 쓰이는 `.ur-btn` 을 번들에서 지우는 것(트리셰이킹)은 **소스만 봐선
 *     알 수 없다.** 그건 빌드 산출 CSS 를 봐야 하고, 아래 마지막 케이스가 dist 가 있을
 *     때만 확인한다(없으면 건너뛴다 — CI 순서에 의존하지 않기 위해).
 *   - 개별 화면이 체계를 안 쓰고 인라인으로 버튼을 그리는 것은 안 본다(아직 2,600여 곳).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf-8')
const urBtn = css.match(/\.ur-btn\s*\{[\s\S]*?\}/)?.[0] ?? ''

describe('버튼 체계 (.ur-btn)', () => {
  it('.ur-btn 과 크기 3종이 정의돼 있어야 한다', () => {
    expect(urBtn, '.ur-btn 정의를 찾지 못했다').not.toBe('')
    for (const size of ['ur-btn-lg', 'ur-btn-md', 'ur-btn-sm', 'ur-btn-block']) {
      expect(css, `.${size} 가 없다`).toContain(`.${size}`)
    }
  })

  it('테두리는 축약형 `border:` 가 아니라 border-width 로만 0 이어야 한다', () => {
    // 축약형이면 border-style 이 none 이 되어 나중에 붙는 border 유틸이 무력화된다.
    expect(urBtn).not.toMatch(/(^|[\s;{])border\s*:/)
    expect(urBtn).toMatch(/border-width\s*:\s*0/)
  })

  it('전역 버튼 눌림/전환 규칙이 살아 있어야 한다', () => {
    expect(css).toMatch(/button:not\(:disabled\)/)
    expect(css).toMatch(/transition-duration:\s*160ms/)
    expect(css).toMatch(/scale\(0?\.9\d+\)/)
  })

  it('reduced-motion 에서 전환과 변형을 꺼야 한다', () => {
    const mq = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\s{4}\}/)?.[0] ?? css
    expect(mq).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]{0,400}transform:\s*none/)
  })

  it('빌드 산출 CSS 에 .ur-btn-lg 가 실려야 한다 (Tailwind 트리셰이킹 방어)', () => {
    const dir = resolve(root, 'dist/client/assets')
    if (!existsSync(dir)) return // 빌드 전이면 판정하지 않는다(CI 순서 비의존).
    const f = readdirSync(dir).find((n) => /^index-.*\.css$/.test(n))
    if (!f) return
    const built = readFileSync(resolve(dir, f), 'utf-8')
    expect(built, '빌드 CSS 에 .ur-btn-lg 가 없다 — 실사용처가 사라져 통째로 지워졌다').toContain('.ur-btn-lg{')
  })
})

describe('아이콘 획 굵기', () => {
  it('lucide 기본값(2)만 골라 얇게 해야 한다 — 명시값은 건드리면 안 된다', () => {
    // `svg.lucide { … }` 처럼 전체에 걸면 개발자가 일부러 정한 155곳(강조 3 · 섬세 1.5 등)을
    // 통째로 덮어써 의도를 지운다. 속성 선택자로 **기본값만** 잡아야 한다.
    const rule = css.match(/svg\.lucide\[stroke-width=['"]2['"]\]\s*\{[^}]*\}/)
    expect(rule, 'svg.lucide[stroke-width="2"] 규칙이 없다').toBeTruthy()
    expect(rule![0]).toMatch(/stroke-width:\s*1\.\d+/)

    // 속성 필터 없는 전면 규칙이 있으면 안 된다.
    expect(css).not.toMatch(/svg\.lucide\s*\{/)
  })
})

describe('카테고리 분류는 한 표만 있어야 한다', () => {
  it('홈 피드가 자기 카테고리 표를 따로 갖지 않는다 (DEAL_CATS 만)', () => {
    // 🩸 실제로 났던 일: 상단 탭(`전체·식사·미용·숙소·기타`)과 바로 아래 칩
    //   (`전체·식사·숙소·뷰티·기타`)이 **같은 분류를 다른 이름·다른 순서**로 보여 줬다.
    //   `PcHomeRail` 이 자기 주석에 "라벨 SSOT — 갈리면 어긋난다" 고 적어 뒀는데도
    //   두 번째 표가 생겨 그대로 어긋났다. SSOT 는 **다른 표가 없을 때만** 성립한다.
    const feed = readFileSync(resolve(root, 'src/pages/main-home/GroupBuyFeed.tsx'), 'utf-8')
    expect(feed).toMatch(/const CATEGORIES = DEAL_CATS/)
    // 자체 배열 리터럴(키+라벨 쌍)이 다시 생기면 실패
    expect(feed).not.toMatch(/const CATEGORIES\s*=\s*\[/)
  })
})

describe('현재 위치 표시 — 만들어 놓고 안 부르는 일이 없게', () => {
  it('coord2region 서버 엔드포인트에 클라이언트 소비처가 있어야 한다', () => {
    // 🩸 실제로 났던 일: 서버 `/api/proxy/kakao/coord2region` 이 2026-07-07 부터 있었고
    //   주석에 "대표 — 홈 '내 주변' 기준" 이라고까지 적혀 있었는데, **클라이언트에서
    //   한 번도 호출한 적이 없었다.** 그래서 위치를 잡아도 화면은 일반명사 "내 주변" 만
    //   말했고, 대표가 "홈에선 현재 위치가 어딘지도 나와야지" 라고 지적할 때까지 몰랐다.
    //   ⇒ 에러가 안 나는 부재다. 배포는 초록불이고 기능만 조용히 없다.
    const server = readFileSync(resolve(root, 'src/worker/routes/proxy.routes.ts'), 'utf-8')
    expect(server, '서버 엔드포인트가 사라졌다면 이 검사도 갱신할 것').toContain('/kakao/coord2region')

    const hook = readFileSync(resolve(root, 'src/hooks/useCurrentDong.ts'), 'utf-8')
    expect(hook).toContain('/api/proxy/kakao/coord2region')

    // 홈 두 표면이 실제로 그 훅을 쓰는지 — 훅만 있고 아무도 안 쓰면 같은 상태로 돌아간다.
    for (const f of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      expect(readFileSync(resolve(root, f), 'utf-8'), `${f} 가 useCurrentDong 을 안 쓴다`).toMatch(/useCurrentDong\(/)
    }
  })

  it('위치 이름을 못 얻어도 화면이 깨지지 않는다 (폴백 유지)', () => {
    const bar = readFileSync(resolve(root, 'src/pages/pc-home/PcHomeLocationBar.tsx'), 'utf-8')
    expect(bar).toMatch(/locatedLabel \|\| '내 주변'/)
  })
})
