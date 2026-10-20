/**
 * 🧬 주입 — **마이 상단 카운트 ↔ 지갑 "사용 가능" 불일치** (2026-10-07 대표 신고)
 *
 * 되돌리면 전부 **조용히** 틀린 숫자를 보여 준다. 에러가 안 나고 숫자가 그럴듯해서,
 * 눌러 들어가 본 사람만 안다 — 대표가 오늘 그렇게 발견했다(*"2개라고 해서 들어갔더니 없어"*).
 */
const WALLET = 'src/shared/voucher-wallet.ts'
const COUNT = 'src/pages/user-profile/useMyCounts.ts'
const VPAGE = 'src/pages/MyVouchersPage.tsx'
const GPAGE = 'src/pages/MyGifticonsPage.tsx'
const T = 'src/tests/unit/voucher-count-matches-wallet-2026-10-07.test.ts'

export default [
  {
    name: '이용권카운트 — 상태를 안 보고 전부 센다 (종전 동작)',
    file: COUNT,
    find: '    voucher: vouchers ? vouchers.filter(v => isStoreVoucher(v) && isUsableWalletItem(v)).length : null,',
    replace: '    voucher: vouchers ? vouchers.filter(isStoreVoucher).length : null,',
    test: T,
    why:
      '정확히 종전 코드다. 이미 다 쓴 이용권까지 세므로 상단은 `2`, 눌러 들어간 지갑은 `0장` 이다. ' +
      '2026-05-27 에 같은 자리에서 난 사고(카운트 ↔ 목록 불일치)의 재발이다.',
  },
  {
    name: '이용권카운트 — 교환권도 상태를 안 본다',
    file: COUNT,
    find: '    gifticon: vouchers ? vouchers.filter(v => isGifticonVoucher(v) && isUsableWalletItem(v)).length : null,',
    replace: '    gifticon: vouchers ? vouchers.filter(v => isGifticonVoucher(v)).length : null,',
    test: T,
    why:
      '대표 화면에선 교환권이 0 이라 안 드러났을 뿐, **같은 결함**이다. 한쪽만 고치면 ' +
      '다음 사람은 교환권에서 똑같이 밟는다.',
  },
  {
    name: '이용권카운트 — 발송 실패분을 "쓸 수 있다" 로 센다',
    file: WALLET,
    find: '  if (isFailedGifticon(v)) return false',
    replace: '  // (실패분도 센다)',
    test: T,
    why:
      '문자조차 못 받은 교환권을 "사용 가능" 으로 세면 **결제됐는데 안 온 것**을 가진 사람에게 ' +
      '"쓸 수 있다" 고 말하는 셈이다(2026-09-04 대표 결정으로 빼기로 한 바로 그것).',
  },
  {
    name: '이용권카운트 — 지갑이 술어를 손으로 다시 적는다',
    file: VPAGE,
    find: '  const unusedItems = shownVouchers.filter(isUsableWalletItem)',
    replace: "  const unusedItems = shownVouchers.filter(v => v.status === 'unused')",
    test: T,
    why:
      '값이 같아 보여도 두 벌이 되는 순간 갈린다 — 실패분 제외 규칙이 한쪽에만 들어가면 ' +
      '상단과 지갑이 또 다른 숫자를 말한다. 이 사고의 근원이 정확히 그 복제였다.',
  },
  {
    name: '이용권카운트 — 교환권 지갑도 따로 적는다',
    file: GPAGE,
    find: '  const usable = owned.filter(isUsableWalletItem)',
    replace: "  const usable = owned.filter(v => v.status === 'unused')",
    test: T,
    why: '위와 같은 이유. 세 곳(카운트·이용권 지갑·교환권 지갑)이 같은 함수를 봐야 한다.',
  },
]
