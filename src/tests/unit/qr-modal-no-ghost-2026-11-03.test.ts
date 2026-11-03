/**
 * 🩹 2026-11-03 대표 *"이용안내 글자 두번 겹치는건 고쳐줘"* — 내 이용권 QR 창의 '이용 안내' 가 겹쳐 두 번 그려졌다.
 * 원인: 흐림 판(`.ur-glass`, backdrop-filter) 안에서 스크롤하는 영역을 안드로이드 크롬이 다시 그릴 때 잔상을 남긴다.
 * 처방: 안에서 스크롤하는 큰 창은 같은 모양의 불투명 판(`.ur-glass-solid`).
 * ⚠️ 못 보는 것: 실제 기기의 그리기 결함 자체(헤드리스 크롬은 재현하지 않는다) — 이 시험은 처방이 빠지지 않게만 지킨다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('QR 창 — 흐림 판 안 스크롤 금지', () => {
  it('QR 창 판은 불투명(ur-glass-solid)이고 흐림(ur-glass)이 아니다', () => {
    const s = readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8')
    expect(s).toContain('<div ref={panelRef} className="ur-glass-solid ur-pop-card')
    expect(s).not.toMatch(/ref=\{panelRef\} className="ur-glass ur-pop-card/)
  })
  it('ur-glass-solid 는 흐림이 없다', () => {
    const css = readFileSync('src/index.css', 'utf8')
    const rule = css.match(/\.ur-glass-solid \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain('var(--surface)')
    expect(rule).not.toMatch(/backdrop-filter/)
  })
})
