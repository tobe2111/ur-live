/**
 * 🖥️ 교환권 상세 PC 서버 첫 화면 — 상단 네비 자리 (2026-11-12 PC 실측 CLS 0.33: 앱의 DesktopTopNav 114px 가
 *   서버 그림 위에 끼어 본문 전체가 내려갔다).
 *   고정: ① PC(pcPath 있음)면 네비 틀 + 두 줄 글자가 본문 앞에 ② 폰(undefined)은 네비 없음(종전 그대로)
 *        ③ 켜짐: /vouchers/:id 는 '교환권' 하나, 딜 카테고리는 없음 · 홈은 '홈'·'전체'
 *        ④ 틀 클래스가 PC 홈과 같은 값(PC_HOME_FS 가 같은 SSOT 를 가리킨다).
 *   못 보는 것: 픽셀 — 라이브 CLS 로 잰다.
 */
import { describe, it, expect } from 'vitest'
import { buildVoucherDetailFirstScreen } from '@/worker/utils/voucher-detail-ssr-body'
import { pcTopNavBlockHtml } from '@/worker/utils/pc-topnav-first-screen'
import { PC_TOPNAV_FRAME } from '@/shared/pc-topnav-frame'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'

const SEED = JSON.stringify({ success: true, data: { name: '연타발 30만원권', image_url: 'https://media.ur-team.com/uploads/x.jpg', deal_only: 1 } })
const on = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return Array.from(d.querySelectorAll('nav a')).filter((a) => a.querySelector('span[class*="bg-brand"]')).map((a) => a.textContent) }

describe('교환권 상세 PC 상단 네비', () => {
  it('① PC 면 본문 앞에 네비', () => {
    const html = buildVoucherDetailFirstScreen(SEED, '<i>l</i>', '/vouchers/2285')
    expect(html).toContain(`<div class="${PC_TOPNAV_FRAME.outer}">`)
    expect(html.indexOf('동네딜, 교환권, 상품 검색')).toBeLessThan(html.indexOf('연타발 30만원권'))
  })
  it('② 폰은 네비 없음', () => expect(buildVoucherDetailFirstScreen(SEED, '<i>l</i>')).not.toContain(PC_TOPNAV_FRAME.outer))
  it('③ 켜짐 표시', () => {
    expect(on(pcTopNavBlockHtml('/vouchers/2285'))).toEqual(['교환권'])
    expect(on(pcTopNavBlockHtml('/'))).toEqual(['홈', '전체'])
    expect(on(pcTopNavBlockHtml('/vouchersX'))).toEqual([])
  })
  it('④ 틀이 PC 홈과 같다', () => {
    expect(PC_HOME_FS.topnav).toBe(PC_TOPNAV_FRAME.outer); expect(PC_HOME_FS.topnavRow1).toBe(PC_TOPNAV_FRAME.row1); expect(PC_HOME_FS.topnavRow2).toBe(PC_TOPNAV_FRAME.row2)
  })
})
