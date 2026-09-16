/**
 * 🎟️ 지갑 분리 불변식 (2026-08-31 — 대표 "교환권은 교환권 페이지에서, 이용권은 이용권 페이지에서")
 *
 * 교환권(문자로 오는 기프티콘)과 이용권(매장 QR/PIN)은 **사는 곳도 쓰는 법도 다른데** 한 지갑에
 * 세그먼트 탭으로 얹혀 있었다. 페이지를 둘로 나눈 뒤 무너지기 쉬운 것은 세 가지다:
 *   ① 판정이 두 벌이 되는 것(한쪽은 source, 다른 쪽은 카테고리로 나누기 시작하는 것)
 *   ② 산 뒤 도착지가 옛 지갑으로 되돌아가는 것 — 화면은 멀쩡하고 "산 게 없다"만 남아 조용히 새는 사고
 *   ③ 카탈로그(`/vouchers`)에서 보관함으로 가는 길이 사라지는 것 — 그러면 산 사람이 영영 못 찾는다
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 실제 렌더 결과(리스트에 무엇이 그려지는지)와 서버 응답의 형태.
 *   필터 함수와 배선(어느 함수를 쓰는가·어디로 보내는가)만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { isGifticonVoucher, isStoreVoucher } from '@/shared/voucher-wallet'
import { FLOW_CONFIG } from '@/shared/product-flow'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 판정 — 어느 보관함 것인지는 한 함수만 정한다', () => {
  it('KT 문자 발송분(source=kt_alpha)은 교환권', () => {
    expect(isGifticonVoucher({ source: 'kt_alpha' })).toBe(true)
  })
  it('딜 전용 상품(deal_only=1) 발급분도 교환권 — 결제흐름 SSOT 와 같은 기준', () => {
    expect(isGifticonVoucher({ source: 'internal', deal_only: 1 })).toBe(true)
  })
  it('매장 이용권(internal, deal_only 없음)은 교환권이 아니다', () => {
    expect(isGifticonVoucher({ source: 'internal' })).toBe(false)
    expect(isGifticonVoucher({ source: 'internal', deal_only: 0 })).toBe(false)
  })
  it('deal_only 를 안 주는 폴백 응답에서도 source 만으로 판정된다', () => {
    expect(isGifticonVoucher({ source: 'kt_alpha', deal_only: undefined })).toBe(true)
    expect(isGifticonVoucher({ source: 'internal', deal_only: undefined })).toBe(false)
  })
  it('두 지갑은 정확한 분할 — 어느 발급분도 양쪽에 걸치거나 어디에도 안 속하지 않는다', () => {
    const rows = [
      { source: 'kt_alpha' }, { source: 'internal' },
      { source: 'internal', deal_only: 1 }, {}, { source: null, deal_only: '1' },
    ]
    for (const r of rows) expect(isGifticonVoucher(r) === isStoreVoucher(r)).toBe(false)
  })
})

describe('② 산 뒤 도착지 — 교환권은 교환권 보관함으로', () => {
  it('결제흐름 SSOT 의 voucher_deal 성공 경로가 /my-gifticons', () => {
    expect(FLOW_CONFIG.voucher_deal.successPath).toBe('/my-gifticons')
  })
  it('딜 교환 성공 직후 이동이 옛 이용권 지갑으로 돌아가 있지 않다', () => {
    for (const p of ['src/pages/VoucherDetailPage.tsx', 'src/pages/GroupBuyDetailPage.tsx', 'src/pages/ProductDetailPage.tsx']) {
      const src = strip(read(p))
      // 교환권 발급(딜) 직후의 navigate 는 전부 교환권 보관함이어야 한다.
      const afterInvalidate = src.match(/invalidateVouchers\(\)\s*\n\s*navigate\('([^']+)'\)/g) ?? []
      expect(afterInvalidate.length, `${p}: 딜 발급 후 navigate 를 못 찾음(리팩토링됐으면 이 테스트도 함께 고칠 것)`).toBeGreaterThan(0)
      for (const m of afterInvalidate) expect(m, p).toContain('/my-gifticons')
    }
  })
  it('KT 발송 완료·실패 알림도 교환권 보관함으로 보낸다', () => {
    const src = read('src/worker/utils/kt-alpha-auto-send.ts')
    expect(src).toContain("'/my-gifticons'")
    expect(src).not.toContain("'/my-vouchers'")
  })
})

describe('③ 배선 — 두 페이지가 서로의 것을 담지 않는다', () => {
  const wallet = strip(read('src/pages/MyVouchersPage.tsx'))
  const gifts = strip(read('src/pages/MyGifticonsPage.tsx'))

  it('이용권 지갑은 isStoreVoucher 로 거른다', () => {
    expect(wallet).toMatch(/vouchers\.filter\(isStoreVoucher\)/)
  })
  it('교환권 보관함은 isGifticonVoucher 로 거른다', () => {
    expect(gifts).toMatch(/\.filter\(isGifticonVoucher\)/)
  })
  it('이용권 지갑에 교환권 세그먼트 탭이 다시 생기지 않는다', () => {
    expect(wallet).not.toMatch(/sourceTab|tabGifticon/)
  })
  it('이용권 지갑에는 교환권이 링크로도 들어가지 않는다', () => {
    /**
     * 대표 2026-08-31: *"이용권 페이지에 교환권이 들어있으면 안 되지 — 교환권은 교환권 페이지에만."*
     * 처음엔 "내 교환권 N장 ›" 다리를 놓았는데, 그것도 이용권 화면에 교환권이 있는 것으로 읽힌다.
     * 교환권으로 가는 길은 하단 '교환권' 탭 → 보관함, 그리고 마이페이지 행이 담당한다.
     */
    expect(wallet).not.toContain('/my-gifticons')
    // 반대 방향도 같은 경계다 — 교환권 보관함의 뒤로가기는 교환권 카탈로그로 돌아간다(이용권 지갑이 아니라).
    expect(gifts).toMatch(/onBack=\{\(\) => navigate\('\/vouchers'\)\}/)
  })
  it('두 페이지 어디서도 kt_alpha 를 직접 비교하지 않는다(판정 SSOT 우회 금지)', () => {
    expect(wallet).not.toContain('kt_alpha')
    expect(gifts).not.toContain('kt_alpha')
  })
  it('카탈로그(/vouchers)에서 보관함으로 가는 길이 있다 — 모바일 헤더 + PC 레일', () => {
    // 진입점은 파일 크기 래칫 때문에 컴포넌트로 분리돼 있다. 목적지와 배선을 함께 본다.
    expect(strip(read('src/pages/vouchers/GifticonBoxEntry.tsx'))).toContain("navigate('/my-gifticons')")
    const page = strip(read('src/pages/VouchersPage.tsx'))
    expect(page).toMatch(/<VouchersTopBar\b/)          // 모바일: 상단 바가 [보관함][검색] 을 싣는다
    expect(strip(read('src/pages/vouchers/VouchersTopBar.tsx'))).toMatch(/<VoucherHeaderActions\b/)
    expect(page).toMatch(/<GifticonBoxRailRow\b/)      // PC: 좌 레일 행
  })
  it('라우트가 등록돼 있고 몰 슬러그로 선점되지 않는다', () => {
    expect(strip(read('src/App.tsx'))).toContain('path="/my-gifticons"')
    expect(read('src/shared/mall/slug.ts')).toContain("'my-gifticons'")
  })
})

describe('④ 다크 모드 — 지갑 배경을 인라인으로 칠하지 않는다', () => {
  /**
   * 2026-08-31 시안 캡처 중 실측으로 잡은 결함: 라이트 지갑 래퍼가 배경/글자색을 **인라인 스타일**로
   * 칠하는데 내용은 전부 `dark:` variant 를 갖고 있어, 다크 모드에서 **흰 배경 + 흰 글자**가 됐다
   * (제목 "내 이용권"/"내 교환권" 과 섹션 라벨이 통째로 안 보였다 — 실측 h1 rgb(255,255,255) on rgb(255,255,255)).
   * 인라인 스타일이라 클래스 기반인 `check-theme-consistency` 의 사각지대였다.
   */
  const atoms = read('src/components/wallet/WalletAtoms.tsx')
  /**
   * 🔀 2026-09-15 재조준 (색 정리 — 표면 토큰 채택).
   *
   * 종전엔 `bg-[#F8F7FC] dark:bg-[#11141C]` 라는 **그 hex 짝 그대로**를 찾았는데, 같은 값을 담은
   * 토큰 `bg-warm`(= `var(--bg)`)으로 접히면서 정상인데 빨간불이 됐다.
   *
   * 🔑 그래서 **판정 기준을 hex 에서 불변식 자체로 옮긴다.** 이 시험이 지키려던 것은
   * "저 두 hex 가 적혀 있다" 가 아니라 **"라이트 지갑의 배경을 인라인으로 칠하지 않는다"** 이고,
   * 토큰 쪽이 그 불변식을 더 강하게 만족한다(클래스 하나가 두 테마를 다 안다).
   * ⇒ 아래 ②가 진짜 불변식이고 ①은 그 짝의 보조다. hex 를 되돌려도 ①은 통과하므로 ②가 본체다.
   */
  const lightStart = atoms.indexOf("if (theme === 'light')")
  const light = atoms.slice(lightStart, atoms.indexOf('return (', atoms.indexOf('}', atoms.indexOf('</div>', lightStart))))

  it('앵커가 살아 있다 — 라이트 분기를 실제로 잘랐는가', () => {
    // 0건을 통과로 착각하지 않기 위한 자기검증(이 레포가 반복해 당한 "헛도는 가드").
    expect(lightStart, 'WalletPageWrapper 의 라이트 분기를 못 찾았다').toBeGreaterThan(-1)
    expect(light).toContain('className=')
    expect(light.length).toBeLessThan(600)
  })

  it('① 라이트 지갑 래퍼의 배경이 테마를 아는 클래스다', () => {
    // `bg-warm`(토큰) 또는 종전의 hex 짝 — 둘 다 라이트 #F8F7FC / 다크 #11141C 로 같은 값이다.
    expect(light).toMatch(/\bbg-warm\b|bg-\[#F8F7FC\] dark:bg-\[#11141C\]/)
  })

  it('② 라이트 지갑 래퍼가 배경을 인라인으로 칠하지 않는다 (진짜 불변식)', () => {
    expect(light, [
      '인라인 배경은 다크 토글을 안 따라간다 — 2026-08-31 에 흰 배경 + 흰 글자가 된 원인이 정확히 이것이다.',
      '(클래스 기반인 check-theme-consistency 의 사각지대라 가드도 못 잡는다.)',
    ].join('\n')).not.toMatch(/style=\{\{[^}]*\bbackground/)
  })

  it('③ 라이트 지갑 래퍼가 다크 글자색 클래스를 갖는다', () => {
    expect(light).toMatch(/text-gray-900 dark:text-white/)
  })
})
