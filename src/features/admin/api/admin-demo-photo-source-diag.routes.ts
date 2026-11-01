/**
 * 🔬 2026-10-26 데모 사진 출처 진단 (대표 "이용권마다 최소 3장씩 사진 받아오기로 했는데 지금 안되고 있어").
 *
 * 라이브 하트비트가 매시 `reconditioned=0 · photoShort=308` 이다. 사진 수집이 Cloudflare 에서 아예 안 되는지,
 * 되는데 구조를 못 읽는지를 **추측하지 않고** 라이브 워커가 직접 두드려 본 결과로 가른다
 * (개발 환경은 네이버 지도가 egress 차단이라 여기서만 볼 수 있다).
 *
 * 읽기 전용 — DB 를 바꾸지 않는다. 한 상품당 외부 요청 ≤12.
 * 응답에는 각 단계의 HTTP 상태·크기·업체 사진 주소 수, 그리고 사진 주소 **주변 글자**(구조 파악용,
 * 200자 × 최대 4개)를 싣는다 — 메뉴 이름·사진 분류가 HTML 어디에 있는지 보려는 것이다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { getSupplyMeta } from '@/worker/utils/product-supply-meta'
import { findNaverPlace } from '@/worker/utils/naver-place-photo'
import { extractKakaoPlaceId, fetchKakaoMyStoreAll } from '@/worker/utils/kakao-place-photos'
import { kakaoPlaceUrlFromId } from '@/shared/kakao-place-url'

export const adminDemoPhotoSourceDiagRoutes = new Hono<{ Bindings: Env }>()

const UA_PC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

interface Probe { name: string; url: string; status: number; bytes: number; ms: number; ldb: number; kakaoImg: number; hasApollo: boolean; contexts: string[]; head?: string; placeIds?: string[]; error?: string }

/** 사진 주소 주변 글자 — 이스케이프를 풀고 앞뒤 100자. */
function contextsOf(text: string, re: RegExp, max = 4): string[] {
  const t = text.replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
  const out: string[] = []
  for (const m of t.matchAll(re)) {
    const i = m.index ?? 0
    out.push(t.slice(Math.max(0, i - 120), i + 80).replace(/\s+/g, ' '))
    if (out.length >= max) break
  }
  return out
}

async function probe(name: string, url: string, headers: Record<string, string>): Promise<Probe> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(7000) })
    const text = await res.text()
    const ldbRe = /https?:(?:\/\/|\\u002F\\u002F|\\\/\\\/)ldb-phinf\.pstatic\.net/gi
    const t = text.replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
    return {
      name, url, status: res.status, bytes: text.length, ms: Date.now() - t0,
      ldb: (t.match(/https?:\/\/ldb-phinf\.pstatic\.net\/[^"'\s\\<>)]+/gi) || []).length,
      kakaoImg: (t.match(/https?:\/\/[a-z0-9.]*(?:daumcdn\.net|kakaocdn\.net)\/[^"'\s\\<>)]+/gi) || []).length,
      hasApollo: /__APOLLO_STATE__|apolloState/.test(text),
      contexts: contextsOf(text, ldbRe).length ? contextsOf(text, ldbRe) : contextsOf(text, /(daumcdn|kakaocdn)\.net\/[^"'\s]+/gi),
      // 본문 앞부분 — 차단·캡차·빈 응답을 가리려면 실제 글자를 봐야 한다(2026-10-26 allSearch 가 200 인데 336B 였다).
      head: text.slice(0, 400).replace(/\s+/g, ' '),
      // 네이버 장소 번호 후보 — 검색 응답 어디에 있든 "id":"123…" / place/123… 모양을 줍는다.
      placeIds: Array.from(new Set([...text.matchAll(/(?:place\/|"id"\s*:\s*"?)(\d{7,12})/g)].map((m) => m[1]))).slice(0, 5),
    }
  } catch (err) {
    return { name, url, status: 0, bytes: 0, ms: Date.now() - t0, ldb: 0, kakaoImg: 0, hasApollo: false, contexts: [], error: String((err as Error)?.message || '').slice(0, 80) }
  }
}

adminDemoPhotoSourceDiagRoutes.get('/dongnedeal/photo-source-diag', cors(), async (c) => {
  try {
    const id = Number(c.req.query('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: 'id 가 필요합니다' }, 400)
    const row = await c.env.DB.prepare(
      `SELECT id, name, category, restaurant_name, restaurant_address, image_url, images FROM products WHERE id = ? AND slug LIKE 'demo-%'`
    ).bind(id).first<{ id: number; name: string; category: string; restaurant_name: string | null; restaurant_address: string | null; image_url: string | null; images: string | null }>()
    if (!row) return c.json({ success: false, error: '데모 상품이 아닙니다' }, 404)
    const meta = (await getSupplyMeta(c.env.DB, [id]).catch(() => new Map())).get(id) || {}
    const probes: Probe[] = []

    // 카카오 — 대표사진(og) 페이지 + 사진 목록 후보 경로들(현재 쓰는 건 og 하나뿐).
    const kid = extractKakaoPlaceId(meta.kakao_place_url || null)
    if (kid) {
      probes.push(await probe('kakao.page', kakaoPlaceUrlFromId(kid) || '', { 'User-Agent': UA_PC, Accept: 'text/html' }))
      probes.push(await probe('kakao.panel3', `https://place-api.map.kakao.com/places/panel3/${kid}`, { 'User-Agent': UA_PC, Accept: 'application/json', pf: 'PC', Referer: 'https://place.map.kakao.com/' }))
      probes.push(await probe('kakao.photos', `https://place-api.map.kakao.com/places/tab/photos/${kid}?type=all`, { 'User-Agent': UA_PC, Accept: 'application/json', pf: 'PC', Referer: 'https://place.map.kakao.com/' }))
    }

    // 네이버 — 매장 찾기(allSearch) → 사진 탭 · 메뉴 탭 · 홈.
    let naver: { found: boolean; id?: string; name?: string; keys?: string[]; via?: string } = { found: false }
    const q = encodeURIComponent(row.restaurant_name || '')
    const qa = encodeURIComponent(`${row.restaurant_name || ''} ${(row.restaurant_address || '').split(/\s+/).slice(0, 2).join(' ')}`.trim())
    // 다른 네이버 검색 경로들 — allSearch 가 막혀도 장소 번호를 얻을 수 있는지.
    probes.push(await probe('naver.instant', `https://map.naver.com/p/api/search/instant-search?query=${qa}&coords=37.5,127.0`, { 'User-Agent': UA_PC, Accept: 'application/json', Referer: 'https://map.naver.com/' }))
    probes.push(await probe('naver.m.search', `https://m.map.naver.com/search2/searchMore.naver?query=${qa}&sm=clk&style=v5&page=1&displayCount=5&type=SITE_1`, { 'User-Agent': UA_M, Accept: 'application/json', Referer: 'https://m.map.naver.com/' }))
    probes.push(await probe('naver.pc.list', `https://pcmap.place.naver.com/place/list?query=${qa}`, { 'User-Agent': UA_PC, Accept: 'text/html', Referer: 'https://map.naver.com/' }))
    probes.push(await probe('naver.m.list', `https://m.place.naver.com/place/list?query=${qa}`, { 'User-Agent': UA_M, Accept: 'text/html', Referer: 'https://m.place.naver.com/' }))
    void q
    const allSearchUrl = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(row.restaurant_name || '')}&type=all&searchCoord=&boundary=`
    probes.push(await probe('naver.allSearch', allSearchUrl, { 'User-Agent': UA_PC, Accept: 'application/json', Referer: 'https://map.naver.com/' }))
    const match = row.restaurant_name ? await findNaverPlace(row.restaurant_name, row.restaurant_address).catch(() => null) : null
    // ?nid= 로 장소 번호를 직접 주면 검색을 건너뛰고 사진·메뉴 탭만 본다(검색이 막혔을 때 사진 탭은 되는지 가르려고).
    const nidParam = String(c.req.query('nid') || '')
    const nidFromProbe = probes.find((p) => p.name !== 'naver.allSearch' && p.placeIds?.length)?.placeIds?.[0] || ''
    const forced = /^\d{5,12}$/.test(nidParam) ? nidParam : nidFromProbe
    if (match || forced) {
      const nid = forced || String(match?.id || '')
      naver = { found: !!match, id: nid, name: String(match?.name || ''), keys: match ? Object.keys(match).slice(0, 40) : [], via: forced ? (nidParam ? 'param' : 'probe') : 'allSearch' }
      if (/^\d+$/.test(nid)) {
        const h = { 'User-Agent': UA_M, Accept: 'text/html', Referer: 'https://m.place.naver.com/' }
        probes.push(await probe('naver.photo.biz', `https://m.place.naver.com/restaurant/${nid}/photo?filterType=${encodeURIComponent('업체사진')}`, h))
        probes.push(await probe('naver.photo.all', `https://m.place.naver.com/restaurant/${nid}/photo`, h))
        probes.push(await probe('naver.menu', `https://m.place.naver.com/restaurant/${nid}/menu/list`, h))
        probes.push(await probe('naver.home', `https://m.place.naver.com/place/${nid}/home`, h))
        probes.push(await probe('naver.pc.photo', `https://pcmap.place.naver.com/restaurant/${nid}/photo`, { ...h, 'User-Agent': UA_PC, Referer: 'https://map.naver.com/' }))
      }
    }

    return c.json({
      success: true,
      product: { id: row.id, name: row.name, category: row.category, store: row.restaurant_name, address: row.restaurant_address, cover: row.image_url, photos: (() => { try { return JSON.parse(row.images || '[]').length } catch { return 0 } })() },
      meta: { kakao_place_url: meta.kakao_place_url || null, demo_cond_v: meta.demo_cond_v || null, demo_cond_tries: meta.demo_cond_tries || null, demo_photo_retry_after: meta.demo_photo_retry_after || null },
      naver, probes,
    })
  } catch (err) {
    console.error('[photo-source-diag]', err)
    return c.json({ success: false, error: '진단 중 오류가 발생했습니다' }, 500)
  }
})

/**
 * 🖼️ 2026-10-27 (대표 "카카오에서도 들고와야 … 매장주 제공 사진들 중에서 내가 다른 사진으로 조정도 하고싶어"):
 *   어드민 동네딜 수정 화면의 "카카오 매장주 사진" 버튼 — 그 장소의 매장주 제공 사진 목록(읽기 전용).
 *   ?place= 카카오 장소 URL 또는 id. 외부 요청 ≤3.
 */
adminDemoPhotoSourceDiagRoutes.get('/dongnedeal/kakao-mystore-photos', cors(), async (c) => {
  const place = String(c.req.query('place') || '').slice(0, 200)
  if (!extractKakaoPlaceId(place)) return c.json({ success: false, error: '카카오 장소 주소가 없습니다' }, 400)
  const photos = await fetchKakaoMyStoreAll(place, 3).catch(() => [] as string[])
  return c.json({ success: true, data: { photos } })
})
