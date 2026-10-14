/**
 * 🔗🗺️ 같은 페이지의 다른 철자는 301 · 페이지가 아닌 꼬리는 404 (2026-10-14, 대표 "계속 진행해").
 *
 * ## 실측 (라이브 `urdeal.kr`, Googlebot UA)
 *
 *     /faq/index.html     200 · canonical 자기자신 · 제목이 **제네릭 홈**
 *     /blog/              200 · canonical `/blog/`  · 제목이 **제네릭 홈**
 *     /products/2917/     200 · canonical `/products/2917/`
 *     /faq/zzzqqq         200 · index, follow · canonical 자기자신
 *     /browse/zz · /map/zz · /urshorts/zz · /gdpr/zz · /partners/zz
 *     /join/zz · /videos/zz · /privacy/zz · /refund/zz · /new-openings/zz   전부 같다
 *     /faq/a/b/c          200 · index, follow
 *
 * ## 두 가지를 섞지 않는다
 *
 * 1. **같은 내용, 다른 철자** → 301 (`normalizeDocPath`). 404 로 던지면 그 링크의 가치를 버리고
 *    사람에게도 없는 페이지를 보여 준다.
 * 2. **페이지가 아님** → 404 + noindex (`isKnownAppPath`). 잎 표면(자식 라우트가 없는 최상위)에
 *    아무 꼬리를 달면 무한 thin URL 이 된다.
 *
 * 그래서 **정규화가 먼저**다. 순서가 뒤집히면 `/faq/index.html` 이 404 가 된다(철자 문제인데).
 *
 * ## ⚠️ 이 가드가 못 보는 것
 *
 * - 자식이 *있는* 표면의 쓰레기 꼬리(`/terms/zzzqqq`·`/vouchers/abc`) — 리터럴 자식 모델이 필요하고
 *   `/group-buy/confirm-payment` 가 그 위험의 증거다(숫자 전용 규칙 = 결제 복귀 URL 404). 별건.
 * - 워커 런타임(`Response.redirect` 가 실제로 나가는지) — 배포 후 실측만이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { normalizeDocPath } from '@/shared/seo/path-normalize'
import { isKnownAppPath, KNOWN_PARENT_SEGMENTS, KNOWN_TOP_SEGMENTS } from '@/shared/seo/known-routes'
import { stripComments, readCode } from '../helpers/source-text'

const ROUTE_FILES = [
  'src/App.tsx',
  'src/routes/admin.routes.tsx',
  'src/routes/seller.routes.tsx',
  'src/routes/agency-console.routes.tsx',
]

/** 라우트 표에서 **자식이 있는** 최상위를 다시 계산한다(파라미터 최상위 `:mallSlug` 는 별도 분기). */
function computedParents(): string[] {
  const kids = new Set<string>()
  for (const f of ROUTE_FILES) {
    const s = stripComments(readFileSync(f, 'utf-8'))
    for (const m of s.matchAll(/<Route\s[^>]*?path="([^"]+)"/g)) {
      const segs = m[1].split('/').filter(Boolean)
      if (segs.length > 1 && !segs[0].startsWith(':')) kids.add(segs[0])
    }
  }
  return [...kids].sort()
}

/** 라이브에서 200 + index 였던 잎 표면 꼬리 그대로. */
const LEAF_JUNK = [
  '/browse/zz', '/map/zz', '/urshorts/zz', '/gdpr/zz', '/partners/zz',
  '/join/zz', '/videos/zz', '/privacy/zz', '/refund/zz', '/new-openings/zz',
  '/faq/zzzqqq', '/faq/a/b/c', '/my-orders/123', '/checkout/return',
]

/** 🔴 살아 있어야 하는 경로 — 이 방향이 훨씬 비싸다(색인 복구가 수주). */
const MUST_PASS = [
  '/', '/faq', '/about', '/terms', '/vouchers', '/browse', '/map', '/urshorts',
  '/about/print', '/terms/seller', '/pass/2919', '/products/2917', '/stays/2887',
  '/u/jiwon1228', '/region/서울', '/region/서울/종로구', '/group-buy/confirm-payment',
  '/seller/orders', '/seller/orders/does/not/exist', '/admin/login', '/agency',
  '/account/settings', '/my/deals', '/v/ABC123', '/blog/some-slug', '/zzqqxx/p/2887',
]

describe('🔗 끝 슬래시·index.html 은 301 (같은 내용의 다른 철자)', () => {
  it('① 실측했던 세 모양이 정규화된다', () => {
    expect(normalizeDocPath('/faq/index.html')).toBe('/faq')
    expect(normalizeDocPath('/blog/')).toBe('/blog')
    expect(normalizeDocPath('/products/2917/')).toBe('/products/2917')
    expect(normalizeDocPath('/u/jiwon1228/')).toBe('/u/jiwon1228')
    expect(normalizeDocPath('/about/index.html')).toBe('/about')
  })

  it('②-1 고정점까지 돈다 (두 모양이 겹친 경우)', () => {
    expect(normalizeDocPath('/faq/index.html/')).toBe('/faq')
    expect(normalizeDocPath('/faq//')).toBe('/faq')
    expect(normalizeDocPath('/index.html')).toBe('/')
    // 🔁 두 겹이면 **한 바퀴로 안 끝난다** — 루프가 1회로 줄면 결과가 또 정규화 대상이 되어 루프가 된다.
    expect(normalizeDocPath('/index.html/index.html')).toBe('/')
    expect(normalizeDocPath('/faq/index.html/index.html')).toBe('/faq')
  })

  it('②-2 **멱등** — 정규화된 결과는 더 바꿀 게 없다 (리다이렉트 루프 차단)', () => {
    for (const p of ['/faq/index.html', '/blog/', '/products/2917/', '/faq/index.html/', '/index.html']) {
      const once = normalizeDocPath(p)
      expect(once, p).not.toBeNull()
      expect(normalizeDocPath(once as string), `${p} → ${once} 가 또 정규화된다`).toBeNull()
    }
  })

  it('③ 반대 방향 — 바꿀 게 없으면 null (멀쩡한 URL 을 301 로 보내지 않는다)', () => {
    for (const p of ['/', '/faq', '/blog', '/products/2917', '/u/jiwon1228', '/robots.txt', '/sitemap.xml', '/llms.txt']) {
      expect(normalizeDocPath(p), p).toBeNull()
    }
  })

  it('③-2 워커가 직접 서빙하거나 플랫폼이 가로채는 경로는 무접촉', () => {
    for (const p of ['/api/products/', '/assets/index-abc.js/', '/.well-known/assetlinks.json/', '/cdn-cgi/image/x/']) {
      expect(normalizeDocPath(p), p).toBeNull()
    }
  })

  it('④ 배선 — 워커가 그 함수를 쓰고 `isKnownAppPath` 로 게이트하고 **301** 이다', () => {
    const c = readCode('src/worker/index.ts')
    expect(c).toMatch(/const norm = normalizeDocPath\(url\.pathname\);/)
    // 🔴 게이트가 빠지면 라우트 표에 없는 경로를 301 로 보낸다(그쪽이 더 비싸다).
    expect(c).toMatch(/if \(norm && isKnownAppPath\(norm\)\) return Response\.redirect\(/)
    expect(c).toMatch(/\$\{norm\}\$\{url\.search \|\| ''\}`, 301\)/)
  })

  it('④-2 순서 — 정규화가 블로그 슬러그 301 **앞**이다 (철자를 먼저 한 가지로)', () => {
    const c = readCode('src/worker/index.ts')
    expect(c.indexOf('normalizeDocPath(url.pathname)')).toBeGreaterThan(-1)
    expect(c.indexOf('normalizeDocPath(url.pathname)')).toBeLessThan(c.indexOf('resolveRenamedBlogPath(url.pathname)'))
  })
})

describe('🗺️ 잎 표면의 쓰레기 꼬리는 404 (무한 thin URL)', () => {
  it('① 측정 대상이 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    const parents = computedParents()
    expect(parents.length, '라우트 파일에서 부모를 하나도 못 셌다').toBeGreaterThan(20)
    expect(KNOWN_PARENT_SEGMENTS.size, '부모 집합이 비었다').toBeGreaterThan(20)
  })

  it('② 집합이 라우트 표와 **양방향**으로 일치한다 (손으로 적은 목록이 낡는 것 차단)', () => {
    const parents = computedParents()
    expect([...KNOWN_PARENT_SEGMENTS].sort()).toEqual(parents)
  })

  it('②-2 부모는 전부 최상위 집합 안에 있다', () => {
    for (const p of KNOWN_PARENT_SEGMENTS) expect(KNOWN_TOP_SEGMENTS.has(p), p).toBe(true)
  })

  it('③ 실측했던 잎 꼬리가 전부 막힌다', () => {
    for (const p of LEAF_JUNK) expect(isKnownAppPath(p), p).toBe(false)
  })

  it('④ 반대 방향 — 실재하는 경로는 전부 통과한다', () => {
    for (const p of MUST_PASS) expect(isKnownAppPath(p), p).toBe(true)
  })

  it('⑤ 정규화와 404 가 **섞이지 않는다** — 철자 문제는 301 로 간다', () => {
    // `/faq/index.html` 은 그 자체로는 "모르는 경로" 지만, 정규화가 **먼저** 돌아 301 로 빠진다.
    expect(isKnownAppPath('/faq/index.html')).toBe(false)
    expect(normalizeDocPath('/faq/index.html')).toBe('/faq')
    expect(isKnownAppPath('/faq')).toBe(true)
  })
})
