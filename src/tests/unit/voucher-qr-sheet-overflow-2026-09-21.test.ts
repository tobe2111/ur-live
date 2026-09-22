/**
 * 🩹 **이용권 QR 바텀시트가 화면 위로 넘쳐 잘리던 것** (2026-09-21 대표 신고 — "이용권 페이지에 잘려서 안보임")
 *
 * ## 무슨 일이 있었나
 * `QRModal` 은 모바일에서 `items-end` 바텀시트다. 그런데 패널에 **높이 상한도 스크롤도 없었다.**
 * 내용이 화면보다 길면 아래는 바닥에 붙은 채 **위쪽이 뷰포트 밖으로 밀려 나가고, 스크롤이 없어서
 * 되돌릴 방법이 없다** — 상품명·매장명·QR 윗부분이 영영 안 보인다. 카톡 인앱 브라우저는 상단 바만큼
 * 보이는 높이가 더 줄어 더 잘 난다(대표 화면이 그것).
 *
 * 실측(헤드리스 크로미움 390×640, 같은 CSS 기계로 재현):
 * ```
 * before  패널높이 812 > 뷰포트 640 · 제목 top -160 · 스크롤 불가   ← 손댈 수 없음
 * after   패널높이 589 ≤ 뷰포트     · 제목 top   63 · 스크롤 가능
 * ```
 *
 * ## ⚠️ 이 시험이 **못 하는 것**
 * jsdom 에는 레이아웃이 없다 — **실제로 몇 px 넘쳤는지 여기서는 절대 못 잰다.**
 * 그래서 이 시험은 *넘침을 막는 기계*(높이 상한 + 스크롤 컨테이너)가 제자리에 있는지만 본다.
 * 진짜 판정은 브라우저 프레임 측정이다(위 실측 · 배포 후 라이브).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/pages/my-vouchers/QRModal.tsx')

/** 패널(= `role="dialog"` 가 달린 div)의 className 문자열. */
function panelClass(): string {
  const i = SRC.indexOf('role="dialog"')
  expect(i, '패널 앵커(role="dialog")를 못 찾았다 — 검사가 헛돌고 있다').toBeGreaterThan(-1)
  const open = SRC.lastIndexOf('<div', i)
  const m = SRC.slice(open, i).match(/className="([^"]+)"/)
  expect(m, '패널 className 을 못 읽었다').not.toBeNull()
  return m![1]
}

describe('이용권 QR 시트 — 내용이 길어도 위가 잘리지 않는다', () => {
  it('검사 대상이 실제로 읽힌다(0 바이트면 통과가 아니라 고장)', () => {
    expect(SRC.length).toBeGreaterThan(3000)
  })

  it('🔴 패널에 높이 상한이 있다 — 없으면 내용이 길어진 만큼 위로 넘친다', () => {
    expect(panelClass()).toMatch(/max-h-\[[\d.]+dvh\]/)
  })

  it('🔴 상한은 dvh 다 — 100vh 는 모바일에서 주소창을 포함해 실제 보이는 높이보다 크다(레포 룰)', () => {
    const cls = panelClass()
    expect(cls).not.toMatch(/max-h-\[[\d.]+vh\]/)
    expect(cls).not.toMatch(/max-h-screen/)
  })

  it('🔴 패널이 세로 flex 다 — 본문이 남는 높이를 먹어야 스크롤이 생긴다', () => {
    expect(panelClass()).toMatch(/\bflex\b/)
    expect(panelClass()).toMatch(/\bflex-col\b/)
  })

  it('🔴 본문 스크롤 컨테이너가 있다 — `flex-1 min-h-0 overflow-y-auto` 셋이 다 있어야 한다', () => {
    // min-h-0 이 빠지면 flex 자식이 안 줄어들어 **스크롤이 안 생긴다**(레포가 반복해 밟은 함정).
    expect(SRC).toMatch(/className="flex-1 min-h-0 overflow-y-auto[^"]*"/)
  })

  it('🔴 QR 과 상품명이 스크롤 영역 **안**에 있다 — 밖이면 다시 손댈 수 없게 된다', () => {
    const s = SRC.indexOf('className="flex-1 min-h-0 overflow-y-auto')
    expect(s).toBeGreaterThan(-1)
    const body = SRC.slice(s)
    expect(body).toContain('voucher.product_name')
    expect(body).toContain('<VoucherQRCode')
  })

  it('🔴 닫기(X)는 스크롤 영역 **밖**에 남는다 — 스크롤해도 닫을 수 있어야 한다', () => {
    const s = SRC.indexOf('className="flex-1 min-h-0 overflow-y-auto')
    const x = SRC.indexOf('absolute top-3 right-3')
    expect(x).toBeGreaterThan(-1)
    expect(x, '닫기 버튼이 스크롤 영역 안으로 들어갔다').toBeLessThan(s)
  })

  it('하단 세이프영역을 먹는다 — 홈 인디케이터에 버튼이 가리지 않게', () => {
    expect(SRC).toMatch(/env\(safe-area-inset-bottom\)/)
  })
})
