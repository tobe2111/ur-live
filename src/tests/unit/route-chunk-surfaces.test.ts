/**
 * 🧱 라우트 청크 preload 표면 정합 (2026-08-22)
 *
 * 워커는 표면별로 lazy 페이지 청크를 `modulepreload` 로 주입해 엔트리와 병렬 다운로드시킨다
 * (`scripts/generate-route-chunk-map.mjs` → `worker/generated/route-chunk-map.ts`).
 *
 * 이 표는 **라우팅이 바뀌어도 자동으로 안 따라온다.** 그래서 두 가지가 조용히 망가진다:
 *   ① 낡은 진입점 — 실측 2026-08-22: 홈이 `HomeRoute`(PC/모바일 분기)로 바뀐 뒤에도 표는
 *      `RestaurantMapPage` 를 가리켜, 홈 첫 화면이 **안 쓰는 지도 청크 23KB(gzip)** 를 미리 받고
 *      정작 쓰는 홈 청크는 병렬화를 못 받았다. 양쪽으로 손해인데 에러가 없다.
 *   ② 캡에 잘린 두 번째 진입점 — `linkshop` 은 큐레이터/셀러 두 페이지인데 `SellerPublicPage`
 *      가 MAX_LINKS 10 에 밀려 빠져 있었다(사업자 링크샵의 본체인데도).
 *
 * 못 막는 것: 생성된 맵의 **내용**(빌드 산출물이라 커밋본은 비어 있다). 여기서는 **선언**
 * (`ROUTES`)이 실제 라우팅과 맞는지, 그리고 캡 처리가 페이지 청크를 우선하는지만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
const GEN = 'scripts/generate-route-chunk-map.mjs'
const HOME_ROUTE = 'src/pages/pc-home/HomeRoute.tsx'
const APP = 'src/App.tsx'

/**
 * ROUTES 선언에서 **주석을 제거한** 본문.
 *
 * ⚠️ 2026-08-22 되돌려-검증이 잡은 함정: 처음엔 주석까지 포함해 매칭했는데, 내가 `home:` 위에
 *    달아 둔 설명 주석이 "PcHomePage / MobileHomePage" 를 그대로 적고 있어서 **선언에서 진짜로
 *    빼도 초록**이 떴다. CLAUDE.md 가 경고하는 "주석에만 남아도 통과" 그대로다.
 *    ⇒ 판정은 반드시 코드에만 걸 것.
 */
function routesBlock(): string {
  const s = read(GEN)
  const i = s.indexOf('const ROUTES = {')
  expect(i, 'ROUTES 선언을 못 찾았다 — 생성기 형식이 바뀌었다(통과 아님)').toBeGreaterThan(-1)
  return s
    .slice(i, s.indexOf('}', i))
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
}

describe('home 표면이 실제 홈 라우트를 가리킨다', () => {
  it('`/` 가 렌더하는 페이지들이 표에 있다', () => {
    // HomeRoute 가 실제로 lazy import 하는 페이지 = 홈이 쓰는 청크.
    const home = read(HOME_ROUTE)
    const imported = [...home.matchAll(/lazy\(\(\) => import\('([^']+)'\)\)/g)].map((m) => m[1])
    expect(imported.length, 'HomeRoute 가 lazy import 를 안 한다 — 구조가 바뀌었다').toBeGreaterThanOrEqual(2)
    const block = routesBlock()
    for (const spec of imported) {
      const base = spec.split('/').pop()!
      expect(block, `ROUTES.home 에 ${base} 가 없다 — 그 뷰포트는 preload 를 못 받는다`).toContain(base)
    }
  })

  it('지도 페이지를 홈 표면으로 preload 하지 않는다 (지도는 /map 전용)', () => {
    const block = routesBlock()
    const homeLine = block.split('\n').find((l) => /^\s*home:/.test(l)) ?? ''
    expect(homeLine, '홈이 다시 지도 청크를 미리 받는다 — 실측 23KB(gzip) 낭비').not.toContain(
      'RestaurantMapPage',
    )
    // 그리고 지도는 여전히 살아 있어야 한다(피드 홈의 상단 배너 목적지).
    expect(read(APP)).toContain('<Route path="/map"')
  })
})

describe('진입점이 여러 개인 표면은 페이지 청크가 캡에 안 잘린다', () => {
  it('페이지 청크를 공유 청크보다 먼저 모은다', () => {
    const s = read(GEN)
    expect(s, 'pageJs/sharedJs 분리가 사라졌다 — 두 번째 진입점이 다시 잘린다').toContain('const pageJs = []')
    expect(s).toContain('const sharedJs = []')
    expect(s).toMatch(/pageJs\.push\(c\.js\[0\]\)/)
    expect(s).toMatch(/\[\.\.\.new Set\(\[\.\.\.pageJs, \.\.\.sharedJs\]\)\]/)
  })

  it('링크샵 두 페이지가 모두 선언돼 있다 (사업자 링크샵의 본체가 셀러 페이지다)', () => {
    const block = routesBlock()
    const line = block.split('\n').find((l) => /^\s*linkshop:/.test(l)) ?? ''
    expect(line).toContain('CuratorPage')
    expect(line).toContain('SellerPublicPage')
  })

  it('선언된 진입점 파일이 실재한다 (오타/이동 시 조용히 warn 만 나고 빠진다)', () => {
    const block = routesBlock()
    const specs = [...block.matchAll(/'(src\/[^']+\.tsx)'/g)].map((m) => m[1])
    expect(specs.length).toBeGreaterThanOrEqual(7)
    for (const f of specs) {
      expect(() => readFileSync(f, 'utf-8'), `${f} 가 없다 — 그 표면은 preload 0`).not.toThrow()
    }
  })
})
