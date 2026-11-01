/**
 * 🔎 2026-10-14 — 라이브 실측에서 나온 세 가지 (대표 *"다 해주고 머지 후 또 개선점 찾아"*).
 *
 * ## ① `/{아무문자열}/p/{아무것}` 이 무한 thin URL 이었다
 *
 * Googlebot UA 실측:
 *
 *       /zzqqxx/p/2887     200 · index,follow · canonical 자기자신 · 본문 32자 · 제네릭 홈 제목
 *                          x-ssr-status: MALLPRODUCT:self-fetch-404   ← 404 를 받고도 200 을 냈다
 *       /zzqqxx/p/999999   같음
 *       /zzqqxx/p/abc      200 · index,follow · x-ssr-status **없음**(슬롯조차 안 잡힌다)
 *       (대조) /zzqqxx     404 · noindex                              ← 1세그먼트는 멀쩡했다
 *
 * 원인이 **두 줄**이었다: ⓐ `ENTITY_SLOTS` 에 `MALLPRODUCT` 누락(2026-10-12 에 형제 `MALL` 만
 * 넣었다) ⓑ `isKnownAppPath` 가 `/x/p/*` 를 **무조건** 통과시켜, 슬롯이 안 잡히는 모양도
 * "아는 경로" 가 됐다. `/group-buy/99999999`(2026-07-29)과 같은 클래스다.
 *
 * 🔴 **반대 방향이 훨씬 비싸다** — 실재하는 몰 상품 경로를 404 로 만들면 소개비 귀속 링크가
 *    통째로 죽고 색인 복구는 수주다. 그래서 아래 ①-2·①-3 이 **200 을 유지해야 하는 쪽**을 함께 잠근다.
 *
 * ## ② 비-JS 크롤러가 받는 문서에 사진이 0장이었다
 *
 * 🩸 **먼저 제 근거를 정정한다**: 처음 *"구글 이미지에 자리가 없다"* 로 읽었는데 틀렸다 —
 *    봇 셸에도 엔트리 스크립트가 있어(`script src` 1) **Googlebot 은 렌더해서** React 카드의
 *    `<img>` 를 본다. 실제 공백은 **네이버 Yeti · AI 검색봇**(JS 미실행)이다.
 *
 * ## ③ IndexNow — 색인을 *요청하는* 수단이 없었다
 *
 * 근거·설계는 `shared/seo/indexnow.ts` 머리말. 여기서는 **첫 회차가 아무것도 안 보내는지**와
 * **상한에 잘리면 커서를 유지하는지**를 동작으로 잠근다(둘 다 틀리면 조용히 손해가 난다).
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 실제로 색인에서 빼거나 크롤하는지(외부 판정 ·
 *    수일~수주 · 서치콘솔은 대표만 본다) · HTMLRewriter·fetch 런타임 배선 · 네이버가
 *    `<noscript>` 안의 `<img>` 를 이미지 검색에 넣는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'
import { isKnownAppPath } from '@/shared/seo/known-routes'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import {
  INDEXNOW_ENDPOINTS, INDEXNOW_CURSOR_KEY, buildIndexNowBody, indexNowKeyPath,
  isValidIndexNowKey, parseSitemapEntries, planIndexNow,
} from '@/shared/seo/indexnow'

/** 라이브 응답 모양에서 만든 탐침(스크래치 파일에 의존하면 CI 에서 조용히 건너뛰어진다). */
const SEED = JSON.stringify({
  success: true,
  data: [
    { id: 2919, name: '닭도리탕', restaurant_name: '달빛한스푼', restaurant_address: '서울 중구 x', category: 'meal_voucher', price: 31000, original_price: 35000, image_url: 'https://media.ur-team.com/uploads/seller/26/a.jpg' },
    // 🔴 워커 프록시로 가는 호스트(검증 목록 밖) — 사진을 붙이지 않는다.
    // ⚠️ **앞쪽에 둔다**: 뒤에 두면 어차피 상한에 걸려 가드를 없애도 출력이 안 바뀐다(2026-10-14 주입이 잡았다).
    { id: 2910, name: '치킨 세트', restaurant_name: '둘둘치킨', restaurant_address: '서울 중구 t', category: 'meal_voucher', price: 19600, image_url: 'https://i.ibb.co/abc/x.png' },
    // 🖼️ 사진 없는 행 — 사진을 **지어내지 않는다**(같은 이유로 앞쪽).
    { id: 2911, name: '항정살 세트', restaurant_name: '고냉지', restaurant_address: '서울 중구 u', category: 'meal_voucher', price: 36800 },
    { id: 2915, name: '돈가스 세트', restaurant_name: '홍대돈까스', restaurant_address: '서울 마포구 y', category: 'meal_voucher', price: 7500, image_url: 'https://media.ur-team.com/uploads/seller/26/b.jpg' },
    { id: 2914, name: '보쌈 정식', restaurant_name: '자가만족', restaurant_address: '서울 종로구 z', category: 'meal_voucher', price: 38300, image_url: 'https://media.ur-team.com/uploads/demo/c.jpg' },
    { id: 2913, name: '곱창전골', restaurant_name: '세광양대창', restaurant_address: '서울 중구 w', category: 'meal_voucher', price: 40000, image_url: 'https://media.ur-team.com/uploads/demo/d.jpg' },
    { id: 2912, name: '케이크 홀', restaurant_name: '레종데트르', restaurant_address: '서울 중구 v', category: 'meal_voucher', price: 31400, image_url: 'https://media.ur-team.com/uploads/demo/e.jpg' },
  ],
})

describe('① 몰 상품 경로의 thin URL 을 닫는다', () => {
  it('①-1 없는 몰·없는 상품은 404+noindex 로 간다 (슬롯이 404 를 받으면)', () => {
    expect(shouldNoindexMissingEntity('MALLPRODUCT', 'self-fetch-404')).toBe(true)
  })

  it('①-2 🔴 반대 방향 — 실재하는 몰 상품 경로는 200 을 유지한다', () => {
    // 문법이 맞으면 "아는 경로" 다. 실재 여부는 self-fetch 가 판정하고, 여기서 404 로 만들면
    // 소개비 귀속 링크가 통째로 죽는다.
    expect(isKnownAppPath('/realmall/p/123')).toBe(true)
    expect(shouldNoindexMissingEntity('MALLPRODUCT', 'edge-hit')).toBe(false)
    // ⚠️ **타임아웃은 부재가 아니다** — 콜드 콜로에서 흔하고, 그걸로 noindex 를 내면 멀쩡한
    //   상품이 색인에서 빠진다(더 큰 사고).
    expect(shouldNoindexMissingEntity('MALLPRODUCT', 'self-fetch-timeout')).toBe(false)
  })

  it('①-3 🔴 반대 방향 — 유어샵 소개 경로·깊은 대시보드 경로도 200 을 유지한다', () => {
    expect(isKnownAppPath('/u/jiwon1228/p/2887')).toBe(true)
    expect(isKnownAppPath('/seller/orders/xyz')).toBe(true)
    expect(isKnownAppPath('/vouchers')).toBe(true)
  })

  it('①-4 문법이 아닌 몰 상품 경로는 "아는 경로" 가 아니다', () => {
    // 이 모양들은 슬롯조차 안 잡히므로(`parseMallProductPath` 가 거부) 여기서 막지 않으면
    // **영원히 200 + index** 다.
    for (const p of ['/zzqqxx/p/abc', '/zzqqxx/p/0', '/zzqqxx/p/-1', '/zzqqxx/p/1.5', '/zzqqxx/p/']) {
      expect(isKnownAppPath(p), `${p} 가 아는 경로로 통과했다`).toBe(false)
    }
  })

  it('①-5 판정을 두 벌로 적지 않는다 — 몰 경로 SSOT 를 쓴다', () => {
    const code = readCode('src/shared/seo/known-routes.ts')
    expect(code).toMatch(/parseMallProductPath/)
    // 종전의 무조건 통과가 되돌아오면 빨간불.
    expect(code).not.toMatch(/segs\[1\] === 'p'\)\s*return true/)
    expect(readCode('src/worker/utils/surface-ssr-meta.ts')).toMatch(/'MALLPRODUCT'/)
  })
})

describe('② 크롤러 문서에 사진 자리를 만든다', () => {
  // 🔢 상한은 **그려진 사진**을 센다 — 쓸 수 없는 행(사진 없음 · 프록시 호스트)이 자리를 먹지 않는다.
  //    탐침의 앞 4행 중 둘이 쓸 수 없으므로, 행 인덱스로 세던 종전 구현은 여기서 2장이 되어 빨간불이다.
  it('②-1 목록 표면 행에 사진이 붙는다 — 그려진 사진 4장까지', () => {
    const h = buildStaticSurfaceNoscript('/browse', SEED)
    const imgs = h.match(/<img /g) || []
    expect(imgs.length).toBe(4)
    // 글은 그대로 8행까지(사진만 상한이 있다).
    expect((h.match(/<li>/g) || []).length).toBeGreaterThanOrEqual(7)
  })

  it('②-2 사진은 링크 안쪽에 있다 — 그 그림이 어느 페이지의 것인지 말한다', () => {
    const h = buildStaticSurfaceNoscript('/browse', SEED)
    expect(h).toMatch(/<a href="\/pass\/2919"><img /)
  })

  it('②-3 alt 이 실재하는 이름이다 (지어내지 않는다)', () => {
    const h = buildStaticSurfaceNoscript('/browse', SEED)
    expect(h).toMatch(/alt="달빛한스푼 닭도리탕"/)
    // 가격은 그림을 설명하지 않으므로 alt 에 넣지 않는다.
    expect(h).not.toMatch(/alt="[^"]*판매가/)
  })

  it('②-4 🔴 워커 프록시로 가는 사진은 안 쓴다 (리사이즈가 안 된다)', () => {
    const h = buildStaticSurfaceNoscript('/browse', SEED)
    expect(h).not.toMatch(/api\/image\/resize/)
    // cdn-cgi 로 확실히 가는 것만, 그리고 폭이 선언돼 있다.
    for (const m of h.match(/<img src="([^"]*)"/g) || []) {
      expect(m).toMatch(/\/cdn-cgi\/image\/width=\d+/)
    }
  })

  it('②-5 사진이 없는 행은 글만 남는다 (빈 img 를 만들지 않는다)', () => {
    const one = JSON.stringify({ success: true, data: [{ id: 2911, name: '항정살', restaurant_name: '고냉지', restaurant_address: '서울 중구 u', category: 'meal_voucher', price: 36800 }] })
    const h = buildStaticSurfaceNoscript('/browse', one)
    expect(h).toContain('고냉지')
    expect(h).not.toMatch(/<img /)
  })

  it('②-6 치수를 지어내지 않는다 — height 를 선언하지 않는다', () => {
    // 우리 사진은 비율이 제각각이라(2026-08-31 실측) height 를 적으면 모르는 값을 적는 것이다.
    const h = buildStaticSurfaceNoscript('/browse', SEED)
    expect(h).not.toMatch(/<img[^>]*\sheight=/)
  })

  it('②-7 지역 페이지도 같은 상한을 쓴다', () => {
    const h = buildStaticSurfaceNoscript('/region/서울', SEED)
    expect((h.match(/<img /g) || []).length).toBe(4)
  })
})

describe('③ IndexNow — 보낼 것만 보낸다', () => {
  const entries = [
    { loc: 'https://urdeal.kr/pass/1', lastmod: '2026-10-10T00:00:00Z' },
    { loc: 'https://urdeal.kr/pass/2', lastmod: '2026-10-12T00:00:00Z' },
    { loc: 'https://urdeal.kr/pass/3', lastmod: '2026-10-13T00:00:00Z' },
  ]

  it('③-1 ⚠️ 첫 회차는 **아무것도 보내지 않는다** (커서만 세운다)', () => {
    const p = planIndexNow(entries, '')
    expect(p.urls).toEqual([])
    expect(p.cursor).toBe('2026-10-13T00:00:00Z')
  })

  it('③-2 변경된 것만, 새 것부터', () => {
    const p = planIndexNow(entries, '2026-10-11T00:00:00Z')
    expect(p.urls).toEqual(['https://urdeal.kr/pass/3', 'https://urdeal.kr/pass/2'])
  })

  it('③-3 🔴 상한에 잘리면 커서를 올리지 않는다 (못 보낸 변경이 영구히 빠지지 않게)', () => {
    const p = planIndexNow(entries, '2026-01-01', 1)
    expect(p.urls.length).toBe(1)
    expect(p.cursor).toBe('2026-01-01')
  })

  it('③-4 변경이 없으면 0건', () => {
    expect(planIndexNow(entries, '2026-10-13T00:00:00Z').urls).toEqual([])
  })

  it('③-5 lastmod 없는 항목은 아예 안 센다 (언제 바뀌었는지 모른다)', () => {
    const xml = `<urlset><url><loc>https://urdeal.kr/a</loc><lastmod>2026-10-01</lastmod></url>`
      + `<url><loc>https://urdeal.kr/b</loc></url></urlset>`
    expect(parseSitemapEntries(xml)).toEqual([{ loc: 'https://urdeal.kr/a', lastmod: '2026-10-01' }])
  })

  it('③-6 키 형식·경로·본문', () => {
    expect(isValidIndexNowKey('abcd1234-xyz')).toBe(true)
    expect(isValidIndexNowKey('short')).toBe(false)
    expect(isValidIndexNowKey('has_underscore1')).toBe(false)
    expect(indexNowKeyPath('abcd1234')).toBe('/abcd1234.txt')
    const b = buildIndexNowBody('urdeal.kr', 'abcd1234', 'https://urdeal.kr/abcd1234.txt', ['https://urdeal.kr/pass/1'])
    expect(b).toEqual({ host: 'urdeal.kr', key: 'abcd1234', keyLocation: 'https://urdeal.kr/abcd1234.txt', urlList: ['https://urdeal.kr/pass/1'] })
  })

  it('③-7 🔴 sitemap 을 읽는다 — 선택 술어를 다시 적지 않는다', () => {
    const code = readCode('src/worker/cron/indexnow-submit.ts')
    expect(code).toMatch(/sitemap\.xml/)
    // 상품·블로그를 직접 쿼리하면 sitemap 의 noindex·thin 게이트가 상속되지 않는다.
    expect(code).not.toMatch(/FROM products|FROM blog_posts/)
  })

  it('③-8 🔴 2단 스위치 — 게이트와 키가 둘 다 없으면 한 글자도 안 나간다', () => {
    const code = readCode('src/worker/cron/indexnow-submit.ts')
    expect(code).toMatch(/INDEXNOW_ENABLED !== 'true'/)
    expect(code).toMatch(/isValidIndexNowKey\(key\)/)
    // 제출 실패 시 커서를 올리면 그 변경이 영구히 빠진다.
    expect(code).toMatch(/커서 유지/)
  })

  it('③-9 cron 에 등재돼 있다 (안 돌면 아무 일도 안 일어나고 에러도 없다)', () => {
    const s = readCode('src/worker/scheduled.ts')
    // 🔁 슬롯 안에서는 `slotCron(그 슬롯 주기)` 가 정본이다 — 생 `safeCron` 은 캐리어 주기(*/5)로
    //    기록돼 하트비트 감시가 오탐한다(`cron-slot-cadence` 가드가 그 방향을 막는다).
    expect(s).toMatch(/slotCron\('50 19 \* \* \*'\)\('indexnow-submit'/)
  })

  it('③-10 키 파일 라우트가 env 키와 정확히 같을 때만 응답한다', () => {
    const code = readCode('src/worker/routes/sitemap.routes.ts')
    expect(code).toMatch(/indexNowKeyPath\(key\)/)
    expect(code).toMatch(/isValidIndexNowKey\(key\)/)
  })

  it('③-11 엔드포인트·커서 키가 상수다 (손으로 적으면 갈린다)', () => {
    // 2026-10-31 — 공유 중계 하나가 429 면 전부 막혔다 → 엔진별 직접 제출(네이버·빙).
    expect(INDEXNOW_ENDPOINTS).toEqual(['https://searchadvisor.naver.com/indexnow', 'https://www.bing.com/indexnow'])
    // 하나라도 받으면 성공 — `every` 로 바뀌면 한 엔진의 429 가 커서를 영원히 묶는다.
    expect(readCode('src/worker/cron/indexnow-submit.ts')).toMatch(/results\.some\(\(r\) => r\.ok\)/)
    expect(INDEXNOW_CURSOR_KEY).toBe('indexnow_cursor')
    // 🔴 구글은 IndexNow 를 지원하지 않는다 — 기대를 섞지 않도록 문서에 못 박혀 있어야 한다.
    expect(readFileSync('src/shared/seo/indexnow.ts', 'utf8')).toMatch(/구글은 IndexNow 를 지원하지 않는다/)
  })
})
