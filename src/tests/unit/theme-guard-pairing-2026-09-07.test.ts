/**
 * 🔗 두 테마 가드는 **짝이다** — 한쪽이 면제한 페이지는 반드시 다른 쪽이 본다 (2026-09-07)
 *
 * `check-light-input-guard.mjs` 는 라이트 고정 auth 페이지가 보호 클래스를 가졌는지 정적으로 본다.
 * 그런데 그 목록엔 `CONSUMER_EXCLUDE` 가 있다 — "이 페이지는 양 테마를 지원하니 라이트 고정 검사
 * 대상이 아니다" 라는 선언이다.
 *
 * 🩸 그 선언이 사실인지 아무도 안 보고 있었다. `RegisterPage` 는 거기 적혀 있었지만 실제로는
 *   다크 이행이 반만 돼 있었고(바깥 배경만 뒤집히고 폼은 원시 hex), 다크에서 약관 링크 1.03:1 ·
 *   입력 1.00:1(흰 위 흰)로 **가입 폼 전체가 안 읽혔다.** 로그인 화면 하단에서 바로 가는 자리다.
 *
 * ⇒ 면제는 **약속**이고, 그 약속은 실제 렌더 측정(`check-dark-contrast.mjs`)이 확인한다.
 *   이 테스트는 그 두 목록이 어긋나지 않게 묶는다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 대비 자체(그건 브라우저가 재는 `check-dark-contrast` 의 몫)와
 *   두 목록 밖의 페이지. 여기서 고정하는 것은 "면제했으면 측정한다" 는 관계뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const LIGHT_INPUT = readFileSync('scripts/check-light-input-guard.mjs', 'utf-8')
const DARK_CONTRAST = readFileSync('scripts/check-dark-contrast.mjs', 'utf-8')

/** `CONSUMER_EXCLUDE` 의 파일 경로들. */
function excludedPages(): string[] {
  const m = LIGHT_INPUT.match(/const CONSUMER_EXCLUDE = new Set\(\[([\s\S]*?)\]\)/)
  expect(m, 'CONSUMER_EXCLUDE 를 못 찾았다 — 앵커가 낡았다').toBeTruthy()
  return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** `check-dark-contrast` 가 실제로 도는 경로들. */
function measuredRoutes(): string[] {
  const m = DARK_CONTRAST.match(/const ROUTES = \[([\s\S]*?)\n\]/)
  expect(m, 'ROUTES 를 못 찾았다 — 앵커가 낡았다').toBeTruthy()
  return [...m![1].matchAll(/route: '([^']+)'/g)].map((x) => x[1].split('?')[0])
}

/** 페이지 파일 → 그 페이지가 서비스되는 경로. 새 면제를 추가하면 여기도 한 줄 추가한다. */
const PAGE_ROUTE: Record<string, string> = {
  'src/pages/LoginPage.tsx': '/login',
  'src/pages/RegisterPage.tsx': '/register',
  'src/pages/JoinChoicePage.tsx': '/join',
}

describe('테마 가드 짝 — 면제한 페이지는 측정한다', () => {
  it('CONSUMER_EXCLUDE 의 모든 페이지가 PAGE_ROUTE 에 등록돼 있다', () => {
    const pages = excludedPages()
    expect(pages.length, '면제 목록이 비었다 — 앵커가 낡았을 가능성').toBeGreaterThan(0)
    for (const f of pages) {
      expect(PAGE_ROUTE[f], `${f} 가 면제됐는데 어느 경로인지 이 테스트가 모른다 (PAGE_ROUTE 에 추가할 것)`)
        .toBeTruthy()
    }
  })

  it('면제된 페이지는 전부 dark-contrast 경로 목록에 있다', () => {
    const measured = new Set(measuredRoutes())
    expect(measured.size, '측정 경로가 비었다').toBeGreaterThan(10)
    for (const f of excludedPages()) {
      const route = PAGE_ROUTE[f]
      if (!route) continue // 위 테스트가 따로 잡는다
      expect(measured.has(route),
        `${f} 는 "양 테마 지원"이라며 라이트 고정 검사를 면제받았는데, ` +
        `실제 렌더 측정(check-dark-contrast) 목록엔 ${route} 가 없다 — 아무도 안 보는 페이지가 된다`,
      ).toBe(true)
    }
  })

  it('입력을 받는 소비자 화면이 측정 목록에 있다 (이 클래스의 진앙)', () => {
    // 전역 `.dark input`(특이도 0,5,1)이 요소 클래스를 언제나 이기므로 입력 화면이 가장 위험하다.
    const measured = new Set(measuredRoutes())
    for (const r of ['/store/new', '/register', '/login', '/checkout', '/account/settings']) {
      expect(measured.has(r), `${r} 가 dark-contrast 측정 목록에서 빠졌다`).toBe(true)
    }
  })
})
