#!/usr/bin/env node
/**
 * 🏪 2026-10-26 데모 이용권 사진 — 네이버 지도 **업체사진**을 실제 브라우저로 모은다.
 *
 * 대표: *"네이버 지도가 더 사진들은 많은 것 같긴한데? 네이버 지도에서 최대한 내용을 가져와야겠는데"*
 *       → *"우리가 가지고 있는 리소스를 최대한 활용해서 가장 이상적으로 만들어봐"*
 *
 * 왜 여기(GitHub 러너)인가: 라이브 워커(Cloudflare)는 네이버 검색이 캡차로 막힌다
 *   (`ncaptcha-all-search-no-result` · PC 화면 429 — 진단 2차 실측). 같은 검색을 러너의 실제 브라우저로
 *   열면 가게 번호와 업체사진(ldb-phinf)이 나온다(진단 3차 — 스타벅스 강남역점 15장).
 *
 * 하는 일(이것만):
 *   ① D1 에서 사진이 3장 미만인 데모(쇼핑 데모 제외)를 고른다 — 14일 안에 본 가게는 건너뛴다
 *   ② 네이버 지도에서 **이름 + 시·군·구가 둘 다 맞는** 가게만 고른다(scripts/naver-place-match.mjs)
 *   ③ 그 가게의 업체사진 탭에서 업체 사진 주소만 모은다(손님 리뷰·블로그 사진 제외)
 *   ④ product_supply_meta 에 주소만 적고 재시도를 당긴다 — 내려받기·R2 이관·커버 교체·검증은
 *      기존 워커 파이프라인(demo-image-rehost → fetchDemoPhotos)이 한다(두 벌 만들지 않는다).
 *
 * 우리 서비스·상품 행을 직접 고치지 않는다(메타 키 넷: naver_place_id · naver_biz_photos ·
 * naver_collect_at · demo_photo_retry_after). DRY_RUN=1 이면 아무것도 쓰지 않고 적중률만 보고한다.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… DRY_RUN=1 LIMIT=15 node naver-photo-collect.mjs
 */
import { chromium } from 'playwright'
import { pickNaverPlace, candidatesFromApollo, businessPhotoUrls } from './naver-place-match.mjs'

const ACC = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const DB = process.env.D1_DATABASE_ID || 'd9530ba6-7a26-4c02-9295-3ce5aef112a3' // wrangler.toml DB 바인딩(메인)
const DRY = process.env.DRY_RUN === '1'
const LIMIT = Math.max(1, Math.min(80, Number(process.env.LIMIT || 30)))
const MAX_PHOTOS = 8
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

if (!ACC || !TOKEN) { console.error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 필요'); process.exit(1) }

async function d1(sql, params = []) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const j = await res.json()
  if (!j.success) throw new Error('D1: ' + JSON.stringify(j.errors).slice(0, 200))
  return j.result?.[0]?.results || []
}

async function setMeta(productId, kv) {
  for (const [k, v] of Object.entries(kv)) {
    await d1(
      `INSERT INTO product_supply_meta (product_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(product_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [productId, k, v],
    )
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const rows = await d1(
  `SELECT p.id, p.restaurant_name AS name, p.restaurant_address AS address,
          (SELECT value FROM product_supply_meta m WHERE m.product_id = p.id AND m.key = 'naver_place_id') AS nid
     FROM products p
    WHERE p.slug LIKE 'demo-%' AND p.slug NOT LIKE 'demo-linkshop-%'
      AND p.restaurant_name IS NOT NULL AND p.restaurant_name <> ''
      AND (COALESCE(p.is_active, 1) = 1 OR EXISTS (
        SELECT 1 FROM product_supply_meta h WHERE h.product_id = p.id AND h.key = 'demo_hidden_no_photo' AND h.value = '1'))
      AND (p.images IS NULL OR json_valid(p.images) = 0 OR json_array_length(p.images) < 3)
      AND NOT EXISTS (SELECT 1 FROM product_supply_meta c
        WHERE c.product_id = p.id AND c.key = 'naver_collect_at' AND c.value > datetime('now', '-14 days'))
    ORDER BY p.id
    LIMIT ?`,
  [LIMIT],
)
console.log(`대상 ${rows.length}곳 (DRY_RUN=${DRY ? 1 : 0})`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ userAgent: UA_M, viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const stats = { checked: 0, matched: 0, withPhotos: 0, photos: 0, noMatch: 0, blocked: 0, errors: 0 }
let blockedStreak = 0

for (const row of rows) {
  stats.checked++
  try {
    let nid = /^\d{5,12}$/.test(String(row.nid || '')) ? String(row.nid) : ''
    if (!nid) {
      const area = String(row.address || '').split(/\s+/).slice(0, 2).join(' ')
      await page.goto(`https://m.place.naver.com/place/list?query=${encodeURIComponent(`${row.name} ${area}`.trim())}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForFunction(() => window.__APOLLO_STATE__, null, { timeout: 8000 }).catch(() => {})
      const state = await page.evaluate(() => window.__APOLLO_STATE__ || null)
      if (!state) {
        // 상태가 없으면 막힌 것으로 본다 — 스탬프를 찍지 않아 다음 회차에 다시 본다.
        stats.blocked++; blockedStreak++
        console.log(`  #${row.id} ${row.name}: 검색 결과 상태 없음(차단 의심)`)
        if (blockedStreak >= 3) { console.log('연속 3회 차단 — 이번 회차 중단'); break }
        continue
      }
      blockedStreak = 0
      const pick = pickNaverPlace(candidatesFromApollo(state), row.name, row.address)
      if (!pick) {
        stats.noMatch++
        console.log(`  #${row.id} ${row.name}: 이름·지역이 맞는 가게 없음`)
        if (!DRY) await setMeta(row.id, { naver_collect_at: new Date().toISOString().slice(0, 19).replace('T', ' ') })
        await sleep(2000 + Math.random() * 2000)
        continue
      }
      nid = pick.id
    }
    stats.matched++
    await page.goto(`https://m.place.naver.com/place/${nid}/photo?filterType=${encodeURIComponent('업체사진')}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 2000); await page.waitForTimeout(700) }
    const photos = businessPhotoUrls(await page.content(), MAX_PHOTOS)
    if (photos.length) { stats.withPhotos++; stats.photos += photos.length }
    console.log(`  #${row.id} ${row.name} → 네이버 ${nid}: 업체사진 ${photos.length}장`)
    if (!DRY) {
      const kv = { naver_place_id: nid, naver_collect_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }
      if (photos.length) Object.assign(kv, { naver_biz_photos: JSON.stringify(photos), demo_photo_retry_after: new Date(Date.now() - 60000).toISOString().slice(0, 19).replace('T', ' ') })
      await setMeta(row.id, kv)
    }
  } catch (err) {
    stats.errors++
    console.log(`  #${row.id} ${row.name}: 오류 ${String(err?.message || err).slice(0, 120)}`)
  }
  await sleep(2000 + Math.random() * 2000)
}

await browser.close()
const rate = stats.checked ? Math.round((stats.withPhotos / stats.checked) * 100) : 0
console.log(`COLLECT_RESULT ${JSON.stringify({ ...stats, hitRatePct: rate, dryRun: DRY })}`)
