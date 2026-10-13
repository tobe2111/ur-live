/**
 * 🔗📦 2026-10-13 — ① 지역 경로 조립 SSOT 단일화 ② 쇼핑 `Offer.availability` 재고 반영
 *   ③ sitemap 제출·noindex 계약 (대표 *"너가 할 수 있는 건 최대한 이상적으로 다 해줘"*).
 *
 * ## ① 왜 (라이브 실측 2026-10-13)
 *
 * 같은 지역 경로를 **다섯 군데**가 각자 조립하고 있었고 둘이 날것이었다:
 *
 *     regionPath()            날것   → sitemap `<loc>` · `RegionPage` 의 `<SEO url>`(= 클라 canonical)
 *     resolveRegionSeo        인코딩 → 워커 canonical
 *     surface-list-jsonld     인코딩 → 빵부스러기
 *     regionChildLinks        인코딩 → 크롤러 내부 링크
 *
 * ⇒ sitemap 이 `/region/서울` 을 제출하는데 페이지는 `/region/%EC%84%9C%EC%9A%B8` 을 정본이라
 *   선언했고(사이트맵 규격은 URL-escape 를 요구한다), **같은 페이지가 클라 `<SEO>` 와 워커 주입에서
 *   서로 다른 canonical** 을 내보냈다. 에러가 하나도 안 난다.
 *
 * ## ② 왜 (쇼핑 availability)
 *
 * `Offer.availability` 가 **항상 `InStock`** 이었다. 구글 상품 정책은 그 값이 페이지와 일치하기를
 * 요구하고 어긋나면 리치결과가 거절될 수 있다. 🩸 그런데 **재고 컬럼이 두 벌**이라 순진하게
 * 고치면 더 나빠진다 — 라이브 실측(id 2917) `stock: 200` ↔ `stock_quantity: 0`. 그래서 판정은
 * 화면(`ProductDetailPage` 구매 버튼 `disabled`)과 **같은 술어**다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 * - 구글이 실제로 canonical 을 통합하는지 · 리치결과를 쓰는지(색인 수일~수주 · 서치콘솔은 대표만 본다)
 * - 브라우저 라우팅(인코딩된 `<Link to>` 가 실제로 열리는지) — `parseRegionPath` 왕복만 본다
 * - `RegionPage` 의 `<SEO url>` 이 **절대 URL 로** 바뀌어 나가는지(그 컴포넌트가 origin 을 붙인다)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { regionPath, parseRegionPath } from '@/shared/constants/region-slugs'
import { resolveRegionSeo } from '@/worker/utils/surface-ssr-meta'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { regionChildLinks } from '@/shared/seo/region-digest'
import { buildProductMeta, buildStayDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { readCode } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const SEOUL = encodeURIComponent('서울')
const JONGNO = encodeURIComponent('종로구')

describe('① 지역 경로 — 조립이 한 곳이고 퍼센트 인코딩된다', () => {
  it('regionPath 가 인코딩한다 (sitemap `<loc>` 규격 + canonical 표기 일치)', () => {
    expect(regionPath({ sido: '서울' })).toBe(`/region/${SEOUL}`)
    expect(regionPath({ sido: '서울', sigungu: '종로구' })).toBe(`/region/${SEOUL}/${JONGNO}`)
    expect(regionPath({ sido: '' })).toBe('/region')
  })

  it('왕복이 안 깨진다 — 라우터가 디코드해 같은 ref 로 돌아온다', () => {
    for (const ref of [{ sido: '서울' }, { sido: '서울', sigungu: '중구' }, { sido: '강원', sigungu: '양양군' }]) {
      const [, , sido, sigungu] = regionPath(ref).split('/')
      expect(parseRegionPath(sido, sigungu)).toEqual(ref)
    }
  })

  it('워커 canonical 이 regionPath 와 **같은 값**이다 (두 벌이면 갈린다)', () => {
    for (const p of ['/region/서울', '/region/서울/종로구', `/region/${SEOUL}`]) {
      const r = resolveRegionSeo(p, O)
      expect(r).not.toBeNull()
      const ref = parseRegionPath(...(p.replace(/^\/region\/?/, '').split('/') as [string, string?]))
      if (ref) expect(r?.canonical).toBe(`${O}${regionPath(ref)}`)
    }
  })

  it('빵부스러기 마지막 단계도 같은 조립이다', () => {
    const meta = { title: 't', description: 'd', canonical: `${O}/region/${SEOUL}/${JONGNO}` }
    const raw = buildSurfaceListJsonLd(`/region/${SEOUL}/${JONGNO}`, '', O, meta, null)
    expect(raw).toBeTruthy()
    const crumbs: Array<{ item?: string; name?: string }> = []
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      const o = n as Record<string, unknown>
      if (o['@type'] === 'BreadcrumbList') (o.itemListElement as Array<Record<string, string>>).forEach((x) => crumbs.push(x))
      Object.values(o).forEach(walk)
    }
    walk(JSON.parse(raw))
    expect(crumbs.length).toBeGreaterThan(2)
    expect(crumbs[crumbs.length - 1].item).toBe(`${O}${regionPath({ sido: '서울', sigungu: '종로구' })}`)
    // 날것 한글이 한 건도 없다 — 이 방향이 깨지면 빵부스러기가 canonical 아닌 URL 을 가리킨다.
    for (const c of crumbs) expect(c.item || '').not.toMatch(/[^\x00-\x7F]/)
  })

  it('크롤러 내부 링크(regionChildLinks)도 같은 조립이다', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      restaurant_address: '서울특별시 종로구 세종대로 1', deal_only: 0, name: `가게${i}`,
    }))
    const links = regionChildLinks(`/region/${SEOUL}`, JSON.stringify({ success: true, data: rows }))
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) {
      expect(l.href).not.toMatch(/[^\x00-\x7F]/)
      expect(l.href.startsWith('/region/')).toBe(true)
    }
    expect(links.some((l) => l.href === regionPath({ sido: '서울', sigungu: '종로구' }))).toBe(true)
  })

  it('SSOT 밖에 인라인 조립이 남아 있지 않다 (다섯 벌로 돌아가는 방향을 막는다)', () => {
    for (const f of [
      'src/worker/utils/surface-ssr-meta.ts',
      'src/worker/utils/surface-list-jsonld.ts',
      'src/shared/seo/region-digest.ts',
    ]) {
      expect(readCode(f)).not.toMatch(/\/region\/\$\{encodeURIComponent/)
    }
  })

  it('sitemap `<loc>` 이 초크포인트에서 비ASCII 를 막는다 (새 경로가 또 날것으로 들어와도)', () => {
    const src = readCode('src/worker/routes/sitemap.routes.ts')
    expect(src).toMatch(/<loc>\$\{xmlEscape\(asciiLoc\(/)
    // 멱등성 — 이미 인코딩된 문자열은 그대로 지나야 한다(`%` 가 `%25` 로 두 번 먹히면 전부 깨진다).
    const body = src.slice(src.indexOf('function asciiLoc'))
    expect(body).not.toMatch(/encodeURI\(/)      // encodeURI 는 `%EC` 를 다시 먹는다
    const asciiLoc = (u: string) => u.replace(/[^\x00-\x7F]/g, (ch) => encodeURIComponent(ch))
    expect(asciiLoc(`${O}/region/서울`)).toBe(`${O}/region/${SEOUL}`)
    expect(asciiLoc(`${O}/region/${SEOUL}`)).toBe(`${O}/region/${SEOUL}`)
    expect(asciiLoc(`${O}/vouchers?category=${encodeURIComponent('편의점')}`))
      .toBe(`${O}/vouchers?category=${encodeURIComponent('편의점')}`)
  })
})

const shopSeed = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    success: true,
    data: {
      // 라이브 `/api/products/2917` 응답에서 떼어 온 모양 — 손으로 지어 쓰지 않는다.
      id: 2917, name: '프리미엄 무선아이폰', price: 10000, original_price: null, deal_only: 0,
      description: null, image_url: 'https://i.ibb.co/x.png', category: 'lifestyle',
      stock: 200, stock_quantity: 0, ...over,
    },
  })

function offerOf(meta: { jsonLd?: string } | null): Record<string, unknown> | null {
  if (!meta?.jsonLd) return null
  let found: Record<string, unknown> | null = null
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as Record<string, unknown>
    if (typeof o['@type'] === 'string' && String(o['@type']).includes('Offer')) found = o
    Object.values(o).forEach(walk)
  }
  walk(JSON.parse(meta.jsonLd))
  return found
}

describe('② 쇼핑 Offer.availability — 화면과 같은 술어', () => {
  it('재고가 한쪽에만 있어도 InStock (라이브 실측 stock 200 ↔ stock_quantity 0)', () => {
    const o = offerOf(buildProductMeta(shopSeed(), O, '/products/2917'))
    expect(o?.availability).toBe('https://schema.org/InStock')
  })

  it('반대쪽 컬럼만 있어도 InStock', () => {
    const o = offerOf(buildProductMeta(shopSeed({ stock: 0, stock_quantity: 7 }), O, '/products/2917'))
    expect(o?.availability).toBe('https://schema.org/InStock')
  })

  it('둘 다 0 이면 OutOfStock — 품절을 "재고 있음" 이라 말하지 않는다', () => {
    const o = offerOf(buildProductMeta(shopSeed({ stock: 0, stock_quantity: 0 }), O, '/products/2917'))
    expect(o?.availability).toBe('https://schema.org/OutOfStock')
  })

  it('컬럼이 아예 없으면(null) OutOfStock — 모르면 "있다" 고 말하지 않는다', () => {
    const o = offerOf(buildProductMeta(shopSeed({ stock: null, stock_quantity: null }), O, '/products/2917'))
    expect(o?.availability).toBe('https://schema.org/OutOfStock')
  })

  it('판정이 화면의 구매 버튼과 같은 술어다 (두 벌이면 갈린다)', () => {
    // 화면: `(product.stock ?? 0) <= 0 && (product.stock_quantity ?? 0) <= 0` 이면 disabled
    const ui = readCode('src/pages/ProductDetailPage.tsx')
    expect(ui).toMatch(/stock\s*\?\?\s*0\)\s*<=\s*0\s*&&[\s\S]{0,40}stock_quantity\s*\?\?\s*0\)\s*<=\s*0/)
    const meta = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect(meta).toMatch(/const inStock = Number\(d\.stock \?\? 0\) > 0 \|\| Number\(d\.stock_quantity \?\? 0\) > 0/)
    // 하드코딩으로 되돌아가는 방향을 막는다 — 쇼핑 Offer 의 availability 는 상수가 아니다.
    const shopBlock = meta.slice(meta.indexOf('export function buildProductMeta'))
    expect(shopBlock).not.toMatch(/availability: 'https:\/\/schema\.org\/InStock'/)
  })

  it('숙소는 InStock 유지 — 날짜별 잔여는 달력이 쥐고 있고 페이로드엔 없다', () => {
    const stay = JSON.stringify({
      success: true,
      data: {
        product: { id: 2887, name: '그랑블루글램핑', restaurant_name: '그랑블루', restaurant_address: '강원 속초시 1' },
        rooms: [{ name: '스탠다드', base_price_weekday: 149000 }, { name: '디럭스', base_price_weekday: 209000 }],
      },
    })
    const o = offerOf(buildStayDetailMeta(stay, O, '/stays/2887'))
    expect(o?.['@type']).toBe('AggregateOffer')
    expect(o?.availability).toBe('https://schema.org/InStock')
  })
})

describe('③ sitemap 제출 ↔ 색인 선언이 서로 모순되지 않는다', () => {
  const sm = readCode('src/worker/routes/sitemap.routes.ts')

  it('본문이 있는 두 표면을 제출한다 (실측 /join 134자 · /terms/seller 229자)', () => {
    expect(sm).toMatch(/loc: '\/join'/)
    expect(sm).toMatch(/loc: '\/terms\/seller'/)
  })

  it('법무 검토 전 **초안** 약관은 noindex 다 — 검색결과에 "유어딜 약관" 으로 서면 안 된다', () => {
    for (const p of ['/terms/influencer', '/terms/group-buy']) {
      expect(CONSUMER_SURFACE_SEO[p]?.noindex).toBe(true)
    }
    // 그 페이지가 스스로 초안이라고 적어 둔 줄이 실재한다(전제가 사라지면 이 처방의 근거도 사라진다).
    for (const f of ['src/pages/InfluencerTermsPage.tsx', 'src/pages/GroupBuyTermsPage.tsx']) {
      expect(readFileSync(f, 'utf8')).toContain('법무 검토')
    }
  })

  it('noindex 표면을 sitemap 이 제출하지 않는다 (반대 방향 — 서로 반대되는 신호)', () => {
    for (const [p, e] of Object.entries(CONSUMER_SURFACE_SEO)) {
      if (!e.noindex) continue
      expect(sm.includes(`loc: '${p}'`)).toBe(false)
    }
  })

  it('블로그 시드 제목·본문 검사가 anti-slop 가드에 실재한다', () => {
    // ⚠️ 래칫을 **끄는** 결함은 그 가드를 돌려서는 못 잡는다(끄면 초록이 된다) — 소스로 고정한다.
    const g = readCode('scripts/check-anti-slop-copy.mjs')
    expect(g).toMatch(/src\/features\/blog\/api\/blog-seed\.ts/)         // 경로가 낡으면 무검사가 된다
    expect(g).toMatch(/seed\.titleEm\.length > 0/)                       // 제목은 0 으로 잠근다
    expect(g).toMatch(/seed\.bodyEm > \(base\.blogSeedBodyEmDash \?\? 0\)/)  // 본문은 래칫
    expect(g).toMatch(/seed\.titles < 10/)                               // 0건이면 통과가 아니라 실패
    const base = JSON.parse(readFileSync('scripts/anti-slop-baseline.json', 'utf8'))
    expect(typeof base.blogSeedBodyEmDash).toBe('number')
  })

  it('anti-slop 가드를 실제로 돌려 초록인지 본다 (제목 em-dash·낡은 경로를 잡는 자리)', () => {
    // 🔑 소스 단언만으로는 *검사가 실재한다* 까지만 말한다. 이 줄이 **돌려서** 판정하므로
    //   제목에 em-dash 가 되돌아오거나 BLOG_SEED 경로가 낡으면 여기서 빨간불이 난다.
    const r = spawnSync('node', ['scripts/check-anti-slop-copy.mjs'], { encoding: 'utf8' })
    expect(r.status, (r.stdout || '') + (r.stderr || '')).toBe(0)
  })

  it('정본 약관 둘은 본문 SSOT 를 갖고 있다 (제출의 근거)', () => {
    expect(readCode('src/pages/terms/consumer-terms-content.ts').length).toBeGreaterThan(1000)
    expect(readCode('src/pages/terms/seller-terms-content.ts').length).toBeGreaterThan(1000)
  })
})
