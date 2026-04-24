/**
 * Blog Posts API
 * Admin: CRUD for blog posts
 * Public: GET published posts
 */

import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth'
import { seedBlogPosts } from './blog-seed'

const app = new Hono<{ Bindings: Env }>()

// 테이블 자동 생성
async function ensureBlogTable(DB: D1Database) {
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
  `).run().catch(() => {})
}

// ── 공개: 발행된 글 목록 ──────────────────────────────────────
app.get('/public', async (c) => {
  await ensureBlogTable(c.env.DB)
  // 자동 시드: 글이 없으면 기본 콘텐츠 직접 생성
  const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM blog_posts').first<{ cnt: number }>()
  if (!count || count.cnt === 0) {
    await seedBlogPosts(c.env.DB)
  }
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(Math.max(1, Number(c.req.query('limit') || 9)), 100)
  const tag = c.req.query('tag')
  const offset = (page - 1) * limit

  const where = tag
    ? `WHERE is_published = 1 AND tags LIKE ?`
    : 'WHERE is_published = 1'

  const tagBind = tag ? [`%${tag}%`] : []

  const [posts, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, slug, title, summary, tags, author, thumbnail_url, published_at
      FROM blog_posts ${where}
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).bind(...tagBind, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM blog_posts ${where}`).bind(...tagBind).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: posts.results,
    meta: { total: total?.cnt || 0, page, limit },
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
  const posts = await c.env.DB.prepare(`
    SELECT id, slug, title, summary, tags, author, is_published, published_at, created_at, updated_at
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

  const result = await c.env.DB.prepare(`
    INSERT INTO blog_posts (slug, title, summary, content, tags, author, thumbnail_url, is_published, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  await c.env.DB.prepare(`
    UPDATE blog_posts
    SET slug=?, title=?, summary=?, content=?, tags=?, author=?,
        thumbnail_url=?, is_published=?, published_at=?, updated_at=CURRENT_TIMESTAMP
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

// ── 블로그 시드 (초기 콘텐츠 자동 생성) ─────────────────────────

app.post('/seed', async (c) => {
  await ensureBlogTable(c.env.DB)
  await seedBlogPosts(c.env.DB)
  return c.json({ success: true, message: '블로그 글 생성 완료' })
})

export { app as blogRoutes }
