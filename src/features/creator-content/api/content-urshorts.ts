/**
 * 🎬 '다녀온 사람들' 유튜브 → 유어쇼츠 옮겨 싣기 (2026-11-11 대표 *"이용권 상세페이지에 지금 각 매장들의 유튜브 영상이
 *    올라오잖아. 유어쇼츠 영역으로도 넣어주면 되지 않아?"*)
 *
 * ## 무엇을 하나 (매시 수집 회차의 한 단계)
 *   ① 가게 칸에서 **공개 중인** 유튜브 영상 중 길이를 아직 안 잰 것 50개를 `videos.list` 한 번(1 unit)으로 잰다.
 *   ② **3분 이하**(`URSHORTS_MAX_DURATION_SEC` — 어드민 '주소로 추가'와 같은 기준)만 `home_shorts` 에 넣는다.
 *      가게의 판매 중 이용권 하나(가장 많이 팔린 것)를 붙인다 — 뷰어의 구매 바가 그 이용권으로 간다.
 *   ③ 가게 칸에서 사라진(사장님이 숨김·지움, 기준 변경으로 후보로 내려감) 영상은 유어쇼츠에서도 **끈다**.
 *
 * ## 정한 것
 *   - 🔴 **길이를 재지 않고 넣지 않는다.** 수집 검색의 `videoDuration=short` 는 유튜브 기준 **4분 미만**이라
 *     3분 기준과 다르고, 사장님이 주소로 넣은 영상은 길이 제한이 아예 없다. 세로 카드에 10분 영상을 넣으면
 *     위아래 검은 띠 + 구매 바가 붙은 그냥 유튜브가 된다(`urshorts.ts` 머리말).
 *   - 🔢 **대표가 직접 넣은 영상 뒤에 선다** — `sort_order = 100`(직접 넣은 것은 0). 레일은 앞 12편만 보이므로,
 *     자동 영상이 수십 편 들어와도 대표가 고른 영상이 레일에서 밀려나지 않는다.
 *   - 🔁 **한 번 끈 것을 자동으로 다시 켜지 않는다** — 어드민이 유어쇼츠에서 끈 영상을 매시 되살리면 끌 수가 없다.
 *   - 🪞 상세 페이지 칸은 이 행(`source='creator'`)을 '유어쇼츠' 로 다시 읽지 않는다(`content.routes.ts`) — 같은 영상이 두 번 뜬다.
 *
 * 서브리퀘스트: D1 읽기 2 + 유튜브 1 + 상품 읽기 1 + 쓰기 배치 1 + 끄기 1 = 6.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { parseIsoDurationSec, youTubeThumbUrl, URSHORTS_MAX_DURATION_SEC } from '../../../shared/urshorts'
import { classifyShort } from '../../../shared/urshorts-tags'
import { storeKeyFor } from './content-db'
import { allInChunks } from '../../../worker/utils/d1-in-chunks'

export const CREATOR_SHORTS_SOURCE = 'creator'
/** 직접 넣은 영상(0) 뒤. 레일·뷰어 정렬이 `sort_order ASC, id DESC` 다. */
export const CREATOR_SHORTS_SORT = 100
const PER_RUN = 50

export interface VideoRow { id: number; ext_id: string; title: string | null; author_name: string | null; store_key: string; store_name: string; address: string | null }
export interface StoreProduct { id: number; name: string | null; address: string | null; category: string | null }

/** 잰 길이 → 저장값. 못 잰 것(지워짐·비공개)은 -1 로 적어 다시 안 묻는다. 순수 함수 — 시험이 직접 돌린다. */
export function durationMark(sec: number | null | undefined): number {
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0 ? Math.round(sec) : -1
}

/** 유어쇼츠에 실어도 되는 길이인가. */
export function isShortLength(sec: number): boolean {
  return sec > 0 && sec <= URSHORTS_MAX_DURATION_SEC
}

/** 가게 키 → 붙일 이용권. `products` 는 판매량 순으로 와야 한다(첫 번째가 이긴다). */
export function productByStore(products: StoreProduct[]): Map<string, StoreProduct> {
  const out = new Map<string, StoreProduct>()
  for (const p of products) { const k = storeKeyFor(p.name, p.address); if (!out.has(k)) out.set(k, p) }
  return out
}

export async function syncCreatorShorts(DB: D1Database, env: Env): Promise<{ measured: number; added: number; off: number }> {
  // ③ 먼저 끈다 — 유튜브 키가 없어도 사장님이 숨긴 영상은 내려가야 한다.
  const off = await DB.prepare(`UPDATE home_shorts SET is_active = 0
      WHERE source = '${CREATOR_SHORTS_SOURCE}' AND is_active = 1
        AND NOT EXISTS (SELECT 1 FROM store_creator_content c
                         WHERE c.platform = 'youtube' AND c.ext_id = home_shorts.video_id AND c.status = 'visible')`)
    .run().then((r) => r.meta.changes ?? 0).catch(() => 0)
  if (!env.YOUTUBE_API_KEY) return { measured: 0, added: 0, off }
  const { results } = await DB.prepare(`SELECT c.id, c.ext_id, c.title, c.author_name, c.store_key, k.store_name, k.address
      FROM store_creator_content c JOIN store_content_crawl k ON k.store_key = c.store_key
     WHERE c.platform = 'youtube' AND c.status = 'visible' AND c.duration_sec IS NULL
     ORDER BY c.id LIMIT ${PER_RUN}`).all<VideoRow>()
  const rows = results ?? []
  if (!rows.length) return { measured: 0, added: 0, off }
  const ids = [...new Set(rows.map((r) => r.ext_id))]
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${env.YOUTUBE_API_KEY}`,
    { signal: AbortSignal.timeout(5000) }).catch(() => null)
  // 쿼터 소진(403)·실패면 아무것도 적지 않는다 — 다음 회차가 다시 잰다(-1 로 적으면 영영 안 잰다).
  if (!r || !r.ok) return { measured: 0, added: 0, off }
  const body = await r.json<{ items?: { id?: string; contentDetails?: { duration?: string } }[] }>().catch(() => null)
  if (!body) return { measured: 0, added: 0, off }
  const sec = new Map<string, number>()
  for (const it of body.items ?? []) if (it.id) sec.set(it.id, durationMark(parseIsoDurationSec(it.contentDetails?.duration)))

  const shorts = rows.filter((v) => isShortLength(sec.get(v.ext_id) ?? -1))
  const names = [...new Set(shorts.map((v) => v.store_name))]
  // 한 가게의 이용권은 이름이 같아 늘 같은 조각에 든다 — 조각 안 판매량 순서가 곧 가게 안 순서다.
  const products = await allInChunks(names, (chunk, marks) => DB.prepare(`SELECT id, restaurant_name AS name, restaurant_address AS address, category FROM products
        WHERE group_buy_status = 'active' AND is_active = 1 AND COALESCE(deal_only, 0) = 0
          AND restaurant_name IN (${marks})
        ORDER BY COALESCE(sold_count, 0) DESC, id ASC`).bind(...chunk).all<StoreProduct>().then((r) => r.results ?? []))
  const byStore = productByStore(products)
  const seen = new Set<string>()
  const inserts = shorts.filter((v) => !seen.has(v.ext_id) && seen.add(v.ext_id)).map((v) => {
    const p = byStore.get(v.store_key) ?? null
    const cls = classifyShort({ title: v.title, channel: v.author_name, storeName: v.store_name, storeAddress: v.address, productCategory: p?.category ?? null })
    return DB.prepare(`INSERT OR IGNORE INTO home_shorts
        (video_id, title, channel, thumb_url, product_id, sort_order, is_active, source, duration_sec, consent, region_si, region_area, category)
        VALUES (?, ?, ?, ?, ?, ${CREATOR_SHORTS_SORT}, 1, '${CREATOR_SHORTS_SOURCE}', ?, 0, ?, ?, ?)`)
      .bind(v.ext_id, (v.title ?? '').slice(0, 200) || null, (v.author_name ?? '').slice(0, 100) || null, youTubeThumbUrl(v.ext_id),
        p?.id ?? null, sec.get(v.ext_id) ?? null, cls.region_si, cls.region_area, cls.category)
  })
  const marks = rows.map((v) => DB.prepare(`UPDATE store_creator_content SET duration_sec = ? WHERE id = ?`).bind(sec.get(v.ext_id) ?? -1, v.id))
  const res = await DB.batch([...inserts, ...marks]).catch(() => null)
  const added = res ? res.slice(0, inserts.length).reduce((n, x) => n + (x.meta?.changes ?? 0), 0) : 0
  return { measured: res ? rows.length : 0, added, off }
}
