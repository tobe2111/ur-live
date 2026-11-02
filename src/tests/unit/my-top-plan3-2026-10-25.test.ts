/**
 * 📋 마이 **위쪽 안 3** (2026-10-25 대표 확정 — *"위쪽 안 3 으로 하되, 곧 쓸 이용권은 빼주고"*)
 *
 * 지키는 것:
 *   ① 폰 위쪽은 **목록 판 하나**다 — 내 딜 · 이용권 · 쿠폰이 **같은 판 안에 이 순서로**(세 칸 숫자 줄이 아니다)
 *   ② **곧 쓸 이용권 카드는 위쪽에 없다**(대표가 뺐다) — 폰 위쪽 구역에서 그 카드를 그리지 않는다
 *   ③ 줄의 값에는 단위가 붙는다(`111,500딜`) — 칸이 아니라 줄이라 잘릴 폭이 없다
 *   ④ 환급 줄은 **무엇을 돌려받는지** 말한다 — `충전 딜 환급`(대표 *"환급은 뭐야? 정산이야?"*). 정산(가게 입금)과 다른 일이다
 *   ⑤ 손님 쪽 판은 **이 하나뿐**이다 — 표면 규칙 ⑦(*판은 파는 쪽에만*)의 대표 승인 예외가 번지지 않게
 *   ⑥ 머리줄: 아바타 48 · 이름 아래 `프로필 편집 ›` · 벨은 회색 원 없이
 *
 * ⚠️ 못 보는 것: 390px 에서 실제로 예쁜지(그려서 본다 — `node scripts/visual-preview.mjs --route=/user/profile`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (f: string) => stripComments(readFileSync(f, 'utf8'))
const STATS = read('src/pages/user-profile/MyStats.tsx')
const PAGE = read('src/pages/UserProfilePage.tsx')
const phone = STATS.slice(STATS.indexOf('const rowCls ='))

describe('마이 위쪽 안 3', () => {
  it('① 폰 위쪽은 목록 판 하나 — 내 딜 · 이용권 · 쿠폰이 같은 판 안에 순서대로', () => {
    expect(phone.length, '폰 경로를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(800)
    const plate = phone.indexOf('rounded-2xl bg-surface shadow-lift')
    const d = phone.indexOf("row('내 딜'"), v = phone.indexOf("row('이용권'"), c = phone.indexOf("row('쿠폰'")
    expect(plate, '목록 판이 없다').toBeGreaterThan(-1)
    expect(d > plate && v > d && c > v, '세 줄이 판 안에 순서대로 있지 않다').toBe(true)
    expect(phone, '폰이 다시 세 칸 숫자 줄로 돌아갔다').not.toContain('{cells}')
  })

  it('② 곧 쓸 이용권 카드는 위쪽에 없다 (대표가 뺐다)', () => {
    expect(STATS).not.toMatch(/곧 쓸 이용권/)
    const top = PAGE.slice(PAGE.indexOf('<MyStats '), PAGE.indexOf("<div className={sellerSeats.stores.length > 0 ? 'ur-account-cols"))
    expect(top.length, '위쪽 구역을 못 찾았다').toBeGreaterThan(10)
    expect(top, '위쪽에 곧 쓸 이용권이 들어왔다').not.toMatch(/곧 쓸|UpcomingVoucher|NextVoucher/)
  })

  it('③ 줄의 값에는 단위가 붙는다', () => {
    expect(phone).toContain("row('내 딜', DEAL_PATH, balance, '딜')")
    expect(phone).toContain("row('이용권', '/my-vouchers', voucher, '장')")
    expect(phone).toContain("row('쿠폰', '/my-coupons', coupon, '장')")
    expect(phone).toMatch(/\{unit\}/)
  })

  // 🔁 2026-11-02 재조준 — 대표 *"충전 딜 환급 … 아예 없애달라는 뜻이야"*: 위쪽 판은 세 줄(내 딜·이용권·쿠폰)뿐이다.
  it('④ 위쪽 판에 환급 줄이 없다 (대표 2026-11-02)', () => {
    expect(phone, '환급 줄이 다시 생겼다').not.toMatch(/충전 딜|setRefundOpen/)
    expect((phone.match(/\{row\('/g) ?? []).length, '위쪽 판의 줄이 세 개가 아니다').toBe(3)
  })

  it('⑤ 손님 쪽 판은 이 하나뿐이다 (예외가 번지지 않는다)', () => {
    expect((STATS.match(/shadow-lift/g) ?? []).length, 'MyStats 안의 판이 하나가 아니다').toBe(1)
    for (const f of ['ShoppingGroup', 'SettingsGroup', 'RoleCtaGrid']) {
      expect(read(`src/pages/user-profile/${f}.tsx`), `${f} 에 판이 생겼다`).not.toMatch(/shadow-lift/)
    }
  })

  it('⑥ 머리줄 — 아바타 48 · 이름 아래 프로필 편집 · 회색 원 없는 벨', () => {
    expect(PAGE).toMatch(/w-12 h-12 rounded-full flex-shrink-0 \$\{profileAvatarFitCls/)
    expect(PAGE).toMatch(/mt-1 text-\[13px\][^"]*">\{t\('userProfile\.editProfile'/)
    const bell = PAGE.slice(PAGE.indexOf('onClick={bell.open}') - 10, PAGE.indexOf('onClick={bell.open}') + 300)
    expect(bell, '벨이 회색 원으로 돌아갔다').not.toMatch(/bg-gray-100/)
    expect(bell).toContain('<BellIcon')
  })
})
