/**
 * 🎟️ 마이 판매 구역의 **두 칸** — 2026-10-10 안 3(QR 티켓) → **2026-10-25 대표 확정 안 G** 로 재조준.
 *   대표 *"안 G로 하고, 이용권 등록 및 관리로 명칭 바꾸면 되잖아"*.
 *
 * 🔁 무엇이 바뀌었고 무엇이 그대로인가:
 *   - 바뀐 것: 사용처리가 판 안의 옅은 블루 **티켓**(홈 둘 + 점선) → 판 **밖 위**의 **진한 블루 칸**.
 *     `이용권 등록 · 관리` 는 진한 블루 줄 → 그 옆 **흰 칸**(`이용권 등록·관리`).
 *   - 그대로인 것(2026-10-10 대표 *"사용처리와 등록은 다르더라도 티가 나야"*):
 *     ① 둘은 **생김새가 다르다**(파란 칸 ↔ 흰 칸) — 같은 면이면 다시 안 갈린다
 *     ② 그림은 **QR** 이다(바코드 아님 — 대표 *"바코드 모양이 아니라 QR모양이어야"*)
 *     ③ 진한 블루 면은 이 구역에 **하나**(표면 규칙 ②)
 *     ④ 사용처리는 여전히 **좌석을 먼저 앉히고** 스캐너로 간다(남의 가게 이용권 소각 방지)
 *
 * ⚠️ 이 시험이 **못 보는 것**: 두 칸이 390px 에서 실제로 한 줄에 들어가는지(jsdom 은 레이아웃이 없다).
 *   그건 `node scripts/visual-preview.mjs --route=/user/profile --stores=1 --auth` 로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SELLER = stripComments(readFileSync('src/pages/user-profile/SellerSection.tsx', 'utf8'))
const ICONS = readFileSync('src/components/icons/qr-scan-icon.tsx', 'utf8')

/** `marker` 를 가진 `<button` 부터 그 `</button>` 까지. */
function buttonWith(marker: string): string {
  const i = SELLER.indexOf(marker)
  expect(i, `${marker} 를 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(-1)
  return SELLER.slice(SELLER.lastIndexOf('<button', i), SELLER.indexOf('</button>', i))
}
const scanButton = () => buttonWith("onClick={() => enterSeat('/store/scan')}")
const registerButton = () => buttonWith("onClick={() => openPage('/seller/group-buy', '이용권')}")

describe('마이 판매 두 칸 — 사용처리(파란 칸) · 이용권 등록·관리(흰 칸) (안 G)', () => {
  it('① 사용처리는 진한 블루 칸, 등록은 흰 칸이다 — 둘의 생김새가 다르다', () => {
    const scan = scanButton()
    const reg = registerButton()
    expect(scan, '사용처리가 진한 블루 칸이 아니다').toMatch(/\bbg-brand text-white\b/)
    expect(scan).toContain('사용처리')
    expect(reg, '등록 칸이 흰 칸(bg-surface)이 아니다').toContain('bg-surface')
    expect(reg, '등록 칸이 다시 파란 면이 됐다 — 사용처리와 안 갈린다').not.toMatch(/\bbg-brand\b(?!-)/)
    expect(reg, '대표가 고친 이름이 아니다').toContain('이용권 등록·관리')
  })

  it('② 사용처리 그림은 QR 이다 (바코드가 아니다)', () => {
    const b = scanButton()
    expect(b, 'QR 그림이 사라졌다').toContain('<QrScanIcon')
    expect(b, '그림이 바코드로 그려졌다').not.toMatch(/바코드|barcode/i)
    expect(b, '안내 문구가 QR 을 말하지 않는다').toMatch(/QR/)
  })

  it('③ 두 칸은 판 밖에서 나란히 선다 — 판 안의 줄이 아니다', () => {
    const iGrid = SELLER.indexOf('grid grid-cols-2')
    const iPlate = SELLER.indexOf('<div className={LIST_PLATE_CLS}>')
    expect(iGrid, '두 칸 격자를 못 찾았다').toBeGreaterThan(-1)
    expect(iGrid, '두 칸이 판 안으로 들어갔다').toBeLessThan(iPlate)
    expect(SELLER.indexOf("enterSeat('/store/scan')"), '사용처리가 격자 밖이다').toBeGreaterThan(iGrid)
    expect(SELLER.indexOf("enterSeat('/store/scan')"), '사용처리가 판 안이다').toBeLessThan(iPlate)
  })

  it('④ 진한 블루 면은 이 구역에 하나다(사용처리)', () => {
    expect((SELLER.match(/\bbg-brand text-white\b/g) ?? []).length).toBe(1)
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
