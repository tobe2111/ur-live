/**
 * 🗺️ 지역 착지 페이지가 색인 대상인데 본문이 비어 있었다 (2026-10-12)
 *
 * 대표 *"내 판단이 필요한 3가지 모두 가장 이상적으로 해줄 수 없어?"* 의 ①.
 *
 * ## 실측 (라이브 활성 359건 전수 — `limit=100` 4페이지를 받아 파싱해 셌다)
 *
 *     색인 대상(`REGION_INDEX_MIN_DEALS` 3 이상): 시/도 11곳 + 시군구 32곳 = 43 페이지
 *     그런데 그 표면의 시드는 **홈과 같은 1페이지 50건**이고 그 분포는
 *       서울 44 · 강원 3 · 전북 1 · 부산 1 · 경북 1
 *     ⇒ 색인 대상 11곳 중 **6곳**(경기 49건 · 전남 24 · 충남 16 · 제주 8 · 대구 8 · 충북 8)이
 *        **본문 0자 · ItemList 0건**. 딜이 49건 있는 경기도 그렇다.
 *
 * "상품이 없어서 빈" 것이 아니라 **있는데 시드에 안 담겨서 빈** 것이다. 색인은 되고(게이트를
 * 통과하니까) 내용은 없다 = 구글이 thin content 로 보는 모양. 🩸 이 세션이 처음엔 그것을
 * *"설계의 대가"* 라고 보고했다 — 틀렸고, 재 보고 정정했다.
 *
 * ## 설계 (버린 길들은 `shared/seo/region-digest.ts` 머리말)
 *
 * cron 이 하루 24번 전량을 받아 (시/도, 시군구) 묶음마다 10행까지 접어 **한 KV 키**에 넣고,
 * 워커는 그 키를 **크롤러 본문·ItemList 를 만들 때만** 읽는다.
 *
 * ## 🔴 두 방향을 다 잠근다
 *
 * 메우는 방향만 잠그면, 다음 세션이 그 요약을 **주입**(`__SSR_INITIAL_MAIN__`)에까지 쓰는 쪽이
 * 더 "일관돼" 보인다. 그러면 필드를 깎은 행이 React 의 `initialData` 가 되어 홈·지역 카드가
 * 깨진다 — 빌드도 테스트도 안 깨지고 화면만 망가진다. 그래서 ⑥이 반대 방향을 본다.
 *
 * ## 이 시험이 못 보는 것
 *
 * - KV 가 실제로 그 키를 들고 있는지(라이브 · cron 1회 이상 돌아야 한다)
 * - 구글이 그 본문을 실제로 색인하는지(수일~수주 · 서치콘솔은 대표만 본다)
 * - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖)
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import {
  REGION_DIGEST_FIELDS, REGION_DIGEST_KV_KEY, REGION_DIGEST_PER_BUCKET, REGION_DIGEST_TTL_S,
  buildRegionDigest, digestRowsOf, regionDigestApplies,
} from '@/shared/seo/region-digest'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'

const worker = readCode('src/worker/index.ts')
const cron = readCode('src/worker/cron/cache-prewarm.ts')
const scheduled = readCode('src/worker/scheduled.ts')
const noscriptSrc = readCode('src/worker/utils/crawler-noscript.ts')
const jsonLdSrc = readCode('src/worker/utils/surface-list-jsonld.ts')
const META = { title: 't', description: 'd', canonical: 'https://urdeal.kr/x' }

/**
 * 라이브 분포를 축소한 탐침 — **경기가 50건 시드에 한 건도 없던** 그 모양을 재현한다.
 * 서울이 앞을 다 차지하고 경기·충남·숙소가 뒤에 온다.
 */
function probeRows() {
  const rows: Record<string, unknown>[] = []
  let id = 1
  const push = (o: Record<string, unknown>) => rows.push({ id: id++, deal_only: 0, ...o })
  // 🔴 교환권이 **주소를 갖고** 맨 앞에 온다 — 묶음 자리를 먹는지 재려면 주소가 있어야 한다.
  //    (없으면 `parseRegionFromAddress` 가 어차피 걸러 결함을 심어도 결과가 같다.)
  for (let i = 0; i < 12; i++) {
    push({ name: `교환권${i}`, brand_name: 'GS25', category: '편의점', price: 300, deal_only: 1,
      restaurant_address: '서울특별시 중구 교환권로 1' })
  }
  for (let i = 0; i < 60; i++) {
    push({ name: `서울상품${i}`, restaurant_name: `서울가게${i}`, category: 'meal_voucher',
      restaurant_address: `서울특별시 중구 세종대로 ${i}`, price: 10000 + i, original_price: 20000,
      image_url: '/api/media/a.jpg', slug: `demo-deal-${i}` })
  }
  // 🔴 **같은 시/도의 다른 시군구** — 묶음 키가 시/도만 보면 이 20건이 통째로 탈락한다.
  for (let i = 0; i < 20; i++) {
    push({ name: `종로상품${i}`, restaurant_name: `종로가게${i}`, category: 'meal_voucher',
      restaurant_address: `서울특별시 종로구 율곡로 ${i}`, price: 12000 })
  }
  for (let i = 0; i < 20; i++) {
    push({ name: `경기상품${i}`, restaurant_name: `경기가게${i}`, category: 'meal_voucher',
      restaurant_address: `경기도 파주시 중앙로 ${i}`, price: 31000, original_price: 35000 })
  }
  for (let i = 0; i < 4; i++) {
    push({ name: `충남상품${i}`, restaurant_name: `충남가게${i}`, category: 'beauty_voucher',
      restaurant_address: `충청남도 홍성군 ${i}길`, price: 50000 })
  }
  // 🔴 숙소는 **지역 묶음이 이미 꽉 찬 뒤**에 온다 — 라이브도 그렇다(숙소가 식당과 같은 시군구를
  //    나눠 쓴다). 전용 묶음이 없으면 여기서 한 건도 안 남는다.
  for (let i = 0; i < 12; i++) {
    push({ name: `홍천식당${i}`, restaurant_name: `홍천가게${i}`, category: 'meal_voucher',
      restaurant_address: `강원특별자치도 홍천군 ${i}로`, price: 9000 })
  }
  for (let i = 0; i < 15; i++) {
    push({ name: `숙박권${i}`, restaurant_name: `글램핑${i}`, category: 'stay_voucher',
      restaurant_address: `강원특별자치도 홍천군 ${i}로`, price: 209000, original_price: 272000 })
  }
  return rows
}

describe('① 요약이 색인 대상 지역을 실제로 담는다 (동작 판정)', () => {
  const digest = buildRegionDigest(probeRows())
  const rows = digestRowsOf(digest)

  it('시드 1페이지에 한 건도 없던 지역이 담긴다 — 경기·충남', () => {
    const addrs = rows.map(r => String(r.restaurant_address || ''))
    expect(addrs.some(a => a.startsWith('경기도 파주시'))).toBe(true)
    expect(addrs.some(a => a.startsWith('충청남도 홍성군'))).toBe(true)
  })

  it('묶음당 상한을 지킨다 — 서울 중구 60건이 10건으로', () => {
    const seoul = rows.filter(r => String(r.restaurant_address || '').startsWith('서울특별시 중구'))
    expect(seoul.length).toBe(REGION_DIGEST_PER_BUCKET)
  })

  it('🔴 묶음은 **시군구까지** 가른다 — 같은 시/도의 다른 구가 통째로 탈락하지 않는다', () => {
    // 시/도만 묶으면 서울 상한 10 이 중구에서 다 차고 종로구는 0 이 된다(시군구 32개 색인 페이지).
    const jongno = rows.filter(r => String(r.restaurant_address || '').startsWith('서울특별시 종로구'))
    expect(jongno.length).toBe(REGION_DIGEST_PER_BUCKET)
  })

  it('숙소 묶음이 따로 있다 — 그 시군구가 이미 꽉 찼어도 남는다', () => {
    // 탐침의 숙소는 홍천군 식당 12건 **뒤**에 온다 — 전용 묶음이 없으면 0 건이 된다.
    expect(rows.filter(r => r.category === 'stay_voucher').length).toBe(REGION_DIGEST_PER_BUCKET)
  })

  it('교환권(deal_only=1)은 **주소가 있어도** 지역 묶음 자리를 먹지 않는다', () => {
    expect(rows.some(r => Number(r.deal_only) === 1)).toBe(false)
    // 탐침은 서울 중구 교환권 12건을 **맨 앞에** 둔다 — 세면 실제 매장 딜이 0 건이 된다.
    const seoul = rows.filter(r => String(r.restaurant_address || '').startsWith('서울특별시 중구'))
    expect(seoul.length).toBe(REGION_DIGEST_PER_BUCKET)
  })

  it('입력 순서를 보존한다 — 서버의 데모 후순위 정렬과 갈리지 않게', () => {
    const ids = rows.map(r => Number(r.id))
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  it('행이 0이면 빈 요약이 아니라 **쓰지 않는다**(cron 가드)', () => {
    expect(digestRowsOf(buildRegionDigest([])).length).toBe(0)
    expect(cron).toMatch(/rows\.length\s*>\s*0/)
  })
})

describe('② `slug` 를 되살리지 않는다 — 데모 티 제거(#1712) 회귀 방지', () => {
  it('화이트리스트에 slug 가 없다', () => {
    expect(REGION_DIGEST_FIELDS).not.toContain('slug')
  })
  it('실제 출력에도 없다 — 입력에 있어도', () => {
    expect(buildRegionDigest(probeRows())).not.toContain('demo-deal-')
  })
})

describe('③ 화이트리스트가 두 소비자가 읽는 필드를 덮는다 (드리프트 방어)', () => {
  /** 소비자 소스의 인터페이스에서 필드명을 뽑는다 — 손으로 적으면 한쪽이 늘 때 조용히 갈린다. */
  function ifaceFields(src: string, name: string): string[] {
    const m = src.match(new RegExp(`interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`))
    if (!m) return []
    return [...m[1].matchAll(/^\s{2}([a-z_][a-z0-9_]*)\??:/gmi)].map(x => x[1])
  }
  const consumed = [
    ...ifaceFields(noscriptSrc, 'RegionSeedRow'),
    ...ifaceFields(jsonLdSrc, 'SeedItem'),
  ]

  it('소비자 인터페이스를 실제로 읽어 냈다 (0건이면 통과가 아니라 고장)', () => {
    expect(consumed.length).toBeGreaterThanOrEqual(15)
  })

  it('소비자가 읽는 필드가 전부 화이트리스트에 있다', () => {
    const miss = [...new Set(consumed)].filter(f => !(REGION_DIGEST_FIELDS as readonly string[]).includes(f))
    expect(miss).toEqual([])
  })
})

describe('④ 요약을 먹이면 크롤러 본문·ItemList 가 실제로 생긴다 (출력 판정)', () => {
  const digest = buildRegionDigest(probeRows())

  it('`/region/경기` 본문 — 요약 없으면 0줄, 있으면 생긴다', () => {
    const seoulOnly = JSON.stringify({ data: probeRows().slice(0, 50) })
    expect(buildStaticSurfaceNoscript('/region/경기', seoulOnly)).not.toContain('경기가게')
    const ns = buildStaticSurfaceNoscript('/region/경기', digest)
    expect(ns).toContain('경기가게')
    expect(ns).toContain('31,000원')
    // 다른 동네 가게가 섞이지 않는다 — 판정은 `addressInRegion` SSOT 다.
    expect(ns).not.toContain('서울가게')
  })

  it('`/region/경기` ItemList — 항목이 생기고 전부 그 지역이다', () => {
    const ld = JSON.parse(buildSurfaceListJsonLd('/region/경기', '', 'https://urdeal.kr', META, digest))
    const names: string[] = []
    const walk = (n: unknown) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>
        if (o['@type'] === 'ItemList') (o.itemListElement as unknown[]).forEach(walk)
        if (o['@type'] === 'Product' && o.name) names.push(String(o.name))
        Object.values(o).forEach(walk)
      }
    }
    walk(ld)
    expect(names.length).toBeGreaterThan(0)
    expect(names.every(n => n.startsWith('경기상품'))).toBe(true)
  })

  it('`/stays` 는 숙소만 — 식당 이용권이 숙소 목록의 항목이 되지 않는다', () => {
    const ns = buildStaticSurfaceNoscript('/stays', digest)
    expect(ns).toContain('글램핑')
    expect(ns).not.toContain('서울가게')
  })
})

describe('⑤ 경로 판정 — 지역·숙소만', () => {
  // 🔀 2026-10-12 재조준: **허브(`/region`)도 쓴다** — `regionChildLinks` 가 색인 대상 시/도
  //   링크를 만드는 데 요약이 필요하다(종전엔 허브가 요약을 못 받아 크롤러에게 링크 0개를 줬다).
  //   지키는 불변식은 그대로 — **지역·숙소 경로만** 쓴다(아래 '안 쓴다' 목록이 그 경계다).
  //   허브가 noindex 가 되는 쪽은 `regionThinByDigest` 가 따로 막는다(그 시험이 아래에 있다).
  it.each(['/region', '/region/서울', '/region/서울/중구', '/stays'])('%s → 쓴다', p => {
    expect(regionDigestApplies(p)).toBe(true)
  })
  it.each(['/', '/vouchers', '/browse', '/map', '/u/jiwon1228', '/pass/2919', '/faq'])('%s → 안 쓴다', p => {
    expect(regionDigestApplies(p)).toBe(false)
  })
})

describe('⑥ 🔴 반대 방향 — 요약이 주입(React initialData)으로 새지 않는다', () => {
  it('`ssrPayload` 에 **값을 담는 대입은 딱 한 번** — 요약이 그 변수로 흘러들 수 없다', () => {
    // 🔀 2026-10-12 재조준: facet 시드를 **주입에서 빼는** 한 줄(`ssrPayload = null`)이 생겨
    //   대입이 둘이 됐다. 지키는 불변식은 그대로 — *값*을 담는 대입은 여전히 하나이고 그것은
    //   `r.payload` 다. `null` 은 구조적으로 아무것도 샐 수 없으므로(주입을 **지우는** 방향)
    //   예외로 두고, 그 대신 **요약·크롤러 변수를 담는 대입이 0** 임을 따로 못 박는다
    //   (= `ssrPayload = digestRaw` / `= crawlerPayload` 는 여전히 빨간불).
    const writes = [...worker.matchAll(/\bssrPayload\s*=(?!=)([^\n;]*)/g)].map(m => m[1].trim())
    const valued = writes.filter(w => w !== 'null')
    expect(valued.length).toBe(1)
    expect(valued[0]).toMatch(/^r\w*\.payload$/)
    for (const w of writes) expect(w).not.toMatch(/digest|crawler/i)
  })

  it('`__SSR_INITIAL_*` 주입은 `ssrPayload` 를 쓴다', () => {
    expect(worker).toMatch(/__SSR_INITIAL_[A-Z]+__[\s\S]{0,400}?ssrPayload/)
  })

  it('크롤러 두 소비자는 `crawlerPayload` 를 쓴다', () => {
    expect(worker).toMatch(/buildSurfaceListJsonLd\([^)]*crawlerPayload\)/)
    // 🔀 2026-10-14: 교환권 첫 화면 폴백도 같은 호출을 쓴다 — 하나만 맞아도 통과하면 다른 자리가 1페이지 시드로 새도 모른다.
    const calls = worker.match(/buildStaticSurfaceNoscript\(url\.pathname, \w+\)/g) || []
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const c of calls) expect(c).toBe('buildStaticSurfaceNoscript(url.pathname, crawlerPayload)')
  })

  it('요약이 없으면 MAIN 시드로 떨어진다 (fail-soft)', () => {
    // 🔀 2026-10-12 재조준: #21(thin 지역 noindex)이 요약 **원본**을 따로 들고 있어야 해서 한 줄이
    //   둘로 갈렸다(`digestRaw` → `crawlerPayload`). 지키는 불변식은 그대로 — **요약이 없으면
    //   `ssrPayload` 로 떨어진다**(여기서 null 로 떨어지면 크롤러 본문·ItemList 가 통째로 사라진다).
    expect(worker).toMatch(/const digestRaw = digestP \? await digestP : null;/)
    expect(worker).toMatch(/const crawlerPayload = digestRaw \|\| ssrPayload;/)
  })
})

describe('⑦ cron 배선 — 위상·비용', () => {
  it('동적 워밍(`:00`·`:30`)과 다른 위상에서 한 번만 돈다', () => {
    const m = scheduled.match(/regionDigest:\s*slotOpen\(\{\s*minute:\s*(\d+)\s*\}\)/)
    expect(m).toBeTruthy()
    expect(['15', '45']).toContain(m![1])
  })

  it('전량을 받는다 — 4페이지 × limit=100 ≥ 실측 359', () => {
    expect(cron).toMatch(/\[1,\s*2,\s*3,\s*4\]\.map/)
    expect(cron).toMatch(/limit=100&page=\$\{page\}/)
    // 🔑 홈과 같은 상수에서 출발한다 — 손으로 적으면 홈 시드와 갈린다.
    expect(cron).toMatch(/\$\{baseUrl\}\$\{MAIN_SEED_PATH\}&limit=100/)
  })

  it('TTL 이 재빌드 주기(1시간)보다 길다 — 사이에 빈 구간이 생기지 않게', () => {
    expect(REGION_DIGEST_TTL_S).toBeGreaterThan(3600)
  })

  it('쓰는 쪽과 읽는 쪽이 같은 키 상수를 본다', () => {
    expect(REGION_DIGEST_KV_KEY).toMatch(/^ssr:/)
    expect(cron).toContain('REGION_DIGEST_KV_KEY')
    expect(worker).toContain('REGION_DIGEST_KV_KEY')
  })
})
