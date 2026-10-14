/**
 * 🍞 2026-10-14 — 빵부스러기 체인의 두 불변식.
 *
 * 근거·실측·버린 길은 `src/shared/seo/breadcrumb.ts` 머리말.
 * 요약: ① `/pass/{N}` 310건이 `홈(/) > 동네딜(/) > 상품` — 연속한 두 항목이 **같은 URL**
 *       ② 루트 항목 이름이 상세 359건 `홈` ↔ 목록·지역·블로그 90여 표면 `유어딜`
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - 체인이 *의미상* 맞는지 — URL 만 다르면 지어낸 계층도 통과한다.
 *   - 구글이 SERP 에 그 trail 을 실제로 그리는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 *   - 클라(react-helmet)가 따로 내는 체인 — `/pass/:id` 는 JS 를 렌더하는 AI 봇에게 두 벌이고,
 *     그쪽 제거는 잠금 파일(`GroupBuyDetailPage.tsx`)이라 별건이다(결함 등록 완료).
 */
import { describe, it, expect } from 'vitest'
import { withCrumbRoot, crumbItems } from '@/shared/seo/breadcrumb'
import { CONSUMER_SITE_NAME } from '@/shared/seo/consumer-surfaces'
import { buildDetailMeta, buildStayDetailMeta, buildProductMeta } from '@/worker/utils/detail-ssr-meta'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { readCode } from '../helpers/source-text'

const O = 'https://urdeal.kr'

/** 문서의 모든 `BreadcrumbList` 를 **재귀로** 찾는다 — `@graph`·`mainEntity` 안에 중첩된다. */
function crumbChains(jsonLd: string | undefined | null): Array<Array<{ name: string; item: string }>> {
  if (!jsonLd) return []
  const out: Array<Array<{ name: string; item: string }>> = []
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return }
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>
      if (r['@type'] === 'BreadcrumbList' && Array.isArray(r.itemListElement)) {
        out.push((r.itemListElement as Array<Record<string, unknown>>).map((i) => ({
          name: String(i.name ?? ''), item: String(i.item ?? ''),
        })))
      }
      Object.values(r).forEach(walk)
    }
  }
  try { walk(JSON.parse(jsonLd.replace(/\\u003c/g, '<'))) } catch { return [] }
  return out
}

const pay = (data: unknown) => JSON.stringify({ success: true, data })

describe('🍞 빵부스러기 체인', () => {
  // ──────────────────────────────── ① 순수 함수
  it('①-1 루트를 한 이름으로 붙인다', () => {
    const t = withCrumbRoot(O, [{ name: '숙소', url: `${O}/stays` }])
    expect(t[0]).toEqual({ name: CONSUMER_SITE_NAME, url: `${O}/` })
    expect(t).toHaveLength(2)
  })

  it('①-2 직전 항목과 URL 이 같은 단계는 접는다 — 앞 이름이 살아남는다', () => {
    const t = withCrumbRoot(O, [{ name: '동네딜', url: `${O}/` }, { name: '상품', url: `${O}/pass/1` }])
    expect(t.map((x) => x.name)).toEqual([CONSUMER_SITE_NAME, '상품'])
    // 🔴 반대 방향 — 루트를 `동네딜` 로 개명하면 310개 페이지가 사이트 루트를 그렇게 부른다.
    expect(t[0]!.name).not.toBe('동네딜')
  })

  it('①-3 이름·URL 이 빈 단계는 버린다', () => {
    const t = withCrumbRoot(O, [{ name: '', url: `${O}/x` }, { name: 'y', url: '' }, { name: 'z', url: `${O}/z` }])
    expect(t.map((x) => x.name)).toEqual([CONSUMER_SITE_NAME, 'z'])
  })

  it('①-4 position 은 접은 뒤 1..N 으로 다시 매긴다', () => {
    const items = crumbItems(withCrumbRoot(O, [{ name: 'a', url: `${O}/` }, { name: 'b', url: `${O}/b` }]))
    expect(items.map((i) => i.position)).toEqual([1, 2])
    expect(items.map((i) => i.name)).toEqual([CONSUMER_SITE_NAME, 'b'])
  })

  // ──────────────────────────────── ② 상세 빌더 셋을 **돌려서** 판정
  const cases: Array<[string, () => string | null | undefined, string[]]> = [
    ['/pass/:id', () => buildDetailMeta(pay({ id: 2823, name: '불족발 세트', price: 36600, category: 'meal_voucher', restaurant_name: '안서방왕족발' }), O, '/pass/2823')?.jsonLd,
      [CONSUMER_SITE_NAME, '불족발 세트']],
    ['/stays/:id', () => buildStayDetailMeta(JSON.stringify({ data: { product: { id: 2887, name: '그랑블루', region_sido: '강원' }, rooms: [] } }), O, '/stays/2887')?.jsonLd,
      [CONSUMER_SITE_NAME, '숙소', '그랑블루']],
    ['/products/:id', () => buildProductMeta(pay({ id: 2917, name: '무선아이폰', price: 10000, category: 'lifestyle' }), O, '/products/2917')?.jsonLd,
      [CONSUMER_SITE_NAME, '쇼핑', '무선아이폰']],
  ]

  for (const [label, run, names] of cases) {
    it(`②-${label} 체인이 ${names.join(' › ')}`, () => {
      const chains = crumbChains(run())
      expect(chains, `${label} 에 BreadcrumbList 가 없다`).toHaveLength(1)
      expect(chains[0]!.map((x) => x.name)).toEqual(names)
    })
  }

  it('②-전수 어느 상세도 연속한 같은 URL 을 내지 않는다', () => {
    for (const [label, run] of cases) {
      for (const ch of crumbChains(run())) {
        const urls = ch.map((x) => x.item)
        const dup = urls.filter((u, i) => i > 0 && u === urls[i - 1])
        expect(dup, `${label}: ${urls.join(' > ')}`).toEqual([])
        expect(urls.every((u) => u.startsWith(O)), `${label}: 상대 URL`).toBe(true)
      }
    }
  })

  // ──────────────────────────────── ③ 목록 표면도 같은 함수
  it('③-1 목록·지역 체인의 루트가 같은 이름이고 중복이 없다', () => {
    for (const p of ['/vouchers', '/browse', '/terms/seller', '/region', '/faq']) {
      const meta = { title: 't', description: 'd', canonical: `${O}${p}` }
      const ld = buildSurfaceListJsonLd(p, '', O, meta, null)
      for (const ch of crumbChains(ld)) {
        expect(ch[0]!.name, p).toBe(CONSUMER_SITE_NAME)
        const urls = ch.map((x) => x.item)
        expect(urls.filter((u, i) => i > 0 && u === urls[i - 1]), p).toEqual([])
      }
    }
  })

  // ──────────────────────────────── ④ 조립처가 늘지 않는다
  it('④-1 손으로 쓴 ListItem 조립이 서버 빌더에 없다', () => {
    for (const f of ['src/worker/utils/detail-ssr-meta.ts', 'src/worker/utils/surface-list-jsonld.ts']) {
      const c = readCode(f)
      expect(c, `${f} 가 position 을 손으로 적는다`).not.toMatch(/position:\s*\d/)
      expect(c, `${f} 가 루트 이름을 손으로 적는다`).not.toMatch(/name:\s*'홈'/)
    }
    // 🔎 **출력으로는 판정할 수 없는 자리**라 소스로 본다: 루트를 손으로 한 번 더 붙여도
    //   `withCrumbRoot` 의 접기가 그걸 삼켜 **결과가 같다**(2026-10-14 되돌려-검증이 그렇게 잡았다).
    //   그러면 조립처가 조용히 둘이 되고, 다음에 둘이 갈린다 — 그래서 *루트를 적지 않는다*를 잠근다.
    const l = readCode('src/worker/utils/surface-list-jsonld.ts')
    expect(l, '목록 빌더가 루트 단계를 손으로 적는다').not.toMatch(/name:\s*CONSUMER_SITE_NAME,\s*url:/)
  })

  it('④-4 필터 잎 게이트가 살아 있다 (지금은 출력으로 판정할 수 없다)', () => {
    // `canonicalParams` 를 가진 표면은 라이브에 `/vouchers` 하나뿐이고 그 표면엔 `crumb` 가 있다
    //   ⇒ 게이트를 지워도 **오늘은** 결과가 같다(그래서 주입이 통과했다). 지키는 것은 미래다:
    //   `canonicalParams` 는 있는데 `crumb` 가 없는 표면(noindex 표면은 일부러 비워 둔다)이 생기면
    //   `유어딜 › 편의점` 처럼 상위 단계가 없는 체인이 나온다.
    const l = readCode('src/worker/utils/surface-list-jsonld.ts')
    expect(l, '필터 잎을 붙이기 전 단계가 하나라도 쌓였는지 보는 게이트').toContain('trail.length > 0')
  })

  it('④-2 세 상세 빌더와 목록 빌더가 **같은 함수**를 쓴다', () => {
    const d = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect((d.match(/crumbItems\(withCrumbRoot\(/g) ?? []).length).toBe(3)
    const l = readCode('src/worker/utils/surface-list-jsonld.ts')
    expect((l.match(/withCrumbRoot\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('④-3 `동네딜` 에 자기 목록 URL 을 주지 않는다 (홈이 곧 그 피드다)', () => {
    const d = readCode('src/worker/utils/detail-ssr-meta.ts')
    // `/group-buy` 는 홈으로 301 되는 별칭이라 sitemap 에서도 빠졌다 — 가리키면 리다이렉트를 가리킨다.
    expect(d, '빵부스러기가 301 별칭을 가리킨다').not.toMatch(/url:\s*`\$\{origin\}\/group-buy`/)
  })
})
