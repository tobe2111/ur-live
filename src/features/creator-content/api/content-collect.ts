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
 *      (`blogAutoShow` — 제목이 가게를 불러야 하고 업체·모음 글은 뺀다), 이름만 맞는 글은 후보로 남는다. 새 글 2개까지 글 페이지를 읽어 대표 사진·창 허락 여부를 적는다.
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
  CONTENT_YT_DAILY_SEARCHES, CONTENT_YT_USED_KEY, blogAutoShow, isStoreOwnPost, looksSponsored, mentionsStore, parseContentUrl, videoMatch,
  readDayCount, searchQueryFor, stripHtml,
} from '../../../shared/creator-content'
import { ensureCreatorContentTables, storeKeyFor } from './content-db'
import { fetchPageMeta } from './content-meta'

const STORES_PER_RUN = 5
/** 대표 사진이 없는 보이는 글을 회차마다 이만큼 채운다(검색 API 는 사진을 안 준다 — 글 페이지의 og:image). */
const THUMB_BACKFILL_MIN = 5
const THUMB_BACKFILL_MAX = 28
/** 회차당 죽은 링크 확인 개수(지워졌거나 비공개가 된 글·영상을 숨긴다). */
const DEAD_CHECK_PER_RUN = 3
const NAVER_DISPLAY = 30
const PAGE_FETCH_PER_STORE = 2
// 블로그는 하루 사이에 크게 안 바뀐다 — 사흘에 한 번 다시 보고, 남는 예산을 사진 채우기·죽은 링크 확인에 쓴다(2026-11-09).
const NAVER_REVISIT_HOURS = 72
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
      // 자동 공개 판정은 `blogAutoShow` 하나(가게 자기 글 · 업체 글 · 모음 글 · 업종 이름 가게 제외 + 제목이 가게를 불러야 한다).
      confident: blogAutoShow({ title, summary, author: it.bloggername }, storeName, address) })
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
/** 글이 없는 가게의 두 번째 검색어 — 지점 꼬리·괄호를 뗀 이름만("벌툰 일산역점" → "벌툰"이 아니라 "벌툰 일산역" 처럼 지점 낱말은 남긴다). */
export function blogSecondQuery(storeName: string): string {
  return String(storeName).replace(/\s*\([^)]*\)\s*$/, '').replace(/(지점|점)$/, '').trim()
}

async function collectBlogs(DB: D1Database, env: Env, s: CrawlRow): Promise<number> {
  const cursor = DB.prepare(`UPDATE store_content_crawl SET naver_at = datetime('now') WHERE store_key = ?`).bind(s.store_key)
  const id = env.NAVER_SEARCH_CLIENT_ID, secret = env.NAVER_SEARCH_CLIENT_SECRET
  if (!id || !secret) { await cursor.run().catch(() => null); return 0 }
  // 이미 아는 글(후보·보이는 중·숨김·삭제 전부)은 다시 안 읽는다.
  const known = new Set(((await DB.prepare(`SELECT ext_id FROM store_creator_content WHERE store_key = ? AND platform = 'naver_blog'`)
    .bind(s.store_key).all<{ ext_id: string }>().catch(() => ({ results: [] as { ext_id: string }[] }))).results ?? []).map((x) => x.ext_id))
  const q = searchQueryFor(s.store_name, s.address)
  // 🔎 아직 글이 하나도 없는 가게는 두 번째 검색을 **이름만**으로 바꾼다(2026-11-09 실측: 188곳 중 22곳이 0건 —
  //    "이름 + 동네" 로는 안 걸리고 이름만 쓴 후기가 있다). 자동 공개 판정은 그대로라 넓게 찾아도 엉뚱한 글은 후보에 남는다.
  const second = known.size ? q : blogSecondQuery(s.store_name)
  const [sim, recent] = await Promise.all([naverSearch(id, secret, q, 'sim'), naverSearch(id, secret, second, known.size ? 'date' : 'sim')])
  const picks = pickBlogCandidates([...sim, ...recent], s.store_name, s.address).slice(0, 20)
  if (!picks.length) { await cursor.run().catch(() => null); return 0 }
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
async function backfillThumbs(DB: D1Database, limit: number): Promise<number> {
  const { results } = await DB.prepare(`SELECT s.id, s.ext_id FROM store_creator_content s
      WHERE s.platform = 'naver_blog' AND s.thumb_url IS NULL AND s.status IN ('visible', 'candidate')
      -- 손님이 처음 보는 블로그는 3개 — 사진 있는 글이 3개가 안 되는 가게부터 채운다(2026-11-09). 그다음 보이는 글 · 최신.
      ORDER BY s.status = 'visible' DESC,
        (SELECT COUNT(*) FROM store_creator_content t WHERE t.store_key = s.store_key AND t.status = 'visible' AND t.thumb_url <> '') >= 3,
        s.id DESC LIMIT ?`).bind(limit).all<{ id: number; ext_id: string }>()
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

/**
 * 🧹 자동으로 들어온 블로그를 지금 기준(`blogAutoShow`)으로 다시 본다(2026-11-09 대표 *"연관 없는 블로그도 있네"*).
 * 실측: 자동 공개 2,009개 중 약 40% 가 새 기준에서 탈락(업종 이름 가게 382 · 제목에 이름 없음 315 · 업체 글 · 모음 글).
 *   공개 중인데 탈락 → **후보로 내린다**(지우지 않는다 — 사장님 화면에서 다시 고를 수 있다).
 *   후보인데 통과 → **공개로 올린다**(v3: 구·동 없는 주소를 시로 보게 되면서 제주·강릉 가게 후기가 처음 통과한다).
 * 사장님·어드민이 넣거나 고른 것(source≠auto)·숨긴 것(hidden)은 안 건드린다.
 * 기준 버전마다 한 바퀴 — 커서(id)를 앞으로 밀며 회차당 400개씩. 기준을 바꾸면 `BLOG_RULES_VERSION` 을 올린다.
 */
export const BLOG_RULES_VERSION = 3
const REJUDGE_KEY = 'creator_content_blog_rejudge'
const REJUDGE_PER_RUN = 400
async function rejudgeAutoBlogs(DB: D1Database): Promise<{ demoted: number; promoted: number }> {
  const raw = await readSetting(DB, REJUDGE_KEY)
  const [ver, cur] = String(raw ?? '').split(':').map(Number)
  if (ver === BLOG_RULES_VERSION && cur < 0) return { demoted: 0, promoted: 0 }
  const after = ver === BLOG_RULES_VERSION && Number.isFinite(cur) ? cur : 0
  const { results } = await DB.prepare(`SELECT s.id, s.status, s.title, s.summary, s.author_name, c.store_name, c.address FROM store_creator_content s
      JOIN store_content_crawl c ON c.store_key = s.store_key
      WHERE s.platform = 'naver_blog' AND s.status IN ('visible', 'candidate') AND s.source = 'auto' AND s.id > ? ORDER BY s.id LIMIT ${REJUDGE_PER_RUN}`)
    .bind(after).all<{ id: number; status: string; title: string | null; summary: string | null; author_name: string | null; store_name: string; address: string | null }>()
  const rows = results ?? []
  const down: number[] = [], up: number[] = []
  for (const r of rows) {
    const ok = blogAutoShow({ title: r.title, summary: r.summary, author: r.author_name }, r.store_name, r.address)
    if (r.status === 'visible' && !ok) down.push(r.id)
    else if (r.status === 'candidate' && ok) up.push(r.id)
  }
  const stmts = [
    ...down.map((id) => DB.prepare(`UPDATE store_creator_content SET status = 'candidate', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'visible' AND source = 'auto'`).bind(id)),
    ...up.map((id) => DB.prepare(`UPDATE store_creator_content SET status = 'visible', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'candidate' AND source = 'auto'`).bind(id)),
  ]
  if (stmts.length) await DB.batch(stmts)
  // 다 돌았으면 -1(이 버전은 끝), 아니면 마지막 id 까지 왔다고 적는다.
  await writeSetting(DB, REJUDGE_KEY, `${BLOG_RULES_VERSION}:${rows.length < REJUDGE_PER_RUN ? -1 : rows[rows.length - 1].id}`)
  return { demoted: down.length, promoted: up.length }
}

/**
 * 🪦 죽은 링크 숨기기 (2026-11-09) — 보이는 글·영상 중 가장 오래 확인 안 한 것부터 회차마다 3개.
 *   유튜브: 공개 oEmbed 가 404/401(삭제·비공개) · 블로그: 글 페이지가 404 이거나 "존재하지 않는 게시물".
 *   숨김(`hidden`)으로만 바꾼다(지우지 않는다) — 일시 장애로 잘못 숨겨도 사장님 화면에서 다시 켤 수 있다.
 *   네트워크 실패(응답 없음)는 죽음으로 보지 않는다.
 */
async function hideDeadLinks(DB: D1Database): Promise<number> {
  const { results } = await DB.prepare(`SELECT id, platform, ext_id, url FROM store_creator_content
      WHERE status = 'visible' AND platform IN ('youtube', 'naver_blog')
      ORDER BY checked_at IS NOT NULL, checked_at ASC LIMIT ${DEAD_CHECK_PER_RUN}`).all<{ id: number; platform: string; ext_id: string; url: string }>()
  const rows = results ?? []
  if (!rows.length) return 0
  const dead = await Promise.all(rows.map(async (r) => {
    const url = r.platform === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${r.ext_id}`)}`
      : `https://m.blog.naver.com/${r.ext_id}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)
    if (!res) return false
    if (res.status === 404 || res.status === 410 || (r.platform === 'youtube' && res.status === 401)) return true
    if (r.platform === 'naver_blog' && res.ok) {
      const html = (await res.text().catch(() => '')).slice(0, 60_000)
      return /존재하지 않는 게시물|삭제되었거나|비공개 글/.test(html)
    }
    return false
  }))
  await DB.batch(rows.map((r, i) => DB.prepare(`UPDATE store_creator_content
      SET checked_at = datetime('now'), status = CASE WHEN ? = 1 THEN 'hidden' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(dead[i] ? 1 : 0, r.id)))
  return dead.filter(Boolean).length
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
  // 🖼️ 사진 채우기는 **남는 예산만큼** — 이번 회차에 찾은 가게가 적으면 더 많이 채운다(무료 50/인보케이션).
  //   대략: 기본 D1 ~6 + 가게당 6 + 유튜브 승격 2 + 죽은 링크 5 + 유튜브 3 + 블로그 재판정 3, 나머지가 사진(배치 쓰기 1 포함).
  const thumbRoom = Math.max(THUMB_BACKFILL_MIN, Math.min(THUMB_BACKFILL_MAX, 48 - 6 - (results ?? []).length * 6 - 2 - 5 - 3 - 3 - 2))
  const thumbs = await backfillThumbs(DB, thumbRoom).catch(() => 0)
  const dead = await hideDeadLinks(DB).catch(() => 0)
  const promoted = await promoteVideoCandidates(DB).catch(() => 0)
  const rejudged = await rejudgeAutoBlogs(DB).catch(() => ({ demoted: 0, promoted: 0 }))
  const yt = await collectVideos(DB, env, now).catch(() => ({ searched: false, added: 0 }))
  return { synced, stores: (results ?? []).length, blogs, thumbs, dead, promoted, demoted: rejudged.demoted, blogs_promoted: rejudged.promoted, yt_searched: yt.searched, videos: yt.added }
}
