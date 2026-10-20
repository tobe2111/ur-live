/**
 * 🪝 포커스 가두기 훅이 쇼핑 상세 봉투를 어드민에 끌고 오지 않는다 〔2026-10-20〕
 *
 * 라이브 `/admin` 실측: 어드민이 정적으로 받는 공용 묶음(app-components)이 `lz-productL` 을 import 했고,
 * 그 봉투가 다시 `embla`(캐러셀 라이브러리)를 끌었다 — 합쳐 약 31KB raw. app-components 가 그 봉투에서
 * 가져가는 것은 `useFocusTrap` **하나**였다(장바구니 옵션 모달이 쓴다). 훅에 규칙이 없어 묶음기가 그 훅을
 * 쇼핑 상세 쪽 사용처를 따라 봉투에 넣었기 때문이다. 이제 app-components 가 이미 받는 leaf 봉투
 * (`app-ui-utils`)에 둔다 — 어드민 첫 화면 256.4 → 246.4KB br(check-surface-budgets dash:admin).
 *
 * ⚠️ 못 보는 것: 실제 청크 배치(빌드가 정한다 — surface-budgets 의 dash:admin 래칫이 회귀를 잡는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const vite = stripComments(readFileSync('vite.config.ts', 'utf-8'))

describe('useFocusTrap 청크 배치', () => {
  it('app-ui-utils 로 보낸다', () => {
    expect(vite).toMatch(/if \(id\.includes\('\/src\/hooks\/useFocusTrap'\)\) return 'app-ui-utils'/)
  })
  it('hooks catch-all(app-utils) 보다 먼저 온다 — 먼저 매칭되는 규칙이 이긴다', () => {
    const a = vite.indexOf("'/src/hooks/useFocusTrap'")
    const b = vite.indexOf("id.includes('/src/hooks/')")
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a)
  })
  it('훅은 react 말고 아무것도 import 하지 않는다 (leaf 봉투가 무언가를 끌고 오지 않게)', () => {
    const imports = readFileSync('src/hooks/useFocusTrap.ts', 'utf-8').match(/^import .* from '([^']+)'/gm) ?? []
    expect(imports.length).toBeGreaterThan(0)
    for (const l of imports) expect(l).toMatch(/from 'react'$/)
  })
})
