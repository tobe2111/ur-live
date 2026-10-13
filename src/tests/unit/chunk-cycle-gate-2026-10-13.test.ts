/**
 * 🚨 청크 순환 게이트 (2026-10-13 — 라이브 전 페이지 오류 화면 사고)
 *
 * PR #1756 이 `shared/kakao-place-url` 을 손님 매장 지도(RestaurantMiniMap)에서도 import 하게 했는데,
 * 그 파일에 manualChunks 규칙이 없어 Rollup 이 셀러 봉투(app-seller-components)에 넣었다.
 * 그러자 app-components ↔ app-seller-components **순환**이 생기고, 셀러 청크의 최상위 코드가
 * 아직 평가 안 된 app-components 값을 읽어 `Cannot access 'Z' before initialization` 으로
 * **모든 페이지**가 "문제가 발생했습니다" 로 떨어졌다. Rollup 은 경고만 찍고 빌드·CI·배포가 전부 초록이었다.
 *
 * 이 시험이 지키는 것:
 *  ① vite.config 의 onLog 가 CIRCULAR_CHUNK 를 **던진다**(경고로 흘리지 않는다)
 *  ② 허용목록은 그날 이미 있던 두 순환뿐이다(늘리는 것 = 게이트를 끄는 것)
 *  ③ kakao-place-url 은 공용 봉투(app-shared)에 있다
 *
 * ⚠️ 못 보는 것: 실제 빌드 결과(이 시험은 설정을 읽는다). 게이트 자체가 빌드에서 실제로 던지는지는
 *   2026-10-13 에 규칙을 빼고 빌드해 `[chunk-cycle]` 로 EXIT 1 을 확인했다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('vite.config.ts', 'utf8')

describe('청크 순환 게이트', () => {
  it('① onLog 가 CIRCULAR_CHUNK 를 만나면 throw 한다', () => {
    const i = src.indexOf('onLog(level, log, handler)')
    expect(i, 'onLog 게이트가 사라졌다').toBeGreaterThan(0)
    const body = src.slice(i, i + 800)
    expect(body).toMatch(/log\.code === 'CIRCULAR_CHUNK'/)
    expect(body).toMatch(/if \(!KNOWN_CIRCULAR_CHUNKS\.has\(cycle\)\) \{\s*throw new Error/)
  })

  it('② 허용목록은 이미 있던 두 순환뿐이다', () => {
    const m = src.match(/KNOWN_CIRCULAR_CHUNKS = new Set<string>\(\[([\s\S]*?)\]\)/)
    expect(m).not.toBeNull()
    const items = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    expect(items).toEqual([
      'app-shared -> app-utils -> app-shared',
      'app-shared -> app-utils -> capacitor -> app-shared',
    ])
    // 셀러·대시보드 같은 역할 봉투는 절대 허용목록에 오지 않는다(그날 터진 모양)
    expect(items.join(' ')).not.toMatch(/seller|admin|agency|dashboard/)
  })

  it('③ kakao-place-url 은 app-shared 로 간다', () => {
    expect(src).toMatch(/if \(id\.includes\('\/src\/shared\/kakao-place-url'\)\) return 'app-shared'/)
    expect(src.indexOf("'/src/shared/kakao-place-url'")).toBeLessThan(src.indexOf("if (id.includes('/src/components/seller/')) return 'app-seller-components'"))
  })
})
