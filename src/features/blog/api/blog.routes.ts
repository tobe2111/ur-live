/**
 * Blog Posts API
 * Admin: CRUD for blog posts
 * Public: GET published posts
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'

import { swallow } from '@/worker/utils/swallow';
import { generateBlogDraft, PROMO_TOPICS, type PromoTopic } from './blog-ai';
// 🥗 2026-07-15 워커 다이어트(대표 승인): blog-seed(임베드 블로그 글 ~62KB)는 syncBlogSeed 안에서만 쓰이므로
//   정적 import → 동적 import 로 이동(guide-seed 와 동일 검증된 패턴). 시드 동기화 발생 시에만 로드 → 메인 워커 번들 축소.
import { intParam } from '@/shared/pagination'
import { loadSeedAsset, isBlogSeed, SEED_ASSET_PATHS, type SeedAssetEnv } from '../../../worker/utils/seed-assets'
const app = new Hono<{ Bindings: Env }>()

// AI 초안: 미검토(비공개) 초안이 이만큼 쌓이면 추가 생성 중단(관리자 검토 유도).
const MAX_PENDING_AI_DRAFTS = 5

// 🔄 시드 콘텐츠 버전 — 아래 seedPosts 배열(글 내용)을 바꾸면 이 숫자를 +1 하세요.
// 올리면 배포 후 첫 접근 시 라이브 DB 에 자동 재반영됩니다.
// 관리자가 /admin/blog 에서 직접 수정한 글(manually_edited=1)은 재시드해도 보존됩니다.
// 💸 2026-07-05 v5: 딜 가이드에 유상/무상 버킷 정책 반영.
// v6 (2026-07-18): 딜 충전 종료(대표 확정) — 딜=활동 적립 리워드 프레임으로 딜포인트/결제 관련 글 갱신
const BLOG_SEED_VERSION = 8

// 테이블 자동 생성
async function ensureBlogTable(DB: D1Database) {
  if (_done_ensureBlogTable.has(DB)) return
  _done_ensureBlogTable.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      author TEXT DEFAULT '유어딜 팀',
      thumbnail_url TEXT,
      is_published INTEGER DEFAULT 0,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('blog:api:blog'))
  // 재시드 + 수동편집 보존용 컬럼 (추가만 — 기존 배포엔 없을 수 있어 개별 try-catch)
  for (const ddl of [
    `ALTER TABLE blog_posts ADD COLUMN is_seed INTEGER DEFAULT 0`,
    `ALTER TABLE blog_posts ADD COLUMN manually_edited INTEGER DEFAULT 0`,
    `ALTER TABLE blog_posts ADD COLUMN seed_version INTEGER DEFAULT 0`,
    `ALTER TABLE blog_posts ADD COLUMN ai_generated INTEGER DEFAULT 0`,
    `ALTER TABLE blog_posts ADD COLUMN view_count INTEGER DEFAULT 0`,
  ]) {
    await DB.prepare(ddl).run().catch(swallow('blog:api:blog'))
  }
  // 시드 버전 저장용 메타 테이블
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS blog_meta (key TEXT PRIMARY KEY, value TEXT)`
  ).run().catch(swallow('blog:api:blog'))
}

// ── 공개: 발행된 글 목록 ──────────────────────────────────────
app.get('/public', async (c) => {
  await ensureBlogTable(c.env.DB)
  // 버전 재시드: 코드의 시드 버전이 DB 보다 높으면 자동 반영(수동편집 글 보존)
  await maybeSyncBlogSeed(c.env.DB, c.env as unknown as SeedAssetEnv)
  const page = Math.max(1, intParam(c.req.query('page'), 1))
  const limit = Math.min(Math.max(1, intParam(c.req.query('limit'), 9)), 100)
  const tag = c.req.query('tag')
  // 📝 2026-07-01 서버 검색(q) — 제목/요약/본문 LIKE. 클라(BlogListPage)는 소규모라 전량 로드 후
  //   클라 검색을 쓰지만, 글이 수백 편으로 늘면 클라가 q 를 붙여 서버 페이지네이션으로 전환하면 됨.
  //   q 없으면 WHERE/바인드가 기존과 byte-동일 → SSR 0-RTT·edge 캐시·prewarm 키 전부 불변(additive).
  const q = (c.req.query('q') || '').trim()
  const offset = (page - 1) * limit

  const conds: string[] = ['is_published = 1']
  const binds: unknown[] = []
  if (tag) { conds.push('tags LIKE ?'); binds.push(`%${tag}%`) }
  if (q) { conds.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)'); const like = `%${q}%`; binds.push(like, like, like) }
  const where = `WHERE ${conds.join(' AND ')}`

  const [posts, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, slug, title, summary, tags, author, thumbnail_url, published_at
      FROM blog_posts ${where}
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM blog_posts ${where}`).bind(...binds).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: posts.results,
    meta: { total: total?.cnt || 0, page, limit, ...(tag ? { tag } : {}), ...(q ? { q } : {}) },
  })
})

// ── 공개: 단건 조회 ────────────────────────────────────────────
app.get('/public/:slug', async (c) => {
  await ensureBlogTable(c.env.DB)
  const post = await c.env.DB.prepare(`
    SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1
  `).bind(c.req.param('slug')).first()

  if (!post) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true, data: post })
})

// ── 공개: 조회수 증가 (되먹임 신호) ────────────────────────────
// 발행 글만 카운트. 클라이언트가 세션당 1회 호출(sessionStorage 가드). fail-soft.
app.post('/public/:slug/view', async (c) => {
  await ensureBlogTable(c.env.DB)
  const slug = c.req.param('slug')
  // 봇/중복 보정: 같은 IP+slug 는 1시간 1회만 카운트(KV 있을 때). 되먹임 신호 오염 방지. fail-open.
  const kv = c.env.CACHE_KV || c.env.RATE_LIMIT_KV
  if (kv) {
    try {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
      const key = `blogview:${slug}:${ip}`
      if (await kv.get(key)) return c.json({ success: true, deduped: true })
      await kv.put(key, '1', { expirationTtl: 3600 })
    } catch { /* KV 실패 시 그냥 카운트 */ }
  }
  await c.env.DB.prepare(
    `UPDATE blog_posts SET view_count = COALESCE(view_count,0) + 1 WHERE slug = ? AND is_published = 1`
  ).bind(slug).run().catch(swallow('blog:api:blog'))
  return c.json({ success: true })
})

// ── 어드민 전용 가드 (GET 목록/상세 + POST/PUT/DELETE) ─────────
// 공개 GET /public, /public/:slug 이후의 모든 핸들러에 인증 + admin 체크 적용
app.use('*', requireAuth())
app.use('*', async (c, next) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'admin') {
    return c.json({ success: false, error: 'Admin only' }, 403)
  }
  return next()
})

// ── 어드민: 전체 목록 ─────────────────────────────────────────
app.get('/', async (c) => {
  await ensureBlogTable(c.env.DB)
  await maybeSyncBlogSeed(c.env.DB, c.env as unknown as SeedAssetEnv)
  const posts = await c.env.DB.prepare(`
    SELECT id, slug, title, summary, tags, author, is_published, published_at, created_at, updated_at, is_seed, manually_edited, ai_generated, view_count
    FROM blog_posts ORDER BY created_at DESC
  `).all()
  return c.json({ success: true, data: posts.results })
})

// ── 어드민: 단건 조회 ─────────────────────────────────────────
app.get('/:id', async (c) => {
  await ensureBlogTable(c.env.DB)
  const post = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE id = ?'
  ).bind(Number(c.req.param('id'))).first()
  if (!post) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true, data: post })
})

// ── 어드민: 생성 ──────────────────────────────────────────────
app.post('/', async (c) => {
  await ensureBlogTable(c.env.DB)
  const body = await c.req.json()
  const { title, slug, summary, content, tags, author, thumbnail_url, is_published } = body

  if (!title || !slug || !content) {
    return c.json({ success: false, error: 'title, slug, content 필수' }, 400)
  }

  const publishedAt = is_published ? new Date().toISOString() : null

  // 관리자 직접 작성 글 = 시드 관리 대상 아님 + 수동편집으로 표시(재시드 덮어쓰기 방지)
  const result = await c.env.DB.prepare(`
    INSERT INTO blog_posts (slug, title, summary, content, tags, author, thumbnail_url, is_published, published_at, is_seed, manually_edited)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
  `).bind(
    slug, title, summary || '', content,
    JSON.stringify(tags || []),
    author || '유어딜 팀',
    thumbnail_url || null,
    is_published ? 1 : 0,
    publishedAt,
  ).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } })
})

// ── 어드민: 수정 ──────────────────────────────────────────────
app.put('/:id', async (c) => {
  await ensureBlogTable(c.env.DB)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const { title, slug, summary, content, tags, author, thumbnail_url, is_published } = body

  const existing = await c.env.DB.prepare(
    'SELECT published_at, is_published FROM blog_posts WHERE id = ?'
  ).bind(id).first<{ published_at: string | null; is_published: number }>()

  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)

  // 최초 발행 시점 기록
  const publishedAt = is_published
    ? (existing.published_at || new Date().toISOString())
    : null

  // 관리자 수정 = 수동편집으로 표시 → 이후 재시드해도 이 글은 덮어쓰지 않음
  await c.env.DB.prepare(`
    UPDATE blog_posts
    SET slug=?, title=?, summary=?, content=?, tags=?, author=?,
        thumbnail_url=?, is_published=?, published_at=?, manually_edited=1, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    slug, title, summary || '', content,
    JSON.stringify(tags || []),
    author || '유어딜 팀',
    thumbnail_url || null,
    is_published ? 1 : 0,
    publishedAt, id,
  ).run()

  return c.json({ success: true })
})

// ── 어드민: 삭제 ──────────────────────────────────────────────
app.delete('/:id', async (c) => {
  await ensureBlogTable(c.env.DB)
  await c.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?')
    .bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})


// 구(舊) 시드 slug 목록 — 이 글들은 시드가 관리하던 것으로 표시(is_seed=1)해,
// 새 시드에서 빠진 낡은 글(라이브 관련 등)을 자동으로 비공개 처리하기 위함.
const LEGACY_SEED_SLUGS = [
  'why-live-commerce', 'seller-start-guide', 'meal-voucher-business', 'agency-partnership',
  'live-auction-timedeal', 'friend-invite-group-buy', 'yourdeal-vs-others', 'review-reward-system',
  'what-is-yourdeal',  // 2026-07-28 → 'what-is-urdeal' 로 리네임(브랜드/도메인 정합). 구 URL 은 worker 301.
  'deal-points-guide', 'seller-settlement-guide', 'live-broadcast-tips', 'consumer-shopping-guide',
  'seller-tier-system', 'supporter-ranking-system', 'voucher-how-to-use', 'influencer-live-commerce',
  'group-buy-success-tips', 'safe-payment-system', 'restaurant-map-guide', 'shorts-content-strategy',
]

// 시드↔DB 동기화: 신규 글 삽입 / 시드 관리 글 최신화 / 낡은 시드 글 비공개.
// 관리자가 수정(manually_edited=1)하거나 직접 작성(is_seed=0)한 글은 절대 건드리지 않음.
/**
 * @returns 실제로 동기화했으면 true. **false 면 호출부는 시드 버전을 올리면 안 된다** —
 *   올려 버리면 다음부터 "이미 최신"으로 판단해 재시드를 영영 건너뛴다(라이브 블로그가 조용히 낡는다).
 */
async function syncBlogSeed(DB: D1Database, env?: SeedAssetEnv): Promise<boolean> {
  // 🌱 2026-08-19: 시드 산문(63KB)을 워커 번들에서 빼 **정적 자산**으로 읽는다.
  //   무료 플랜 압축 1MB 한도에 걸려 배포가 막힌 뒤의 조치(상세: worker/utils/seed-assets.ts).
  const posts = await loadSeedAsset(env, SEED_ASSET_PATHS.blog, isBlogSeed)
  if (!posts) return false

  // 구 시드 글을 시드 관리 대상으로 표시(1회, 멱등) → 낡은 글 정리 가능하게
  if (LEGACY_SEED_SLUGS.length) {
    const qs = LEGACY_SEED_SLUGS.map(() => '?').join(',')
    await DB.prepare(
      `UPDATE blog_posts SET is_seed = 1 WHERE manually_edited = 0 AND slug IN (${qs})`
    ).bind(...LEGACY_SEED_SLUGS).run().catch(swallow('blog:api:blog'))
  }

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    // 발행일 분산: 배열 순서대로 3일 간격 과거로 → 목록 정렬/시각이 단조롭지 않게(첫 글이 최신).
    const ageOffset = `-${i * 3} days`
    const existing = await DB.prepare(
      'SELECT id, manually_edited FROM blog_posts WHERE slug = ?'
    ).bind(post.slug).first<{ id: number; manually_edited: number }>().catch(() => null)

    if (!existing) {
      await DB.prepare(`
        INSERT OR IGNORE INTO blog_posts (slug, title, summary, content, tags, author, is_published, published_at, is_seed, manually_edited, seed_version)
        VALUES (?, ?, ?, ?, ?, '유어딜 팀', 1, datetime('now', ?), 1, 0, ?)
      `).bind(post.slug, post.title, post.summary, post.content, post.tags, ageOffset, BLOG_SEED_VERSION).run().catch(swallow('blog:api:blog'))
    } else if (!existing.manually_edited) {
      // 시드 관리 글 & 수동편집 안 됨 → 최신 시드 내용으로 갱신(발행일도 재분산)
      await DB.prepare(`
        UPDATE blog_posts
        SET title=?, summary=?, content=?, tags=?, is_seed=1, is_published=1, published_at=datetime('now', ?), seed_version=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND manually_edited=0
      `).bind(post.title, post.summary, post.content, post.tags, ageOffset, BLOG_SEED_VERSION, existing.id).run().catch(swallow('blog:api:blog'))
    }
    // manually_edited=1 → 건너뜀(수동편집 보존)
  }

  // 새 시드에서 빠진 낡은 시드 글은 비공개(삭제 아님 — 복구 가능). 수동편집/관리자작성 글은 보존.
  const keep = posts.map((p) => p.slug)
  if (keep.length) {
    const qs = keep.map(() => '?').join(',')
    await DB.prepare(
      `UPDATE blog_posts SET is_published = 0, updated_at = CURRENT_TIMESTAMP
       WHERE is_seed = 1 AND manually_edited = 0 AND slug NOT IN (${qs})`
    ).bind(...keep).run().catch(swallow('blog:api:blog'))
  }
  return true
}

// 버전 게이트: 코드 시드 버전 > DB 저장 버전일 때만 동기화(isolate 당 1회 메모)
let _seedSyncedVersion = -1
async function maybeSyncBlogSeed(DB: D1Database, env?: SeedAssetEnv) {
  if (_seedSyncedVersion >= BLOG_SEED_VERSION) return
  try {
    const row = await DB.prepare(
      `SELECT value FROM blog_meta WHERE key = 'seed_version'`
    ).first<{ value: string }>().catch(() => null)
    const stored = row ? Number(row.value) || 0 : 0
    if (stored < BLOG_SEED_VERSION) {
      // ⚠️ 시드 자산을 못 읽었으면(false) **버전을 올리지 않는다** — 다음 요청에서 재시도.
      //   여기서 올려 버리면 재시드가 영영 안 돌아 라이브 블로그가 조용히 낡는다.
      const synced = await syncBlogSeed(DB, env)
      if (!synced) return
      await DB.prepare(
        `INSERT INTO blog_meta (key, value) VALUES ('seed_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(String(BLOG_SEED_VERSION)).run().catch(swallow('blog:api:blog'))
    }
    _seedSyncedVersion = BLOG_SEED_VERSION
  } catch {
    // 동기화 실패가 블로그 서빙을 막지 않도록 — 다음 요청에서 재시도
  }
}

// 관리자 수동 트리거: 버전과 무관하게 강제 재동기화
app.post('/seed', async (c) => {
  await ensureBlogTable(c.env.DB)
  // ⚠️ 시드 자산을 못 읽으면 버전을 올리지 않고 **실패를 알린다** — 조용히 성공으로 처리하면
  //   관리자가 "동기화했다"고 믿는데 라이브는 그대로다.
  const synced = await syncBlogSeed(c.env.DB, c.env as unknown as SeedAssetEnv)
  if (!synced) {
    return c.json({ success: false, error: '시드 자산(seed/blog.json)을 읽지 못했습니다 — 배포 산출물을 확인하세요' }, 503)
  }
  await c.env.DB.prepare(
    `INSERT INTO blog_meta (key, value) VALUES ('seed_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(String(BLOG_SEED_VERSION)).run().catch(swallow('blog:api:blog'))
  return c.json({ success: true, message: '블로그 시드 동기화 완료', version: BLOG_SEED_VERSION })
})

// ── AI 자동 초안 (홍보 전용) ─────────────────────────────────────
// 🔁 되먹임 루프: 아직 안 다룬 주제 중 "성과 좋은 태그"를 가진 주제를 우선 선택.
//   발행 글의 태그별 평균 조회수를 계산 → 각 미작성 주제를 그 태그 성과 합으로 점수화 →
//   최고 점수부터. 성과 데이터가 없으면 기존 순서(백로그 순)로 폴백 → 열린 루프가 닫힌 루프로.
async function pickPromoTopic(DB: D1Database): Promise<PromoTopic | null> {
  // 이미 작성된 slug + 태그별 성과 수집
  const rows = await DB.prepare(
    `SELECT slug, tags, COALESCE(view_count,0) AS views FROM blog_posts WHERE is_published = 1`
  ).all<{ slug: string; tags: string; views: number }>().catch(() => ({ results: [] as { slug: string; tags: string; views: number }[] }))
  const existing = new Set<string>()
  const tagViews = new Map<string, { total: number; count: number }>()
  for (const r of rows.results || []) {
    existing.add(r.slug)
    let tags: string[] = []
    try { tags = JSON.parse(r.tags || '[]') } catch { tags = [] }
    for (const tag of tags) {
      const cur = tagViews.get(tag) || { total: 0, count: 0 }
      cur.total += Number(r.views) || 0
      cur.count += 1
      tagViews.set(tag, cur)
    }
  }
  const tagScore = (tag: string) => {
    const v = tagViews.get(tag)
    return v && v.count > 0 ? v.total / v.count : 0
  }

  // 미작성 주제만 후보. 성과 점수 = 주제 태그들의 평균 조회수 합. 원래 순서는 안정 tie-break.
  const candidates = PROMO_TOPICS
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => !existing.has(t.slug))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const sa = a.t.tags.reduce((s, tag) => s + tagScore(tag), 0)
    const sb = b.t.tags.reduce((s, tag) => s + tagScore(tag), 0)
    if (sb !== sa) return sb - sa       // 성과 높은 주제 우선
    return a.idx - b.idx                // 동점(또는 성과 0) → 백로그 순
  })
  return candidates[0].t
}

async function pendingAiDraftCount(DB: D1Database): Promise<number> {
  const r = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM blog_posts WHERE COALESCE(ai_generated,0)=1 AND is_published=0`
  ).first<{ cnt: number }>().catch(() => null)
  return r?.cnt || 0
}

/**
 * AI 홍보 초안 1편을 생성해 blog_posts 에 **비공개 초안**으로 저장.
 * 관리자 수동 트리거 + 주간 cron 이 공유. 항상 is_published=0(관리자 검토 후 발행).
 */
export async function createAiBlogDraft(
  DB: D1Database,
  apiKey: string | undefined,
): Promise<{ ok: boolean; id?: number; title?: string; skipped?: string; error?: string }> {
  await ensureBlogTable(DB)
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }

  // 미검토 초안이 너무 쌓였으면 중단(관리자 검토 유도)
  const pending = await pendingAiDraftCount(DB)
  if (pending >= MAX_PENDING_AI_DRAFTS) {
    return { ok: false, skipped: `미검토 AI 초안 ${pending}개 — 검토 후 다시 생성하세요` }
  }

  const topic = await pickPromoTopic(DB)
  if (!topic) return { ok: false, skipped: '모든 홍보 주제가 이미 작성됨' }

  const existing = await DB.prepare('SELECT title FROM blog_posts ORDER BY id DESC LIMIT 60')
    .all<{ title: string }>().catch(() => ({ results: [] as { title: string }[] }))
  const existingTitles = (existing.results || []).map((r) => r.title).filter(Boolean)

  const gen = await generateBlogDraft(apiKey, topic, existingTitles)
  if (!gen.ok) return { ok: false, error: gen.error }

  const { draft } = gen
  const res = await DB.prepare(`
    INSERT OR IGNORE INTO blog_posts (slug, title, summary, content, tags, author, is_published, published_at, is_seed, manually_edited, ai_generated)
    VALUES (?, ?, ?, ?, ?, '유어딜 팀', 0, NULL, 0, 0, 1)
  `).bind(
    topic.slug, draft.title, draft.summary, draft.content, JSON.stringify(draft.tags.length ? draft.tags : topic.tags),
  ).run().catch(() => null)

  if (!res || res.meta.changes === 0) return { ok: false, error: '초안 저장 실패(중복 slug 가능)' }
  return { ok: true, id: res.meta.last_row_id as number, title: draft.title }
}

// 관리자: AI 홍보 초안 생성 (비공개 초안으로 저장 → 검토 후 발행)
app.post('/ai-draft', async (c) => {
  const r = await createAiBlogDraft(c.env.DB, c.env.ANTHROPIC_API_KEY)
  if (!r.ok) {
    if (r.error === 'NOT_CONFIGURED') return c.json({ success: false, error: 'AI 미설정 (ANTHROPIC_API_KEY)' }, 400)
    if (r.skipped) return c.json({ success: false, error: r.skipped }, 200)
    return c.json({ success: false, error: r.error || 'AI 초안 생성 실패' }, 502)
  }
  return c.json({ success: true, data: { id: r.id, title: r.title }, message: 'AI 홍보 초안이 생성되었습니다 (비공개). 검토 후 발행하세요.' })
})

export { app as blogRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureBlogTable = new WeakSet<object>()
