/**
 * 🧭 주문마다 **누가 데려왔나 · 무엇을 보고 샀나** 를 함께 적는다 (2026-11-11 대표 *"인플루언서 링크를 통해서 들어와선
 *    유어쇼츠를 볼 수도 있잖아. 24시간 내에. 그럼 인플루언서 성과로 안잡히면 안되지. 이런 케이스들을 체계적으로 잡아줘"*).
 *
 * ## 규칙 (갈래는 위에서부터 — 먼저 맞는 것이 이긴다)
 *   ① **인플루언서** — 결제에 소개 링크가 붙었다(24시간 · 마지막 링크 · 자기 링크 제외 — 그 판정은 결제 경로가 이미 했다).
 *      유어쇼츠·콘텐츠를 보고 샀어도 **성과는 여기**다. 무엇을 봤는지는 `via_*` 에 같이 남는다.
 *   ② **유어쇼츠** — 소개 링크 없이, 24시간 안에 유어쇼츠 영상에서 '구매' 를 눌렀다.
 *   ③ **다녀온 사람들** — 소개 링크 없이, 24시간 안에 상세의 영상·블로그를 열었다.
 *   ④ **유어딜** — 그 밖의 전부.
 *
 * 🔴 **이 표는 돈을 움직이지 않는다.** 소개비·커미션은 종전대로 결제 경로가 `ref` 로 정한다 — 여기는 그 결과를 같이 적어
 *    갈래별로 셀 수 있게 할 뿐이다. 그래서 실패해도 결제는 그대로다(fail-soft).
 * 🔁 주문당 한 줄(`order_ref` PRIMARY KEY + INSERT OR IGNORE) — 확정이 두 번 와도 한 번만 적힌다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 클라 `utils/touch-store.ts` 의 `TOUCH_RE` 와 같은 모양(서버가 다시 검사한다 — 헤더는 누구나 보낼 수 있다). */
const VIA_RE = /^(urshorts|content):([A-Za-z0-9_:.-]{1,80})$/

export type TouchBucket = 'influencer' | 'urshorts' | 'content' | 'direct'

export function parseVia(raw: unknown): { kind: 'urshorts' | 'content'; id: string } | null {
  const m = String(raw ?? '').trim().match(VIA_RE)
  return m ? { kind: m[1] as 'urshorts' | 'content', id: m[2] } : null
}

/** 갈래 판정 — 순수 함수. 소개 링크가 있으면 무엇을 봤든 인플루언서다. */
export function touchBucket(ref: string | null | undefined, viaKind: string | null | undefined): TouchBucket {
  if (ref && String(ref).trim()) return 'influencer'
  if (viaKind === 'urshorts') return 'urshorts'
  if (viaKind === 'content') return 'content'
  return 'direct'
}

const _ensured = new WeakSet<D1Database>()
export async function ensureOrderTouchTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS order_touch (
      order_ref TEXT PRIMARY KEY,
      user_id TEXT,
      product_id INTEGER,
      ref TEXT,
      via_kind TEXT,
      via_id TEXT,
      bucket TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run().catch(() => null)
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_order_touch_created ON order_touch(created_at)`).run().catch(() => null)
}

export async function recordOrderTouch(DB: D1Database, o: {
  orderRef: string | number | null | undefined; userId: string | number | null | undefined; productId?: number | null
  ref?: string | null; viaRaw?: unknown
}): Promise<void> {
  const orderRef = String(o.orderRef ?? '').trim()
  if (!orderRef) return
  await ensureOrderTouchTable(DB)
  const via = parseVia(o.viaRaw)
  const ref = o.ref && String(o.ref).trim() ? String(o.ref).trim().slice(0, 64) : null
  await DB.prepare(`INSERT OR IGNORE INTO order_touch (order_ref, user_id, product_id, ref, via_kind, via_id, bucket) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(orderRef, o.userId == null ? null : String(o.userId), Number.isFinite(Number(o.productId)) && Number(o.productId) > 0 ? Number(o.productId) : null,
      ref, via?.kind ?? null, via?.id ?? null, touchBucket(ref, via?.kind)).run().catch(() => null)
}

/** 어드민 집계 — 갈래별 주문 수, 그리고 인플루언서 성과 중 무엇을 보고 샀는지(경로 겹침). */
export async function loadTouchSummary(DB: D1Database, days: number) {
  await ensureOrderTouchTable(DB)
  const d = Math.max(1, Math.min(365, Math.floor(days) || 30))
  const since = `-${d} days`
  const [buckets, influencerVia, topVideos] = await Promise.all([
    DB.prepare(`SELECT bucket, COUNT(*) n FROM order_touch WHERE created_at > datetime('now', ?) GROUP BY bucket`).bind(since).all<{ bucket: string; n: number }>(),
    DB.prepare(`SELECT COALESCE(via_kind, 'none') via, COUNT(*) n FROM order_touch WHERE bucket = 'influencer' AND created_at > datetime('now', ?) GROUP BY 1`).bind(since).all<{ via: string; n: number }>(),
    // 📮 2026-11-12 제휴 제안 근거(결재 2026-11-12-creator-content-no-revenue-share) — 누구 영상인지 같이 싣는다.
    DB.prepare(`SELECT t.via_id AS video_id, COUNT(*) n, SUM(t.bucket = 'influencer') via_influencer,
          MAX(s.title) title, MAX(s.channel) channel, MAX(p.restaurant_name) store
        FROM order_touch t LEFT JOIN home_shorts s ON s.video_id = t.via_id LEFT JOIN products p ON p.id = s.product_id
        WHERE t.via_kind = 'urshorts' AND t.created_at > datetime('now', ?) GROUP BY t.via_id ORDER BY n DESC LIMIT 20`)
      .bind(since).all<{ video_id: string; n: number; via_influencer: number; title: string | null; channel: string | null; store: string | null }>(),
  ])
  return { days: d, buckets: buckets.results ?? [], influencer_via: influencerVia.results ?? [], top_videos: topVideos.results ?? [] }
}

/** 🧭 2026-11-12 인플루언서 본인 화면 — 내 링크로 산 결제(최근 N일)와, 그중 무엇을 보고 샀는지. 남의 ref 는 못 본다(호출부가 본인 id 만 넘긴다). */
export async function loadMyLinkTouch(DB: D1Database, refId: string, days = 30) {
  await ensureOrderTouchTable(DB)
  const d = Math.max(1, Math.min(365, Math.floor(days) || 30))
  const rows = await DB.prepare(`SELECT COALESCE(via_kind, 'none') via, COUNT(*) n FROM order_touch
      WHERE ref = ? AND created_at > datetime('now', ?) GROUP BY 1`).bind(String(refId), `-${d} days`).all<{ via: string; n: number }>()
  const by = Object.fromEntries((rows.results ?? []).map((r) => [r.via, Number(r.n) || 0])) as Record<string, number>
  const urshorts = by.urshorts ?? 0, content = by.content ?? 0, direct = by.none ?? 0
  return { days: d, total: urshorts + content + direct, urshorts, content, direct }
}
