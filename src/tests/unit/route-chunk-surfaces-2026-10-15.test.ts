/**
 * 🐢 2026-10-15 — 로딩 화면이 뜨던 페이지 9곳을 청크 병렬화에 등재 + 그 때문에 드러난 묶음기 결함 둘.
 *
 * 배경(대표 *"각 페이지마다도 느리고"* — 소비자 18곳 실측, 느린 4G·CPU 4배·첫 방문):
 *   장바구니(로그아웃) 5.6초 · 마이(로그아웃) 5.1초 — "로그인하세요" 안내 하나를 띄우는 데 가장 느렸다.
 *   API 대기는 0 이었다. 그 페이지들이 워커의 청크 맵에 없어서 페이지 청크가 **앱 부팅(약 2.5초) 뒤에야**
 *   출발했고, 그 사이 `load` 가 지나 센트리(129KB)가 같은 회선을 나눠 썼다.
 *   ⇒ 맵에 올리면 엔트리와 병렬로 받고, preload 는 `load` 를 붙들어 센트리도 페이지 뒤로 밀린다.
 *
 * 🩸 처음엔 `ROUTES` 에 넣었다 — 그 표는 vite 묶음기(`scripts/surface-chunks.mjs`)의 입력이기도 해서 묶음이 다시 짜였다:
 *   결제 위젯이 공용 봉투로 가 전 화면 +15~21KB(br)(묶음기가 lazy 사용자까지 공용 기준에 센다) · 기준을 올리면 파일 +2~5개.
 *   ⇒ **preload 전용 표(`PRELOAD_ONLY_ROUTES`)** 로 분리 — 청크 구성은 1바이트도 안 바뀌고 출발 시점만 당겨진다.
 *   (묶음기의 lazy 계산은 이 PR 범위 밖이다 — 그 표면들을 `ROUTES` 로 옮기는 날 다시 드러난다. 인계 문서 참조.)
 *
 * ⚠️ 못 막는 것: 실제 바이트(빌드 후 `check-surface-budgets` 의 몫) · 로그인 판정이 쿠키(`ur_session`)와 앱(`localStorage`)
 *   에서 갈리는 경우(preload 가 빗나갈 뿐 화면은 같다) · 실제로 빨라졌는지(브라우저 실측의 몫).
 */
import { routeSurface } from '@/shared/route-surface'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments, readCode } from '../helpers/source-text'

// 생성기는 .d.mts 를 둘 수 없다 — 본문의 템플릿 문자열(생성 파일의 `export const …`)이 계약 검사(pre-push-roots)에 export 로 읽힌다.
const GEN_PATH = '../../../scripts/generate-route-chunk-map.mjs'
const { ROUTES, PRELOAD_ONLY_ROUTES } = (await import(GEN_PATH as string)) as { ROUTES: Record<string, string[]>; PRELOAD_ONLY_ROUTES: Record<string, string[]> }

const ROOT = '/repo'
const P = (f: string) => path.join(ROOT, f)

describe('① 로딩 화면이 뜨던 페이지가 청크 병렬화에 등재돼 있다', () => {
  const NEW = {
    cart: 'src/pages/CartPage.tsx',
    search: 'src/pages/SearchPage.tsx',
    faq: 'src/pages/FAQPage.tsx',
    stays: 'src/pages/StaysSearchPage.tsx',
    stayDetail: 'src/pages/StayDetailPage.tsx',
    guestMy: 'src/pages/guest/GuestMyPage.tsx',
    guestPass: 'src/pages/guest/GuestPassPage.tsx',
    guestUShop: 'src/pages/guest/GuestUrShopPage.tsx',
  } as const
  it.each(Object.entries(NEW))('%s → %s', (key, file) => {
    expect(PRELOAD_ONLY_ROUTES[key]).toContain(file)
    expect(() => readFileSync(file, 'utf-8')).not.toThrow()
  })
  it('지역은 시/도·허브 두 페이지 모두', () => {
    expect(PRELOAD_ONLY_ROUTES.region).toEqual(['src/pages/region/RegionPage.tsx', 'src/pages/region/RegionIndexPage.tsx'])
  })
  it('로그인 화면(셀러 도구와 코드를 나눠 쓰는 페이지)은 등재하지 않는다 — 대시보드 청크 무접촉', () => {
    const files = [...Object.values(ROUTES), ...Object.values(PRELOAD_ONLY_ROUTES)].flat()
    expect(files).not.toContain('src/pages/UserProfilePage.tsx')
    expect(files).not.toContain('src/pages/MyVouchersPage.tsx')
  })
})

describe('② 워커가 경로를 표면으로 고른다', () => {
  // 🧭 2026-10-15: 판정이 공용 함수(shared/route-surface)로 옮겨갔다 — 앱 부팅(lib/boot-page)도 같은 함수를 쓴다.
  //   불변식은 그대로이고, 판정은 이제 소스 문자열이 아니라 **함수를 불러** 본다.
  const w = stripComments(readCode('src/worker/index.ts'))
  it('로그인 전 탭은 세션 쿠키가 없을 때만 guest 표면', () => {
    expect(w).toMatch(/const authed = \/\(\?:\^\|;\\s\*\)ur_session=\/\.test\(c\.req\.header\('cookie'\) \|\| ''\)/)
    expect(w).toContain("const chunkSurface = routeSurface(url.pathname, isMobileUserAgent(c.req.header('user-agent')), authed)")
    expect(routeSurface('/u/me', true, false)).toBe('guestUShop')
    expect(routeSurface('/user/profile', true, false)).toBe('guestMy')
    expect(routeSurface('/user/profile', true, true)).toBe(null)
    expect(routeSurface('/my-vouchers', true, false)).toBe('guestPass')
    expect(routeSurface('/my-vouchers', true, true)).toBe(null)
  })
  it('/u/me 판정이 유어샵(/u/:handle) 판정보다 먼저 온다 — 뒤면 로그아웃 방문자가 유어샵 청크를 받는다', () => {
    expect(routeSurface('/u/me', true, false)).toBe('guestUShop')
    expect(routeSurface('/u/me', true, true)).toBe('linkshop')
    expect(routeSurface('/u/jiwon1228', true, false)).toBe('linkshop')
  })
  it('공개 페이지 표면', () => {
    for (const [p, want] of [['/cart', 'cart'], ['/search', 'search'], ['/faq', 'faq'], ['/stays', 'stays'], ['/stays/12', 'stayDetail'], ['/region/서울', 'region']] as const) {
      expect(routeSurface(p, true, false)).toBe(want)
    }
  })
})

describe('③ preload 전용 표는 묶음기 입력과 섞이지 않는다', () => {
  it('ROUTES(묶음기 입력)에 preload 전용 표면이 없다 — 섞이면 기존 화면 청크가 다시 짜인다', () => {
    for (const k of Object.keys(PRELOAD_ONLY_ROUTES)) expect(Object.keys(ROUTES), k).not.toContain(k)
    expect(Object.keys(PRELOAD_ONLY_ROUTES).length).toBeGreaterThanOrEqual(9)
  })
  it('vite 는 ROUTES 만 묶음기에 넘긴다', () => {
    const v = stripComments(readFileSync('vite.config.ts', 'utf8'))
    expect(v).toContain("import { ROUTES as SURFACE_ROUTES } from './scripts/generate-route-chunk-map.mjs'")
    expect(v).not.toContain('PRELOAD_ONLY_ROUTES')
  })
  it('생성기는 두 표를 모두 맵으로 낸다 — preload 전용 표를 빼먹으면 워커가 주입할 게 없다', () => {
    const g = stripComments(readFileSync('scripts/generate-route-chunk-map.mjs', 'utf8'))
    expect(g).toContain('Object.entries({ ...ROUTES, ...PRELOAD_ONLY_ROUTES })')
  })
})
