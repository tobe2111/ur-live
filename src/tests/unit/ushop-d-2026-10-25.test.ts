/**
 * 🛍️ 2026-10-25 (대표 *"유어샵은 D 대로 해줘"*) — 유어샵 D안(크기 위계·간격).
 *   시안: https://claude.ai/artifact/Ghiv1iHiF9TB4sUw4R9CZw "유어샵 D".
 *   ① 줄: 사진 88 · 위아래 20 · 상품명 15px **중간 굵기**(한 덩어리에 굵은 제목은 하나 — 굵기 ⑨) ·
 *      순번은 가게 줄 앞("1 · 가게")
 *   ② 탭: 선택만 굵게 + 잉크 밑줄, 나머지는 보통 굵기 회색(교환권 밑줄 탭과 같은 문법)
 *   ③ 옆 여백 20px(px-5)
 *   🔑 값은 `src/shared/ushop-row.ts` 한 곳 — 부품(DealRow plain·PinCategoryChips)과 워커 첫 화면이 같이 쓴다.
 *   ⚠️ 못 보는 것: 실제 렌더(그림) — `node scripts/visual-preview.mjs --route=/u/jiwon1228`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAIN_CLS, PLAIN_THUMB_CLS, USHOP_TAB_CLS } from '@/shared/ushop-row'
import { CURATOR_FS_CLASS } from '@/worker/utils/curator-ssr-body'

const read = (p: string) => readFileSync(p, 'utf8')

describe('유어샵 D안', () => {
  it('① 줄 값 — 상품명은 중간 굵기, 사진 88, 위아래 20', () => {
    expect(PLAIN_CLS.title).toMatch(/\bfont-medium\b/)
    expect(PLAIN_CLS.title).not.toMatch(/\bfont-(bold|semibold|extrabold|black)\b/)
    expect(PLAIN_CLS.eyebrow, '가게 줄은 보통 굵기').not.toMatch(/\bfont-/)
    expect(PLAIN_THUMB_CLS).toBe('w-[88px] h-[88px]')
    expect(PLAIN_CLS.skin).toBe('px-0 py-5')
  })

  it('② 탭 — 굵기는 선택에만', () => {
    expect(USHOP_TAB_CLS, '공용 탭 클래스에 굵기가 없다(선택 분기만 굵게)').not.toMatch(/\bfont-/)
    const chips = read('src/pages/curator-page/PinCategoryChips.tsx')
    expect(chips).toMatch(/on \? 'border-gray-900 dark:border-white font-bold/)
  })

  it('③ 옆 여백 20px — 헤더·칩 줄·목록', () => {
    const header = read('src/pages/curator-page/CuratorHeader.tsx')
    const page = read('src/pages/CuratorPage.tsx')
    expect(header).toContain('flex items-center gap-4 px-5 pt-4')
    expect(header).toContain('mt-4 px-5 flex items-center justify-between gap-2')
    expect(page).toContain('max-w-3xl mx-auto px-5 pt-6 border-b border-rule')
    expect(page).toContain('max-w-3xl mx-auto px-5 pb-4 divide-y')
  })

  it('④ 워커 첫 화면이 같은 상수를 쓴다(두 벌 금지)', () => {
    expect(CURATOR_FS_CLASS.rowTitle).toBe(PLAIN_CLS.title)
    expect(CURATOR_FS_CLASS.rowEyebrow).toBe(PLAIN_CLS.eyebrow)
    expect(CURATOR_FS_CLASS.chip).toBe(USHOP_TAB_CLS)
    expect(CURATOR_FS_CLASS.rowThumb).toContain(PLAIN_THUMB_CLS)
    expect(CURATOR_FS_CLASS.row).toContain(PLAIN_CLS.skin)
    const dealRow = read('src/components/deal/DealRow.tsx')
    expect(dealRow).toMatch(/plain \? PLAIN_CLS\.title/)
  })
})
