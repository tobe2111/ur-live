/**
 * ⚡ 첫 화면 데이터 요청은 **다음 task 로 밀리지 않는다** (2026-10-06)
 *
 * 대표: *"마이 페이지에 로딩 속도? … **내 가게** 이 부분이 가장 늦게 떠."*
 * 이어서: *"근본적인 문제를 모두 해결해줘. 다른 페이지들도 그런 경우가 많아."*
 *
 * ## 무엇이 틀렸나 — 실측
 * 마이 첫 화면의 요청 여덟 중 **둘만** 한 박자 늦게 나갔다:
 *
 *     +564~571ms  wishlists · vouchers/my · coupons/my · notification-prefs · promo-bar · version
 *     +836ms      points/balance          ← 늦음
 *     +842ms      seller/my-stores/summary ← 늦음 (좌석)
 *     +893ms      seller/orders            ← 좌석을 기다리는 2단이라 지연을 **상속**
 *
 * 그 둘만 `import('@/lib/api').then(...)` 을 거쳤다. 원인은 모듈 *다운로드*가 아니다
 * (`app-utils` 는 엔트리가 이미 preload 한다) — `import()` 의 프로미스가 **다음 task 에서**
 * 풀리고 그 사이 React 가 렌더를 돌기 때문에 **첫 묶음을 놓친다.**
 *
 * 정적으로 바꾼 뒤: 여덟 전부 `+496~506ms` · 주문 `+714ms`.
 *
 * 🩸 **같은 자리에서 한 번 오진했다**: 전에 `import('@/lib/api')` 31곳을 병목으로 의심했다가
 *   "간격 10ms" 로 기각했다. 그때 잰 것은 *import 자체의 비용*이었고, 진짜 비용은
 *   **형제 요청들보다 늦게 출발한다**는 것이었다 — 재는 대상을 틀리면 결론이 뒤집힌다.
 *
 * ## 🔑 동적 import 가 **맞는** 자리는 그대로 둔다
 * 시트(`WithdrawSheet`·`BankSheet`·`PinSheet`·`StoreSwitchSheet`)는 **사람이 열 때** 마운트되므로
 * 놓칠 첫 묶음이 없다. 이 시험은 *첫 화면*(마운트 즉시 도는 데이터)만 고정한다.
 *
 * ## 이 시험이 못 막는 것
 * - 몇 ms 빨라지는지 (그건 `scripts/visual-preview.mjs --trace-api` 로 사람이 본다)
 * - 마이 밖의 화면 — 목록이 곧 범위다
 * - `api` 를 거치지 않는 생 `fetch`
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../helpers/source-text'

const ROOT = path.resolve(__dirname, '../../..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

/** 마이 첫 화면에서 **마운트 즉시** 데이터를 부르는 모듈 */
const FIRST_SCREEN = [
  'src/pages/user-profile/useMyStores.ts',
  'src/pages/user-profile/MyStats.tsx',
  'src/pages/user-profile/seller-section/useSellerWork.ts',
  'src/pages/user-profile/SellerSwitchInline.tsx',
]

/** 사람이 열 때만 마운트 — 동적 import 가 맞다(되돌림 방지용 반대 방향 고정) */
const ON_DEMAND = [
  'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
  'src/pages/user-profile/seller-section/BankSheet.tsx',
  'src/pages/user-profile/seller-section/PinSheet.tsx',
  'src/pages/user-profile/StoreSwitchSheet.tsx',
]

describe('⚡ 마이 첫 화면 — api 를 정적으로 쓴다', () => {
  it('검사 대상이 비어 있지 않다 (경로가 낡으면 통과가 아니라 실패다)', () => {
    expect(FIRST_SCREEN.length).toBeGreaterThanOrEqual(4)
    for (const f of FIRST_SCREEN) {
      expect(fs.existsSync(path.join(ROOT, f)), `${f} 이 없다 — 경로가 낡았다`).toBe(true)
    }
  })

  it.each(FIRST_SCREEN)('%s — 동적 import 로 요청을 미루지 않는다', (f) => {
    const src = stripComments(read(f))
    expect(src, `${f}: import('@/lib/api') 가 남아 있다 — 이 요청만 첫 묶음을 놓친다`)
      .not.toContain("import('@/lib/api')")
  })

  it.each(FIRST_SCREEN)('%s — `api` 를 정적으로 들여온다', (f) => {
    const src = stripComments(read(f))
    expect(src, `${f}: 정적 import 가 없다`).toMatch(/^import api from '@\/lib\/api'$/m)
  })

  it('좌석 조회는 정적 api 로 바로 부른다 (요청 한 줄을 앵커로 고정)', () => {
    const src = stripComments(read('src/pages/user-profile/useMyStores.ts'))
    expect(src).toMatch(/api\.get\('\/api\/seller\/my-stores\/summary'\)/)
  })

  it('좌석에 매달린 2단(주문)도 정적 api 로 부른다', () => {
    const src = stripComments(read('src/pages/user-profile/seller-section/useSellerWork.ts'))
    expect(src).toMatch(/api\.get\('\/api\/seller\/orders\?limit=50&sort=desc'\)/)
  })

  /**
   * 🩸 첫 판은 `toContain("import('@/lib/api')")` 였는데 **헛돌았다** — 시트엔 동적 import 가
   *   둘(읽기·쓰기)이라 하나를 지워도 통과했다(주입이 잡았다). 지키려던 것은
   *   *"시트를 정적으로 끌어올리지 않는다"* 이므로 **정적 import 의 부재**로 재조준했다.
   */
  it.each(ON_DEMAND)('%s — 열 때만 뜨는 시트는 api 를 정적으로 끌어올리지 않는다', (f) => {
    const src = stripComments(read(f))
    expect(src, `${f}: 시트까지 정적으로 바꿀 이유가 없다(첫 화면이 아니라 놓칠 묶음이 없다)`)
      .not.toMatch(/^import api from '@\/lib\/api'$/m)
    expect(src, `${f}: 동적 import 가 통째로 사라졌다 — 그러면 api 를 어디서 얻는지 불분명하다`)
      .toContain("import('@/lib/api')")
  })
})
