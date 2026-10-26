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
    expect(PAGE).toMatch(/currentBrands\.length === 0 && !sectionsReady && !!category && <BrandStripReserve/)
  })
})

describe('② 치수를 정하는 클래스가 진짜 블록과 같다', () => {
  it('칩 줄: 바깥 패딩과 알약 치수', () => {
    // 진짜 블록(VouchersPage)과 예약(TopChromeReserve)이 같은 토큰을 쓴다.
    // 🔀 2026-09-30: 잠금표 이행으로 공통 토큰이 4px 격자로 옮겨졌다(`py-2.5`→`py-2` · `pr-3.5`→`pr-4`).
    //    불변식은 그대로 — **두 파일이 같은 토큰을 쓴다**. 값만 현재 것으로.
    // 🏋️ 2026-10-25: 굵기 체계(13px 은 medium)로 칩 굵기도 옮겨졌다 — 불변식 그대로, 값만.
    // 🗂️ 2026-10-25 D안: 알약 칩 → 밑줄 탭. 이제 두 파일이 토큰을 손으로 적지 않고 **같은 상수**를 쓴다 —
    //    불변식(같은 치수)이 글자 대조에서 import 대조로 강해졌다.
    for (const k of ['VOUCHER_CAT_TAB.wrap', 'VOUCHER_CAT_TAB.row', 'VOUCHER_CAT_TAB.tab', 'VOUCHER_CAT_TAB.on']) {
      expect(PAGE, `real chip: ${k}`).toContain(k)
      expect(RESERVE, `reserve chip: ${k}`).toContain(k)
    }
  })

  // 🔄 2026-10-14: '브랜드로 찾기' 헤더 줄이 사라졌다(대표 지시) — 예약에도 헤더가 없어야 한다(있으면 그 높이만큼 밀린다).
  it('브랜드 줄: 바깥 패딩 · 로고 줄 (헤더 줄 없음)', () => {
    expect(RESERVE, '헤더 줄이 예약에 남지 않는다').not.toMatch(/브랜드로 찾기|justify-between mb-2/)
    for (const cls of [
      'ur-content-wide px-5 lg:px-8 pt-2 pb-3',   // 바깥 패딩 (2026-09-30: pt-1.5 → pt-2 · 2026-10-25 D안: px-4 → px-5)
      'flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1',   // 로고 줄 (gap-2.5 → gap-2)
    ]) {
      expect(PAGE, `real brand: ${cls}`).toContain(cls)
      expect(RESERVE, `reserve brand: ${cls}`).toContain(cls)
    }
  })

  it('로고 타일은 BrandChip 과 같은 치수', () => {
    // 로고 줄 높이는 BrandChip 이 정한다 — 타일 48 + gap-1 + 라벨.
    // 🔀 2026-09-29: 라벨이 10 → **12px**(정본 스케일 바닥). `shared.tsx` 가 이행됐으므로
    //    예약도 같이 따라가야 한다 — 두 값이 갈리면 브랜드 줄이 다시 밀린다.
    for (const cls of ['flex flex-col items-center gap-1', 'w-12 h-12 rounded-2xl', 'text-[12px]']) {
      expect(SHARED, `BrandChip: ${cls}`).toContain(cls)
      expect(RESERVE, `reserve tile: ${cls}`).toContain(cls)
    }
  })
})

describe('③ 자리만 잡고 아무것도 보이지 않는다', () => {
  it('두 예약 다 invisible + aria-hidden', () => {
    // 개수 하한이 아니라 **예약 루트마다** 판정한다 — 예약이 셋이 되자(PC 줄 추가) 하한 2 가
    // 한 곳에서 invisible 이 빠져도 통과했다(2026-10-19 PR CI 주입이 잡았다).
    const brand = RESERVE.slice(RESERVE.indexOf('export function BrandStripReserve'))
    expect(brand).toMatch(/^[\s\S]*?return \(\s*<div className="[^"]*\binvisible\b[^"]*" aria-hidden="true">/)
    expect(RESERVE).toMatch(/<div className=\{`\$\{PC_BRAND\.wrap\} invisible`\} aria-hidden="true">/)
    expect(RESERVE.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  // 🔄 2026-10-14: 접힘이 없어졌다 — 예약도 로고 줄을 늘 잡는다(반대 방향 밀림이 생길 상태가 없다).
  it('접힘 상태가 없다 — 예약은 로고 줄을 늘 잡는다', () => {
    expect(RESERVE).not.toMatch(/\{open && \(/)
    expect(PAGE).toMatch(/<BrandStripReserve \/>/)
  })
})

describe('④ PC 인기 브랜드 줄도 자리를 잡는다 (2026-10-19 라이브 1440px CLS 0.037)', () => {
  it('PC 블록과 예약이 같은 클래스 상수(PC_BRAND)를 쓴다', () => {
    expect(PAGE).toMatch(/<div className=\{PC_BRAND\.wrap\}>\s*<h3 className=\{PC_BRAND\.title\}>인기 브랜드<\/h3>\s*<div className=\{PC_BRAND\.row\}>/)
    expect(RESERVE).toMatch(/\$\{PC_BRAND\.wrap\} invisible/)
    expect(RESERVE).toMatch(/<h3 className=\{PC_BRAND\.title\}>/)
    expect(RESERVE).toMatch(/<div className=\{PC_BRAND\.row\}><BrandChipReserve \/>/)
  })
  it('PC 예약은 브랜드가 아직 안 왔을 때만 뜬다', () => {
    expect(PAGE).toContain('{currentBrands.length === 0 && !sectionsReady && !!category && <PcBrandStripReserve />}')
  })
})
