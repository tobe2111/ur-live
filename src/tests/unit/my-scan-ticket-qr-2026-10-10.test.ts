/**
 * 🎟️ 2026-10-10 — 마이 판매 구역 **안 3** (대표 확정 *"안 3으로 하되, 바코드 모양이 아니라 QR모양이어야
 *   하잖아 버튼이"*).
 *
 * 지키는 것:
 *   ① 사용처리는 **티켓**이다 — 옅은 블루 면 + 판 색으로 뚫은 홈 둘 + 점선 + **QR 꼬리**.
 *      종전엔 사용처리와 이용권 등록이 같은 줄 문법이라 "다르더라도 티가 나야" 하는 둘이 안 갈렸다.
 *   ② 꼬리는 **QR** 이다(바코드 아님) — 손님이 내미는 이용권이 QR 이라 같은 물건으로 읽혀야 한다.
 *   ③ 홈은 판과 **같은 색**(`bg-surface`)이다 — 다른 색이면 홈이 아니라 점 두 개로 읽힌다(다크에서 특히).
 *   ④ 진한 블루 면은 `이용권 등록 · 관리` **하나**다(표면 규칙 ②).
 *   ⑤ 사용처리는 여전히 **좌석을 먼저 앉히고** 스캐너로 간다(남의 가게 이용권 소각 방지).
 *
 * ⚠️ 이 시험이 **못 보는 것**: 티켓이 실제로 예쁜지 · 홈이 판 가장자리에 정확히 걸리는지(jsdom 은
 *   레이아웃이 없다). 그건 `node scripts/visual-preview.mjs --route=/user/profile --stores=1 --auth` 로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SELLER = stripComments(readFileSync('src/pages/user-profile/SellerSection.tsx', 'utf8'))
const ICONS = readFileSync('src/components/icons/qr-scan-icon.tsx', 'utf8')

/** 사용처리 버튼 한 덩어리 — `enterSeat('/store/scan')` 를 가진 `<button` 부터 그 `</button>` 까지. */
function scanButton(): string {
  const i = SELLER.indexOf("onClick={() => enterSeat('/store/scan')}")
  expect(i, '사용처리 버튼을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
  const start = SELLER.lastIndexOf('<button', i)
  const end = SELLER.indexOf('</button>', i)
  return SELLER.slice(start, end)
}

describe('마이 사용처리 = QR 티켓 (안 3)', () => {
  it('① 옅은 블루 티켓이고, 진한 블루가 아니다', () => {
    const b = scanButton()
    expect(b).toContain('bg-brand-tint')
    expect(b, '사용처리가 다시 진한 블루 면이 됐다 — 등록 줄과 면이 둘이 된다').not.toMatch(/\bbg-brand\b(?!-)/)
    expect(b).toContain('border-dashed')
    expect(b).toContain('이용권 사용처리')
  })

  it('② 꼬리는 QR 이다 (바코드가 아니다)', () => {
    const b = scanButton()
    expect(b, 'QR 꼬리가 사라졌다').toContain('<QrScanIcon')
    expect(b, '꼬리가 바코드(세로 막대)로 그려졌다').not.toMatch(/바코드|barcode/i)
    expect(b, '안내 문구가 QR 을 말하지 않는다').toMatch(/QR을/)
  })

  it('③ 홈 둘은 판과 같은 색으로 뚫는다', () => {
    const b = scanButton()
    const notches = b.match(/rounded-full bg-surface/g) ?? []
    expect(notches.length, '홈이 둘이 아니거나 판 색(bg-surface)이 아니다').toBe(2)
  })

  it('④ 진한 블루 면은 이용권 등록 · 관리 하나다', () => {
    expect((SELLER.match(/\bbg-brand text-white\b/g) ?? []).length).toBe(1)
    expect(SELLER).toMatch(/bg-brand text-white[\s\S]{0,400}이용권 등록 · 관리/)
  })

  it('⑤ 사용처리는 좌석을 먼저 앉히고 스캐너로 간다', () => {
    expect(SELLER).toContain("enterSeat('/store/scan')")
  })

  it('QR 아이콘은 세트 규칙(획 1.6)을 쓰고 스캔 틀 모서리를 가지며, 마이가 그것을 쓴다', () => {
    expect(ICONS).toContain('export const QrScanIcon')
    expect(ICONS, '획이 세트(1.6)와 다르다').toContain('strokeWidth={1.6}')
    expect(ICONS, '스캔 틀 모서리가 없다 — 코드만 그리면 "내 티켓" 으로 읽힌다').toMatch(/M3 9V5\.4/)
    expect(SELLER, '마이가 QR 아이콘을 그 파일에서 안 가져온다').toContain("from '@/components/icons/qr-scan-icon'")
  })
})
