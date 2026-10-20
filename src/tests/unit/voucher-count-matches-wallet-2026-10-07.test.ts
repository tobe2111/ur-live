/**
 * 🎟️ **마이 상단 카운트 = 지갑의 "사용 가능"** — 같은 술어를 쓴다.
 *
 * ## 왜 생겼나 (2026-10-07 대표 신고 — *"이용권 2개라고 해서 들어갔더니 없어"*)
 * 마이 상단은 `이용권 2`, 눌러 들어간 지갑은 `사용 가능 0장`. **둘 다 맞는 숫자인데 세는 집합이
 * 달랐다** — 상단은 `isStoreVoucher` 로 **전부**(이미 다 쓴 것까지) 셌고, 지갑 첫 탭은
 * `status === 'unused'` 만 센다. 대표 화면의 `이용권 현황` 이 그대로 말해 줬다:
 * *구매완료 2 · 사용가능 0 · 사용완료 2*.
 *
 * 🩸 **같은 자리 두 번째다.** 2026-05-27 에 *"/user/profile 카운트 ↔ /my-vouchers 목록 불일치"*
 * 사고가 나 잠금표에 올랐고 처방은 *"같은 훅을 쓰라"* 였다. 훅은 같았는데 **기준이 달라** 또 났다.
 * ⇒ 처방을 한 칸 내린다: **같은 훅으로 부족하고 같은 술어를 써야 한다.**
 *
 * ## ❌ 이 시험이 못 보는 것
 * - 서버가 `status` 를 무엇으로 주는지(여기서는 그 값을 신뢰한다).
 * - 상단 줄의 **뜻**이 "쓸 수 있는 것" 이 맞는지 — 그건 제품 판단이고, 대표가 그렇게 읽었다.
 */
import { describe, it, expect } from 'vitest'
import { isUsableWalletItem, isStoreVoucher, isGifticonVoucher } from '@/shared/voucher-wallet'
import { readCode } from '../helpers/source-text'

// 대표 계정의 실제 모양 — 이용권 2장이 **둘 다 사용 완료**.
const DAEPYO = [
  { id: 1, status: 'used', source: null, deal_only: 0 },
  { id: 2, status: 'used', source: null, deal_only: 0 },
]

describe('이용권 카운트 ↔ 지갑 (2026-10-07)', () => {
  it('⓪ 측정기 자기검사 — 픽스처가 정말 이용권이다', () => {
    expect(DAEPYO.every(isStoreVoucher)).toBe(true)
    expect(DAEPYO.some(isGifticonVoucher)).toBe(false)
  })

  it('① 대표 사례 — 다 쓴 2장은 "사용 가능" 에서 0 이다', () => {
    expect(DAEPYO.filter(isUsableWalletItem)).toHaveLength(0)
  })

  it('② 안 쓴 것만 센다', () => {
    const mixed = [...DAEPYO, { id: 3, status: 'unused', source: null, deal_only: 0 }]
    expect(mixed.filter(isUsableWalletItem)).toHaveLength(1)
  })

  it('③ 발송 실패한 교환권은 "사용 가능" 이 아니다 (2026-09-04 대표 결정 승계)', () => {
    const failed = { id: 4, status: 'unused', source: 'kt_alpha', kt_status: 'failed' }
    expect(isGifticonVoucher(failed)).toBe(true)
    expect(isUsableWalletItem(failed)).toBe(false)
  })

  it('④ 카운트와 지갑 둘이 **같은 함수**를 쓴다 (손으로 적으면 또 갈린다)', () => {
    const count = readCode('src/pages/user-profile/useMyCounts.ts')
    // 🩸 첫 판은 `toContain('isUsableWalletItem')` + 이용권 줄만 봤다. 그래서 **교환권 줄만**
    //   종전으로 되돌려도 통과했다(주입 러너가 잡았다). ⇒ **두 줄 각각**을 앵커한다.
    expect(count).toMatch(/voucher:[\s\S]{0,140}isUsableWalletItem/)
    expect(count).toMatch(/gifticon:[\s\S]{0,140}isUsableWalletItem/)
    // 종전처럼 상태를 안 보고 전부 세면 안 된다.
    expect(count).not.toMatch(/filter\(isStoreVoucher\)/)
    expect(count).not.toMatch(/filter\(v => isGifticonVoucher\(v\)\)/)

    for (const f of ['src/pages/MyVouchersPage.tsx', 'src/pages/MyGifticonsPage.tsx']) {
      const w = readCode(f)
      expect(w).toContain('isUsableWalletItem')
      // 술어를 그 자리에 다시 적는 것이 이 사고의 근원이었다.
      expect(w).not.toMatch(/status === 'unused'/)
    }
  })
})
