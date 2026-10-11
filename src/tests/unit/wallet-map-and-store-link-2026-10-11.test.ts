/**
 * 🗺️ 이용권 지갑 '지도로 보기' 화면 + 이용권 상세 '가게 보기' (2026-10-11 대표 신고)
 *
 * ① 지도 상자가 400px 고정이라 460 칸 아래가 비었고, 그 자리에 깔린 이용권 카드가 카카오 지도 내부 z-index 에
 *    눌려 반쯤 가려졌다. ② 머리줄이 지갑 토큰(라이트 고정 흰 바탕)인데 제목은 사이트 테마를 따라 다크에서
 *    흰 바탕 흰 글자로 사라졌다. ③ '가게 보기' 가 글자 크기(19px)라 폰에서 "눌러지지도 않"았다.
 *
 * ⚠️ 못 보는 것: 실제 카카오 타일이 그려진 모습(프리뷰는 SDK 를 막는다) · 폰에서의 실제 터치감.
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

describe('지도로 보기 화면', () => {
  const map = readCode('src/pages/my-vouchers/VoucherMap.tsx')
  it('지도 상자는 부모 높이를 채우고 카카오 내부 z-index 를 가둔다', () => {
    expect(map).toMatch(/style=\{\{ height: '100%', minHeight: 400, isolation: 'isolate' \}\}/)
    expect(map).not.toMatch(/shadow-lift" style=\{\{ height: 400 \}\}/)
  })
  it('머리줄은 사이트 테마 표면이다(지갑 토큰 흰 바탕에 다크 제목 금지)', () => {
    const page = readCode('src/pages/MyVouchersPage.tsx')
    const head = sliceFrom(page, "if (viewMode === 'map') {", '<VoucherMap', 4000)
    expect(head.length).toBeGreaterThan(0)
    expect(head).toMatch(/sticky top-0 md:top-14 z-30[^"]*bg-surface/)
    expect(head).not.toMatch(/tk\.chrome/)
  })
})

describe("'가게 보기' 눌림 영역", () => {
  it('손가락 크기(44px) 이상이다', () => {
    const src = readCode('src/pages/group-buy/StoreLocation.tsx')
    const btn = sliceFrom(src, 'onClick={onProfile}', '가게 보기', 600)
    expect(btn).toMatch(/min-h-\[44px\]/)
  })
})
