/**
 * 🪑 마이 안 판매 — 좌석 불변식 (2026-09-25, 설계 §15-2 · §15-3 · §14 단계 1)
 *
 * ## 이 테스트가 막는 사고
 * 1. **`switch-to-seller` 사각지대** — 그 길은 `sellers.linked_user_id`(UNIQUE 1인 1행) 한 행만 본다.
 *    `POST /store/new` 는 설계상 그 칸을 **비우고** 권한을 `seller_operators` 로만 주므로
 *    라이브 좌석 9개가 그 길에서는 **안 보인다.** 새 판매 화면이 그 길을 쓰면 자기 가게가 있는
 *    사장님에게 "내 가게 등록" 을 권하게 된다.
 * 2. **좌석 토큰 ↔ 인라인 작업 충돌** — 좌석 토큰은 JWT 안에 `seller_id` 가 박혀 있어 가게를 바꾸면
 *    토큰이 통째로 바뀐다. 셀러 대시보드는 전환 후 **하드 리로드**로 그 틈을 없앴지만, 마이는
 *    리로드를 못 한다(그러면 인라인이 아니다). 그래서 세대(generation)가 리로드를 대신한다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 실제 브라우저에서 시트가 정말 닫히는지(jsdom 은 레이아웃·사용자 입력을 재현하지 않는다).
 * - 서버 권한 판정. 그건 `canOperateStore` 와 `seller-operators-invariants.test.ts` 의 몫이다.
 * - 단계 2 이후 추가될 **새 작업 버튼**이 `assertSeat` 을 부르는지 — 그 버튼이 생길 때
 *   이 파일에 한 줄을 더해야 한다(지금은 작업 버튼이 없다).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const SEAT = readCode('src/lib/seller-seat.ts')
const HOOK = readCode('src/pages/user-profile/useMyStores.ts')
const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const SHEET = readCode('src/pages/user-profile/StoreSwitchSheet.tsx')
const CHIP = readCode('src/pages/user-profile/SellerSwitchInline.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')
const WORK = readCode('src/pages/user-profile/seller-section/useSellerWork.ts')
const ORDERS_UI = readCode('src/pages/user-profile/seller-section/PendingOrders.tsx')
// 🔁 2026-09-26 (§21): `SellingList`(인라인 판매 중 목록)는 **삭제됐다** — 같은 목록이 카드와
//   이용권 묶음 두 곳에 있으면 반드시 갈린다. 현황은 묶음 안에서 본다(할 일만 카드에 남는다).
const VOUCHER_SHEET = readCode('src/pages/user-profile/seller-section/VoucherSheet.tsx')
const VOUCHER_EDIT = readCode('src/pages/user-profile/seller-section/VoucherEditSheet.tsx')
const SCAN = readCode('src/pages/StoreScanPage.tsx')

/** base64url 로 JWT 흉내 — 한글 매장 이름 포함(그게 순진한 atob 을 깨뜨린다). */
function fakeSeatToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `head.${b64}.sig`
}

describe('좌석 모듈 — 토큰이 어느 가게인지 (동작)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('토큰이 없으면 null', async () => {
    const m = await import('@/lib/seller-seat')
    expect(m.currentSeatId()).toBeNull()
  })

  it('한글 매장 이름이 들어간 토큰도 좌석 id 를 읽는다', async () => {
    localStorage.setItem('seller_token', fakeSeatToken({ seller_id: 42, name: '돈까스연구소', type: 'seller' }))
    const m = await import('@/lib/seller-seat')
    expect(m.currentSeatId()).toBe(42)
  })

  it('망가진 토큰은 던지지 않고 null', async () => {
    localStorage.setItem('seller_token', 'not-a-jwt')
    const m = await import('@/lib/seller-seat')
    expect(() => m.currentSeatId()).not.toThrow()
    expect(m.currentSeatId()).toBeNull()
  })

  it('assertSeat 은 화면이 든 가게와 토큰이 다르면 던진다 — 호출부는 보내면 안 된다', async () => {
    localStorage.setItem('seller_token', fakeSeatToken({ seller_id: 7 }))
    const m = await import('@/lib/seller-seat')
    expect(() => m.assertSeat(7)).not.toThrow()
    expect(() => m.assertSeat(8)).toThrow(/SEAT_MISMATCH/)
  })

  it('세대가 오르면 구독자 전부가 통보받는다 (리로드를 대신하는 장치)', async () => {
    const m = await import('@/lib/seller-seat')
    const seen: number[] = []
    const off1 = m.onSeatChange(() => seen.push(1))
    m.onSeatChange(() => { throw new Error('한 구독자가 터져도') })
    const off2 = m.onSeatChange(() => seen.push(2))
    const before = m.seatGeneration()
    m.bumpSeatGeneration()
    expect(m.seatGeneration()).toBe(before + 1)
    expect(seen).toEqual([1, 2])
    off1(); off2()
    m.bumpSeatGeneration()
    expect(seen).toEqual([1, 2])
  })
})

describe('좌석 출처 — 옛 길(switch-to-seller)을 쓰지 않는다 (§15-2)', () => {
  it('마이 판매 화면 어디에도 switch-to-seller 호출이 없다', () => {
    for (const [name, code] of [['seat', SEAT], ['hook', HOOK], ['section', SECTION], ['sheet', SHEET], ['chip', CHIP]] as const) {
      expect(stripComments(code), `${name}: switch-to-seller 는 linked_user_id 한 행만 본다 — 좌석 9개가 안 보인다`)
        .not.toContain("api.post('/api/seller/switch-to-seller')")
    }
  })

  it('좌석 목록은 /my-stores 계열에서 온다', () => {
    expect(stripComments(HOOK)).toContain("'/api/seller/my-stores/summary'")
    expect(stripComments(SHEET)).toContain("'/api/seller/my-stores'")
  })

  it('칩은 좌석이 있으면 사라진다 — 같은 화면에 진입점이 둘이면 갈린다', () => {
    const code = stripComments(CHIP)
    expect(code).toContain('if (hasSeat) return null')
    // 그리고 좌석이 있을 땐 옛 상태 API 를 아예 묻지 않는다.
    expect(code).toMatch(/if \(!seatsResolved \|\| hasSeat\) return\b/)
  })

  it('좌석은 페이지가 한 번만 묻는다 — 부품이 각자 부르지 않는다', () => {
    expect(stripComments(PAGE)).toContain('const sellerSeats = useMyStores()')
    for (const [name, code] of [['section', SECTION], ['chip', CHIP]] as const) {
      expect(stripComments(code), `${name} 가 직접 useMyStores() 를 부르면 같은 화면이 두 답을 말한다`)
        .not.toMatch(/\buseMyStores\s*\(/)
    }
  })
})

describe('좌석 전환 — 리로드 없이 옛 가게 데이터를 버린다 (§15-3)', () => {
  it('전환은 mint SSOT(enterStoreSeat)를 거치고 세대를 올린다', () => {
    const code = stripComments(SEAT)
    // ⚠️ 정적 import 면 안 된다 — enter-store 는 첫 페인트 밖 청크라 홈이 통째로 받게 된다.
    expect(code).toContain("await import('../utils/enter-store')")
    expect(code).not.toMatch(/^import \{[^}]*enterStoreSeat/m)
    expect(code, '토큰을 여기서 또 발급하면 mint 가 두 벌이 된다').not.toContain('/token`')
    const fn = code.slice(code.indexOf('export async function switchSeat'))
    expect(fn).toContain('enterStoreSeat(sellerId)')
    expect(fn).toContain('bumpSeatGeneration()')
  })

  it('데이터 훅이 세대를 구독해 다시 부른다 — 이게 하드 리로드를 대신한다', () => {
    const code = stripComments(HOOK)
    expect(code).toContain('onSeatChange')
    expect(code).toMatch(/onSeatChange\(\(\) => \{?\s*load\(\)/)
  })

  it('시트는 전환 뒤 스스로 닫는다 (열린 시트가 옛 가게를 가리키지 않게)', () => {
    const fn = stripComments(SHEET)
    const pick = fn.slice(fn.indexOf('async function pick'))
    expect(pick).toContain('switchSeat(')
    expect(pick).toContain('onClose()')
  })

  it('전환 실패는 조용히 성공으로 넘어가지 않는다', () => {
    const fn = stripComments(SHEET)
    const pick = fn.slice(fn.indexOf('async function pick'))
    expect(pick).toMatch(/if \(!ok\)/)
  })
})

describe('권한 근거는 토큰뿐 (§15-3 규칙 ③)', () => {
  it('판매 화면이 localStorage/URL 의 seller_id 를 읽어 쓰지 않는다', () => {
    for (const [name, code] of [['section', SECTION], ['sheet', SHEET], ['hook', HOOK]] as const) {
      expect(stripComments(code), `${name}: 좌석 id 의 진실은 토큰이다`)
        .not.toContain("localStorage.getItem('seller_id')")
    }
  })

  // 🩸 이 시험의 앵커는 두 번 재조준됐다(09-25 단계 2, 09-26 §20). 두 번 다 **지키려던 것은 그대로**이고
  //   앵커로 쓴 문자열(`enterSeat('/seller')` · `assign(to)`)이 *우연한* 것이었다 — 전자는 전체 도구가
  //   마이 안 시트가 되며 사라졌고, 후자는 귀환 표시를 감싸며 모양이 바뀌었다.
  //   ⇒ 이제 **불변식 자체**에 앵커한다: 좌석이 이미 맞으면 토큰을 다시 발급하지 않는다.
  it('셀러 화면 진입은 좌석이 맞을 때 발급조차 안 한다', () => {
    const code = stripComments(SECTION)
    // 단락 평가 — 왼쪽이 참이면 `switchSeat` 을 아예 안 부른다.
    expect(code).toMatch(/currentSeatId\(\) === store\.seller_id \|\| await switchSeat\(/)
    expect(code).toMatch(/window\.location\.assign\(/)
  })
})

describe('단계 2 — 일감은 좌석에 앉아야 그리고, 보내기 전에 다시 확인한다', () => {
  it('좌석은 **토큰**에서 읽는다 — 서버 current_seller_id 는 재조회 뒤에야 따라온다', () => {
    const code = stripComments(SECTION)
    expect(code).toContain('useSyncExternalStore(onSeatChange, currentSeatId')
    expect(code).toMatch(/const seated = store != null && seatId === store\.seller_id/)
  })

  it('일감 블록은 seated 일 때만 그린다', () => {
    const code = stripComments(SECTION)
    const at = code.indexOf('{seated ? (')
    expect(at, 'seated 분기가 없으면 좌석 없는 사람에게 빈 목록을 그린다').toBeGreaterThan(0)
    const branch = code.slice(at, at + 600)
    expect(branch).toContain('<PendingOrders')
  })

  it('목록도 좌석이 맞을 때만 부른다', () => {
    const code = stripComments(WORK)
    expect(code).toMatch(/if \(!enabled \|\| currentSeatId\(\) !== sellerId\)/)
  })

  it('🔴 모든 쓰기가 guarded(assertSeat) 를 지난다', () => {
    const code = stripComments(WORK)
    expect(code).toContain('assertSeat(sellerId)')
    for (const fn of ['confirmOrder', 'toggleProduct']) {
      const at = code.indexOf(`const ${fn} = useCallback(`)
      expect(at, `${fn} 이 없다 — 앵커가 낡았다`).toBeGreaterThan(0)
      expect(code.slice(at, at + 80), `${fn} 이 guarded 를 안 지나면 옛 가게로 나간다`).toContain('guarded(')
    }
  })

  it('낙관적 갱신을 하지 않는다 — 서버가 거절하면 화면도 안 바뀐다', () => {
    const code = stripComments(WORK)
    expect(code).toMatch(/if \(!r\.data\?\.success\) return false[\s\S]{0,200}setOrders\(/)
    expect(code).toMatch(/if \(!r\.data\?\.success\) return false[\s\S]{0,240}setProducts\(/)
  })

  it('환불·삭제·출금은 여기 없다 — 한 손으로 할 일이 아니다(§14 선별 표)', () => {
    // 🔁 2026-09-26: `selling` 자리를 이용권 묶음 둘로 옮겼다(그 화면이 목록·토글을 이어받았다).
    //   ⚠️ 판정은 그대로다 — **삭제**는 어디에도 없다. 환불·출금은 §19 로 마이에 들어왔지만
    //   전용 시트가 맡으므로 이 넷에는 여전히 없어야 한다(섞이면 한 손 실수가 돈을 움직인다).
    for (const [name, code] of [['work', WORK], ['orders', ORDERS_UI], ['voucherSheet', VOUCHER_SHEET], ['voucherEdit', VOUCHER_EDIT]] as const) {
      const stripped = stripComments(code)
      expect(stripped, `${name}: 삭제는 되돌릴 수 없다 — 끄는 것(HIDDEN)이어야 한다`).not.toMatch(/\/refund|DELETED'\s*\}|api\.delete\(/)
      expect(stripped, `${name}: 출금은 전용 시트가 맡는다`).not.toMatch(/withdraw/)
    }
  })

  it('끄는 것은 숨김이지 삭제가 아니다 — 되돌릴 수 있어야 한 손으로 준다', () => {
    const code = stripComments(WORK)
    expect(code).toContain("status: next ? 'ACTIVE' : 'HIDDEN'")
    expect(code).toContain('is_active: next')
  })

  it('주문 확인은 PREPARING 전이 — 대시보드 칩과 같은 동작', () => {
    expect(stripComments(WORK)).toContain("{ status: 'PREPARING' }")
  })
})

describe('단계 3 — 소각은 되돌릴 수 없다', () => {
  it('사용처리는 **먼저 그 가게 좌석에 앉힌 뒤** 보낸다', () => {
    const code = stripComments(SECTION)
    expect(code, '좌석을 안 맞추고 보내면 화면엔 A 가 떠 있는데 B 의 이용권이 소각된다')
      .toContain("enterSeat('/store/scan')")
  })

  it('계산대가 되돌릴 수 없음을 **먼저** 말한다', () => {
    const code = stripComments(SCAN)
    expect(code).toContain('바로 사용 완료')
    expect(code).toContain('되돌릴 수 없습니다')
  })

  it('계산대가 어느 가게로 처리되는지 말한다 — 값은 표시 전용', () => {
    const code = stripComments(SCAN)
    expect(code).toContain('currentSeatLabel()')
    expect(code).toContain('이용권만 처리됩니다')
  })

  it('검은 계산대 카드는 좌석 섹션이 못 뜰 때만 남는다(진입점 둘 금지)', () => {
    const code = stripComments(PAGE)
    expect(code).toMatch(/localStorage\.getItem\('seller_token'\) && sellerSeats\.stores\.length === 0/)
  })
})

describe('오늘 카드 경로는 보기만 — 돈이 움직이지 않는다', () => {
  /**
   * 🔁 2026-09-25 재조준(§19): 대표가 *"등록·환불·분석·출금도 마이에서"* 로 확정하며 섹션에
   *   판매 시트 넷이 붙었다. 지키려던 것은 **"섹션·좌석 경로가 직접 돈을 움직이지 않는다"** 이지
   *   "마이에 쓰기가 없다" 가 아니었다 — 쓰기는 **각 시트가 자기 API 하나만** 부른다.
   */
  it('섹션·좌석 경로는 스스로 쓰기 API 를 부르지 않는다 — 부르는 건 시트다', () => {
    for (const [name, code] of [['section', SECTION], ['switch-sheet', SHEET], ['hook', HOOK]] as const) {
      const stripped = stripComments(code)
      expect(stripped, `${name}: 여기서 직접 쓰면 시트와 두 벌이 된다`).not.toMatch(/api\.(put|patch|delete)\(/)
      expect(stripped, `${name}: POST 는 좌석 발급(enterStoreSeat)만이다`).not.toMatch(/api\.post\(/)
    }
  })

  it('불러오기 실패를 0 으로 위장하지 않는다', () => {
    const code = stripComments(SECTION)
    expect(code).toMatch(/if \(loading \|\| failed \|\| !store\) return null/)
  })
})
