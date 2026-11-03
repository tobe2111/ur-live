/**
 * 📷 매장 계산대 안 B (2026-11-03 대표 확정 *"안 B로 해줘"*) — 카메라가 화면 전체, 아래 두 칩, 글자는 한 줄.
 * ⚠️ 못 보는 것: 실제 폰에서 카메라가 칸을 꽉 채우는지(그건 그려서 본다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const PAGE = stripComments(readCode('src/pages/StoreScanPage.tsx'))
const VIEW = stripComments(readCode('src/components/voucher/FullScanView.tsx'))
const SCAN = stripComments(readCode('src/components/voucher/VoucherScanner.tsx'))

describe('매장 계산대 안 B', () => {
  it('계산대는 full 로 그리고, 머리 아래 칸을 꽉 채운다', () => {
    expect(PAGE).toContain('<VoucherScanner full />')
    expect(PAGE).toContain('relative min-h-0 flex-1')
    expect(PAGE).toContain('flex h-[100dvh] flex-col')
  })
  it('안내 문단이 돌아오지 않는다 — 글자는 네모 아래 한 줄', () => {
    expect(PAGE).not.toContain('확인창이 떠요')
    expect(PAGE).not.toContain('직접 입력하세요')
    expect(VIEW).toContain("'이용권 QR을 네모 안에'")
  })
  it('아래 칩 둘 — 사진 · 코드 입력(누르면 입력줄)', () => {
    expect(VIEW).toContain("seller.scan.photoChip")
    expect(VIEW).toContain("seller.scan.codeChip")
    expect(VIEW).toMatch(/typing \? \(/)
  })
  it('확인창은 full 에서도 뜬다(되돌릴 수 없다는 말의 자리)', () => {
    const fullBranch = SCAN.slice(SCAN.indexOf('if (full) {'), SCAN.indexOf('\n  return (\n', SCAN.indexOf('if (full) {')))
    expect(fullBranch).toContain('<UseConfirmSheet pending={pending}')
  })
  it('셀러 대시보드 계산대는 종전 모양(full 없음)', () => {
    expect(stripComments(readCode('src/pages/SellerVoucherScanPage.tsx'))).toContain('<VoucherScanner />')
  })
  it('카메라 위 오류·결과는 알림과 같은 유리 알약이다(팝업 통일 2026-11-02) — 색 상자 금지', () => {
    expect(VIEW).toContain("const POP = 'ur-glass ur-pop-toast")
    expect(VIEW).toMatch(/p\.cameraError && \(\s*<div role="alert" className=\{`\$\{POP\}/)
    expect(VIEW).not.toMatch(/bg-tone-(warn|ok|bad)-bg/)
  })
})
