/**
 * 🌆 2026-11-02 대표 *"홈 화면 밀림 해결해줘. 처음 유어딜 켤 때 꽤 로딩 걸려"* — 홈 맨 위 지역 사진을 **서버 첫 화면**이 그린다.
 *
 * 실사용(11-02 폰 홈 p75): LCP 1,980ms 중 1,564ms 가 "화면 도착 → 그 사진 요청 출발" 이었다(사진이 앱 부팅 뒤에야 생겨서).
 * 지키는 것: ① 쿠키 없음(처음 온 손님) = 전국 = 전국 그림(11-03 서울 → 동네 가게 거리) ② `none` = 사진 없는 머리(종전 sticky) ③ 아는 slug = 그 사진
 *   ④ 모르는 값·깨진 값 = 서울 ⑤ 서버 사진 머리의 클래스가 화면 소스와 같다 ⑥ 화면은 서버 사진을 페이드 없이 이어받고
 *   ⑦ 다음 첫 화면을 위해 쿠키를 남긴다 ⑧ 워커가 쿠키를 넘긴다.
 * ⚠️ 못 보는 것: 실제 LCP(라이브에서 잰다) · 다크 모드 그라데이션의 픽셀.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildHomeFirstScreen, HOME_FS_CLASS } from '@/worker/utils/home-first-screen'
import { regionHeroFromCookieHeader, homeHeroCookieValue, regionHeroFor } from '@/shared/home-region-hero'

const P = { id: 2915, name: '홍대 돈가스 세트', image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/x.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }
const SEED = JSON.stringify({ success: true, data: [{ id: 1, title: '이런 이용권은 어떠세요?', subtitle: null, products: [P] }] })
const LOADER = '<div style="min-height:100dvh">loader</div>'
const build = (cookie: string | null) => { const host = document.createElement('div'); host.innerHTML = buildHomeFirstScreen(SEED, LOADER, '', cookie); return host }
const seoul = regionHeroFor({})! // 2026-11-03 전국 전용 그림(national) — 변수 이름은 옛 서울 시절 그대로

describe('홈 맨 위 지역 사진 — 서버 첫 화면', () => {
  it('① 쿠키 없음 = 서울 사진이 첫 화면에 있다', () => {
    const h = build(null)
    const img = h.querySelector('img[data-home-hero]') as HTMLImageElement
    expect(img?.getAttribute('src')).toBe(seoul.src)
    expect(h.querySelector(`[data-region-hero="${seoul.slug}"]`)?.className).toBe(HOME_FS_CLASS.heroChrome)
  })
  it('② none = 사진 없는 머리(종전 sticky)', () => {
    const h = build('a=1; ur_home_hero=none; b=2')
    expect(h.querySelector('img[data-home-hero]')).toBeNull()
    expect(h.querySelector('#ur-first-screen > div > div:not(.sr-only)')?.className).toBe(HOME_FS_CLASS.chrome)
  })
  it('③ 아는 slug = 그 사진 · ④ 모르는 값 = 서울', () => {
    expect(build('ur_home_hero=busan').querySelector('img[data-home-hero]')?.getAttribute('src')).toMatch(/busan/)
    expect(regionHeroFromCookieHeader('ur_home_hero=<script>')?.slug).toBe('national')
    expect(regionHeroFromCookieHeader('ur_home_hero=nowhere')?.slug).toBe('national')
    expect(homeHeroCookieValue(null)).toBe('none')
  })
  it('⑤ 서버 사진 머리 클래스가 화면 소스에 그대로 있다', () => {
    const src = readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8')
    expect(src).toContain(`'${HOME_FS_CLASS.heroChrome}'`)
    expect(src).toContain(`className="${HOME_FS_CLASS.heroBg}"`)
    expect(src).toContain('absolute inset-0 h-full w-full object-cover transition-opacity duration-200')
  })
  it('⑥ 화면은 서버 사진을 보인 상태로 이어받고 ⑦ 쿠키를 남긴다', () => {
    const src = readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8')
    expect(src).toMatch(/useState\(\(\) => \{\s*try \{ return !!document\.querySelector\(`img\[data-home-hero="\$\{CSS\.escape\(src\)\}"\]`\)/)
    expect(src).toMatch(/document\.cookie = `\$\{HOME_HERO_COOKIE\}=\$\{homeHeroCookieValue\(hero\)\}; Path=\/; Max-Age=31536000; SameSite=Lax`/)
  })
  it('⑧ 워커가 쿠키를 넘긴다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/buildHomeFirstScreen\(ssrExtraPayload, urdealLoaderHtml, nearLabelFromCookieHeader\(c\.req\.header\('cookie'\)\), c\.req\.header\('cookie'\) \?\? null\)/)
  })
})
