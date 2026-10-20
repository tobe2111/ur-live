/**
 * 🔁 2026-10-18 — 쇼핑(`/browse`)이 번역 도착에 맞춰 1페이지를 **한 번 더** 받던 것.
 *
 * `useTranslation` 의 `t` 는 번역 묶음이 도착할 때 새로 만들어진다(i18n-lite `added`). `loadProducts`
 * 가 `t` 에 묶이고 리셋 effect 가 `loadProducts` 에 묶여 있어, 번역이 첫 요청 뒤에 오면 리셋이 다시
 * 돌았다 — `check-duplicate-fetch` 간헐 `/api/products ×2`(4ms 간격, 로컬 8회 중 2회).
 * ⚠️ 못 보는 것: 다른 화면의 같은 모양(effect 가 `t` 를 품은 콜백에 묶인 곳) — 이 파일은 쇼핑만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/pages/BrowsePage.tsx')

describe('쇼핑 — 번역 도착이 목록 요청을 다시 부르지 않는다', () => {
  it('loadProducts 의 의존성에 t 가 없다', () => {
    const at = SRC.indexOf('const loadProducts = useCallback(')
    expect(at, 'loadProducts 를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    const deps = SRC.slice(at).match(/\n  \}, \[([^\]]*)\]\)/)
    expect(deps, '의존성 배열을 못 찾았다').not.toBeNull()
    const list = deps![1].split(',').map((x) => x.trim())
    expect(list, '번역이 도착할 때마다 1페이지를 다시 받는다').not.toContain('t')
    for (const k of ['category', 'sortBy', 'priceRange']) expect(list, `${k} 가 바뀌면 다시 받아야 한다`).toContain(k)
  })

  it('에러 문구는 최신 t 를 ref 로 읽는다(옛 언어로 굳지 않는다)', () => {
    expect(SRC).toMatch(/const tRef = useRef\(t\); tRef\.current = t/)
    expect(SRC).toContain("setError(tRef.current('browse.loadError'))")
  })
})
