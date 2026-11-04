/**
 * 🔎 "다녀온 사람들" 자동 수집 — 매시 :45 (2026-11-04 대표 *"네 추천대로"* · *"유튜브는 유어애즈랑 자동으로 분담"*)
 *
 * 한 회차가 하는 일
 *   ① (하루 한 번) 판매 중 이용권에서 가게 목록을 `store_content_crawl` 로 옮긴다 — 가게 단위로 찾는다(이용권 단위 X).
 *   ② 가장 오래 안 찾은 가게 5곳 → 네이버 블로그 검색(공식 API, 하루 무료 25,000회 중 회차당 5회)
 *      → 제목·요약에 **가게 이름이 그대로 들어간 글만** 후보로. 새 글 2개까지 글 페이지를 읽어 대표 사진·창 허락 여부를 적는다.
 *   ③ 유튜브는 회차당 **최대 1곳**, 하루 `CONTENT_YT_DAILY_SEARCHES`(15)회까지. 유어애즈와 같은 10,000점 풀이라
 *      유어애즈 성과 측정이 그 몫을 비워 둔다(`contentYtReservedUnits`). 60초 이하 영상만.
 *
 * 🔴 **전부 `candidate` 로만 들어간다** — 사장님(또는 어드민)이 켜기 전엔 손님에게 안 보인다.
 * 🔴 사장님이 지운 글(`deleted`)·숨긴 글은 `INSERT OR IGNORE` 라 다시 후보로 안 올라온다.
 *
 * 서브리퀘스트(무료 50/인보케이션): D1 ~8 + 가게당(검색 1 + 글 페이지 ≤2 + 저장 1 + 커서 1) × 5 + 유튜브 3 ≈ 36.
 * ⚠️ 못 보는 것: 검색 결과의 **질**(이름이 같은 다른 가게). 그래서 사람이 고르는 단계를 없애지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import {
  CONTENT_YT_DAILY_SEARCHES, CONTENT_YT_USED_KEY, looksSponsored, mentionsStore, parseContentUrl,
  readDayCount, searchQueryFor, stripHtml,
} from '../../../shared/creator-content'
import { ensureCreatorContentTables, storeKeyFor } from './content-db'
import { fetchPageMeta } from './content-meta'

const STORES_PER_RUN = 5
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
  const today = kstDay(now)
  if ((await readSetting(DB, SYNC_KEY)) === today) return 0
  const { results } = await DB.prepare(`
    SELECT seller_id, restaurant_name AS name, MIN(restaurant_address) AS address
      FROM products
     WHERE group_buy_status = 'active' AND is_active = 1 AND seller_id IS NOT NULL
       AND restaurant_name IS NOT NULL AND TRIM(restaurant_name) != ''
     GROUP BY seller_id, restaurant_name LIMIT 2000`).all<{ seller_id: number; name: string; address: string | null }>()
  const rows = results ?? []
  for (let i = 0; i < rows.length; i += 80) {
    await DB.batch(rows.slice(i, i + 80).map((r) => DB.prepare(`
      INSERT INTO store_content_crawl (store_key, seller_id, store_name, address, seen_at) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(store_key) DO UPDATE SET store_name = excluded.store_name, address = excluded.address, seen_at = excluded.seen_at`)
      .bind(storeKeyFor(r.seller_id, r.name), r.seller_id, r.name, r.address)))
  }
  await writeSetting(DB, SYNC_KEY, today)
  return rows.length
}

interface CrawlRow { store_key: string; seller_id: number; store_name: string; address: string | null }

interface NaverBlogItem { title: string; link: string; description: string; bloggername: string; postdate: string }

/** 네이버 블로그 검색 결과 → 이 가게 글만. 순수 함수 — 시험이 직접 돌린다. */
export function pickBlogCandidates(items: NaverBlogItem[], storeName: string) {
  const out: { extId: string; url: string; title: string; summary: string; author: string; published: string | null; sponsored: boolean }[] = []
  for (const it of items) {
    const title = stripHtml(it.title)
    const summary = stripHtml(it.description)
    if (!mentionsStore(`${title} ${summary}`, storeName)) continue
    const parsed = parseContentUrl(it.link)
    if (!parsed || parsed.platform !== 'naver_blog') continue
    const d = /^\d{8}$/.test(it.postdate) ? `${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6, 8)}` : null
    out.push({ extId: parsed.extId, url: parsed.url, title: title.slice(0, 200), summary: summary.slice(0, 300), author: stripHtml(it.bloggername).slice(0, 80), published: d, sponsored: looksSponsored(`${title} ${summary}`) })
  }
  return out
}

interface YtSearchItem { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } } }

export function pickVideoCandidates(items: YtSearchItem[], storeName: string) {
  const out: { extId: string; title: string; author: string; thumb: string | null; published: string | null }[] = []
  for (const it of items) {
    const id = it.id?.videoId
    const sn = it.snippet
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !sn) continue
    const title = stripHtml(sn.title)
    if (!mentionsStore(`${title} ${stripHtml(sn.description)}`, storeName)) continue
    const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? null
    out.push({ extId: id, title: title.slice(0, 200), author: stripHtml(sn.channelTitle).slice(0, 80), thumb: thumb && thumb.startsWith('https://') ? thumb : null, published: sn.publishedAt?.slice(0, 10) ?? null })
  }
  return out
}

async function collectBlogs(DB: D1Database, env: Env, s: CrawlRow): Promise<number> {
  const id = env.NAVER_SEARCH_CLIENT_ID, secret = env.NAVER_SEARCH_CLIENT_SECRET
  if (!id || !secret) return 0
  const q = encodeURIComponent(searchQueryFor(s.store_name, s.address))
  const r = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${q}&display=20&sort=sim`, {
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }, signal: AbortSignal.timeout(5000),
  }).catch(() => null)
  if (!r || !r.ok) return 0
  const body = await r.json<{ items?: NaverBlogItem[] }>().catch(() => null)
  const picks = pickBlogCandidates(body?.items ?? [], s.store_name).slice(0, 10)
  if (!picks.length) return 0
  // 이미 아는 글(후보·보이는 중·숨김·삭제 전부)은 다시 안 읽는다.
  const known = new Set(((await DB.prepare(`SELECT ext_id FROM store_creator_content WHERE store_key = ? AND platform = 'naver_blog'`)
    .bind(s.store_key).all<{ ext_id: string }>().catch(() => ({ results: [] as { ext_id: string }[] }))).results ?? []).map((x) => x.ext_id))
  const fresh = picks.filter((p) => !known.has(p.extId))
  if (!fresh.length) return 0
  const metas = await Promise.all(fresh.slice(0, PAGE_FETCH_PER_STORE).map((p) => fetchPageMeta(`https://m.blog.naver.com/${p.extId}`).catch(() => null)))
  await DB.batch(fresh.map((p, i) => DB.prepare(`
    INSERT OR IGNORE INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, thumb_url, author_name, summary, published_at, sponsored, embeddable, status, source)
    VALUES (?, ?, 'naver_blog', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', 'auto')`)
    .bind(s.store_key, s.seller_id, p.extId, p.url, p.title, metas[i]?.thumb_url ?? null, p.author, p.summary, p.published,
      p.sponsored ? 1 : 0, metas[i]?.embeddable ? 1 : 0)))
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
  const picks = pickVideoCandidates(body?.items ?? [], s.store_name).slice(0, 10)
  if (!picks.length) return { searched: true, added: 0 }
  await DB.batch(picks.map((p) => DB.prepare(`
    INSERT OR IGNORE INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, thumb_url, author_name, published_at, embeddable, status, source)
    VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, 1, 'candidate', 'auto')`)
    .bind(s.store_key, s.seller_id, p.extId, `https://www.youtube.com/watch?v=${p.extId}`, p.title, p.thumb, p.author, p.published)))
  return { searched: true, added: picks.length }
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
    blogs += await collectBlogs(DB, env, s).catch(() => 0)
    await DB.prepare(`UPDATE store_content_crawl SET naver_at = datetime('now') WHERE store_key = ?`).bind(s.store_key).run().catch(() => null)
  }
  const yt = await collectVideos(DB, env, now).catch(() => ({ searched: false, added: 0 }))
  return { synced, stores: (results ?? []).length, blogs, yt_searched: yt.searched, videos: yt.added }
}
