/**
 * 🖥️ PC 홈 상단 네비 서버 렌더 (2026-11-12 대표 PC 캡처 "아직 느리네" — 맨 위 줄이 1초 남짓 빈 흰 줄).
 *   서버가 로고·검색창·둘째 줄 메뉴 글자를 그린다. 앱이 켜지면 `DesktopTopNav` 가 통째로 바꾸므로
 *   **같은 클래스·같은 순서·같은 라벨**이어야 그 순간 글자가 옆으로 튀지 않는다.
 *   고정: ① 클래스 SSOT 가 DesktopTopNav 소스와 글자 그대로 같다 ② 서비스 5 + 딜 카테고리 전부(생활 포함 → /life)
 *   ③ 홈·전체 두 개만 켜짐 점 ④ 아이콘 자리 w-4 h-4 ⑤ 로고는 UrDealLogo 20 비율 ⑥ 첫 화면이 실제로 그 두 줄을 담는다.
 *   못 보는 것: 픽셀 폭(아이콘 칸은 같은 크기라 같다고 본다 — 라이브 CLS 로 잰다) · 우측 아이콘(장바구니·계정)은 안 그린다.
 */
import { describe, it, expect } from 'vitest'
import { readRaw } from '../helpers/source-text'
import { PC_TOPNAV_CLS, PC_TOPNAV_SERVICES, PC_TOPNAV_SEARCH_PLACEHOLDER } from '@/shared/pc-topnav-first'
import { pcTopNavRowsHtml, buildPcHomeFirstScreen } from '@/worker/utils/pc-home-first-screen'
import { DEAL_CAT_LABELS } from '@/shared/deal-cats'

const NAV = readRaw('src/components/main/DesktopTopNav.tsx')
const [row1, row2] = pcTopNavRowsHtml().split('\u0000')

describe('① 클래스가 앱 헤더와 같다', () => {
  for (const [k, v] of Object.entries(PC_TOPNAV_CLS)) it(k, () => expect(NAV).toContain(v))
  it('검색 문구도 같다', () => expect(NAV).toContain(PC_TOPNAV_SEARCH_PLACEHOLDER))
})

describe('② 항목 · ③ 켜짐 · ④ 아이콘 자리', () => {
  const d = document.createElement('div'); d.innerHTML = row2
  const links = Array.from(d.querySelectorAll('nav a'))
  it('서비스 5 + 딜 카테고리 전부, 앱과 같은 순서', () => {
    expect(links.map((a) => a.textContent)).toEqual([...PC_TOPNAV_SERVICES.map((x) => x.label), ...DEAL_CAT_LABELS.map((x) => x.label)])
  })
  it('서비스 라벨이 앱 소스에 있다', () => { for (const x of PC_TOPNAV_SERVICES) expect(NAV).toContain(`'${x.label}'`) })
  it('생활은 /life · 전체는 / · 나머지는 /?category=', () => {
    const href = (t: string) => links.find((a) => a.textContent === t)!.getAttribute('href')
    expect(href('생활')).toBe('/life'); expect(href('전체')).toBe('/'); expect(href('식사')).toBe('/?category=meal_voucher')
  })
  it('켜짐 점은 홈·전체 둘뿐', () => {
    const on = links.filter((a) => a.querySelector('span[class*="bg-brand"]')).map((a) => a.textContent)
    expect(on).toEqual(['홈', '전체'])
  })
  it('모든 항목에 w-4 h-4 아이콘 자리', () => { for (const a of links) expect(a.firstElementChild!.getAttribute('class')).toBe('w-4 h-4') })
  it('구분선 하나', () => expect(d.querySelectorAll(`span.w-px`).length).toBe(1))
})

describe('⑤ 로고 · ⑥ 첫 화면에 실린다', () => {
  it('로고 20px · 점 3.6px', () => { expect(row1).toContain('font-size:20px'); expect(row1).toContain('width:3.6px;height:3.6px') })
  it('검색창이 있다', () => expect(row1).toContain(`placeholder="${PC_TOPNAV_SEARCH_PLACEHOLDER}"`))
  it('첫 화면 HTML 이 두 줄을 담는다', () => {
    const B = (id: number) => ({ id, title: 't', description: null, image_url: `https://media.ur-team.com/u/b${id}.jpg`, link_url: '/vouchers', banner_slot: 'strip', display_order: id, video_url: null, start_date: null, end_date: null })
    const html = buildPcHomeFirstScreen(JSON.stringify({ success: true, data: [B(1), B(2), B(3)] }), '<i>l</i>')
    expect(html).toContain(row1); expect(html).toContain(row2)
  })
})
