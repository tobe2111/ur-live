/**
 * 🪪 2026-10-19 — 판매자 마이 첫 화면이 나브 색인 봉투를 받던 것.
 *
 * 마이 판매 구역의 안내문(`store-status-note.ts`)이 `SELLER_STATUS_KEY` **상수 하나**를 읽는데,
 * 그 출처 `shared/seller-approval.ts` 가 manualChunks 에서 `app-seller-nav`(나브 색인 · 메뉴 아이콘)에 묶여 있었다.
 * 그래서 판매자 마이가 그 봉투 + lucide(br 9.5) + lucide-desktop(1.1)을 첫 화면에 받았다 —
 * 마이엔 메뉴가 그려지지도 않는다. 같은 함정이 `seller-roles` 에서 이미 한 번 났다(vite.config 주석).
 * 처방: `seller-approval` → `app-shared`(1.6KB · import 0 — 아무것도 끌고 오지 않는다).
 * 결과(정적 폐쇄 brotli): dash:my 215.5 → 202.7.
 *
 * ⚠️ 못 보는 것: 바이트 자체(`check-surface-budgets` 가 잠근다). 이 시험은 *왜* 되돌아왔는지를 말한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const VITE = readFileSync('vite.config.ts', 'utf8')
const ruleOf = (path: string) =>
  VITE.match(new RegExp(`if \\(id\\.includes\\('${path.replace(/\//g, '\\/')}'\\)\\) return '([^']+)'`))?.[1]
const APPROVAL = readFileSync('src/shared/seller-approval.ts', 'utf8')

describe('seller-approval 은 공용 묶음에 산다', () => {
  it('manualChunks 가 app-shared 로 보낸다', () => {
    const m = VITE.match(/if \(id\.includes\('\/src\/shared\/seller-approval'\)\) return '([^']+)'/)
    expect(m, 'seller-approval 규칙이 사라졌다 — catch-all 이 어디로 보낼지 모른다').not.toBeNull()
    expect(m![1]).toBe('app-shared')
  })
  it('seller-approval 은 아무것도 import 하지 않는다(app-shared 가 남을 끌고 오지 않게)', () => {
    expect(APPROVAL).not.toMatch(/^\s*import\s/m)
  })
  it('마이 안내문은 여전히 그 상수를 공용 모듈에서 읽는다(사본을 만들지 않는다)', () => {
    const note = readFileSync('src/pages/user-profile/seller-section/store-status-note.ts', 'utf8')
    expect(note).toMatch(/import \{ SELLER_STATUS_KEY \} from '@\/shared\/seller-approval'/)
    expect(note).not.toMatch(/SELLER_STATUS_KEY\s*=/)
  })
})

/**
 * 📜 같은 클래스 둘째(2026-10-19): 약관 버전 상수 `pages/terms/terms-types`(import 0)에 규칙이 없어 Rollup 이
 *   판매자 가입 화면과 함께 `app-seller-components` 에 넣었다 → 에이전시 콘솔(매장 등록 카드)이 상수 하나 때문에
 *   판매자 대시보드 봉투 + 그 의존 전부를 받았다. dash:agency 294.5 → 180.3.
 * 🔁 셋째: 어드민 활동 피드의 `CheckCircle2`(= lucide `circle-check`)는 이용권 상세 봉투(lz-gbDetail)에 사는 아이콘이라
 *   어드민 첫 화면이 그 봉투를 받았다 → 이미 받는 `CheckCircle`(= `circle-check-big`)로. dash:admin 292.9 → 274.0.
 */
describe('작은 상수 모듈이 큰 봉투를 끌지 않는다', () => {
  it('terms-types 는 app-shared 로 간다', () => {
    expect(ruleOf('/src/pages/terms/terms-types')).toBe('app-shared')
  })
  it('terms-types 는 아무것도 import 하지 않는다', () => {
    expect(readFileSync('src/pages/terms/terms-types.ts', 'utf8')).not.toMatch(/^\s*import\s/m)
  })
  it('어드민 활동 피드는 circle-check(CheckCircle2) 를 쓰지 않는다', () => {
    const src = readFileSync('src/pages/admin-page/AdminActivityFeed.tsx', 'utf8')
    const names = [...src.matchAll(/import\s+\{([^}]*)\}\s*from\s*'lucide-react'/g)].flatMap(m => m[1].split(',').map(x => x.trim()))
    expect(names).not.toContain('CheckCircle2')
    expect(names).not.toContain('CircleCheck')
  })
})
