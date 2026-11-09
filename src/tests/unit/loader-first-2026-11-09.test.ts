/**
 * ⏳ "로더 먼저" (2026-11-09 대표 "계속 최적화") — 서버 첫 화면이 없는 소비자 화면도 로더가 앱 CSS 를 기다리지 않는다.
 *   라이브 실측(폰 4G): /search·/cart·/videos 는 HTML 이 0.3~0.5s 에 다 왔는데 첫 그림 1.1~1.5s — 인라인 스타일 로더조차 37KB 앱 CSS 뒤였다.
 *   고정하는 것: ① 로더-먼저 표면 판정(대시보드·임베드·인증 제외) ② 지연이 켜지면 앱 CSS 는 항상 media=print(첫 화면 CSS 유무 무관) + 백스톱 10초
 *   ③ 첫 화면이 없는 표면엔 critical CSS 를 인라인하지 않는다 ④ 워커는 첫 화면 CSS 를 firstScreenApplies 로만 넣는다 ⑤ 로더는 자기 <style> 을 든다.
 *   못 보는 것: HTMLRewriter 런타임(워커 전용) · 실제 첫 그림(배포 뒤 라이브).
 */
import { describe, it, expect } from 'vitest'
import { loaderFirstApplies, cssFirstApplies, firstScreenApplies, criticalCssFor, criticalSurfaceOf, CRITICAL_BACKSTOP_MS } from '@/worker/utils/css-first-boot'
import { brandLoaderMarkup } from '@/shared/brand-loader-markup'
import { readRaw } from '../helpers/source-text'

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

describe('① 표면 판정', () => {
  it.each(['/search', '/cart', '/videos', '/products/3', '/checkout', '/browse', '/u/jiwon/p/2887', '/map?category=x'])('소비자 화면 %s → 로더-먼저', (p) => {
    expect(loaderFirstApplies(p.split('?')[0])).toBe(true); expect(cssFirstApplies(p.split('?')[0], PHONE)).toBe(true); expect(cssFirstApplies(p.split('?')[0], PC)).toBe(true)
  })
  it.each(['/admin', '/admin/login', '/seller/orders', '/agency', '/embed/live/1', '/wholesale/x', '/supplier', '/auth/kakao/callback', '/oauth/x', '/sync/callback', '/api/version'])('%s → 제외', (p) => {
    expect(loaderFirstApplies(p)).toBe(false); expect(cssFirstApplies(p, PHONE)).toBe(false)
  })
  it('③ 첫 화면 없는 표면엔 critical CSS 0 — 알려진 표면은 그대로', () => {
    expect(criticalSurfaceOf('/search')).toBeNull(); expect(criticalCssFor('/search', 'FULL', 'HOME', { detail: 'D' })).toBe('')
    expect(criticalCssFor('/pass/1', 'FULL', 'HOME', { detail: 'D' })).toBe('D'); expect(criticalCssFor('/', 'FULL', 'HOME', {})).toBe('HOME')
    expect(firstScreenApplies('/search', PHONE)).toBe(false)
  })
})

describe('②④⑤ 배선', () => {
  const mod = readRaw('src/worker/utils/css-first-boot.ts')
  it('지연이 켜지면 앱 CSS 링크는 항상 media=print — crit 조건 밖', () => {
    const body = mod.slice(mod.indexOf('export function applyCssFirstBoot'))
    expect(body).toMatch(/if \(!on\) return rw[\s\S]{0,900}rw = rw\.on\('link\[rel="stylesheet"\]'/) // 2026-11-09 토큰판(styleCss) 줄이 사이에 끼어 창을 900 으로
    expect(body).not.toMatch(/if \(crit\) \{\s*rw = rw\.on\('link\[rel="stylesheet"\]'/)
    expect(body).toMatch(/cssFirstBootScript\(nonce, true\)/) // 백스톱은 늘 첫 화면용(10초) — 앱 CSS 없이 React 를 켜지 않는다
    expect(CRITICAL_BACKSTOP_MS).toBe(10000)
  })
  it('워커: 첫 화면 CSS 는 firstScreenApplies 일 때만 넣는다 · 라우트 청크 rel 도 같은 cssFirst', () => {
    const w = readRaw('src/worker/index.ts')
    expect(w).toContain("applyCssFirstBoot(new HTMLRewriter(), nonce, cssFirst, firstScreenApplies(url.pathname, c.req.header('user-agent') || '', authed) ? criticalCssFor(url.pathname) : '')")
    expect(w).toContain('<link rel="${routePreloadRel(cssFirst)}" crossorigin href=')
  })
  it('로더는 자기 <style> 을 들고 있어 앱 CSS 없이 그려진다', () => {
    const html = brandLoaderMarkup(4, true)
    expect(html).toMatch(/<style>[^<]*\.ur-ldr\{/)
    expect(html).toContain('ur-ldr-shy') // 0.5초 안에 끝나면 안 보인다 — 깜빡임 없음
  })
})
