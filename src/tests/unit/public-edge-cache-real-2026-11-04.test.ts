/**
 * 🌊 2026-11-04 대표 *"데이터가 느리고, 유저가 갑자기 많이 들어오고 해도, 최적화가 잘 되어있어야 해"*
 *
 * ## `CDN-Cache-Control` 헤더는 **아무것도 캐시하지 않는다**
 * 공개 API 여럿이 `c.header('CDN-Cache-Control', 'public, max-age=…')` 만 붙이고 "엣지가 캐시한다" 고 적어 두었다.
 * 그런데 이 앱은 Pages Functions(`_worker.js`)라 응답이 전부 `cf-cache-status: DYNAMIC` — Cloudflare 앞단이
 * **그 헤더를 보고 캐시하지 않는다**(라이브 실측: 같은 URL 을 세 번 불러도 매번 원본). 실제로 원본을 막는 것은
 * 코드 안의 `publicCache`/`edgeCache`(caches.default)뿐이고, 그것이 붙은 응답만 `X-Cache-Status: *-HIT` 가 찍힌다.
 *
 * 라이브 실측으로 12곳이 **사람이 몰리면 그대로 D1·KV·카카오로 직행**하고 있었다 — `promo-bar`(모든 페이지)·
 * `feature-flags`(매 요청 KV 목록 전체) · `seeding/offer/:id`(이용권 상세마다) · `consumer-settings`(지도) ·
 * 유어샵 `sns-posts` · `region/label` · `regions` · `new-openings` · `area-report` · `seeding/open` · `deal-subcats`.
 * ⇒ 각 라우트에 `publicCache` 를 붙였다(전부 사람과 무관한 공개 데이터 — 핸들러가 로그인 정보를 안 읽는다).
 *
 * ## 이 시험이 지키는 것
 * ① 고친 12곳에 `publicCache` 가 붙어 있다.
 * ② **새로** `CDN-Cache-Control` 을 쓰면서 그 라우트 정의에 캐시 미들웨어가 없는 공개 GET 이 생기면 빨간불.
 *    기존 것(아래 BASELINE)은 `worker/index.ts` 의 `app.use(…, publicCache())` 가 감싸고 있음을 라이브로 확인했거나
 *    (HIT) 다른 서비스·저빈도 링크라 동결만 한다. 목록은 **줄어들기만** 해야 한다.
 *
 * ⚠️ 못 보는 것: `index.ts` 의 `app.use` 가 실제로 그 경로를 덮는지(그건 라이브 `X-Cache-Status` 로만 확인된다)
 *   · 핸들러가 사람마다 다른 값을 내는지(캐시하면 섞인다 — 붙이기 전에 핸들러를 읽을 것).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const FIXED: Array<[string, string]> = [
  ['src/worker/routes/public-utility.routes.ts', "get('/api/promo-bar', publicCache("],
  ['src/worker/routes/public-utility.routes.ts', "get('/api/consumer-settings', publicCache("],
  ['src/worker/routes/feature-flag.routes.ts', "flagRoutes.get('/', publicCache("],
  ['src/worker/routes/feature-flag.routes.ts', "flagRoutes.get('/:key', publicCache("],
  ['src/features/seeding/api/seeding.routes.ts', "seedingRoutes.get('/offer/:productId', publicCache("],
  ['src/features/seeding/api/seeding.routes.ts', "seedingRoutes.get('/open', publicCache("],
  ['src/worker/index.ts', "app.use('/api/curator/:handle/sns-posts', publicCache("],
  ['src/worker/routes/region.routes.ts', "publicRegionRoutes.get('/label', publicCache("],
  ['src/features/group-buy/api/regions.routes.ts', "regionsRoutes.get('/', publicCache("],
  ['src/features/marketing/api/new-openings-public.routes.ts', "app.get('/', publicCache("],
  ['src/features/marketing/api/area-report-public.routes.ts', "app.get('/', publicCache("],
  ['src/features/home-service/api/home-service.routes.ts', "homeServiceRoutes.get('/deal-subcats', publicCache("],
]

const BASELINE = new Set([
  'src/worker/routes/curator/sns-posts.routes.ts /:handle/sns-posts', // index.ts 의 app.use 가 감싼다(라우트 시험이 캐시 없는 환경에서 직접 부른다)
  'src/features/banners/api/banners.routes.ts /',
  'src/features/group-buy/api/group-buy-public.routes.ts /products',
  'src/features/group-buy/api/group-buy-public.routes.ts /products/map-clusters',
  'src/features/home-service/api/home-service.routes.ts /share/:token',
  'src/features/mall/api/mall-public.routes.ts /:slug',
  'src/features/mall/api/mall-public.routes.ts /:slug/products',
  'src/features/mall/api/mall-public.routes.ts /:slug/products/:id',
  'src/features/products/api/products.routes.ts /',
  'src/features/products/api/products.routes.ts /count',
  'src/features/products/api/products.routes.ts /:id',
  'src/worker/routes/curator.routes.ts /:handle',
  'src/worker/routes/public-utility.routes.ts /api/vouchers/categories',
])

/** 공개 GET 중 본문에 `CDN-Cache-Control` 을 쓰는데 정의 줄에 캐시·인증 미들웨어가 없는 것. */
export function headerOnlyCacheRoutes(): string[] {
  const files = execSync("git ls-files 'src/features/**/*.ts' 'src/worker/**/*.ts'", { encoding: 'utf8' })
    .split('\n').filter((f) => f && !f.includes('/tests/') && !f.endsWith('.test.ts'))
  const out: string[] = []
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    const re = /\n\s*(\w+)\.get\(\s*(['"`])([^'"`]+)\2\s*,([^\n]*)/g
    const defs: Array<{ i: number; path: string; rest: string }> = []
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) defs.push({ i: m.index, path: m[3], rest: m[4] })
    defs.forEach((d, k) => {
      const body = s.slice(d.i, k + 1 < defs.length ? defs[k + 1].i : s.length)
      if (!/CDN-Cache-Control/.test(body)) return
      if (/publicCache|edgeCache|requireAuth|requireSeller|requireAdmin|requireAgency/.test(d.rest)) return
      out.push(`${f} ${d.path}`)
    })
  }
  return out
}

describe('공개 API 는 헤더가 아니라 실제 캐시로 원본을 막는다', () => {
  it.each(FIXED)('%s — %s', (file, anchor) => {
    expect(readFileSync(file, 'utf8')).toContain(anchor)
  })

  it('새 "헤더만 캐시" 공개 GET 이 생기지 않는다(기준선은 줄어들기만)', () => {
    const found = headerOnlyCacheRoutes()
    const fresh = found.filter((x) => !BASELINE.has(x))
    expect(fresh, 'CDN-Cache-Control 만으로는 캐시되지 않는다(cf-cache-status: DYNAMIC) — 라우트에 publicCache(N) 를 붙일 것').toEqual([])
    expect(found.length, '검사기가 아무것도 못 찾으면 헛도는 것이다').toBeGreaterThan(3)
  })
})
