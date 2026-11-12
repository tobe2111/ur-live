/**
 * 🖥️ PC 홈 서버 첫 화면 (2026-11-09 대표 "1~4번 모두 진행" ③) — 두 벌(워커 HTML ↔ React `PcHeroBanners`)이 갈리면 빨간불.
 *   라이브 실측: PC 홈 첫 글자 2.25초(로더뿐). 배너 시드는 같은 HTML 에 와 있었다.
 *   고정하는 것: ① 같은 사진 주소(큰 1100 · 작은 560, 화질 76) ② 같은 섹션·칸 클래스 ③ 네비 높이 68+1+44 예약
 *   ④ strip 배너 0장이면 ''(로더 폴백) ⑤ 워커는 데스크톱 UA·쿼리 없음·시드 있음일 때만 ⑥ 폰·크롤러 분기는 그대로.
 *   못 보는 것: 픽셀(jsdom 레이아웃 없음) · 프로모 바가 켜진 날의 밀림(라이브 캡처로).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PcHeroBanners from '@/pages/pc-home/PcHeroBanners'
import { buildPcHomeFirstScreen, pcHomeLcpImage } from '@/worker/utils/pc-home-first-screen'
import { PC_HOME_FS, PC_HERO_IMG, pcHeroBannersFromPayload } from '@/shared/pc-home-first-screen'
import { HOME_BANNERS_SEED_ID } from '@/shared/home-near-seed-read'
import { cfImage } from '@/utils/cf-image'
import { readRaw } from '../helpers/source-text'

const B = (id: number, slot: string, title: string, desc: string | null = '설명') => ({ id, title, description: desc, image_url: `https://media.ur-team.com/uploads/user/10/2026-10/b${id}.jpg`, link_url: 'https://urdeal.kr/vouchers', banner_slot: slot, display_order: id, video_url: null, start_date: null, end_date: null })
const PAYLOAD = JSON.stringify({ success: true, data: [B(8, 'vouchers', '교환권 자리'), B(2, 'strip', '커피·편의점 교환권, 딜로 바로'), B(3, 'strip', '퇴근길 서울 맛집', null), B(4, 'strip', '바다 보고 한 끼'), B(5, 'strip', '강릉·속초'), B(6, 'strip', '제주 맛집'), B(7, 'strip', '여섯 번째 — 잘린다')] })
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

function renderReact(payload: string) {
  document.getElementById(HOME_BANNERS_SEED_ID)?.remove()
  const s = document.createElement('script'); s.id = HOME_BANNERS_SEED_ID; s.type = 'application/json'; s.textContent = payload; document.body.appendChild(s)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><PcHeroBanners /></MemoryRouter></QueryClientProvider>).container
}
const imgSrcs = (root: HTMLElement) => Array.from(root.querySelectorAll('img')).map((i) => i.getAttribute('src'))

describe('① 같은 사진 주소 · ② 같은 클래스', () => {
  const html = buildPcHomeFirstScreen(PAYLOAD, LOADER)
  const server = document.createElement('div'); server.innerHTML = html
  // testing-library 가 매 it 뒤에 언마운트하므로 React 는 it 안에서 그린다.
  it('큰 1 + 작은 2 — 서버가 그린 사진 주소가 React 의 (보이는) 첫 세 장과 같다', () => {
    const react = renderReact(PAYLOAD)
    const s = imgSrcs(server)
    const r = imgSrcs(react)
    expect(s.length).toBe(3)
    expect(s[0]).toBe(cfImage(B(2, 'strip', '').image_url, PC_HERO_IMG.big))
    expect(r[0]).toBe(s[0]) // React 는 큰 자리 다섯 장을 겹쳐 두고 첫 장이 보인다 — 첫 장 주소가 같다
    expect(r.slice(-2)).toEqual(s.slice(1)) // 오른쪽 두 장
    expect(s[1]).toBe(cfImage(B(3, 'strip', '').image_url, PC_HERO_IMG.small))
  })
  it('섹션·큰 자리·옆 칸·슬라이드·사진·제목 클래스가 같다', () => {
    const react = renderReact(PAYLOAD)
    const sSec = server.querySelector('section')!; const rSec = react.querySelector('section')!
    expect(Array.from(sSec.children).map((c) => c.className)).toEqual(Array.from(rSec.children).map((c) => c.className))
    expect(sSec.className).toBe(rSec.className)
    expect(sSec.className).toBe(`${PC_HOME_FS.sectionBase} ${PC_HOME_FS.sectionCols2}`)
    expect(server.querySelector('section > div')!.className).toBe(rSec.querySelector(':scope > div')!.className)
    expect(server.querySelector('section > div:nth-child(2)')!.className).toBe(rSec.querySelector(':scope > div:nth-child(2)')!.className)
    const sSlide = server.querySelector('section a, section div[class*="justify-end"]')!; const rSlide = rSec.querySelector('a, div[class*="justify-end"]')!
    expect(sSlide.className).toBe(rSlide.className)
    expect(server.querySelector('img')!.className).toBe(react.querySelector('img')!.className)
    expect(server.querySelector('strong')!.className).toBe(react.querySelector('strong')!.className)
    expect(server.querySelector('strong')!.textContent).toBe('커피·편의점 교환권, 딜로 바로')
  })
  it('③ 네비 높이 예약(68 + 경계선 + 44) 과 색면·컨테이너 — PcHomePage·DesktopTopNav 의 클래스와 같다', () => {
    expect(html).toContain(`<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`)
    expect(html).toContain(`<div class="${PC_HOME_FS.field}"><div class="${PC_HOME_FS.container}">`)
    const nav = readRaw('src/components/main/DesktopTopNav.tsx')
    expect(nav).toContain("'flex items-center gap-3 h-[68px] max-w-[1440px] mx-auto w-full px-5 lg:px-8'")
    expect(nav).toMatch(/className="border-t border-gray-100 dark:border-\[#2C2F35\]">[\s\S]{0,900}className="h-11 flex items-center/)
    const page = readRaw('src/pages/pc-home/PcHomePage.tsx')
    expect(page).toContain(`className="${PC_HOME_FS.field}"`)
    expect(page).toContain(`className="${PC_HOME_FS.container}"`)
    expect(html.startsWith('<div id="ur-first-screen"><div class="hidden md:block">')).toBe(true) // HomeRoute 의 md 분기와 같은 경계
    expect(html).toContain('min-height:34dvh') // 로더는 아래에만
  })
})

describe('④ 폴백 · ⑤⑥ 워커 배선', () => {
  it('strip 배너가 없거나 payload 가 깨지면 "" — 호출부가 로더로 폴백', () => {
    expect(buildPcHomeFirstScreen(JSON.stringify({ success: true, data: [B(8, 'vouchers', 'x')] }), LOADER)).toBe('')
    expect(buildPcHomeFirstScreen('{bad', LOADER)).toBe(''); expect(buildPcHomeFirstScreen(null, LOADER)).toBe('')
    expect(pcHeroBannersFromPayload(PAYLOAD).length).toBe(5) // 상한 5
    expect(pcHomeLcpImage(PAYLOAD)).toBe(cfImage(B(2, 'strip', '').image_url, PC_HERO_IMG.big))
  })
  it('1장이면 한 열, 2장이면 오른쪽 한 칸', () => {
    const one = buildPcHomeFirstScreen(JSON.stringify({ success: true, data: [B(2, 'strip', 'a')] }), LOADER)
    expect(one).toContain(PC_HOME_FS.sectionCols1); expect(one).not.toContain(PC_HOME_FS.sideGrid)
    const two = buildPcHomeFirstScreen(JSON.stringify({ success: true, data: [B(2, 'strip', 'a'), B(3, 'strip', 'b')] }), LOADER)
    expect(two).toContain(PC_HOME_FS.sideRows1)
  })
  it('워커: 데스크톱 UA(폰·크롤러 아님) · 쿼리 없음 · 배너 시드 있음일 때만, LCP 헤더와 함께 — 폰 분기는 그대로', () => {
    const w = readRaw('src/worker/index.ts')
    expect(w).toMatch(/else if \(ssrSlot === 'MAIN' && isMainPage && !url\.search && homeBannersPayload && !shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const pcFirst = buildPcHomeFirstScreen\(homeBannersPayload, urdealLoaderHtml, ssrExtraPayload\); if \(pcFirst\) appendLcpLink\(c\.res\.headers, pcHomeLcpImage\(homeBannersPayload\)\);/)
    expect(w).toMatch(/if \(bannersSeed\?\.payload\) \{ homeNearSeedHtml \+= homeBannersSeedScript\(bannersSeed\.payload\); homeBannersPayload = bannersSeed\.payload \}/)
    expect(w).toMatch(/else if \(ssrSlot === 'MAIN' && ssrExtraPayload && isMainPage && shouldRenderMobileFirstScreen\(/) // 폰 분기 보존
  })
})
