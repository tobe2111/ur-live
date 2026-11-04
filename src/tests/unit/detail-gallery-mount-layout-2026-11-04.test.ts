/**
 * ⚡ 2026-11-04 대표 *"계속 최적화"* — 상세 갤러리가 마운트 때 `scrollLeft`·`clientWidth` 를 읽어 강제 레이아웃을 일으켰다
 *   (CPU×4 프로파일 66ms, 하네스 TBT 0.83~1.05s → 0.51~0.59s). 첫 진입(첫 사진)에서는 재지 않는다.
 * ⚠️ 못 보는 것: 실제 기기 체감 · 다른 마운트 읽기(프로파일로 찾을 것).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

describe('상세 갤러리 — 첫 진입에 레이아웃을 읽지 않는다', () => {
  const s = stripComments(readFileSync('src/pages/group-buy/DetailGallery.tsx', 'utf8'))
  it('첫 실행이고 첫 사진이면 재기 전에 돌아간다', () => {
    const i = s.indexOf('if (!syncedOnce.current) { syncedOnce.current = true; if (active === 0) return }')
    const read = s.indexOf('const cur = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))')
    expect(i).toBeGreaterThan(0)
    expect(read).toBeGreaterThan(i)
  })
})
