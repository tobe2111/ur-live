/**
 * 🎨 이용권 상세 "안 B" · 지갑 "안 E" (2026-09-15 대표 확정)
 *
 * ## 무엇을 보고 정했나
 * 대표: *"이용권페이지가 너무 AI로 만든 것 같아"* → 라이브 `/group-buy/2888`(홍대돈까스)을
 * 실제 데이터로 렌더해 재 봤더니, 문제는 모양보다 **내용**이었다:
 *
 *   ① 같은 할인을 한 화면에서 **세 번** 말했다 — `34%` · `25,000원` 취소선 · 하단 바 `8,500원 할인 중`
 *   ② "딜 안내" 세 줄이 `['즉시 교환권 발급', '전 지점 사용', …]` **하드코딩**이라 상품과 무관하게 늘 같았고,
 *      그중 **"전 지점 사용"은 거짓**이었다(2888 은 전주 단일 매장). 지어낸 문장은 디자인이 아니라 **분쟁**이다.
 *   ③ 그 세 줄이 말하는 것을 아래 `UsageGuide`(이용 안내)가 **이미** 말하고 있었다(중복 렌더).
 *   ④ 섹션 사이 8px 회색 띠가 4개 — 표면 규칙은 "표면 두 톤"인데 띠가 세 번째 톤이었다.
 *   ⑤ 할인율만 `--gbd-danger`(#F23E4D) — 2026-09-07 대표가 확정한 SSOT 는 `--sale` 이고,
 *      목록 10곳은 이미 `--sale` 이라 **같은 상품이 목록과 상세에서 다른 빨강**이었다.
 *
 * 지갑(`/my-vouchers`)은 가진 이용권을 **전부 펼친 티켓**으로 그렸다 — 8장이면 훑는 데만 네 번 스크롤.
 * 대표가 시안 5개 중 **안 E(컴팩트)** 를 골랐다: 가장 급한 한 장만 펴고 나머지는 한 줄씩.
 *
 * ## 이 테스트가 **못 보는 것** (과신 금지)
 * - 실제 렌더 결과·간격·대비. 클래스 문자열로만 본다. 새 회귀를 **다른 이름**으로 만들면 못 잡는다.
 * - 라이브 DB 의 상품 데이터(`voucher_expiry` 가 비어 있으면 화면이 무엇으로 폴백하는지).
 * - 지갑 다크 렌더. 대비는 CI 의 contrast 워크플로가 실제 렌더로 잰다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

const GB = 'src/pages/GroupBuyDetailPage.tsx'
const WALLET = 'src/pages/MyVouchersPage.tsx'
const WALLET_FILES = [
  'src/pages/MyVouchersPage.tsx',
  'src/pages/my-vouchers/VoucherTicket.tsx',
  'src/pages/my-vouchers/WalletHeader.tsx',
  'src/pages/my-vouchers/WalletArchive.tsx',
  'src/pages/my-vouchers/WalletEmpty.tsx',
  'src/pages/my-vouchers/WalletRow.tsx',
  'src/pages/my-vouchers/QRModal.tsx',
  'src/pages/my-vouchers/VoucherMap.tsx',
  'src/pages/my-vouchers/ReviewBonusButton.tsx',
]

describe('상세 안 B — 지어낸 문장이 돌아오지 않았다', () => {
  it('"전 지점 사용" 하드코딩이 없다 (단일 매장에 거짓말하던 그 줄)', () => {
    expect(readCode(GB), '고정 문구가 되살아났다 — 상품과 무관하게 "전 지점 사용"이 나간다')
      .not.toContain('전 지점 사용')
  })

  it('이용권 정보 섹션이 실제 스펙표(UsageGuide)를 그린다', () => {
    const src = readCode(GB)
    const at = src.indexOf('id="gb-sec-info"')
    expect(at, '섹션 앵커를 못 찾았다 — 상단 탭이 스크롤할 곳이 사라졌다').toBeGreaterThan(0)
    // 섹션 안쪽만 본다(파일 전체를 보면 import 줄에 걸려 늘 통과한다).
    const section = src.slice(at, src.indexOf('DealMenuList', at))
    expect(section, '이용권 정보 자리에 스펙표가 없다').toMatch(/<UsageGuide\b/)
  })

  it('UsageGuide 를 두 번 그리지 않는다 (위로 올리면서 아래 것을 지웠다)', () => {
    const renders = readCode(GB).match(/<UsageGuide\b/g) || []
    expect(renders.length, '이용 안내가 한 페이지에 두 번 렌더된다').toBe(1)
  })
})

describe('상세 안 B — 같은 할인을 세 번 말하지 않는다', () => {
  it('하단 결제 바에 "할인 중" 문구가 없다', () => {
    // 🔀 2026-09-15 머지: main 이 같은 날 하단 바를 `DealBottomBar` 부품으로 분리했다(로직 불변).
    //   검사 대상이 페이지가 아니라 그 부품으로 옮겨진다 — 페이지만 보면 이 가드는 조용히 통과한다.
    const bar = readCode('src/pages/group-buy/DealBottomBar.tsx')
    expect(bar.length, '결제 바 부품을 못 읽었다 — 경로가 낡았다').toBeGreaterThan(500)
    expect(bar, '결제 바가 다시 할인액을 말한다 — 위 가격 블록이 이미 말한다').not.toContain('할인 중')
    // 페이지 쪽에도 되살아나지 않았는지 함께 본다(분리 이전 형태로의 회귀 차단).
    expect(readCode(GB), '페이지가 다시 자체 결제 바를 그린다').not.toContain('할인 중')
  })

  /**
   * 🩸 앵커 교훈(2026-09-15): 처음엔 `formatNumber(unitPrice)` 를 파일 처음부터 찾았는데,
   *   그 문자열은 **카카오 공유 문구**에 먼저 나온다. 그래서 가격 블록이 아니라 공유 텍스트를
   *   검사하고 있었다(헬퍼가 경고한 "앵커를 안 잡으면 남의 코드를 검사한다"). 블록부터 앵커한다.
   */
  // 🔁 2026-10-11 (대표 확정 "D안"): 모바일 가격이 머리 카드(`PassHeadCard`)로 옮겨가 **한 줄**
  //   [할인율 · 판매가 · 정가 취소선] 이 됐다. 지키려던 것은 그대로 — **살 금액이 가장 크다** ·
  //   할인율은 `--sale` · 정가는 취소선.
  // 🔁 2026-10-24 (대표 승인 "그루폰식"): 가격 줄이 머리에서 '옵션 선택' 카드(`PassOptionCard`)로 옮겨갔다.
  //   지키는 것은 그대로 — 판매가가 가장 크다 · 할인율은 --sale · 정가는 취소선.
  // 🔁 2026-10-25 (대표 확정 D안 "이용권 상세는 D"): 큰 가격이 다시 머리(`PassHeadCard`)로 — 정가 취소선 위,
  //   그 아래 [할인율 · 판매가]. 옵션 카드엔 작은 옵션 값만 남는다. 지키는 것은 그대로.
  const priceBlock = () => {
    const src = readCode('src/pages/group-buy/PassHeadCard.tsx')
    const start = src.indexOf('{unitPrice != null && unitPrice > 0 && (')
    expect(start, '가격 줄 시작 앵커가 낡았다').toBeGreaterThan(0)
    return src.slice(start, src.indexOf('\n      )}', start))
  }
  const sizeOf = (block: string, needle: string) => {
    const line = block.split('\n').find((l) => l.includes(needle))
    expect(line, needle + ' 를 가격 줄에서 못 찾았다').toBeTruthy()
    return Number(/text-\[(\d+)px\]/.exec(line!)![1])
  }

  it('판매가가 가장 크다 — 할인율·정가보다', () => {
    const block = priceBlock()
    expect(sizeOf(block, 'formatNumber(unitPrice)'), '판매가가 정가보다 크지 않다')
      .toBeGreaterThan(sizeOf(block, 'formatNumber(refPrice)'))
    expect(sizeOf(block, 'formatNumber(unitPrice)'), '판매가가 할인율보다 크지 않다')
      .toBeGreaterThan(sizeOf(block, '{discountPct}%'))
    expect(block.split('\n').find((l) => l.includes('formatNumber(refPrice)'))!, '정가에 취소선이 없다').toContain('line-through')
  })

  it('할인율이 --sale 이다 (상세만 쓰던 --gbd-danger 로 되돌아가지 않았다)', () => {
    const block = priceBlock()
    const line = block.split('\n').find((l) => l.includes('{discountPct}%</span>'))
    expect(line, '가격 줄에서 할인율 렌더 줄을 못 찾았다 — 셀렉터가 낡았다').toBeTruthy()
    expect(line!, line!.trim().slice(0, 90)).toContain('var(--sale)')
    expect(line!, '상세 전용 빨강이 되살아났다').not.toContain('--gbd-danger')
  })
})

describe('상세 안 B — 표면이 두 톤이다', () => {
  it('8px 회색 띠가 없다 (구분선으로 바뀌었다)', () => {
    expect(readCode(GB), '섹션 사이 회색 띠가 되살아났다 — 면이 세 톤이 된다')
      .not.toMatch(/height:\s*8,\s*background:\s*'var\(--gbd-bg\)'/)
  })

  it('매장 위치가 테두리 없는 카드이고 전화 버튼을 갖는다', () => {
    const src = readCode(GB)
    expect(src, '매장 위치가 StoreLocation 위임에서 인라인으로 되돌아갔다').toMatch(/<StoreLocation\b/)
    const loc = readCode('src/pages/group-buy/StoreLocation.tsx')
    // ⚠️ 파일 전체에서 `border:` 를 금지하면 안 된다 — **outline 버튼**은 테두리가 정상이고
    //   (main 이 같은 날 `--rule-strong` 으로 통일했다), 그렇게 짜면 정상 코드가 빨간불이 난다.
    //   지키려는 것은 **지도 블록에 경계가 없다**(안 3) 하나다.
    // 🔀 처음엔 "들림(--lift)이 있어야 한다"고 썼다가 뺐다 — main 이 같은 날 확정한 안 3 은
    //   카드가 아니라 **경계 없는 블록**이고, 내 안 B 시안의 매장 위치도 같은 그림이었다.
    //   두 승인이 어긋나지 않으므로 여기서 들림을 요구하면 내가 내 결정을 되돌리는 셈이 된다.
    //   블록 자체의 모양(경계 0)은 `gb-detail-borders-2026-09-15.test.ts` ①이 정본으로 지킨다.
    const block = loc.split('\n').find((l) => l.includes('borderRadius: 14') && l.includes('overflow'))
    expect(block, '매장 위치 지도 블록 줄을 못 찾았다 — 앵커가 낡았다').toBeTruthy()
    expect(block!, '매장 위치 지도에 테두리가 되살아났다').not.toMatch(/border:\s*'1px solid/)
    expect(loc, '전화 버튼이 사라졌다 — 전화번호가 갈 곳이 없어진다').toContain('`tel:${phone}`')
  })
})

describe('지갑 안 E — 급한 한 장만 펴고 나머지는 한 줄', () => {
  // 🔀 2026-10-14 대표 확정 안 B 가 안 E 의 '첫 장만 펼친 티켓'을 대체했다 — 같은 물건이 첫 장만 다르게 보였다.
  //   불변식은 "사용 가능 목록은 펼친 티켓이 아니라 줄" 로 넓어졌다(첫 장도 포함).
  it('사용 가능 목록은 전부 같은 한 줄(WalletRow)이다 — 첫 장만 펼친 티켓으로 되돌아가지 않는다', () => {
    const src = readCode(WALLET)
    expect(src, '모든 이용권을 줄로 그리지 않는다').toMatch(/shown\.map\(v => <WalletRow\b/)
    expect(src, '첫 장만 펼친 티켓이 되돌아왔다').not.toMatch(/shown\[0\]/)
  })

  it('접힌 줄을 누르면 같은 QR 모달이 열린다 (접기이지 삭제가 아니다)', () => {
    const src = readCode(WALLET)
    const row = sliceFrom(src, '<WalletRow', '/>', 400)
    expect(row, 'WalletRow 앵커가 낡았다').toContain('onOpen')
    expect(row, '줄을 눌러도 아무 일이 안 일어난다').toContain('setQrVoucher(v)')
    // 🩸 되돌려-검증이 잡은 것(2026-09-15): 여기까지만 보면 **호출부만** 검사한다.
    //   부품 안에서 `onClick={() => {}}` 로 바꿔도 초록이었다 — 줄을 눌러도 아무 일이 안 나는데.
    //   빈 핸들러는 콘솔에도 안 남으므로 부품 쪽 배선을 함께 못 박는다.
    const comp = readCode('src/pages/my-vouchers/WalletRow.tsx')
    expect(comp, 'WalletRow 가 onOpen 을 클릭에 배선하지 않는다 — 줄이 죽은 버튼이 된다')
      .toMatch(/onClick=\{onOpen\}/)
  })

  it('임박(D-2 이하)을 체계 빨강으로 말한다', () => {
    const row = readCode('src/pages/my-vouchers/WalletRow.tsx')
    // 🦦 2026-10-09: 기준값을 `URGENT_DAYS` 상수로 뺐다(지갑 위 만료 임박 줄과 같은 값을 쓰게) — 값은 그대로 2.
    expect(row, '임박 판정이 사라졌다').toMatch(/d\s*<=\s*URGENT_DAYS/)
    expect(row, '임박 기준이 2일이 아니다').toMatch(/export const URGENT_DAYS = 2\b/)
    expect(row, '임박 강조가 사라졌거나 툴킷 색으로 돌아갔다').toContain('text-tone-bad')
  })

  it('접힌 줄 오른쪽은 남은 기간이다 — 장별 가격을 다시 말하지 않는다 (2026-10-07 대표 확정)', () => {
    const row = readCode('src/pages/my-vouchers/WalletRow.tsx')
    expect(row, '남은 기간(D-N) 표시가 사라졌다').toMatch(/`D-\$\{d\}`/)
    expect(row, '줄에 장별 가격이 되돌아왔다 — 금액은 머리글 합계 한 번').not.toMatch(/applied_price|product_price|formatNumber/)
  })
})

describe('지갑 — 툴킷 기본색·회색 테두리 상자가 없다', () => {
  it.each(WALLET_FILES)('%s 가 툴킷 기본색을 직접 적지 않는다', (p) => {
    const src = readCode(p)
    for (const hex of ['#DC2626', '#16A34A', '#141414', '#0F0F0F', '#6B7280']) {
      expect(src, `${p} 에 ${hex} 가 되살아났다 — 체계 토큰(--tone-*, --surface)을 쓸 것`)
        .not.toContain(hex)
    }
  })

  it.each(WALLET_FILES)('%s 에 회색 테두리 상자가 없다', (p) => {
    expect(readCode(p), `${p} 에 border-gray-200 상자가 되살아났다 — 표면 규칙 ① "카드 테두리 0"`)
      .not.toContain('border-gray-200')
  })
})
