/**
 * 🐢 2026-10-15 — 로딩 화면이 뜨던 페이지 9곳을 청크 병렬화에 등재 + 그 때문에 드러난 묶음기 결함 둘.
 *
 * 배경(대표 *"각 페이지마다도 느리고"* — 소비자 18곳 실측, 느린 4G·CPU 4배·첫 방문):
 *   장바구니(로그아웃) 5.6초 · 마이(로그아웃) 5.1초 — "로그인하세요" 안내 하나를 띄우는 데 가장 느렸다.
 *   API 대기는 0 이었다. 그 페이지들이 워커의 청크 맵에 없어서 페이지 청크가 **앱 부팅(약 2.5초) 뒤에야**
 *   출발했고, 그 사이 `load` 가 지나 센트리(129KB)가 같은 회선을 나눠 썼다.
 *   ⇒ 맵에 올리면 엔트리와 병렬로 받고, preload 는 `load` 를 붙들어 센트리도 페이지 뒤로 밀린다.
 *
 * 등재하자 묶음기(`scripts/surface-chunks.mjs`)의 결함 둘이 드러났다(`check-surface-budgets` 가 잡았다):
 *   ① **lazy 사용자까지 공용 기준에 셌다** — 장바구니·숙소 상세가 결제 위젯을 *나중에* 부르는 것만으로 사용자가 4곳을
 *      넘어 위젯이 `lz-common`(모든 화면이 정적으로 받는 봉투)에 들어갔고, stripe·toss 를 끌고 와 **전 화면 +15~21KB(br)**.
 *   ② **공용 기준이 고정값 4** — 표면이 10 → 19 로 늘자 새 표면 넷이 같이 쓰는 모듈이 전부 공용이 돼 **전 화면 +7~9KB**.
 *      기준을 표면 수에 비례(40%)시키면 10곳일 때 4(종전과 같다), 19곳이면 8.
 *
 * ⚠️ 못 막는 것: 실제 바이트(빌드 후 `check-surface-budgets` 의 몫) · 로그인 판정이 쿠키(`ur_session`)와 앱(`localStorage`)
 *   에서 갈리는 경우(preload 가 빗나갈 뿐 화면은 같다) · 실제로 빨라졌는지(브라우저 실측의 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createSurfaceChunker } from '../../../scripts/surface-chunks.mjs'
import { ROUTES } from '../../../scripts/generate-route-chunk-map.mjs'
import { stripComments, readCode } from '../helpers/source-text'

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
    expect((ROUTES as Record<string, string[]>)[key]).toContain(file)
    expect(() => readFileSync(file, 'utf-8')).not.toThrow()
  })
  it('지역은 시/도·허브 두 페이지 모두', () => {
    expect(ROUTES.region).toEqual(['src/pages/region/RegionPage.tsx', 'src/pages/region/RegionIndexPage.tsx'])
  })
  it('로그인 화면(셀러 도구와 코드를 나눠 쓰는 페이지)은 등재하지 않는다 — 대시보드 청크 무접촉', () => {
    const files = Object.values(ROUTES as Record<string, string[]>).flat()
    expect(files).not.toContain('src/pages/UserProfilePage.tsx')
    expect(files).not.toContain('src/pages/MyVouchersPage.tsx')
  })
})

describe('② 워커가 경로를 표면으로 고른다', () => {
  const w = stripComments(readCode('src/worker/index.ts'))
  const block = w.slice(w.indexOf('const chunkSurface ='), w.indexOf('const routeChunks ='))
  it('로그인 전 탭은 세션 쿠키가 없을 때만 guest 표면', () => {
    expect(w).toMatch(/const authed = \/\(\?:\^\|;\\s\*\)ur_session=\/\.test\(c\.req\.header\('cookie'\) \|\| ''\)/)
    expect(block).toContain("url.pathname === '/u/me' && !authed ? 'guestUShop'")
    expect(block).toContain("url.pathname === '/user/profile' ? (authed ? null : 'guestMy')")
    expect(block).toContain("url.pathname === '/my-vouchers' ? (authed ? null : 'guestPass')")
  })
  it('/u/me 판정이 유어샵(/u/:handle) 판정보다 먼저 온다 — 뒤면 로그아웃 방문자가 유어샵 청크를 받는다', () => {
    const me = block.indexOf("'/u/me'")
    const shop = block.indexOf("'linkshop'")
    expect(me).toBeGreaterThan(-1)
    expect(shop).toBeGreaterThan(-1)
    expect(me).toBeLessThan(shop)
  })
  it('공개 페이지 표면', () => {
    for (const s of ["'/cart' ? 'cart'", "'/search' ? 'search'", "'/faq' ? 'faq'", "'/stays' ? 'stays'", "'stayDetail'", "'region'"]) {
      expect(block).toContain(s)
    }
  })
})

describe('③ 묶음기 — lazy 로만 쓰는 모듈은 공용 봉투(lz-common)로 끌어올리지 않는다', () => {
  // 가짜 그래프: 페이지 4곳이 pay.ts 를 **나중에(lazy)** 부른다. 그리고 shared.ts 는 4곳이 정적으로 쓴다.
  function graph() {
    const big = 'x'.repeat(5000)
    const mods: Record<string, { isEntry?: boolean; importedIds: string[]; dynamicallyImportedIds?: string[]; code?: string }> = {
      [P('src/main.tsx')]: { isEntry: true, importedIds: [] },
      [P('src/pay.ts')]: { importedIds: [], code: big },
      [P('src/tinyPay.ts')]: { importedIds: [], code: 'x' },
      [P('src/shared.ts')]: { importedIds: [], code: big },
    }
    for (const n of ['A', 'B', 'C', 'D']) {
      mods[P(`src/pages/${n}.tsx`)] = { importedIds: [P('src/shared.ts')], dynamicallyImportedIds: [P('src/pay.ts')], code: big }
    }
    mods[P('src/pages/A.tsx')].dynamicallyImportedIds!.push(P('src/tinyPay.ts'))
    return { getModuleIds: () => Object.keys(mods)[Symbol.iterator](), getModuleInfo: (id: string) => mods[id] ?? null }
  }
  const routes = { a: ['src/pages/A.tsx'], b: ['src/pages/B.tsx'], c: ['src/pages/C.tsx'], d: ['src/pages/D.tsx'] }
  const gate = createSurfaceChunker({ routes, root: ROOT, commonMin: 4, minGroupBytes: 2000 })
  it('정적으로 4곳이 쓰면 공용 — 종전 동작 그대로', () => {
    expect(gate(P('src/shared.ts'), 'app-components', graph())).toBe('lz-common')
  })
  it('lazy 로만 4곳이 쓰면 종전 이름 그대로(공용 봉투가 결제 SDK 를 정적으로 끌고 오지 않게)', () => {
    expect(gate(P('src/pay.ts'), 'payments', graph())).toBe('payments')
  })
  it('lazy 로만 쓰는 작은 묶음도 공용으로 합치지 않는다', () => {
    expect(gate(P('src/tinyPay.ts'), 'payments', graph())).not.toBe('lz-common')
  })
})

describe('④ 공용 기준은 표면 수에 비례한다', () => {
  it('vite 가 고정값이 아니라 표면 수의 40% 를 쓴다(10곳=4 · 19곳=8)', () => {
    const v = stripComments(readFileSync('vite.config.ts', 'utf8'))
    expect(v).toContain('commonMin: Number(process.env.LZ_COMMON || Math.max(4, Math.ceil(Object.keys(SURFACE_ROUTES).length * 0.4))),')
    const n = Object.keys(ROUTES).length
    expect(n, '표면 수').toBeGreaterThanOrEqual(19)
    expect(Math.max(4, Math.ceil(n * 0.4))).toBeGreaterThanOrEqual(8)
    expect(Math.max(4, Math.ceil(10 * 0.4))).toBe(4)
  })
})
