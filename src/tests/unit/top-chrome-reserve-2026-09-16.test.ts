/**
 * 🧷 교환권 상단 두 블록의 **자리 예약이 진짜 블록을 따라가는가** (2026-09-16)
 *
 * 종전엔 손으로 박은 숫자(`h-[50px]`·`h-[113px]`)였다. 2026-09-02 에 칩이 흰 알약+그림자로
 * 바뀌었는데 숫자가 안 따라와 **6px·4px 씩 모자랐고**, 그 모자람은 에러가 아니라
 * *첫 방문자 화면이 교체 순간 10px 내려앉는 것*으로만 나타났다(실측: 첫 사진 y 348 → 358).
 *
 * ⇒ 예약을 **진짜 블록과 같은 클래스**로 세워 높이가 같은 CSS 에서 나오게 했다.
 *
 * ## 이 시험이 **못** 하는 것
 * jsdom 엔 레이아웃이 없어 "높이가 같은가" 를 여기서 못 잰다. 그래서 *치수를 정하는 클래스가
 * 같은지*만 대조하고, 실제 밀림은 브라우저 프레임 캡처가 판정한다(핸드오프에 명령 기재).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/VouchersPage.tsx')
const RESERVE = readCode('src/pages/vouchers/TopChromeReserve.tsx')
const SHARED = readCode('src/pages/vouchers/shared.tsx')

describe('① 마법의 숫자가 아니라 마크업으로 예약한다', () => {
  it('페이지에 손으로 박은 예약 높이가 없다', () => {
    // 종전 두 값. 다시 들어오면 같은 드리프트가 재발한다.
    expect(PAGE).not.toMatch(/h-\[50px\]/)
    expect(PAGE).not.toMatch(/h-\[113px\]/)
  })

  it('두 예약 컴포넌트를 실제로 렌더한다(배선)', () => {
    expect(PAGE).toMatch(/<ChipRowReserve\s*\/>/)
    expect(PAGE).toMatch(/<BrandStripReserve\b/)
    expect(PAGE).toMatch(/from '\.\/vouchers\/TopChromeReserve'/)
  })

  it('예약은 블록이 비었고 아직 안 왔을 때만 뜬다', () => {
    // 도착 뒤에도 남으면 빈 자리가 영구히 생긴다.
    expect(PAGE).toMatch(/sections\.length === 0 && !sectionsReady && <ChipRowReserve/)
    expect(PAGE).toMatch(/currentBrands\.length === 0 && !sectionsReady && <BrandStripReserve/)
  })
})

describe('② 치수를 정하는 클래스가 진짜 블록과 같다', () => {
  it('칩 줄: 바깥 패딩과 알약 치수', () => {
    // 진짜 블록(VouchersPage)과 예약(TopChromeReserve)이 같은 토큰을 쓴다.
    for (const cls of ['ur-content-wide px-4 lg:px-8 py-2.5', 'h-9 pl-3 pr-3.5', 'text-[13px] font-bold']) {
      expect(PAGE, `real chip: ${cls}`).toContain(cls)
      expect(RESERVE, `reserve chip: ${cls}`).toContain(cls)
    }
  })

  it('브랜드 줄: 바깥 패딩 · 헤더 · 로고 줄', () => {
    for (const cls of [
      'ur-content-wide px-4 lg:px-8 pt-1.5 pb-3', // 바깥 패딩
      'flex items-center justify-between mb-1.5', // 헤더 줄
      'text-[12px] font-bold',                     // 헤더 글자 크기
      'w-3.5 h-3.5',                               // ChevronDown
      'flex gap-2.5 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1', // 로고 줄
    ]) {
      expect(PAGE, `real brand: ${cls}`).toContain(cls)
      expect(RESERVE, `reserve brand: ${cls}`).toContain(cls)
    }
  })

  it('로고 타일은 BrandChip 과 같은 치수', () => {
    // 로고 줄 높이는 BrandChip 이 정한다 — 타일 48 + gap-1 + 10px 라벨.
    for (const cls of ['flex flex-col items-center gap-1', 'w-12 h-12 rounded-2xl', 'text-[10px]']) {
      expect(SHARED, `BrandChip: ${cls}`).toContain(cls)
      expect(RESERVE, `reserve tile: ${cls}`).toContain(cls)
    }
  })
})

describe('③ 자리만 잡고 아무것도 보이지 않는다', () => {
  it('두 예약 다 invisible + aria-hidden', () => {
    expect(RESERVE.match(/invisible/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(RESERVE.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('접힘 상태를 따라간다 — 로고 줄은 open 일 때만', () => {
    // 접힌 채로 예약만 펴면 반대 방향으로 같은 크기의 밀림이 난다.
    expect(RESERVE).toMatch(/\{open && \(/)
    expect(PAGE).toMatch(/<BrandStripReserve open=\{brandsOpen\}/)
  })
})
