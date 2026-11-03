/**
 * 🎬 유어쇼츠 — 2026-11-03 대표 신고 *"재생버튼 2개 생기고 아래 부분도 수정 필요"*.
 *
 *  ① 멈춤 버튼은 **유튜브 버튼 자리**(재생기 한가운데 = 화면 한가운데보다 `YT_TITLE_CLIP_PX/2` 위)에 서고,
 *     그 버튼을 덮을 만큼 크고 진하다. 화면 한가운데에 두면 유튜브 것과 어긋나 두 개로 보인다.
 *  ② 아래 두 카드(구매 바 · 인기 이용권)는 **불투명 흰 판**이다 — 반투명이면 아래 Shorts 글자가 비친다.
 * ⚠️ 못 보는 것: 유튜브 버튼의 실제 크기·위치(유튜브가 정한다 — 실기기로 확인).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const V = readFileSync('src/pages/VideosPage.tsx', 'utf8')
const N = readFileSync('src/pages/videos/NearbyPassesCard.tsx', 'utf8')

describe('① 재생 버튼 하나', () => {
  it('유튜브 버튼 자리로 올린다', () => {
    expect(V).toContain('style={{ transform: `translateY(-${YT_TITLE_CLIP_PX / 2}px)` }} data-testid="shorts-paused"')
  })
  it('덮을 만큼 크고 진하다', () => {
    expect(V).toMatch(/h-\[76px\] w-\[76px\] place-items-center rounded-full bg-black\/85/)
  })
})

describe('② 불투명 흰 판', () => {
  it('구매 바', () => { expect(V).toContain('rounded-2xl bg-white p-2 shadow-2xl') })
  it('인기 이용권 카드', () => { expect(N).toMatch(/ur-np-in flex items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl/) })
})
