/**
 * 🔎 "다녀온 사람들" 자동 수집 — **유어애즈 워커(ur-ads) 매시** (2026-11-04 대표 *"네 추천대로"* · *"유튜브는 유어애즈랑 자동으로 분담"*
 *    · *"네이버 쪽은 토큰 많잖아 … 많이 활용해봐 수집하는거. 우리 서비스에 부담이 가지 않을 정도로"* · *"2번은 가 로"*)
 *
 * 🏠 **어디서 도나**: ur-ads 의 `/__ads/creator-content`(자기 인보케이션 — 유어애즈 레인과 서브리퀘스트 예산을 안 나눈다,
 *    매시간 레인이라 바쁜 회차엔 디스패처가 미룬다). 🩸 처음엔 메인 cron 워커(`ur-live`)에 달았는데 **그 워커엔
 *    네이버·유튜브 키가 없어** 첫 회차가 아무것도 못 가져왔다(키는 Pages 와 ur-ads 에만 있다).
 *
 * 한 회차가 하는 일
 *   ① (6시간마다) 판매 중 **이용권**(교환권 제외 — 가게가 없다)에서 가게 목록을 `store_content_crawl` 로 옮긴다.
 *   ② 가장 오래 안 찾은 가게 6곳 → 네이버 블로그 검색 **두 번**(관련도순 · 최신순, 각 30건 — 하루 무료 25,000회의 1~2%)
 *      → 제목·요약에 **가게 이름이 그대로 들어간 글만**. 그중 **이름 + 동네가 둘 다 있는 글은 바로 보이고**
 *      (`confidentMatch`), 이름만 맞는 글은 후보로 남는다. 새 글 2개까지 글 페이지를 읽어 대표 사진·창 허락 여부를 적는다.
 *   ③ 유튜브는 회차당 **최대 1곳**, 하루 `CONTENT_YT_DAILY_SEARCHES`(15)회까지. 유어애즈와 같은 10,000점 풀이라
 *      유어애즈 성과 측정이 그 몫을 비워 둔다(`contentYtReservedUnits`). 60초 이하 영상만.
 *
 * 🔴 **이름만 맞는 글은 `candidate`** — 사장님(또는 어드민)이 켜기 전엔 손님에게 안 보인다. 확실한 글만 `visible`.
 * 🔴 사장님이 지운 글(`deleted`)·숨긴 글은 `INSERT OR IGNORE` 라 다시 올라오지 않는다.
 *
 * 서브리퀘스트(무료 50/인보케이션): D1 ~4 + 가게당(검색 2 + 아는 글 1 + 글 페이지 ≤2 + 저장·커서 1 배치) × 5 + 사진 채우기 7 + 유튜브 3 ≈ 44.
 * ⚠️ 못 보는 것: 검색 결과의 **질**(이름이 같은 다른 가게). 그래서 사람이 고르는 단계를 없애지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import {
  CONTENT_YT_DAILY_SEARCHES, CONTENT_YT_USED_KEY, confidentMatch, isStoreOwnPost, looksSponsored, mentionsStore, parseContentUrl, videoMatch,
  readDayCount, searchQueryFor, stripHtml,
} from '../../../shared/creator-content'
import { ensureCreatorContentTables, storeKeyFor } from './content-db'
import { fetchPageMeta } from './content-meta'

const STORES_PER_RUN = 5
/** 대표 사진이 없는 보이는 글을 회차마다 이만큼 채운다(검색 API 는 사진을 안 준다 — 글 페이지의 og:image). */
const THUMB_BACKFILL_PER_RUN = 5
const NAVER_DISPLAY = 30
const PAGE_FETCH_PER_STORE = 2
const NAVER_REVISIT_HOURS = 20
const YT_REVISIT_DAYS = 14
const SYNC_KEY = 'creator_content_crawl_synced'

function ptDay(ms: number): string { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) }
function kstDay(ms: number): string { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) }

async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(key).first<{ value: string }>().catch(() => null)
  return r?.value ?? null
}
async function writeSetting(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare(`INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(key, value).run().catch(() => null)
}

/** ① 가게 목록 동기화 — 하루 한 번. */
async function syncStores(DB: D1Database, now: number): Promise<number> {
  // 6시간 칸마다 한 번 — 새로 만든 데모·이용권이 다음 날까지 기다리지 않게(2026-11-04 대표 *"앞으로 데모 이용권을 만들어도"*).
  //   안 찾아 본 가게(naver_at NULL)는 커서 정렬상 **맨 앞**이라 들어온 다음 회차에 바로 검색된다.
  const today = `${kstDay(now)}#${Math.floor(Number(new Date(now).toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false })) / 6)}`
  if ((await readSetting(DB, SYNC_KEY)) === today) return 0
  // 이용권만(deal_only=0) — 교환권(기프티콘·KT)은 가게가 없다. 가게 = 이름 + 동네(`storeKeyFor`), 사장님 계정은 없어도 된다.
  const { results } = await DB.prepare(`
    SELECT restaurant_name AS name, restaurant_address AS address, MAX(seller_id) AS seller_id
      FROM products
     WHERE group_buy_status = 'active' AND is_active = 1 AND COALESCE(deal_only, 0) = 0
       AND restaurant_name IS NOT NULL AND TRIM(restaurant_name) != ''
     GROUP BY restaurant_name, restaurant_address LIMIT 3000`).all<{ seller_id: number | null; name: string; address: string | null }>()
  const byKey = new Map<string, { seller_id: number | null; name: string; address: string | null }>()
  for (const r of results ?? []) { const k = storeKeyFor(r.name, r.address); if (!byKey.has(k)) byKey.set(k, r) }
  const rows = [...byKey.entries()]
  for (let i = 0; i < rows.length; i += 80) {
    await DB.batch(rows.slice(i, i + 80).map(([k, r]) => DB.prepare(`
      INSERT INTO store_content_crawl (store_key, seller_id, store_name, address, seen_at) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(store_key) DO UPDATE SET seller_id = excluded.seller_id, store_name = excluded.store_name, address = excluded.address, seen_at = excluded.seen_at`)
      .bind(k, r.seller_id ?? 0, r.name, r.address)))
  }
  await writeSetting(DB, SYNC_KEY, today)
  return rows.length
}

interface CrawlRow { store_key: string; seller_id: number | null; store_name: string; address: string | null }

interface NaverBlogItem { title: string; link: string; description: string; bloggername: string; postdate: string }

/** 네이버 블로그 검색 결과 → 이 가게 글만. 순수 함수 — 시험이 직접 돌린다. */
export function pickBlogCandidates(items: NaverBlogItem[], storeName: string, address?: string | null) {
  const out: { extId: string; url: string; title: string; summary: string; author: string; published: string | null; sponsored: boolean; confident: boolean }[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const title = stripHtml(it.title)
    const summary = stripHtml(it.description)
    if (!mentionsStore(`${title} ${summary}`, storeName)) continue
    const parsed = parseContentUrl(it.link)
    if (!parsed || parsed.platform !== 'naver_blog' || seen.has(parsed.extId)) continue
    seen.add(parsed.extId)
    const d = /^\d{8}$/.test(it.postdate) ? `${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6, 8)}` : null
    out.push({ extId: parsed.extId, url: parsed.url, title: title.slice(0, 200), summary: summary.slice(0, 300), author: stripHtml(it.bloggername).slice(0, 80), published: d, sponsored: looksSponsored(`${title} ${summary}`),
      // 가게 자기 블로그 글은 이름·동네가 늘 들어 있어 '확실' 을 그냥 통과한다 — 자동 공개에서 뺀다(후보로는 남는다).
      confident: !isStoreOwnPost(it.bloggername, storeName) && confidentMatch(`${title} ${summary}`, storeName, address) })
  }
  return out
}

interface YtSearchItem { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } } }

export function pickVideoCandidates(items: YtSearchItem[], storeName: string, address?: string | null) {
  const out: { extId: string; title: string; author: string; thumb: string | null; published: string | null; confident: boolean }[] = []
  for (const it of items) {
    const id = it.id?.videoId
    const sn = it.snippet
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !sn) continue
    const title = stripHtml(sn.title)
    const text = `${title} ${stripHtml(sn.description)}`
    if (!mentionsStore(text, storeName)) continue
    const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? null
    out.push({ extId: id, title: title.slice(0, 200), author: stripHtml(sn.channelTitle).slice(0, 80), thumb: thumb && thumb.startsWith('https://') ? thumb : null, published: sn.publishedAt?.slice(0, 10) ?? null, confident: !isStoreOwnPost(sn.channelTitle, storeName) && videoMatch(text, storeName) })
  }
  return out
}

async function naverSearch(id: string, secret: string, q: string, sort: 'sim' | 'date'): Promise<NaverBlogItem[]> {
  const r = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(q)}&display=${NAVER_DISPLAY}&sort=${sort}`, {
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }, signal: AbortSignal.timeout(5000),
  }).catch(() => null)
  if (!r || !r.ok) return []
  return ((await r.json<{ items?: NaverBlogItem[] }>().catch(() => null))?.items) ?? []
}

/** 가게 하나 — 검색 2회(관련도·최신) → 이 가게 글만 → 새 글만 저장. 커서 갱신도 같은 배치에 싣는다(서브리퀘스트 1). */
async function collectBlogs(DB: D1Database, env: Env, s: CrawlRow): Promise<number> {
  const cursor = DB.prepare(`UPDATE store_content_crawl SET naver_at = datetime('now') WHERE store_key = ?`).bind(s.store_key)
  const id = env.NAVER_SEARCH_CLIENT_ID, secret = env.NAVER_SEARCH_CLIENT_SECRET
  if (!id || !secret) { await cursor.run().catch(() => null); return 0 }
  const q = searchQueryFor(s.store_name, s.address)
  const [sim, recent] = await Promise.all([naverSearch(id, secret, q, 'sim'), naverSearch(id, secret, q, 'date')])
  const picks = pickBlogCandidates([...sim, ...recent], s.store_name, s.address).slice(0, 20)
  if (!picks.length) { await cursor.run().catch(() => null); return 0 }
  // 이미 아는 글(후보·보이는 중·숨김·삭제 전부)은 다시 안 읽는다.
  const known = new Set(((await DB.prepare(`SELECT ext_id FROM store_creator_content WHERE store_key = ? AND platform = 'naver_blog'`)
    .bind(s.store_key).all<{ ext_id: string }>().catch(() => ({ results: [] as { ext_id: string }[] }))).results ?? []).map((x) => x.ext_id))
  const fresh = picks.filter((p) => !known.has(p.extId))
  if (!fresh.length) { await cursor.run().catch(() => null); return 0 }
  // 글 페이지는 **확실한 글부터** 읽는다(바로 보일 글에 사진이 있어야 한다).
  const order = [...fresh].sort((a, b) => Number(b.confident) - Number(a.confident))
  const metas = await Promise.all(order.slice(0, PAGE_FETCH_PER_STORE).map((p) => fetchPageMeta(`https://m.blog.naver.com/${p.extId}`).catch(() => null)))
  await DB.batch([...order.map((p, i) => DB.prepare(`
    INSERT OR IGNORE INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, thumb_url, author_name, summary, published_at, sponsored, embeddable, status, source)
    VALUES (?, ?, 'naver_blog', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto')`)
    .bind(s.store_key, s.seller_id ?? 0, p.extId, p.url, p.title, metas[i]?.thumb_url ?? null, p.author, p.summary, p.published,
      p.sponsored ? 1 : 0, metas[i]?.embeddable ? 1 : 0, p.confident ? 'visible' : 'candidate')), cursor])
  return fresh.length
}

async function collectVideos(DB: D1Database, env: Env, now: number): Promise<{ searched: boolean; added: number }> {
  if (!env.YOUTUBE_API_KEY) return { searched: false, added: 0 }
  const day = ptDay(now)
  const used = readDayCount(await readSetting(DB, CONTENT_YT_USED_KEY), day)
  if (used >= CONTENT_YT_DAILY_SEARCHES) return { searched: false, added: 0 }
  const s = await DB.prepare(`SELECT store_key, seller_id, store_name, address FROM store_content_crawl
      WHERE yt_at IS NULL OR yt_at < datetime('now', '-${YT_REVISIT_DAYS} days')
      ORDER BY yt_at IS NOT NULL, yt_at ASC LIMIT 1`).first<CrawlRow>().catch(() => null)
  if (!s) return { searched: false, added: 0 }
  // 🔴 부르기 **전에** 센다 — 응답이 실패해도 구글은 100점을 가져간다. 늦게 세면 몫을 넘긴다.
  await writeSetting(DB, CONTENT_YT_USED_KEY, `${day}:${used + 1}`)
  await DB.prepare(`UPDATE store_content_crawl SET yt_at = datetime('now') WHERE store_key = ?`).bind(s.store_key).run().catch(() => null)
  const q = encodeURIComponent(searchQueryFor(s.store_name, s.address))
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&regionCode=KR&relevanceLanguage=ko&maxResults=15&q=${q}&key=${env.YOUTUBE_API_KEY}`,
    { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!r) return { searched: true, added: 0 }
  if (r.status === 403) { await writeSetting(DB, CONTENT_YT_USED_KEY, `${day}:${CONTENT_YT_DAILY_SEARCHES}`); return { searched: true, added: 0 } }
  if (!r.ok) return { searched: true, added: 0 }
  const body = await r.json<{ items?: YtSearchItem[] }>().catch(() => null)
  const picks = pickVideoCandidates(body?.items ?? [], s.store_name, s.address).slice(0, 10)
  if (!picks.length) return { searched: true, added: 0 }
  await DB.batch(picks.map((p) => DB.prepare(`
    INSERT OR IGNORE INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, thumb_url, author_name, published_at, embeddable, status, source)
    VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, 1, ?, 'auto')`)
    .bind(s.store_key, s.seller_id ?? 0, p.extId, `https://www.youtube.com/watch?v=${p.extId}`, p.title, p.thumb, p.author, p.published,
      p.confident ? 'visible' : 'candidate')))
  return { searched: true, added: picks.length }
}

/**
 * 🖼️ 사진 없는 블로그 글 채우기 (2026-11-04 대표 *"블로그 사진은 안나오네?"*) — 검색 API 는 사진을 안 주고,
 *    수집 때는 가게당 2개만 글 페이지를 읽었다. 보이는 글부터 회차마다 5개씩 읽는다.
 *    못 읽은 글은 `thumb_url = ''` 로 표시해 다시 안 시도한다(NULL = 아직 안 해 봄).
 */
async function backfillThumbs(DB: D1Database): Promise<number> {
  const { results } = await DB.prepare(`SELECT id, ext_id FROM store_creator_content
      WHERE platform = 'naver_blog' AND thumb_url IS NULL AND status IN ('visible', 'candidate')
      ORDER BY status = 'visible' DESC, id DESC LIMIT ${THUMB_BACKFILL_PER_RUN}`).all<{ id: number; ext_id: string }>()
  const rows = results ?? []
  if (!rows.length) return 0
  const metas = await Promise.all(rows.map((r) => fetchPageMeta(`https://m.blog.naver.com/${r.ext_id}`).catch(() => null)))
  await DB.batch(rows.map((r, i) => DB.prepare(`UPDATE store_creator_content SET thumb_url = ?, embeddable = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(metas[i]?.thumb_url ?? '', metas[i]?.embeddable ? 1 : 0, r.id)))
  return metas.filter((m) => m?.thumb_url).length
}

/**
 * 🎬 이미 후보로 쌓인 유튜브 영상을 새 기준(`videoMatch`)으로 다시 본다(2026-11-09). 제목만 남아 있어 제목으로 판정한다.
 * 자동으로 들어온 후보만 — 사장님이 숨긴 것(hidden)·지운 것(deleted)은 건드리지 않는다. 한 번 읽고 한 번 쓴다(서브리퀘스트 2).
 */
async function promoteVideoCandidates(DB: D1Database): Promise<number> {
  const { results } = await DB.prepare(`SELECT s.id, s.title, s.author_name, c.store_name FROM store_creator_content s
      JOIN store_content_crawl c ON c.store_key = s.store_key
      WHERE s.platform = 'youtube' AND s.status = 'candidate' AND s.source = 'auto' LIMIT 300`)
    .all<{ id: number; title: string | null; author_name: string | null; store_name: string }>()
  const ids = (results ?? []).filter((r) => !isStoreOwnPost(r.author_name, r.store_name) && videoMatch(r.title ?? '', r.store_name)).map((r) => r.id)
  if (!ids.length) return 0
  await DB.batch(ids.map((id) => DB.prepare(`UPDATE store_creator_content SET status = 'visible', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'candidate'`).bind(id)))
  return ids.length
}

export async function runCreatorContentCollect(env: Env, now = Date.now()) {
  const DB = env.DB
  await ensureCreatorContentTables(DB)
  const synced = await syncStores(DB, now).catch(() => 0)
  const { results } = await DB.prepare(`SELECT store_key, seller_id, store_name, address FROM store_content_crawl
      WHERE naver_at IS NULL OR naver_at < datetime('now', '-${NAVER_REVISIT_HOURS} hours')
      ORDER BY naver_at IS NOT NULL, naver_at ASC LIMIT ${STORES_PER_RUN}`).all<CrawlRow>()
  let blogs = 0
  for (const s of results ?? []) {
    // 실패해도 커서는 넘긴다 — 안 넘기면 같은 가게에서 매 회차 멈춘다.
    blogs += await collectBlogs(DB, env, s).catch(async () => {
      await DB.prepare(`UPDATE store_content_crawl SET naver_at = datetime('now') WHERE store_key = ?`).bind(s.store_key).run().catch(() => null)
      return 0
    })
  }
  const thumbs = await backfillThumbs(DB).catch(() => 0)
  const promoted = await promoteVideoCandidates(DB).catch(() => 0)
  const yt = await collectVideos(DB, env, now).catch(() => ({ searched: false, added: 0 }))
  return { synced, stores: (results ?? []).length, blogs, thumbs, promoted, yt_searched: yt.searched, videos: yt.added }
}
