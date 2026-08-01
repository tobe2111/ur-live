/**
 * 🔴 **본진에 운영자 몰 입구를 만들지 않는다** 〔대표 경계조건 ⑤, 2026-07-29〕
 *
 * 대표 지시: *"유어딜 본진에 이 서비스로 가는 입구를 만들지 말 것 — 홈 배너, 메뉴 탭, 추천 섹션 전부 금지.
 * 진입은 운영자가 뿌린 링크뿐이다. 발견성 개선을 위한 제안도 하지 말 것(P0 이후 판단)."*
 *
 * ## 왜 가드가 필요한가
 * 이 금지는 **어기기 쉽고 어긴 티가 안 난다.** 홈에 섹션 하나 붙이는 건 자연스러운 개선처럼 보이고,
 * 붙여도 아무것도 깨지지 않는다. 그래서 문서에만 적어두면 **다음 세션이 선의로 위반**한다
 * (이 레포가 반복해 만난 클래스 — 실패가 아니라 조용한 이탈).
 *
 * ## 무엇이 P0 판정을 지키나
 * 본진 유입이 섞이면 *"엑셀을 버렸는가"* 판정이 오염된다 — 운영자가 자기 고객을 데려온 것인지
 * 유어딜이 손님을 꽂아준 것인지 구분이 안 된다. **입구를 막는 것이 곧 측정을 지키는 것**이다.
 *
 * ⚠️ 이 가드가 **못** 막는 것:
 *   - 정적 문자열이 아닌 동적 링크(`href={someVar}`) — 텍스트로는 판정 불가
 *   - 어드민/셀러 화면의 몰 링크(그건 운영 도구라 금지 대상이 아니다)
 *   - 검색엔진·SNS 를 통한 유입(우리가 만든 입구가 아니다)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/** 본진 소비자 진입면 — 여기에 몰 입구가 생기면 P0 측정이 오염된다. */
const MAINLAND_SURFACES = [
  'src/components/main/BottomNav.tsx',
  'src/components/main/DesktopTopNav.tsx',
  'src/components/main/DealEarnStrip.tsx',
  'src/components/main/FlashDealsHero.tsx',
  'src/components/main/HomeDongneDealSection.tsx',
  'src/components/main/HomeProductsRail.tsx',
]

/** 몰 표면을 가리키는 신호. 라우트가 아직 없으므로 **미래 이름까지** 함께 막는다. */
const MALL_ENTRY_SIGNALS = [
  /\/mall\b/,
  /operator-mall/i,
  /운영자\s*몰/,
  /몰\s*둘러보기/,
  /mallSlug/,
]

describe('⑤ 본진에 운영자 몰 입구 금지', () => {
  const present = MAINLAND_SURFACES.filter((f) => existsSync(resolve(process.cwd(), f)))

  it('검사 대상 파일이 실재한다 (빈 스캔 방지)', () => {
    // 파일이 리네임되면 조용히 0개를 검사하고 초록이 뜬다 — 그게 이 가드가 죽는 방식이다.
    // 이름이 바뀌었으면 **목록을 갱신**하라는 신호로 여기서 멈춘다.
    expect(present.length, `사라진 파일: ${MAINLAND_SURFACES.filter(f => !present.includes(f)).join(', ')}`)
      .toBe(MAINLAND_SURFACES.length)
  })

  it('본진 진입면에 몰 링크·섹션이 없다', () => {
    const hits: string[] = []
    for (const f of present) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8')
      for (const re of MALL_ENTRY_SIGNALS) {
        if (re.test(src)) hits.push(`${f} ← ${re}`)
      }
    }
    expect(
      hits,
      `본진에 몰 입구가 생겼다(대표 경계조건 ⑤ 위반). 진입은 운영자가 뿌린 링크뿐이다:\n${hits.join('\n')}`,
    ).toEqual([])
  })
})

/**
 * 🔴 **`/:mallSlug` 라우트의 자리** 〔세션 ③-a, 2026-08-01〕
 *
 * 이 라우트는 **1-세그먼트 URL 을 전부 매치**한다. 그래서 자리가 곧 안전성이다:
 * catch-all(`*`) 바로 앞이 아니면, **뒤에 오는 라우트가 조용히 죽는다** —
 * 이 레포가 실제로 겪은 중복 라우트 사고(`/influencer` 두 달간 미렌더)와 같은 클래스이고,
 * 그때처럼 **에러도 경고도 빌드 실패도 안 난다.**
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 다른 파일(`src/routes/*.tsx`)에 1-세그먼트 라우트가 추가되는 경우.
 *   그건 `check-duplicate-routes` 도 못 본다(경로가 다르니 중복이 아니다). 자리 규칙은 App.tsx 안에서만 성립한다.
 */
describe('🔴 `/:mallSlug` 는 catch-all 바로 앞에 있어야 한다', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  const routePaths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

  it('App.tsx 라우트 목록에서 `/:mallSlug` 다음은 `*` 뿐이다', () => {
    const i = routePaths.indexOf('/:mallSlug')
    expect(i, '`/:mallSlug` 라우트가 App.tsx 에 없다').toBeGreaterThan(-1)
    // 뒤에 남은 것이 catch-all 하나뿐이어야 한다. 하나라도 더 있으면 그 라우트는 도달 불가다.
    expect(routePaths.slice(i + 1)).toEqual(['*'])
  })

  it('1-세그먼트 파라미터 라우트는 `/:mallSlug` 하나뿐이다', () => {
    // 둘이면 먼저 선언된 쪽이 항상 이겨 나머지는 죽는다(중복 아님 → 중복 가드가 못 잡는다).
    const oneSegParam = routePaths.filter((p) => /^\/:[^/]+$/.test(p))
    expect(oneSegParam).toEqual(['/:mallSlug'])
  })
})
