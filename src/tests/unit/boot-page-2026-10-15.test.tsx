/**
 * 🚀 하드로드·탭 이동 때 "페이지 로딩 중" 단계를 건너뛴다 (2026-10-15 대표 *"가장 이상적이고 영구적으로"*).
 *
 * 라이브 실측(이용권 상세, 느린 4G · CPU 4배, 측정기 부하 없이):
 *   - 하드로드: 페이지 코드는 HTML 단계에서 이미 받아 두는데도 React.lazy 가 첫 렌더에서 한 번 멈춰
 *     폴백을 그리고, React 18 은 폴백을 그린 뒤 **최소 0.5초** 가 지나야 내용을 드러낸다.
 *     같은 문서로 A/B 7회 — 누를 수 있게 되는 시각 중간값 2.93 → 2.74초(7회 전부 개선).
 *   - 홈 → 상세: 카드가 상세 코드를 미리 받아 두고도 누를 때마다 "페이지 로딩 중" 이 0.35초 떴다(3회 전부).
 *     그 미리받기가 `import()` 를 직접 불러 **코드만 받고** 화면 컴포넌트는 "준비됨" 으로 안 바뀌었기 때문이다.
 *
 * 이 시험이 지키는 것
 *   ① lazyPage — 준비되면 Suspense 없이 그린다(서버 렌더로 동기 판정)
 *   ② preloadBootPage — 상한·실패에서 앱을 붙잡지 않는다
 *   ③ 표면 판정은 워커와 앱이 같은 함수(routeSurface)
 *   ④ 하드로드 미리받기 표면(ROUTES ∪ PRELOAD_ONLY_ROUTES) 전부에 부팅 로더가 등록돼 있다
 *   ⑤ main.tsx 가 첫 렌더 **전에** 기다린다
 *   ⑥ 미리받기 지점이 페이지를 `import()` 로 직접 받지 않는다(받으면 ①이 무력화된다)
 *   ⑦ loadRoute — 모듈을 돌려주고, 중복 없이, 실패하면 다시 받는다
 *   ⑧ 사업자 유어샵 페이지 래퍼는 하나뿐
 *
 * ⚠️ 이 시험이 못 보는 것: 실제로 몇 ms 빨라지는지(브라우저 측정만 판정한다 — scratch `abboot.mjs`/`spanav.mjs`
 *    방식) · React 의 공개 지연 값 자체(React 내부) · 등록은 됐는데 그 표면의 실제 라우트가 다른 컴포넌트를 그리는 경우.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { readCode } from '@/tests/helpers/source-text'
import { lazyPage, preloadBootPage, registerBootPage, bootSurface } from '@/lib/boot-page'
import { routeSurface, isCuratorShopPath, HOME_DESKTOP_QUERY } from '@/shared/route-surface'
// 생성기 모듈은 .d.mts 를 두지 않는다 — 그 파일은 생성 본문(템플릿) 안에도 `export const` 줄이 있어
// pre-push-roots 의 '.d.mts 계약' 검사와 충돌한다. 경로를 변수로 넘겨 타입 해석을 건너뛴다.
const GEN = '../../../scripts/generate-route-chunk-map.mjs'
const { ROUTES, PRELOAD_ONLY_ROUTES } = (await import(/* @vite-ignore */ GEN)) as {
  ROUTES: Record<string, string[]>; PRELOAD_ONLY_ROUTES: Record<string, string[]>
}

describe('① lazyPage — 준비되면 lazy 를 거치지 않는다', () => {
  it('load() 전에는 멈춘다(경계 없이 렌더하면 던진다)', () => {
    const Page = lazyPage(() => Promise.resolve({ default: (p: { who: string }) => createElement('b', null, `hi ${p.who}`) }))
    expect(() => renderToString(createElement(Page, { who: 'x' }))).toThrow()
  })
  it('load() 뒤에는 **한 번도 렌더한 적 없어도** 바로 그린다', async () => {
    // ⚠️ 위 시험과 래퍼를 따로 쓴다 — 한 번 렌더하면 React.lazy 자신이 풀려 버려, 이 시험이 lazyPage 의 동작이 아니라
    //    lazy 의 캐시를 재게 된다(주입으로 확인한 함정 — '늘 lazy 로 그린다' 결함에 초록이 떴다).
    const Page = lazyPage(() => Promise.resolve({ default: (p: { who: string }) => createElement('b', null, `hi ${p.who}`) }))
    await Page.load()
    expect(renderToString(createElement(Page, { who: 'urdeal' }))).toContain('hi urdeal')
  })
  it('같은 래퍼의 load 는 몇 번 불러도 같은 컴포넌트를 준다', async () => {
    const C = () => createElement('i', null, 'c')
    const Page = lazyPage(() => Promise.resolve({ default: C }))
    const a = await Page.load(); const b = await Page.load()
    expect(a.default).toBe(C); expect(b.default).toBe(C)
  })
})

describe('② preloadBootPage — 앱을 붙잡지 않는다', () => {
  it('등록된 로더가 끝나면 true', async () => {
    registerBootPage('faq', () => Promise.resolve())
    expect(await preloadBootPage('faq', 200)).toBe(true)
  })
  it('상한을 넘으면 false 로 끝난다(끝나지 않는 로더)', async () => {
    registerBootPage('search', () => new Promise(() => {}))
    const t = Date.now()
    expect(await preloadBootPage('search', 30)).toBe(false)
    expect(Date.now() - t).toBeLessThan(1000)
  })
  it('실패하면 false — 던지지 않는다', async () => {
    registerBootPage('cart', () => Promise.reject(new Error('chunk 404')))
    await expect(preloadBootPage('cart', 200)).resolves.toBe(false)
  })
  it('표면이 없거나 등록이 없으면 false', async () => {
    expect(await preloadBootPage(null)).toBe(false)
    expect(await preloadBootPage('urshorts', 50)).toBe(false)
  })
})

describe('③ 표면 판정은 한 함수 — 워커와 앱', () => {
  const worker = readCode('src/worker/index.ts')
  it('워커는 routeSurface 를 부르고 자기 정규식 사슬을 갖지 않는다', () => {
    expect(worker).toMatch(/const chunkSurface = routeSurface\(url\.pathname, isMobileUserAgent\(c\.req\.header\('user-agent'\)\), authed\)/)
    expect(worker).not.toMatch(/\? 'gbDetail'/)
  })
  it('앱 부팅도 같은 함수를 쓴다', () => {
    expect(readCode('src/lib/boot-page.tsx')).toMatch(/routeSurface\(location\.pathname,/)
  })
  it.each([
    ['/', true, false, 'home'], ['/', false, false, 'homePc'],
    ['/pass/2919', true, false, 'gbDetail'], ['/group-buy/12', true, false, 'gbDetail'],
    ['/vouchers/5', true, false, 'voucherDetail'], ['/vouchers', true, false, 'vouchers'],
    ['/products/9', true, false, 'product'], ['/u/jiwon1228', true, false, 'linkshop'],
    ['/u/me', true, false, 'guestUShop'], ['/u/me', true, true, 'linkshop'],
    ['/user/profile', true, false, 'guestMy'], ['/user/profile', true, true, null],
    ['/my-vouchers', true, false, 'guestPass'], ['/my-vouchers', true, true, null],
    ['/stays/3', true, false, 'stayDetail'], ['/region/서울', true, false, 'region'],
    ['/map', true, false, 'map'], ['/checkout', true, false, null],
  ])('%s (mobile=%s authed=%s) → %s', (p, m, a, want) => {
    expect(routeSurface(p, m, a)).toBe(want)
  })
})

describe('④ 하드로드 미리받기 표면 전부에 부팅 로더', () => {
  const src = ['src/App.tsx', 'src/pages/pc-home/HomeRoute.tsx', 'src/routes/seller-public.routes.tsx'].map(readCode).join('\n')
  const registered = new Set([...src.matchAll(/registerBootPage\('([a-zA-Z]+)'/g)].map((m) => m[1]))
  const surfaces = [...Object.keys(ROUTES), ...Object.keys(PRELOAD_ONLY_ROUTES)]
  it('표면 목록이 비어 있지 않다(헛도는 가드 차단)', () => {
    expect(surfaces.length).toBeGreaterThanOrEqual(15)
  })
  it.each(surfaces)('%s', (s) => {
    expect(registered.has(s), `${s} 표면에 registerBootPage 가 없다 — 하드로드에서 "페이지 로딩 중" 단계가 다시 생긴다`).toBe(true)
  })
  it('부팅 로더는 lazyPage 의 load 다(같은 래퍼라야 준비됨이 된다)', () => {
    for (const m of src.matchAll(/registerBootPage\('[a-zA-Z]+', ([A-Za-z]+)\.load\)/g)) {
      expect(src, `${m[1]} 는 lazyPage 로 만들어야 한다`).toMatch(new RegExp(`(?:const ${m[1]} = lazyPage\\(|export const ${m[1]} = lazyPage\\(|import \\{ ${m[1]} \\})`))
    }
  })
})

describe('⑤ main.tsx 가 첫 렌더 전에 기다린다', () => {
  const main = readCode('src/main.tsx')
  it('await preloadBootPage(bootSurface()) 가 createRoot 앞에 있다', () => {
    // 2026-10-18: PC 상단 네비 준비와 같이 기다린다(Promise.all) — 불변식(첫 렌더 전에 기다린다)은 그대로
    expect(main).toMatch(/await Promise\.all\(\[preloadBootPage\(bootSurface\(\)\)/)
    const a = main.indexOf('preloadBootPage(bootSurface())')
    const b = main.indexOf('ReactDOM.createRoot(rootElement)')
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a)
  })
})

describe('⑥ 미리받기 지점이 페이지를 import() 로 직접 받지 않는다', () => {
  it.each([
    ['src/pages/main-home/GroupBuyFeedCard.tsx', "loadRoute('gbDetail')"],
    ['src/components/main/BottomNav.tsx', "loadRoute('vouchers')"],
  ])('%s', (f, want) => {
    const code = readCode(f)
    expect(code).not.toMatch(/import\(['"]@\/pages\//)
    expect(code).toContain(want)
  })
  it('로더 이름은 App.tsx·seller-public.routes 가 등록한 것뿐이다', () => {
    const reg = ['src/App.tsx', 'src/routes/seller-public.routes.tsx'].map(readCode).join('\n')
    const names = new Set([...reg.matchAll(/registerRoutePreload\('([a-zA-Z]+)'/g)].map((m) => m[1]))
    const used = ['src/pages/main-home/GroupBuyFeedCard.tsx', 'src/components/main/BottomNav.tsx']
      .flatMap((f) => [...readCode(f).matchAll(/loadRoute\('([a-zA-Z]+)'\)/g)].map((m) => m[1]))
    expect(used.length).toBeGreaterThanOrEqual(6)
    for (const n of used) expect(names.has(n), `loadRoute('${n}') 는 등록돼 있지 않다 — 조용히 아무것도 안 받는다`).toBe(true)
  })
})

describe('⑦ loadRoute', () => {
  it('모듈을 돌려주고 한 번만 받는다', async () => {
    const rp = await import('@/lib/route-preload')
    let n = 0
    rp.registerRoutePreload('t1', () => { n++; return Promise.resolve({ warm: 1 }) })
    const a = await rp.loadRoute('t1'); const b = await rp.loadRoute('t1')
    expect(a).toEqual({ warm: 1 }); expect(b).toBe(a); expect(n).toBe(1)
  })
  it('실패하면 다음에 다시 받는다', async () => {
    const rp = await import('@/lib/route-preload')
    let n = 0
    rp.registerRoutePreload('t2', () => { n++; return n === 1 ? Promise.reject(new Error('net')) : Promise.resolve('ok') })
    await expect(rp.loadRoute('t2')).rejects.toThrow()
    await expect(rp.loadRoute('t2')).resolves.toBe('ok')
  })
})

describe('⑧ 사업자 유어샵 페이지 래퍼는 하나', () => {
  it('SellerPublicPage 를 lazy 로 직접 감싸는 곳이 없다', () => {
    const files = ['src/App.tsx', 'src/pages/CuratorPage.tsx', 'src/routes/seller-public.routes.tsx']
    for (const f of files) expect(readCode(f)).not.toMatch(/lazy\(\(\) => import\(['"][^'"]*SellerPublicPage['"]\)\)/)
    for (const f of ['src/pages/CuratorPage.tsx', 'src/routes/seller-public.routes.tsx']) expect(readCode(f)).toMatch(/from '[^']*lazy-seller-public'/)
  })
  it('래퍼 파일이 실재한다', () => {
    expect(fs.existsSync(path.resolve('src/pages/seller-public/lazy-seller-public.ts'))).toBe(true)
  })
})

/**
 * 🧪 2026-10-15 CI(chunks)가 잡은 두 결함 — 빌드·화면 정상, 안 쓸 코드만 미리 받았다.
 *   ⑨ 부팅이 홈을 **UA** 로 골랐다. 렌더러(HomeRoute)는 **뷰포트**로 고른다 → 좁은 창의 데스크톱 브라우저가
 *      PC 홈(lz-homePc · lz-homePc-map)을 받았다(폰 430 · 데스크톱 UA 하네스에서 청크 27 → 30).
 *   ⑩ 유어샵 표면에 두 페이지(CuratorPage · SellerPublicPage)를 다 걸어, `/u/*` 에서 안 그릴 사업자 페이지를 받았다(26 → 28).
 */
describe('⑨ 홈 표면은 뷰포트로 — HomeRoute 와 같은 쿼리', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const stub = (desktopViewport: boolean, ua: string) => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === HOME_DESKTOP_QUERY ? desktopViewport : false }))
    vi.stubGlobal('location', { pathname: '/' })
    vi.stubGlobal('navigator', { userAgent: ua })
  }
  const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'
  const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  it('좁은 창 + 데스크톱 UA → home (UA 가 아니라 뷰포트)', () => {
    stub(false, DESKTOP_UA)
    expect(bootSurface()).toBe('home')
  })
  it('넓은 창 + 폰 UA → homePc', () => {
    stub(true, PHONE_UA)
    expect(bootSurface()).toBe('homePc')
  })
  it('HomeRoute 가 같은 상수로 고른다(두 벌 금지)', () => {
    const home = readCode('src/pages/pc-home/HomeRoute.tsx')
    expect(home).toMatch(/useMediaQuery\(HOME_DESKTOP_QUERY\)/)
    expect(home).not.toMatch(/useMediaQuery\('\(min-width/)
  })
})

describe('⑩ 유어샵 표면 안에서 그 주소가 그리는 페이지만 받는다', () => {
  it.each([
    ['/u/jiwon1228', true], ['/u/me', true], ['/u', true],
    ['/profile/store1', false], ['/s/store1', false], ['/user/profile', false],
  ])('%s → CuratorPage=%s', (p, want) => {
    expect(isCuratorShopPath(p)).toBe(want)
  })
  it('CuratorPage 부팅 로더는 /u/* 에서만, SellerPublicPage 는 그 밖에서만', () => {
    expect(readCode('src/App.tsx')).toMatch(/registerBootPage\('linkshop', \(\) => \(isCuratorShopPath\(location\.pathname\) \? CuratorPage\.load\(\) : Promise\.resolve\(\)\)\)/)
    expect(readCode('src/routes/seller-public.routes.tsx')).toMatch(/registerBootPage\('linkshop', \(\) => \(isCuratorShopPath\(location\.pathname\) \? Promise\.resolve\(\) : SellerPublicPage\.load\(\)\)\)/)
  })
})
