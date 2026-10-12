/**
 * 🎁🖼️ 2026-10-12 후속 — ① 선물 "회수" → "선물 보내기 취소"(대표 *"응 이름 바꿔줘"*)
 *                         ② 홈 섹션 카드도 갤러리를 카드 SSOT 로 자른다(딜 피드·상품 목록과 같은 규칙).
 *
 * ⚠️ 못 막는 것: 새로 생기는 화면이 "회수" 를 쓰는 것 — 아래 목록의 파일만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const GIFT_UI = [
  'src/pages/my-vouchers/GiftVoucherSheet.tsx',
  'src/pages/my-vouchers/QRModal.tsx',
  'src/pages/my-vouchers/VoucherTicket.tsx',
  'src/pages/VoucherGiftReceivePage.tsx',
  'src/features/group-buy/api/voucher-gift.routes.ts',
  'src/worker/utils/voucher-gift.ts',
]

describe('① 선물 문구는 "보내기 취소"', () => {
  it('선물 화면·응답 문구에 "회수" 가 없다', () => {
    for (const f of GIFT_UI) {
      const strings = stripComments(readFileSync(f, 'utf8')).match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1|>[^<>{}\n]+</g) || []
      const hit = strings.filter(s => s.includes('회수'))
      expect({ f, hit }).toEqual({ f, hit: [] })
    }
  })
  it('버튼과 받는 화면이 같은 말을 한다', () => {
    expect(readFileSync('src/pages/my-vouchers/GiftVoucherSheet.tsx', 'utf8')).toContain('선물 보내기 취소')
    expect(readFileSync('src/pages/VoucherGiftReceivePage.tsx', 'utf8')).toContain("cancelled: '보낸 분이 선물을 취소했어요'")
  })
})

describe('② 홈 섹션 갤러리 자르기', () => {
  it('섹션 응답의 products 가 capRowGalleries 를 거친다', () => {
    const s = stripComments(readFileSync('src/features/sections/api/sections.routes.ts', 'utf8'))
    expect(s).toMatch(/products: capRowGalleries\(normalizeSectionSource\(s\.source\) === 'manual'/)
  })
  it('자르기 자체 — 커버 빼고 최대 3장, 배열로', async () => {
    const { capRowGalleries } = await import('@/features/group-buy/api/card-gallery')
    const rows = capRowGalleries([{ id: 1, image_url: 'c', images: JSON.stringify(['c', 'a', 'b', 'd', 'e']) }])
    expect((rows[0] as unknown as { images: string[] }).images).toEqual(['a', 'b', 'd'])
  })
})
