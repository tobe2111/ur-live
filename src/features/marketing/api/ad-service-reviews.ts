/**
 * 🆕 2026-07-08 유어애즈 서비스몰 — 고객 리뷰(구매 검증형).
 *
 *   ⚠️ 정책(대표 요청 "자동 생성"에 대한 답): **가짜/자동생성 리뷰는 만들지 않는다.**
 *   자작 후기는 한국 표시광고법 위반(공정위 제재)·소비자 기만이라 구현하지 않는다. 대신
 *   **실제로 주문을 완료(status='done')한 고객만** 별점·후기를 남길 수 있게 하여 구조적으로 조작을 차단한다.
 *   (봇 팔로워를 안 만든 것과 동일 원칙.)
 */
export interface ReviewRow { id: number; rating: number; title: string; body: string; author_masked: string; view_count: number; created_at: string }
export interface ReviewSummary { count: number; avg: number }

const _schemaDone = new WeakSet<object>()
export async function ensureReviewSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_service_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_masked TEXT NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'visible',
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(order_id)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_svc_reviews_svc ON ad_service_reviews(service_id, id)').run().catch(() => null)
}

/** 작성자 마스킹 — 회사명/이메일 첫 글자만 노출(개인정보 보호 + 스크린샷 형식). */
function maskAuthor(companyName: string | null, email: string | null): string {
  const base = (companyName || '').trim() || (email || '').split('@')[0] || '고객'
  const head = [...base][0] || '고'
  return `${head}****`
}

/** 이 계정이 이 상품에 리뷰 가능한 완료 주문을 가졌는가(아직 리뷰 안 단 것). 반환: 리뷰용 order_id 또는 null. */
export async function reviewableOrderId(DB: D1Database, accountId: number, serviceId: number): Promise<number | null> {
  await ensureReviewSchema(DB)
  const row = await DB.prepare(`SELECT o.id AS id FROM ad_service_orders o
    WHERE o.account_id = ? AND o.service_id = ? AND o.status = 'done'
      AND NOT EXISTS (SELECT 1 FROM ad_service_reviews r WHERE r.order_id = o.id)
    ORDER BY o.id DESC LIMIT 1`).bind(accountId, serviceId).first<{ id: number }>().catch(() => null)
  return row?.id ?? null
}

export async function createReview(DB: D1Database, accountId: number, serviceId: number, input: { rating: number; title: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureReviewSchema(DB)
  const rating = Math.round(Number(input.rating))
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return { ok: false, error: '별점(1~5)을 선택해주세요' }
  const title = String(input.title || '').trim()
  const body = String(input.body || '').trim()
  if (title.length < 2 || title.length > 60) return { ok: false, error: '제목을 2~60자로 입력해주세요' }
  if (body.length < 5 || body.length > 1000) return { ok: false, error: '내용을 5~1000자로 입력해주세요' }
  // 🔒 구매 검증: 완료 주문이 있어야만(구조적으로 가짜 차단).
  const orderId = await reviewableOrderId(DB, accountId, serviceId)
  if (!orderId) return { ok: false, error: '완료된 주문 고객만 후기를 작성할 수 있습니다 (주문당 1회).' }
  const acc = await DB.prepare('SELECT company_name, email FROM ad_accounts WHERE id = ?').bind(accountId).first<{ company_name: string | null; email: string | null }>().catch(() => null)
  const author = maskAuthor(acc?.company_name || null, acc?.email || null)
  const r = await DB.prepare('INSERT OR IGNORE INTO ad_service_reviews (service_id, account_id, order_id, rating, title, body, author_masked) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(serviceId, accountId, orderId, rating, title.slice(0, 60), body.slice(0, 1000), author).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '이미 이 주문에 후기를 작성했습니다' }
  return { ok: true }
}

const PAGE_SIZE = 15
export async function listReviews(DB: D1Database, serviceId: number, page = 1): Promise<{ reviews: ReviewRow[]; total: number; page: number; pages: number }> {
  await ensureReviewSchema(DB)
  const p = Math.max(1, Math.round(Number(page) || 1))
  const cnt = await DB.prepare("SELECT COUNT(*) AS c FROM ad_service_reviews WHERE service_id = ? AND status = 'visible'").bind(serviceId).first<{ c: number }>().catch(() => null)
  const total = Number(cnt?.c) || 0
  const r = await DB.prepare("SELECT id, rating, title, body, author_masked, view_count, created_at FROM ad_service_reviews WHERE service_id = ? AND status = 'visible' ORDER BY id DESC LIMIT ? OFFSET ?")
    .bind(serviceId, PAGE_SIZE, (p - 1) * PAGE_SIZE).all<ReviewRow>().catch(() => null)
  return { reviews: r?.results || [], total, page: p, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

/** 상품별 요약(평균·개수) — 카탈로그/상세 배지용. */
export async function reviewSummary(DB: D1Database, serviceId: number): Promise<ReviewSummary> {
  await ensureReviewSchema(DB)
  const r = await DB.prepare("SELECT COUNT(*) AS c, AVG(rating) AS a FROM ad_service_reviews WHERE service_id = ? AND status = 'visible'").bind(serviceId).first<{ c: number; a: number }>().catch(() => null)
  return { count: Number(r?.c) || 0, avg: r?.a ? Math.round(Number(r.a) * 10) / 10 : 0 }
}

// ── 어드민 모더레이션 ────────────────────────────────────────────────────────
export async function adminListReviews(DB: D1Database, limit = 200): Promise<Array<ReviewRow & { service_id: number; account_id: number; status: string }>> {
  await ensureReviewSchema(DB)
  const r = await DB.prepare('SELECT id, service_id, account_id, rating, title, body, author_masked, view_count, status, created_at FROM ad_service_reviews ORDER BY id DESC LIMIT ?')
    .bind(Math.min(500, limit)).all<ReviewRow & { service_id: number; account_id: number; status: string }>().catch(() => null)
  return r?.results || []
}
export async function adminSetReviewStatus(DB: D1Database, id: number, status: 'visible' | 'hidden'): Promise<void> {
  await ensureReviewSchema(DB)
  await DB.prepare('UPDATE ad_service_reviews SET status = ? WHERE id = ?').bind(status === 'hidden' ? 'hidden' : 'visible', id).run().catch(() => null)
}
