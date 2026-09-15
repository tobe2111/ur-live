/**
 * 🧺 장바구니 — **스위치 둘이 어긋나면 막다른 길이 된다** (2026-09-15)
 *
 * ## 실제로 라이브에 나갔던 결함
 * 담기 버튼을 서버 게이트와 묶지 않고 내보냈다. 게이트가 꺼진 라이브에서:
 *   담기 → 성공(`cart_items` 에 남는다) → 결제 → **403 "장바구니 결제는 아직 준비 중입니다"**
 * 초대해 놓고 못 사게 하는 화면이다. 로컬에서 머지된 코드를 실제로 띄워 스크린샷으로 발견했다
 * (유닛·가드·CI 전부 초록이었다 — 어느 검사도 "버튼이 보이는데 결제가 막힌다"를 묻지 않았다).
 *
 * ## 이 시험이 지키는 것
 * ① 담기 버튼이 UI 플래그 뒤에 있다 ② 기본값이 꺼짐 ③ 서버 게이트는 그대로(보안 경계)
 * ④ 켜는 절차가 **두 스위치를 같이** 말한다(문서) — 하나만 켜면 다시 막다른 길이다.
 *
 * ## 못 막는 것
 * 두 스위치를 실제로 같이 켰는지. 그건 배포 시점의 사람 일이라 문서로만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const FLAGS = readFileSync('src/shared/feature-flags.ts', 'utf-8')
const BAR = stripComments(readFileSync('src/pages/group-buy/DealBottomBar.tsx', 'utf-8'))
const ROUTES = stripComments(readFileSync('src/features/group-buy/api/cart-checkout.routes.ts', 'utf-8'))
const CHECKLIST = readFileSync('docs/STAGING_CHECKLIST.md', 'utf-8')
const DAILY = stripComments(readFileSync('src/worker/cron/scheduled-cleanup-daily.ts', 'utf-8'))
const INTENT = stripComments(readFileSync('src/features/group-buy/api/cart-intent.ts', 'utf-8'))

describe('① 담기 진입점은 플래그 뒤에 있다', () => {
  it('DealBottomBar 가 VOUCHER_CART_UI_ENABLED 로 show 를 막는다', () => {
    expect(BAR).toMatch(/show=\{VOUCHER_CART_UI_ENABLED\s*&&/)
    expect(BAR).toMatch(/import \{ VOUCHER_CART_UI_ENABLED \} from '@\/shared\/feature-flags'/)
  })
  it('기본값은 꺼짐 — staging 실결제 전에 켜지지 않는다', () => {
    expect(stripComments(FLAGS)).toMatch(/export const VOUCHER_CART_UI_ENABLED = false/)
  })
})

describe('② 서버 게이트는 여전히 진짜 경계다 (UI 플래그가 대신하지 않는다)', () => {
  // 🔑 UI 를 숨기는 것은 편의다. API 를 직접 치는 사람은 화면을 안 본다.
  it('두 엔드포인트 모두 cartEnabled 를 본다', () => {
    expect((ROUTES.match(/if \(!await cartEnabled\(DB\)\) return c\.json\(GATE_OFF, 403\)/g) || []).length).toBe(2)
  })
  it('게이트 조회 실패는 꺼진 것으로 본다 (머니 경로 fail-closed)', () => {
    expect(ROUTES).toMatch(/catch \{ return false \}/)
  })
})

describe('③ 켜는 절차가 두 스위치를 같이 말한다', () => {
  it('플래그 주석이 서버 키와의 짝을 명시한다', () => {
    expect(FLAGS).toContain('voucher_cart_enabled')
    expect(FLAGS).toMatch(/스위치가 둘이다/)
  })
  it('체크리스트가 두 스위치를 같이 켜라고 적는다', () => {
    const at = CHECKLIST.indexOf('S-CART')
    expect(at, 'S-CART 절을 못 찾았다 — 체크리스트가 낡았다').toBeGreaterThan(-1)
    const sec = CHECKLIST.slice(at, at + 4000)
    expect(sec).toContain('VOUCHER_CART_UI_ENABLED')
    expect(sec).toContain('voucher_cart_enabled')
  })
})

describe('④ 남은 의사 기록을 실제로 치우는 사람이 있다', () => {
  /**
   * 🩸 헬퍼는 있는데 **호출부가 0** 이었다. 결제창에서 이탈한 행은 `consumed_at` 이 안 찍히고
   * 아무도 안 지운다 — 게이트를 켜는 날부터 조용히 쌓인다. "있다"와 "돈다"는 다른 일이다.
   */
  it('일 1회 청소가 purgeStaleCartIntents 를 **부른다**', () => {
    // ⚠️ 이름만 찾으면 헛돈다 — 호출을 지워도 `import { purgeStaleCartIntents }` 줄에 이름이 남는다.
    //    (같은 함정을 오늘 이미 한 번 밟았다.) 그래서 **호출 형태**를 앵커로 쓴다.
    expect(DAILY).toMatch(/await purgeStaleCartIntents\(DB\)/)
    expect(DAILY).toMatch(/results\.cart_intents_purged = n/)
  })
  it('그 함수가 실제로 오래된 행을 지운다 (이름만 있는 게 아니다)', () => {
    expect(INTENT).toMatch(/DELETE FROM gb_cart_intents WHERE created_at </)
  })
})
