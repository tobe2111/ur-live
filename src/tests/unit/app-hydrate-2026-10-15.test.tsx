/**
 * 🧊 서버가 그린 **앱 전체**를 브라우저가 **이어받아도 갈리지 않는다** (2026-10-15 대표 *"가장 이상적이어야 해. 대기업 수준의
 *    로딩 인프라"* — 상세 서버 렌더 3단계, 앱 전체 이어받기).
 *
 * 워커가 `#root` 에 넣는 HTML 은 `src/ssr/pass-detail-entry.tsx` 의 `renderPassApp` 이 만든다. 브라우저는 그 화면을
 * `hydrateRoot` 로 이어받는다(`main.tsx`). 둘의 첫 렌더가 갈리면 React 18 은 그 영역을 **버리고 다시 그린다** —
 * 화면은 멀쩡하고 에러도 0 이라 아무도 모른다(서버 렌더의 이득만 조용히 사라진다).
 *
 * 이 시험은 **실제 진입점 함수**로 서버 HTML 을 만들고(브라우저 전역을 지운 채), 그 HTML 을 **로그인한 브라우저**
 * (user_id·seller_id·위치 캐시·다크 테마·셀러 토큰…)가 이어받게 해서 React 의 회복 오류가 0 인지 센다.
 *
 * 처음 재 봤을 때 11건이었고, 원인은 둘이었다:
 *   ① `AppContent` 가 렌더 중 localStorage·matchMedia 를 직접 읽었다(푸시 설정·사이드배너 문지기) → 서버(없음)와 갈림
 *   ② 그걸 uSES 로 바꿔도 **이어받기 영역의 바깥**(AppContent)에 두면, 영역이 다 이어받아지기 전에 바뀐 값이 흘러들어
 *      "Suspense boundary received an update before it finished hydrating" 로 영역 전체가 다시 그려졌다
 *   ⇒ 값을 읽는 일을 영역 **안쪽의 작은 부품**(`SignedInOnly`·`WideOnly`)으로 옮겼다. 새 셸 부품도 이 규칙을 따른다.
 *
 * 이 시험이 못 보는 것: 문구(i18n) 일치 — 이 환경은 `react-i18next` 를 모의로 바꿔 양쪽이 같은 기본 문구를 쓴다.
 *   실제 문구 일치는 서버·브라우저가 같은 `@/i18n` 의 `i18nReady` 를 기다린다는 배선(아래 ③)과 번들 스모크가 지킨다.
 *   그리고 실제 브라우저에서의 갈림 수는 배포 뒤 HYD 표본(`reportHydration`)으로 본다.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { hydrateRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import ThemeProvider from '@/components/ThemeProvider'
import { queryClient } from '@/lib/react-query'
import { renderPassApp } from '@/ssr/pass-detail-entry'
import { readCode } from '@/tests/helpers/source-text'

const PRODUCT = {
  id: 2919, seller_id: 26, name: '달빛한스푼 닭도리탕', description: '달빛한스푼 이용권',
  price: 31000, original_price: 35000, discount_rate: 0,
  image_url: 'https://media.ur-team.com/uploads/seller/26/a.jpg', thumbnail: null,
  images: '["https://media.ur-team.com/uploads/seller/26/a.jpg"]',
  category: 'meal_voucher', stock: 99, stock_quantity: 0, is_active: 1, deal_only: 0, sold_count: 0,
  review_count: 0, avg_rating: 0, dominant_color: '#743e20', detail_images: null, long_description: null,
  group_buy_target: 0, group_buy_current: 1, group_buy_status: 'active', group_buy_deadline: null, group_buy_tiers: null,
  restaurant_name: '달빛한스푼', restaurant_address: '서울 마포구 테스트로 1', restaurant_phone: '02-000-0000',
  restaurant_lat: 37.49, restaurant_lng: 126.98, voucher_expiry: '2026-12-31 15:30:00', voucher_terms: null,
  referral_commission_rate: null, created_at: '2026-10-07 04:32:30', updated_at: '2026-10-07 04:55:56',
  seller_name: '달빛한스푼', seller_username: 'store_x', seller_avatar: null, seller_bio: null,
  seller_instagram: null, seller_youtube: null, seller_tiktok: null, seller_facebook: null,
  current_discount_pct: 0, next_tier: null, next_tier_remaining: null, qty_cap: 10, kakao_place_url: null,
}
const URL_ = '/pass/2919'

/** 서버처럼 — 브라우저 전역을 지운 채 실제 진입점으로 그린다(첫 호출에서 문구·페이지 모듈을 준비한 뒤). */
async function serverHtml(url = URL_): Promise<string> {
  await renderPassApp(PRODUCT, url) // 준비(i18nReady · preloadBootPage) — 이 호출은 전역이 있어도 된다
  vi.stubGlobal('window', undefined); vi.stubGlobal('document', undefined)
  vi.stubGlobal('localStorage', undefined); vi.stubGlobal('sessionStorage', undefined)
  vi.stubGlobal('navigator', undefined); vi.stubGlobal('matchMedia', undefined)
  try {
    return await renderPassApp(PRODUCT, url)
  } finally {
    vi.unstubAllGlobals()
  }
}

/** 브라우저처럼 — main.tsx 와 같은 트리를 이어받게 하고 React 의 회복 오류를 센다. */
async function hydrateErrors(html: string, url = URL_): Promise<string[]> {
  queryClient.clear()
  const seed = document.createElement('script')
  seed.id = '__SSR_INITIAL_DETAIL__'; seed.type = 'application/json'
  seed.textContent = JSON.stringify({ success: true, data: PRODUCT })
  document.head.appendChild(seed)
  const host = document.createElement('div'); host.id = 'root'; host.innerHTML = html
  document.body.appendChild(host)
  const errors: string[] = []
  const onErr = (ev: ErrorEvent) => { errors.push(String(ev.error?.message || ev.message)); ev.preventDefault() }
  window.addEventListener('error', onErr)
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | null = null
  try {
    await act(async () => {
      root = hydrateRoot(host, <ThemeProvider><App Router={MemoryRouter as never} routerProps={{ initialEntries: [url] }} /></ThemeProvider>, {
        onRecoverableError: (e) => { errors.push(String(e)) },
      })
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 300)) }) // 늦게 도는 이펙트·이어받기 마저
  } finally {
    spy.mockRestore()
    window.removeEventListener('error', onErr)
    act(() => { root?.unmount() })
    host.remove(); seed.remove()
  }
  return errors
}

beforeAll(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark'); vi.unstubAllGlobals() })

describe('① 서버가 앱 전체를 그린다(브라우저 전역 없이)', () => {
  it('상품·하단 탭이 있고, 로딩 화면이나 "브라우저에서 그려라" 자리가 없다', async () => {
    const html = await serverHtml()
    expect(html).toContain('달빛한스푼 닭도리탕')
    expect(html).toContain('aria-label="마이"')
    expect(html).not.toMatch(/페이지 로딩/)
    expect(html, '첫 화면이 서버에서 못 그리는 lazy 를 쓴다 — 그 자리는 이어받기가 아니라 새로 그려진다').not.toContain('<!--$!-->')
  })
})

describe('② 브라우저가 이어받아도 갈리지 않는다', () => {
  it('로그인 전 브라우저 — 회복 오류 0', async () => {
    expect(await hydrateErrors(await serverHtml())).toEqual([])
  })
  it('로그인·셀러·위치·다크 테마가 다 있는 브라우저 — 회복 오류 0', async () => {
    const html = await serverHtml()
    for (const [k, v] of Object.entries({
      user_id: '3', seller_id: '26', admin_id: '10', agency_id: '4', user_type: 'user', session_login: '1',
      access_token: 'x', seller_token: 'y', user_handle: 'jiwon1228', seller_username: 'store_x',
      user_profile_image: 'https://x/y.jpg', ur_last_loc_v1: JSON.stringify({ lat: 37.5, lng: 127 }), ur_theme_mode_v1: 'dark',
      'urq:balance': '50000', // 딜 잔액 캐시 — 결제 버튼 문구('N딜로 결제하기')를 가른다
    })) localStorage.setItem(k, v)
    document.documentElement.classList.add('dark')
    expect(await hydrateErrors(html)).toEqual([])
  })
  it('쿼리가 붙은 주소(?ref=)도 같은 주소로 그리고 이어받는다', async () => {
    const url = '/pass/2919?ref=7'
    expect(await hydrateErrors(await serverHtml(url), url)).toEqual([])
  })
})

describe('③ 문구·주소를 서버와 같게 만드는 배선', () => {
  it('서버 진입점은 브라우저와 같은 @/i18n 의 i18nReady 와 부팅 페이지 준비를 기다린 뒤 그린다', () => {
    const e = readCode('src/ssr/pass-detail-entry.tsx')
    expect(e).toMatch(/import \{ i18nReady \} from '@\/i18n'/)
    expect(e).toMatch(/Promise\.all\(\[i18nReady, preloadBootPage\('gbDetail'\)\]\)/)
    expect(e).toMatch(/<ThemeProvider>\s*<App\s/)
    expect(e).toMatch(/queryClient=\{qc\}/)
  })
  it('브라우저는 이어받기 전에 같은 i18nReady 를 기다린다', () => {
    expect(readCode('src/main.tsx')).toMatch(/import i18n, \{ i18nReady \} from '\.\/i18n'/)
  })
  it('AppContent 는 렌더 중 localStorage·matchMedia 를 직접 읽지 않는다(이어받기 영역 바깥이다)', () => {
    const app = readCode('src/App.tsx')
    const body = app.slice(app.indexOf('function AppContent()'), app.indexOf('function App('))
    expect(body.length).toBeGreaterThan(2000)
    // 이펙트 안은 서버에서 안 돈다 — 렌더 중 읽기만 막는다: shellNeed 블록과 렌더 반환부
    const shell = body.slice(body.indexOf('const shellNeed = {'), body.indexOf('}', body.indexOf('const shellNeed = {')))
    expect(shell).not.toMatch(/localStorage|matchMedia/)
    expect(body).toMatch(/<SignedInOnly><Suspense fallback=\{null\}><PushNotificationSetup \/><\/Suspense><\/SignedInOnly>/)
    expect(body).toMatch(/<WideOnly query="\(min-width: 1024px\)"[^>]*><Suspense fallback=\{null\}><SideBanner \/><\/Suspense><\/WideOnly>/)
  })
})
