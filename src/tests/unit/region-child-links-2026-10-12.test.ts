/**
 * 🔗 지역 트리의 **자식 링크** — 허브 → 시/도 → 시군구 (2026-10-12)
 *
 * **왜 있나(라이브 실측 — Googlebot UA 로 서버 HTML 의 `<a href>` 를 셌다)**: 색인 대상 지역이
 * **43~44개**인데 그 트리로 들어가는 **내부 링크가 0개**였다.
 *
 *     /region        본문 120자 · a태그 **0**   ← 허브인데 자식으로 가는 길이 없다
 *     /region/서울    본문 364자 · 상품만 링크   ← 자식 시군구 32곳으로 가는 길이 없다
 *
 * ⇒ 그 44개가 **sitemap 으로만** 발견되고 내부 링크 가치는 0 이다. JS 를 렌더하는 Googlebot 은
 * 화면 링크를 보지만 **Yeti(네이버)·AI 검색봇은 이 문서가 전부**다.
 *
 * 🔑 **링크 집합 = 색인 집합.** 판정이 `regionThinByDigest` 와 **같은 데이터·같은 술어**라
 * *"링크한다"* ⟺ *"thin 이 아니다"* 가 구조적으로 보장된다. 이 시험은 그 동치를 **양방향으로**
 * 재고(링크된 것은 thin 이 아니고, 빠진 후보는 thin 이다), 그래서 "색인 말라고 한 URL 을
 * 링크" 하는 모순이 생길 수 없다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 링크를 실제로 따라가는지(외부 판정 · 수일~수주) ·
 *    KV 가 그 키를 들고 있는지(cron 1회 필요) · 사람 화면(이 블록은 `<noscript>` 라 JS 가 돌면
 *    렌더조차 안 된다 — **byte-동일**) · 라벨에 `&`·`<` 가 든 경우(주소 파서가 그런 시군구 이름을
 *    만들지 않아 **동작으로 잴 수 없다** → 조립부가 `esc()` 를 쓰는지 소스로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import {
  buildRegionDigest, regionChildLinks, regionThinByDigest, regionDigestApplies,
} from '@/shared/seo/region-digest'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { resolveRegionSeo } from '@/worker/utils/surface-ssr-meta'

const code = readCode
const NS = 'src/worker/utils/crawler-noscript.ts'

const row = (id: number, addr: string, name: string, deal = 0) => ({
  id, name, restaurant_name: name, restaurant_address: addr, price: 10000,
  category: 'meal_voucher', deal_only: deal, is_active: 1,
})
/**
 * 서울 종로구 4 · 서울 중구 3 · 경기 파주시 3 · 인천 2(thin) · 대구 5(전부 교환권)
 *
 * 🩸 **인천에 교환권 2건을 일부러 섞었다** — 2 + 2 = 4 라, 교환권을 세면 인천이 임계값(3)을
 *    넘어 **링크되는데 `regionThinByDigest` 는 여전히 thin 이라고 한다**(그쪽은 교환권을 안 센다).
 *    즉 링크 집합과 색인 집합이 갈린다. 처음 픽스처는 교환권을 **후보가 아닌 시/도**(대구)에만
 *    뒀는데, 그러면 세는 규칙을 지워도 결과가 같아 주입이 통과했다 — 픽스처가 그 경우를 담지
 *    않으면 규칙을 없애도 초록이다.
 */
const ROWS = [
  ...[1, 2, 3, 4].map(i => row(i, `서울 종로구 길 ${i}`, `종로집${i}`)),
  ...[5, 6, 7].map(i => row(i, `서울 중구 길 ${i}`, `중구집${i}`)),
  ...[8, 9, 10].map(i => row(i, `경기 파주시 길 ${i}`, `파주집${i}`)),
  ...[11, 12].map(i => row(i, `인천 미추홀구 길 ${i}`, `인천집${i}`)),
  ...[18, 19].map(i => row(i, `인천 미추홀구 길 ${i}`, `인천교환권${i}`, 1)),
  ...[13, 14, 15, 16, 17].map(i => row(i, `대구 중구 길 ${i}`, `대구집${i}`, 1)),
]
const DIGEST = buildRegionDigest(ROWS)
const labels = (p: string) => regionChildLinks(p, DIGEST).map(k => k.label)

describe('① 링크 집합 ⟺ 색인 집합 — 양방향', () => {
  it('허브는 **딜 3건 이상인 시/도만** 링크한다', () => {
    expect(labels('/region')).toEqual(['서울', '경기'])
  })

  it('🔴 링크한 지역은 전부 thin 이 **아니다**(색인 말라고 한 URL 을 가리키지 않는다)', () => {
    for (const k of regionChildLinks('/region', DIGEST)) {
      expect(regionThinByDigest(decodeURIComponent(k.href), DIGEST), `${k.label} 이 thin 인데 링크됐다`).toBe(false)
    }
    for (const k of regionChildLinks('/region/서울', DIGEST)) {
      expect(regionThinByDigest(decodeURIComponent(k.href), DIGEST), `${k.label} 이 thin 인데 링크됐다`).toBe(false)
    }
  })

  it('🔴 반대 방향 — 빠진 후보는 전부 thin 이다(멀쩡한 지역을 빠뜨리지 않았다)', () => {
    // 인천은 2건이라 thin(= 빠져야 한다) · 대구는 교환권뿐이라 아예 후보가 아니다.
    expect(labels('/region')).not.toContain('인천')
    expect(regionThinByDigest('/region/인천', DIGEST), '인천이 thin 이 아니라면 링크에서 빠진 게 결함이다').toBe(true)
    expect(labels('/region')).not.toContain('대구')
  })

  it('교환권(deal_only=1)은 세지 않는다 — 매장이 없어 지역 페이지의 항목이 아니다', () => {
    const onlyDeals = buildRegionDigest([1, 2, 3, 4, 5].map(i => row(i, `부산 해운대구 길 ${i}`, `부산집${i}`, 1)))
    expect(regionChildLinks('/region', onlyDeals)).toEqual([])
  })

  it('🔴 요약 대신 **MAIN 시드**가 와도 교환권을 세지 않는다 — 그 봉투엔 교환권이 그대로 있다', () => {
    // 🩸 처음엔 `buildRegionDigest` 로 만든 요약에 교환권을 섞어 쟀는데, **그 함수가 이미 교환권을
    //   버려서** 세는 규칙을 지워도 결과가 같았다(주입이 두 번 통과했다 — 같은 규칙의 **세 번째
    //   사본**이었다). 실제로 그 규칙이 일하는 자리는 **요약이 없을 때**다: 워커는
    //   `crawlerPayload = digestRaw || ssrPayload` 를 넘기므로 KV miss 면 **MAIN 시드 원본**
    //   (교환권 포함)이 이 함수에 온다. 그래서 봉투를 손으로 만들어 그 경우를 잰다.
    const seed = JSON.stringify({ success: true, data: [
      ...[1, 2].map(i => row(i, `인천 미추홀구 길 ${i}`, `인천집${i}`)),
      ...[3, 4].map(i => row(i, `인천 미추홀구 길 ${i}`, `인천교환권${i}`, 1)),
    ] })
    // 비-교환권 2건뿐이라 thin — 교환권까지 세면 4 가 되어 링크되는데, 그 URL 은 여전히 noindex 다.
    expect(regionThinByDigest('/region/인천', seed)).toBe(true)
    expect(regionChildLinks('/region', seed)).toEqual([])
  })
})

describe('② 요약이 없으면 링크를 만들지 않는다 — 부재는 "없다" 가 아니다', () => {
  it.each([null, undefined, '', '{"data":[]}', 'not json'])('%s → 링크 0', (d) => {
    expect(regionChildLinks('/region', d as string | null)).toEqual([])
  })

  it('요약이 없을 때 허브 본문은 **종전과 byte-동일**이다', () => {
    const before = buildStaticSurfaceNoscript('/region', null)
    expect(before).not.toContain('<a ')
    expect(before.length).toBeGreaterThan(50)
    // 요약이 오면 링크만 덧붙는다(문구는 그대로).
    const after = buildStaticSurfaceNoscript('/region', DIGEST)
    expect(after.startsWith(before.replace('</noscript>', ''))).toBe(true)
  })
})

describe('③ 트리 모양 — 잎에는 자식이 없다', () => {
  it('시/도는 자기 시군구만 낸다', () => {
    expect(labels('/region/서울')).toEqual(['종로구', '중구'])
    expect(labels('/region/경기')).toEqual(['파주시'])
  })

  it('시군구(잎)·지역 아닌 경로·더 깊은 경로는 링크 0', () => {
    for (const p of ['/region/서울/종로구', '/region/서울/중구/더깊게', '/vouchers', '/', '/stays']) {
      expect(regionChildLinks(p, DIGEST), p).toEqual([])
    }
  })

  it('모르는 시/도는 자식이 없다 — 지어낸 지역에 트리를 만들지 않는다', () => {
    expect(regionChildLinks('/region/없는도', DIGEST)).toEqual([])
  })
})

describe('④ 주소 = canonical — 링크가 리다이렉트·다른 URL 을 가리키지 않는다', () => {
  it('자식 href 가 그 경로의 canonical 과 같은 경로다', () => {
    // 🩸 손으로 조립하면 `강원특별자치도` 처럼 정규화되는 값에서 canonical 과 어긋나는데
    //    **에러가 전혀 안 난다**(같은 세션의 빵부스러기 작업에서 값을 치르고 배운 자리).
    for (const k of [...regionChildLinks('/region', DIGEST), ...regionChildLinks('/region/서울', DIGEST)]) {
      const path = decodeURIComponent(k.href)
      const seo = resolveRegionSeo(path, 'https://urdeal.kr')
      expect(seo, `${path} 가 지역 표면으로 해석되지 않는다`).toBeTruthy()
      expect(decodeURIComponent(String(seo!.canonical))).toBe(`https://urdeal.kr${path}`)
    }
  })

  it('정규화되는 시/도도 canonical 과 같다 — 강원특별자치도 주소', () => {
    const d = buildRegionDigest([1, 2, 3].map(i => row(i, `강원특별자치도 속초시 길 ${i}`, `속초집${i}`)))
    const kids = regionChildLinks('/region', d)
    expect(kids.map(k => k.label)).toEqual(['강원'])
    const path = decodeURIComponent(kids[0].href)
    expect(decodeURIComponent(String(resolveRegionSeo(path, 'https://urdeal.kr')!.canonical)))
      .toBe(`https://urdeal.kr${path}`)
  })
})

describe('⑤ 배선 — 허브가 요약을 받고, 마크업은 한 곳에서만 조립한다', () => {
  it('허브 경로가 요약 대상이다(종전엔 아니어서 링크를 만들 수 없었다)', () => {
    expect(regionDigestApplies('/region')).toBe(true)
    expect(regionDigestApplies('/region/서울')).toBe(true)
    expect(regionDigestApplies('/stays')).toBe(true)
    for (const p of ['/', '/vouchers', '/browse', '/map', '/faq', '/u/jiwon1228']) {
      expect(regionDigestApplies(p), p).toBe(false)
    }
  })

  it('조립은 `childLinksHtml` 한 곳 — 두 벌이면 한쪽이 탈출을 빠뜨린다', () => {
    const c = code(NS)
    expect(c).toContain('function childLinksHtml(')
    // `regionChildLinks` 를 직접 쓰는 곳은 그 헬퍼뿐이어야 한다.
    expect(c.match(/regionChildLinks\(/g) || []).toHaveLength(1)
    expect(c.match(/childLinksHtml\(path, ssrPayload\)/g) || []).toHaveLength(2)
    // 라벨·주소 둘 다 탈출을 지난다(동작으로는 못 잰다 — 머리말의 "못 보는 것" 참조).
    expect(c).toMatch(/href="\$\{esc\(k\.href\)\}">\$\{esc\(k\.label\)\}/)
  })

  it('시/도 페이지는 상품 목록 **뒤에** 자식을 붙인다 — 상품이 먼저다', () => {
    const html = buildStaticSurfaceNoscript('/region/서울', DIGEST)
    expect(html.indexOf('/pass/1')).toBeLessThan(html.indexOf('/region/%EC%84%9C%EC%9A%B8/'))
    expect(html).toContain('서울 이용권')
  })
})
