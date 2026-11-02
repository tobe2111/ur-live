/**
 * ➖ 2026-11-02 대표 *"배너 위에 구분선이 신경쓰여 없애줘"* — 모바일 안 1 의 첫 섹션(제목 없음)은 아래 8px 띠를 안 긋는다.
 * 세 곳이 같은 클래스를 써야 한다: 화면(`HomeSections`) · 서버 첫 화면 · CSS. 하나만 빠지면 마운트 때 8px 튀거나 띠가 남는다.
 * ⚠️ 못 보는 것: 실제 렌더에서 띠가 안 보이는지(그건 라이브 캡처로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'

const seed = JSON.stringify({ success: true, data: [{ id: 1, title: 't', products: [{ id: 5, name: '실매장', price: 1000, original_price: 2000, image_url: 'https://media.ur-team.com/a.jpg', category: 'meal_voucher' }] }] })

describe('첫 섹션 아래 띠 없음 (배너 위 구분선 제거)', () => {
  it('CSS — 폰 구간에서 ur-panel-flush 는 border-bottom 0', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/\.ur-home-panel\.ur-panel-flush \{ border-bottom: 0; \}/)
  })
  it('화면 — bareFirst 의 첫 섹션(과 자리 섹션)이 그 클래스를 단다', () => {
    const src = readFileSync('src/components/home/HomeSections.tsx', 'utf8')
    expect(src).toContain("ur-home-panel${bareFirst && sIdx === 0 ? ' ur-panel-flush' : ''}")
    expect(src).toContain("ur-home-panel${bareFirst ? ' ur-panel-flush' : ''}")
  })
  it('서버 첫 화면 — 같은 클래스', () => {
    expect(buildHomeFirstScreen(seed, '')).toMatch(/<section class="[^"]*ur-home-panel[^"]* ur-panel-flush">/)
  })
})
