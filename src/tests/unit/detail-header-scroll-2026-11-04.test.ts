/**
 * ⚡ 2026-11-04 대표 *"최적화 계속"* — 상세 머리줄(뒤로·찜·공유)이 **스크롤마다** 사진 높이(`offsetHeight`)를 읽어
 *   강제 레이아웃을 일으켰다(첫 진입 긴 작업 68ms @CPU×4 + 스크롤 버벅임). 높이는 ResizeObserver 로 크기가 바뀔 때만,
 *   스크롤은 저장값 비교 + 프레임당 1회(rAF).
 * ⚠️ 못 보는 것: 실제 스크롤 매끄러움(하네스는 스크롤을 재지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

describe('상세 머리줄 — 스크롤 중 레이아웃 읽기 금지', () => {
  const s = stripComments(readFileSync('src/components/deal/DetailFloatingHeader.tsx', 'utf8'))
  const onScroll = s.slice(s.indexOf('const onScroll'), s.indexOf('\n', s.indexOf('const onScroll')))
  it('스크롤 핸들러는 offsetHeight 를 읽지 않고 rAF 로 한 프레임에 한 번', () => {
    expect(onScroll).not.toMatch(/offsetHeight|getBoundingClientRect/)
    expect(onScroll).toContain('requestAnimationFrame(apply)')
  })
  it('높이는 ResizeObserver 로 잰다 · 판정식 유지(사진 높이 − 56, 없으면 60)', () => {
    expect(s).toContain('new ResizeObserver(onResize)')
    expect(s).toContain('threshold = h > 0 ? Math.max(0, h - HEADER_H) : 60')
  })
})
