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
    const src = readCode(GB)
    const bar = src.slice(src.indexOf("aria-label=\"결제 영역\""))
    expect(bar.length, '결제 바 앵커가 낡았다').toBeGreaterThan(200)
    expect(bar, '결제 바가 다시 할인액을 말한다 — 위 가격 블록이 이미 말한다').not.toContain('할인 중')
  })

  /**
   * 🩸 앵커 교훈(2026-09-15): 처음엔 `formatNumber(unitPrice)` 를 파일 처음부터 찾았는데,
   *   그 문자열은 **카카오 공유 문구**에 먼저 나온다. 그래서 가격 블록이 아니라 공유 텍스트를
   *   검사하고 있었다(헬퍼가 경고한 "앵커를 안 잡으면 남의 코드를 검사한다"). 블록부터 앵커한다.
   */
  const priceBlock = () => {
    const src = readCode(GB)
    const at = src.indexOf("style={{ padding: '12px 18px 16px' }}")
    expect(at, '모바일 가격 블록 앵커가 낡았다').toBeGreaterThan(0)
    const end = src.indexOf('결제 즉시 교환권 발급', at)
    expect(end, '가격 블록 끝 앵커가 낡았다').toBeGreaterThan(at)
    return src.slice(at, end)
  }

  it('가격이 세로 위계다 — 정가·할인율이 먼저, 판매가가 더 크다', () => {
    const block = priceBlock()
    expect(block.indexOf('formatNumber(refPrice)'), '정가가 판매가 뒤로 갔다 — 한 줄 배치로 되돌아갔다')
      .toBeLessThan(block.indexOf('formatNumber(unitPrice)'))
    const sizeNear = (needle: string) => {
      const i = block.indexOf(needle)
      expect(i, needle + ' 를 가격 블록에서 못 찾았다').toBeGreaterThan(-1)
      const hits = [...block.slice(0, i).matchAll(/fontSize:\s*([\d.]+)/g)].map((m) => Number(m[1]))
      return hits[hits.length - 1]
    }
    expect(sizeNear('formatNumber(unitPrice)'), '판매가가 정가보다 크지 않다')
      .toBeGreaterThan(sizeNear('formatNumber(refPrice)'))
  })

  it('할인율이 --sale 이다 (상세만 쓰던 --gbd-danger 로 되돌아가지 않았다)', () => {
    const block = priceBlock()
    const line = block.split('\n').find((l) => l.includes('{displayDiscountPct}%'))
    expect(line, '가격 블록에서 할인율 렌더 줄을 못 찾았다 — 셀렉터가 낡았다').toBeTruthy()
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
    expect(loc, '매장 위치 카드에 테두리가 되살아났다').not.toMatch(/border:\s*'1px solid/)
    expect(loc, '전화 버튼이 사라졌다 — 전화번호가 갈 곳이 없어진다').toContain('`tel:${phone}`')
  })
})

describe('지갑 안 E — 급한 한 장만 펴고 나머지는 한 줄', () => {
  it('사용 가능 목록이 첫 장만 티켓, 나머지는 WalletRow 다', () => {
    const src = readCode(WALLET)
    expect(src, '목록이 다시 전부 펼친 티켓이 됐다').toMatch(/shown\[0\]/)
    expect(src, '접힌 줄(WalletRow)이 사라졌다').toMatch(/<WalletRow\b/)
    expect(src, '나머지를 slice(1) 로 넘기지 않는다 — 첫 장이 두 번 나온다')
      .toMatch(/shown\.slice\(1\)/)
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
    expect(row, '임박 판정이 사라졌다').toMatch(/d\s*<=\s*2/)
    expect(row, '임박 강조가 사라졌거나 툴킷 색으로 돌아갔다').toContain('text-tone-bad')
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
