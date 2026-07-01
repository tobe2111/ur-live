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
const app = new Hono<{ Bindings: Env }>()

// AI 초안: 미검토(비공개) 초안이 이만큼 쌓이면 추가 생성 중단(관리자 검토 유도).
const MAX_PENDING_AI_DRAFTS = 5

// 🔄 시드 콘텐츠 버전 — 아래 seedPosts 배열(글 내용)을 바꾸면 이 숫자를 +1 하세요.
// 올리면 배포 후 첫 접근 시 라이브 DB 에 자동 재반영됩니다.
// 관리자가 /admin/blog 에서 직접 수정한 글(manually_edited=1)은 재시드해도 보존됩니다.
const BLOG_SEED_VERSION = 3

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
  await maybeSyncBlogSeed(c.env.DB)
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
  await maybeSyncBlogSeed(c.env.DB)
  const posts = await c.env.DB.prepare(`
    SELECT id, slug, title, summary, tags, author, is_published, published_at, created_at, updated_at, is_seed, manually_edited, ai_generated
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

// ── 시드 콘텐츠 정의 ────────────────────────────────────────────
// 이 배열(글 내용)을 수정하면 위 BLOG_SEED_VERSION 을 +1 하세요 → 배포 후 자동 반영.
function blogSeedPosts(): Array<{ slug: string; title: string; summary: string; tags: string; content: string }> {
  return [
    {
      slug: 'what-is-yourdeal',
      title: '유어딜이란? — 이용권·교환권·동네딜을 한곳에',
      summary: '유어딜은 이용권, 교환권, 동네딜을 한곳에서 만나는 소비자 혜택 플랫폼입니다. 할인가로 사서 매장에서 바로 쓰고, 나만의 링크샵까지 갖는 유어딜의 모든 것을 소개합니다.',
      tags: '["유어딜", "이용권", "교환권", "동네딜"]',
      content: `## 유어딜, 한 문장으로

유어딜은 **이용권·교환권·동네딜**을 한곳에서 만나는 소비자 혜택 플랫폼입니다. 온라인에서 할인가로 사서, 오프라인 매장에서 바로 쓰는 경험을 가장 간단하게 만드는 것이 목표입니다.

## 세 가지 핵심 혜택

### 1. 이용권 — 할인가로 사서 매장에서 바로 사용
식당, 뷰티, 숙박, 액티비티까지. 유어딜에서 이용권을 할인가로 즉시 구매하면, 매장에 가서 QR 코드나 PIN 번호만 보여주면 끝입니다. 예약이나 대기 없이 **지금 사서 지금 쓰는** 구조라, 필요할 때 바로 활용할 수 있습니다.

### 2. 교환권 — 익숙한 기프티콘
카페 쿠폰, 상품권 같은 기프티콘도 유어딜에서 만날 수 있습니다. 선물하기 좋고, 받은 사람이 편하게 쓰는 익숙한 방식 그대로입니다.

### 3. 동네딜 — 내 주변의 진짜 혜택
내 위치를 기준으로 주변 지역의 딜을 모아 보여줍니다. 멀리 갈 필요 없이 **생활 반경 안에서** 쓸 수 있는 혜택을 찾을 수 있어요.

## 나만의 쇼핑몰, 링크샵

유어딜에 가입한 유저라면 **누구나 자동으로 나만의 링크샵**을 갖게 됩니다. 유어딜 도메인 뒤에 /u/{내 핸들} 주소가 붙는 나만의 쇼핑몰이죠. 마음에 드는 이용권이나 상품을 핀으로 추천해 친구에게 링크 한 줄로 공유할 수 있습니다.

사업자등록을 하고 판매 승인을 받으면 **사업자 유저**가 되어, 링크샵에서 내 상품을 직접 판매할 수도 있습니다.

## 딜 포인트로 더 간편하게

유어딜의 딜 포인트(딜)는 **1원 = 1딜, 충전 수수료 0원**입니다. 미리 충전해 두면 결제가 빠르고, 마음에 드는 유저를 후원할 때도 사용할 수 있습니다.

## 결제는 안전하게

모든 결제는 **토스페이먼츠**와 연동되어 카드·간편결제를 안전하게 처리합니다. 개인정보와 결제 정보는 검증된 결제 시스템으로 보호됩니다.

## 이렇게 시작하세요

1. 유어딜에 가입하면 링크샵이 자동으로 생깁니다.
2. 이용권·교환권·동네딜을 둘러보고 필요한 혜택을 골라 구매하세요.
3. 매장에서 QR/PIN으로 바로 사용하세요.

할인가로 사서 바로 쓰는 가장 쉬운 방법, 유어딜에서 시작하세요.`,
    },
    {
      slug: 'voucher-guide',
      title: '이용권 완벽 가이드 — 온라인 할인 구매, 매장에서 바로 사용',
      summary: '이용권은 온라인에서 할인가로 즉시 구매해 매장에서 QR/PIN으로 바로 쓰는 유어딜의 핵심 혜택입니다. 식사·미용·숙소·기타 카테고리와 이용권의 모든 것을 알려드립니다.',
      tags: '["이용권", "할인", "가이드"]',
      content: `## 이용권이란?

이용권은 **온라인에서 할인가로 즉시 구매**한 뒤, 오프라인 매장에서 QR 코드나 PIN 번호로 바로 사용하는 혜택입니다. 여럿이 모여야 할인이 시작되는 공동구매가 아니라, **지금 사면 바로 쓰는 즉시 구매** 방식이라는 점이 가장 큰 특징입니다.

## 어떤 이용권이 있나요?

유어딜 이용권은 네 가지 카테고리로 나뉩니다.

- **식사** — 식당·카페 등 먹거리 매장에서 쓰는 이용권
- **미용** — 헤어, 네일, 피부관리 등 뷰티 매장 이용권
- **숙소** — 호텔, 펜션, 게스트하우스 등 숙박 이용권
- **기타** — 액티비티, 체험, 여가 등 다양한 이용권

카테고리 칩으로 필터링하면 원하는 종류만 빠르게 골라 볼 수 있습니다.

## 왜 이용권을 쓰면 좋은가요?

### 1. 할인가로 미리 확보
정가보다 저렴한 가격에 이용권을 사 두면, 실제 방문 시 그만큼 이득입니다.

### 2. 예약·대기 없이 즉시 구매
사고 싶을 때 바로 결제하면 곧바로 내 이용권함에 담깁니다. 인원이 모이길 기다릴 필요가 없습니다.

### 3. 사용이 간단
매장에서 이용권함을 열어 QR/PIN을 보여주기만 하면 됩니다. 복잡한 절차가 없어요.

## 구매부터 사용까지

1. **둘러보기** — 카테고리(식사/미용/숙소/기타)로 원하는 이용권을 찾습니다.
2. **결제** — 카드·간편결제 또는 미리 충전한 딜 포인트로 결제합니다. 결제는 토스페이먼츠로 안전하게 처리됩니다.
3. **보관** — 구매한 이용권은 내 이용권함에 자동 저장됩니다.
4. **사용** — 매장에서 QR/PIN을 제시하면 끝입니다.

## 구매 전 확인할 점

- **유효기간**: 이용권마다 사용 가능 기간이 정해져 있으니 상세 페이지에서 꼭 확인하세요.
- **사용처**: 어느 매장에서 쓸 수 있는지, 사용 조건은 무엇인지 미리 살펴보세요.
- **환불 규정**: 미사용 이용권의 환불 조건은 상품별로 다를 수 있습니다.

## 딜 포인트로 더 편하게

미리 딜 포인트를 충전해 두면(1원 = 1딜, 수수료 없음) 이용권 결제가 한층 빨라집니다. 자주 쓰는 분이라면 충전해 두는 것을 추천합니다.

## 정리

이용권은 **할인가로 사서 바로 쓰는** 가장 실속 있는 방법입니다. 오늘 필요한 혜택을 미루지 말고 지금 유어딜에서 찾아보세요.`,
    },
    {
      slug: 'voucher-how-to-use',
      title: '이용권 사용 방법 — 구매부터 매장 사용, 유효기간까지',
      summary: '구매한 이용권은 내 이용권함에 저장되고, 매장에서 QR/PIN을 제시하면 바로 사용됩니다. 이용권 사용법과 유효기간, 환불까지 단계별로 안내합니다.',
      tags: '["이용권", "사용방법", "가이드"]',
      content: `## 이용권, 어떻게 쓰나요?

이용권 사용은 생각보다 훨씬 간단합니다. 온라인에서 산 이용권을 매장에서 QR 코드나 PIN 번호로 제시하면 그것으로 끝입니다. 단계별로 자세히 안내해 드릴게요.

## 1단계 — 구매하기

원하는 이용권을 골라 결제합니다. 결제 수단은 카드, 간편결제, 그리고 미리 충전해 둔 딜 포인트를 쓸 수 있습니다. 모든 결제는 토스페이먼츠로 안전하게 처리됩니다.

## 2단계 — 내 이용권함 확인

결제가 완료되면 이용권이 **내 이용권함**에 자동으로 담깁니다. 언제든 앱에서 내 이용권함을 열어 보유 중인 이용권 목록과 각각의 유효기간을 확인할 수 있습니다.

## 3단계 — 매장에서 사용

매장에 방문해 결제·이용 단계에서 이용권을 제시하면 됩니다.

- **QR 코드 방식**: 이용권 상세 화면의 QR 코드를 매장 직원에게 보여주거나 스캔합니다.
- **PIN 번호 방식**: 화면에 표시된 PIN 번호를 직원에게 알려주면 매장에서 확인 후 처리합니다.

사용이 완료되면 해당 이용권은 사용 완료 상태로 바뀌어, 중복 사용이 되지 않도록 관리됩니다.

## 유효기간을 꼭 확인하세요

이용권마다 **사용 가능 기간**이 정해져 있습니다. 기간이 지나면 사용이 어려울 수 있으니, 구매 직후 내 이용권함에서 유효기간을 확인하고 그 안에 사용하는 것이 좋습니다. 기간이 임박하면 미리 계획을 세워 두세요.

## 사용이 안 될 때 확인할 점

- **유효기간이 지났는지** 다시 확인하세요.
- **사용처가 맞는지** — 이용권마다 지정된 매장·조건이 있습니다.
- **이미 사용 완료 상태인지** 이용권함에서 상태를 확인하세요.
- 그래도 문제가 있으면 유어딜 고객 지원으로 문의하세요.

## 환불은 어떻게 되나요?

미사용 이용권의 환불 조건은 상품마다 다를 수 있습니다. 상세 페이지의 환불 규정을 확인하시고, 환불이 가능한 경우 결제 수단(또는 딜 포인트)으로 돌려받게 됩니다. 이미 사용한 이용권은 환불 대상이 아닌 점 유의하세요.

## 팁

- 방문 전에 이용권함을 미리 열어 두면 매장에서 당황하지 않습니다.
- 인터넷 연결이 불안정한 매장이라면, PIN 번호를 미리 확인해 두면 편합니다.

이용권은 사서 보여주기만 하면 되는 가장 간편한 혜택입니다. 어렵게 느낄 것 없이 편하게 사용하세요.`,
    },
    {
      slug: 'exchange-voucher-guide',
      title: '교환권(기프티콘) 가이드 — 이용권과 무엇이 다를까?',
      summary: '교환권은 카페 쿠폰·상품권 같은 익숙한 기프티콘입니다. 교환권이 무엇인지, 이용권과 어떻게 다른지, 어디서 쓰는지 쉽게 정리했습니다.',
      tags: '["교환권", "기프티콘", "가이드"]',
      content: `## 교환권이란?

교환권은 우리가 흔히 아는 **기프티콘**입니다. 카페 음료 쿠폰, 상품권처럼 온라인에서 받아 매장이나 지정된 곳에서 상품·서비스로 교환하는 방식이죠. 유어딜에서는 이런 교환권을 손쉽게 만나고 활용할 수 있습니다.

## 이용권과 교환권, 무엇이 다른가요?

두 가지 모두 온라인에서 사서 오프라인에서 쓰는 혜택이지만, 성격이 조금 다릅니다.

| 구분 | 이용권 | 교환권 |
|---|---|---|
| 성격 | 할인가로 사서 매장에서 바로 사용 | 익숙한 기프티콘 형태 |
| 카테고리 | 식사·미용·숙소·기타 | 카페 쿠폰·상품권 등 |
| 사용 방식 | 매장에서 QR/PIN 제시 | 지정 사용처에서 교환 |
| 선물 | — | 선물용으로 특히 편리 |

쉽게 말해, **이용권은 다양한 오프라인 매장에서 할인 혜택을 누리는 데 초점**이 있고, **교환권은 익숙한 기프티콘처럼 정해진 상품과 교환**하는 데 초점이 있습니다. 목적에 따라 골라 쓰면 됩니다.

## 교환권은 이럴 때 좋아요

### 1. 선물하기 좋아요
카페 쿠폰이나 상품권은 부담 없이 마음을 전하기 좋은 선물입니다. 갑자기 감사 인사를 전할 일이 생겼을 때 특히 유용합니다.

### 2. 익숙해서 편해요
이미 많은 분이 기프티콘 사용에 익숙하기 때문에, 받는 사람도 별도 설명 없이 바로 쓸 수 있습니다.

### 3. 사용처가 명확해요
교환권은 어디서 쓸 수 있는지 사용처가 분명하게 안내되어 있어, 헷갈릴 일이 적습니다.

## 사용 방법

1. 유어딜에서 원하는 교환권을 구매합니다. 결제는 토스페이먼츠로 안전하게 처리됩니다.
2. 구매한 교환권은 내 보관함에 저장됩니다.
3. 지정된 사용처에서 교환권을 제시하고 상품·서비스로 교환합니다.

## 구매 전 확인할 점

- **사용처**: 어디서 교환할 수 있는지 상세 페이지에서 확인하세요.
- **유효기간**: 교환권에도 사용 기한이 있으니 기간 안에 쓰세요.
- **교환 조건**: 특정 상품에만 쓸 수 있는지 등 조건을 확인하세요.

## 정리

교환권은 **익숙한 기프티콘 그대로**, 이용권은 **다양한 매장의 할인 혜택**. 두 가지를 상황에 맞게 활용하면 유어딜을 훨씬 알차게 즐길 수 있습니다.`,
    },
    {
      slug: 'dongne-deal-guide',
      title: '동네딜 가이드 — 내 주변의 진짜 혜택 찾기',
      summary: '동네딜은 내 위치를 기준으로 주변 지역의 딜을 모아 보여주는 유어딜의 기능입니다. 생활 반경 안에서 쓸 수 있는 혜택을 찾는 방법을 안내합니다.',
      tags: '["동네딜", "위치기반", "가이드"]',
      content: `## 동네딜이란?

동네딜은 **내 주변 지역의 딜을 모아 보여주는** 유어딜의 기능입니다. 멀리 있는 매장까지 갈 필요 없이, 지금 내가 있는 생활 반경 안에서 쓸 수 있는 혜택을 한눈에 찾을 수 있습니다.

## 왜 동네딜인가요?

아무리 좋은 할인이라도, 집이나 회사에서 너무 멀면 결국 쓰기 어렵습니다. 동네딜은 이런 고민을 해결합니다. **내 주변에서 실제로 방문할 수 있는 곳**의 혜택만 골라 보여주기 때문에, 발견한 딜을 실제로 활용할 확률이 훨씬 높습니다.

- 점심시간에 근처 식당 이용권을 바로 찾기
- 퇴근길에 들를 만한 뷰티 매장 혜택 확인하기
- 주말에 가까운 곳에서 즐길 수 있는 딜 둘러보기

## 동네딜 이용 방법

### 1. 내 주변 딜 보기
동네딜에 들어가면 위치를 기준으로 주변의 딜이 모여 표시됩니다. 위치 정보 사용을 허용하면 **내 주변** 딜을 더 정확하게 찾아 줍니다.

### 2. 지역·카테고리로 좁히기
관심 있는 지역이나 카테고리(식사·미용·숙소·기타)로 필터링해 원하는 혜택만 빠르게 확인할 수 있습니다.

### 3. 구매하고 바로 사용
마음에 드는 딜을 찾았다면 그 자리에서 구매하고, 매장에 방문해 QR/PIN으로 사용하면 됩니다.

## 위치 정보는 어떻게 쓰이나요?

동네딜은 더 가까운 혜택을 보여주기 위해 위치 정보를 활용합니다. 위치 사용을 허용하면 **내 주변** 기준으로 정렬되어 편리하고, 원하지 않으면 지역을 직접 선택해 둘러볼 수도 있습니다. 위치 정보는 주변 딜 표시를 위한 용도로 사용됩니다.

## 이렇게 활용해 보세요

- **평일 낮**: 회사 근처 식사 이용권으로 점심값 아끼기
- **주말**: 가까운 액티비티·체험 딜로 나들이 계획하기
- **여행 중**: 현재 위치 기준으로 근처 맛집·숙소 혜택 찾기

## 정리

동네딜은 **가까워서 진짜로 쓸 수 있는** 혜택을 찾는 가장 빠른 방법입니다. 지금 있는 곳에서 유어딜 동네딜을 열어, 내 주변의 알짜 혜택을 만나 보세요.`,
    },
    {
      slug: 'linkshop-my-store',
      title: '링크샵 — 누구나 갖는 나만의 쇼핑몰',
      summary: '유어딜에 가입한 유저는 누구나 자동으로 나만의 링크샵을 갖습니다. /u/{핸들} 주소의 내 쇼핑몰에 마음에 드는 혜택을 핀으로 추천하고 링크 하나로 공유하세요.',
      tags: '["링크샵", "나만의쇼핑몰", "공유"]',
      content: `## 링크샵이란?

링크샵은 **유어딜에 가입하면 누구나 자동으로 갖게 되는 나만의 쇼핑몰**입니다. 유어딜 도메인 뒤에 /u/{내 핸들} 주소가 붙는, 오직 나만의 공간이죠. 별도로 만들 필요 없이 가입과 동시에 생성됩니다.

## 왜 링크샵이 특별한가요?

블로그나 SNS에 링크를 잔뜩 붙이는 대신, **하나의 주소로 내가 추천하는 혜택을 모아** 보여줄 수 있습니다. 친구에게, 팔로워에게, 단톡방에 링크 한 줄만 공유하면 됩니다.

- 내가 직접 써 보고 좋았던 이용권을 모아 두기
- 취향에 맞는 교환권·동네딜을 큐레이션하기
- 나만의 쇼핑몰처럼 꾸며 공유하기

## 핀으로 추천하기

마음에 드는 이용권이나 상품을 **핀**으로 내 링크샵에 담을 수 있습니다. 핀으로 추천한 혜택은 내 링크샵 방문자에게 보여지고, 방문자가 그 혜택을 이용하면 나의 추천이 빛을 발합니다. 좋은 것을 발견했을 때 바로바로 핀으로 모아 두세요.

## 공유하는 방법

1. 내 링크샵 주소(유어딜 도메인/u/{내 핸들})를 복사합니다.
2. SNS 프로필, 메신저, 게시물 어디든 붙여넣습니다.
3. 방문자가 링크를 눌러 내가 추천한 혜택을 둘러봅니다.

주소가 짧고 깔끔해서, 프로필 링크 한 자리에 넣기에도 딱 좋습니다.

## 사업자 유저라면 더 강력하게

사업자등록을 하고 판매 승인을 받아 **사업자 유저**가 되면, 링크샵은 단순 추천 공간을 넘어 **내 상품을 직접 파는 쇼핑몰**이 됩니다. 이때 링크샵의 주인공은 내 상품이고, 이용권은 이를 보완하는 부가 채널로 활용할 수 있습니다.

즉, 링크샵 하나에 기능이 **레이어처럼 더해지는** 구조입니다. 유저일 때의 추천·공유 기능은 그대로 유지되면서, 판매 기능이 추가되는 것이죠.

## 링크샵을 잘 꾸미는 팁

- **일관된 주제**: 관심사나 취향이 드러나는 혜택을 모으면 방문자가 더 좋아합니다.
- **꾸준한 업데이트**: 새로 발견한 좋은 혜택을 자주 핀으로 추가하세요.
- **핸들 공유**: 내 핸들을 여러 채널에 노출해 링크샵 방문을 늘리세요.

## 정리

링크샵은 **가입만 하면 생기는 나만의 쇼핑몰**입니다. 좋은 혜택을 모아 링크 하나로 공유하고, 사업자 유저가 되면 내 상품까지 파는 공간으로 키워 보세요.`,
    },
    {
      slug: 'become-business-user',
      title: '사업자 유저 되기 — 내 링크샵에서 내 상품 판매하기',
      summary: '유저에서 사업자등록과 판매 승인을 거치면 사업자 유저가 됩니다. 내 링크샵에서 내 상품을 직접 팔고 셀러 대시보드로 관리하는 방법을 안내합니다.',
      tags: '["사업자유저", "판매", "링크샵"]',
      content: `## 사업자 유저란?

유어딜의 모든 회원은 **유저**로 시작합니다. 여기서 **사업자등록을 하고 판매 승인**을 받으면 **사업자 유저**가 됩니다. 사업자 유저는 자신의 링크샵에서 **내 상품을 직접 판매**하고, 판매 대금을 현금으로 정산받을 수 있습니다.

## 유저에서 사업자 유저로

유어딜의 신분은 교체되는 것이 아니라 **기능이 더해지는** 구조입니다.

1. **유저** — 가입만 하면 됩니다. 링크샵이 자동 생성되고, 이용권·교환권·동네딜을 이용하고, 좋은 혜택을 핀으로 추천할 수 있습니다.
2. **사업자등록** — 판매를 위해 사업자 정보를 등록합니다.
3. **판매 승인** — 등록 정보가 확인되면 판매 권한이 부여됩니다.
4. **사업자 유저** — 이제 내 링크샵에서 내 상품을 판매할 수 있습니다.

기존 유저로서의 기능(추천, 구매, 공유)은 그대로 유지되면서, 판매 기능이 추가로 얹히는 방식입니다.

## 내 링크샵이 곧 내 쇼핑몰

사업자 유저의 링크샵(유어딜 도메인/u/{내 핸들})은 **내 상품이 주인공인 나만의 쇼핑몰**입니다. 별도의 쇼핑몰을 만들거나 복잡한 세팅을 할 필요 없이, 이미 갖고 있던 링크샵에 상품을 올리면 됩니다.

- 내 상품을 링크샵 전면에 진열
- 이용권은 상품을 보완하는 부가 채널로 함께 운영
- 링크 하나로 고객에게 내 쇼핑몰을 공유

## 셀러 대시보드로 관리하기

판매를 시작하면 **셀러 대시보드**라는 관리 도구를 사용하게 됩니다. 여기서 상품 등록·수정, 주문 확인, 정산 내역 조회 등을 한곳에서 처리할 수 있습니다. 셀러 대시보드는 어디까지나 **판매 관리를 돕는 도구**입니다.

## 정산은 어떻게?

판매 대금은 플랫폼 기본 수수료(5%)를 제외하고 정산됩니다. 정산 시 세법에 따라 원천징수(기본 3.3% 사업소득)가 적용될 수 있습니다. 자세한 흐름은 사업자 유저 정산 가이드를 참고하세요.

## 시작하기 전 준비물

- **사업자등록증**: 판매 승인을 위해 필요합니다.
- **정산 계좌 정보**: 판매 대금을 받을 계좌입니다.
- **판매할 상품**: 어떤 상품을 어떤 가격에 올릴지 정리해 두면 좋습니다.

## 정리

유저에서 시작해 사업자 유저가 되면, 이미 가진 링크샵이 **내 상품을 파는 쇼핑몰**로 확장됩니다. 부담 없이 시작해 나만의 쇼핑몰을 키워 보세요.`,
    },
    {
      slug: 'deal-points-guide',
      title: '딜 포인트 완벽 가이드 — 충전 1원=1딜, 수수료 없음',
      summary: '딜 포인트는 1원=1딜로 수수료 없이 충전하는 유어딜의 포인트입니다. 충전·사용·후원까지 딜 포인트를 알차게 쓰는 방법을 정리했습니다.',
      tags: '["딜포인트", "충전", "후원"]',
      content: `## 딜 포인트(딜)란?

딜 포인트는 유어딜에서 사용하는 포인트입니다. 미리 충전해 두면 결제가 빠르고 간편해지며, 마음에 드는 유저를 응원하는 **후원**에도 쓸 수 있습니다.

## 충전 — 1원 = 1딜, 수수료 없음

딜 포인트의 가장 큰 장점은 **충전 수수료가 없다**는 점입니다.

- **1원 = 1딜**로 그대로 환산됩니다.
- 충전 시 별도 수수료가 붙지 않습니다. 넣은 만큼 그대로 딜이 됩니다.
- 충전 결제는 토스페이먼츠로 안전하게 처리됩니다.

예를 들어 10,000원을 충전하면 정확히 10,000딜이 적립됩니다. 손해 보는 부분 없이 투명합니다.

## 사용 — 결제할 때 즉시 차감

딜 포인트는 이용권·교환권 등 상품을 결제할 때 사용할 수 있습니다. 결제 시 보유한 딜 포인트가 **즉시 차감**되므로, 카드 결제를 매번 거치지 않아도 빠르게 구매를 마칠 수 있습니다. 자주 유어딜을 이용하는 분이라면 미리 충전해 두는 것이 편리합니다.

## 후원 — 응원하는 마음 전하기

딜 포인트로 마음에 드는 유저를 **후원**할 수 있습니다. 좋은 추천을 해 주거나 응원하고 싶은 유저에게 딜을 보내 마음을 전하는 방식입니다.

- **최소 후원 금액은 500딜**입니다.
- 후원 시 딜 포인트가 즉시 차감됩니다.

## 딜 포인트를 알차게 쓰는 팁

### 1. 미리 충전해 두기
자주 이용한다면 미리 충전해 두면 결제가 훨씬 빠릅니다. 수수료가 없으니 부담도 없습니다.

### 2. 필요한 만큼 충전
충전한 딜은 유어딜 안에서 사용하는 포인트입니다. 사용 계획에 맞춰 필요한 만큼 충전하는 것을 권합니다.

### 3. 후원으로 응원
좋은 혜택을 발견하게 해 준 유저가 있다면 500딜부터 후원으로 감사를 표현해 보세요.

## 자주 묻는 질문

**Q. 충전 시 수수료가 정말 없나요?**
네. 1원 = 1딜로 환산되며 별도 충전 수수료가 없습니다.

**Q. 결제할 때 딜과 카드를 함께 쓸 수 있나요?**
결제 화면에서 보유한 딜 포인트를 사용해 결제할 수 있습니다. 결제 수단은 화면 안내를 따르세요.

**Q. 후원은 얼마부터 가능한가요?**
최소 500딜부터 후원할 수 있습니다.

## 정리

딜 포인트는 **수수료 없이 1원=1딜로 충전**해 빠르게 결제하고, 좋아하는 유저를 후원할 수 있는 유어딜의 든든한 포인트입니다. 미리 충전해 두고 편하게 이용하세요.`,
    },
    {
      slug: 'safe-payment-system',
      title: '유어딜 안전 결제 — 토스페이먼츠로 든든하게',
      summary: '유어딜의 모든 결제는 토스페이먼츠와 연동되어 카드·간편결제를 안전하게 처리합니다. 결제 수단과 보안, 안심하고 결제하는 방법을 안내합니다.',
      tags: '["결제", "토스페이먼츠", "보안"]',
      content: `## 안심하고 결제하세요

유어딜의 모든 결제는 **토스페이먼츠**와 연동되어 처리됩니다. 검증된 결제 시스템을 통해 카드와 간편결제를 안전하게 이용할 수 있어, 처음 방문한 분도 안심하고 구매할 수 있습니다.

## 어떤 결제 수단을 쓸 수 있나요?

- **신용·체크카드**: 국내 주요 카드로 결제할 수 있습니다.
- **간편결제**: 익숙한 간편결제 수단으로 몇 번의 터치만에 결제가 끝납니다.
- **딜 포인트**: 미리 충전해 둔 딜 포인트로도 결제할 수 있습니다(1원 = 1딜, 충전 수수료 없음).

상황에 맞는 결제 수단을 골라 편하게 이용하세요.

## 결제가 안전한 이유

### 1. 검증된 결제 시스템
결제 처리는 토스페이먼츠를 통해 이루어집니다. 결제 승인, 취소, 환불이 표준화된 절차로 안전하게 관리됩니다.

### 2. 결제 정보 보호
카드 정보 등 민감한 결제 정보는 결제 시스템에서 안전하게 처리됩니다.

### 3. 정확한 금액 검증
결제 금액은 서버에서 정확히 확인한 뒤 승인됩니다. 표시된 금액과 다르게 결제되는 일이 없도록 검증 절차를 거칩니다.

## 결제 흐름

1. **상품 선택** — 원하는 이용권·교환권을 고릅니다.
2. **결제 수단 선택** — 카드, 간편결제, 딜 포인트 중에서 선택합니다.
3. **결제 진행** — 토스페이먼츠 결제창에서 안전하게 결제합니다.
4. **완료** — 결제가 승인되면 구매한 상품이 보관함에 담기고, 결제 결과를 확인할 수 있습니다.

## 결제 시 확인할 점

- **결제 금액**: 결제 전 최종 금액을 다시 한번 확인하세요.
- **약관 동의**: 결제 진행을 위해 필요한 약관에 동의해야 합니다.
- **영수증**: 결제 완료 후 결제 내역과 영수증을 확인할 수 있습니다.

## 환불은 어떻게 되나요?

환불이 필요한 경우, 상품별 환불 규정에 따라 처리됩니다. 카드로 결제했다면 결제 수단으로, 딜 포인트로 결제했다면 딜 포인트로 돌려받게 됩니다. 이미 사용한 이용권·교환권은 환불 대상이 아닐 수 있으니 상세 페이지의 규정을 확인하세요.

## 결제가 안 될 때

- 카드 한도나 유효기간을 확인하세요.
- 간편결제 앱의 상태를 점검하세요.
- 딜 포인트 결제라면 잔액이 충분한지 확인하세요.
- 그래도 문제가 있으면 잠시 후 다시 시도하거나 고객 지원으로 문의하세요.

## 정리

유어딜은 **토스페이먼츠 연동**으로 카드·간편결제를 안전하게 처리합니다. 안심하고 원하는 혜택을 결제하세요.`,
    },
    {
      slug: 'review-reward-guide',
      title: '리뷰 리워드 — 리뷰 쓰면 딜 포인트 적립',
      summary: '유어딜에서 이용 후기를 남기면 딜 포인트로 리워드를 받을 수 있습니다. 리뷰 작성 방법과 좋은 리뷰 쓰는 팁, 리워드 활용법을 안내합니다.',
      tags: '["리뷰", "리워드", "딜포인트"]',
      content: `## 리뷰 쓰면 딜 포인트로 돌아옵니다

유어딜에서 이용권이나 교환권을 사용한 뒤 **후기를 남기면 딜 포인트 리워드**를 받을 수 있습니다. 내 경험을 공유하는 작은 수고가 다른 유저에게는 큰 도움이 되고, 나에게는 다음 구매에 쓸 수 있는 딜로 돌아옵니다.

## 왜 리뷰가 중요할까요?

- **다음 유저에게 도움**: 실제 이용자의 솔직한 후기는 구매를 고민하는 사람에게 가장 믿을 만한 정보입니다.
- **더 나은 혜택으로**: 유저들의 피드백이 쌓일수록 좋은 혜택이 더 잘 보이게 됩니다.
- **나에게는 리워드**: 리뷰를 남기면 딜 포인트가 적립됩니다.

## 리뷰 작성 방법

1. 이용권·교환권을 구매하고 실제로 사용합니다.
2. 내 구매 내역 또는 상품 페이지에서 리뷰 작성으로 들어갑니다.
3. 별점과 후기 내용을 입력하고 등록합니다.
4. 조건에 맞으면 딜 포인트 리워드가 적립됩니다.

## 좋은 리뷰를 쓰는 팁

리워드도 중요하지만, 다른 유저에게 도움이 되는 리뷰일수록 가치가 있습니다.

### 1. 구체적으로
막연히 "좋았어요"보다 **무엇이 어떻게 좋았는지** 적어 주세요. 예를 들어 "식사 이용권으로 방문했는데 대기 없이 바로 사용됐고, 메뉴 구성이 알찼어요"처럼요.

### 2. 솔직하게
아쉬웠던 점도 담백하게 적으면 신뢰가 올라갑니다. 솔직한 후기가 결국 모두에게 도움이 됩니다.

### 3. 사용 경험 중심으로
QR/PIN 사용은 편했는지, 매장 응대는 어땠는지 등 **실제 사용 경험**을 담으면 좋은 리뷰가 됩니다.

## 적립된 딜 포인트 활용하기

리뷰로 받은 딜 포인트는 일반 딜 포인트와 똑같이 사용할 수 있습니다.

- 다음 이용권·교환권 결제에 사용
- 응원하고 싶은 유저에게 후원(최소 500딜)

리뷰를 꾸준히 남기면 딜이 차곡차곡 쌓여, 다음 구매가 한결 가벼워집니다.

## 리뷰 작성 시 유의할 점

- 실제 이용 경험을 바탕으로 정직하게 작성해 주세요.
- 타인을 비방하거나 부적절한 내용은 삼가 주세요.
- 리워드 지급 조건은 상품·정책에 따라 다를 수 있습니다.

## 정리

리뷰 리워드는 **내 경험을 나누고 딜 포인트로 보상받는** 선순환입니다. 이용권·교환권을 쓴 뒤 솔직한 후기를 남기고, 쌓인 딜로 다음 혜택을 더 알뜰하게 누려 보세요.`,
    },
    {
      slug: 'business-user-settlement',
      title: '사업자 유저 정산 가이드 — 매출부터 정산까지',
      summary: '사업자 유저의 판매 대금은 플랫폼 수수료 5%를 제외하고 정산되며, 원천징수 기본 3.3%가 적용됩니다. 매출부터 정산까지의 흐름을 명확히 정리했습니다.',
      tags: '["사업자유저", "정산", "수수료"]',
      content: `## 정산, 어렵지 않습니다

사업자 유저가 되어 링크샵에서 상품을 팔기 시작하면, 판매 대금을 어떻게 받는지가 가장 궁금하실 겁니다. 이 글에서 매출 발생부터 정산까지의 흐름을 한눈에 정리해 드립니다.

## 정산 흐름 한눈에 보기

1. **판매 발생** — 고객이 내 링크샵에서 상품을 구매하고 결제합니다.
2. **주문 확정** — 결제가 승인되고 주문이 확정됩니다.
3. **수수료 차감** — 판매 금액에서 플랫폼 기본 수수료(5%)가 차감됩니다.
4. **원천징수 적용** — 세법에 따라 원천징수(기본 3.3%)가 적용됩니다.
5. **정산 지급** — 남은 금액이 등록한 계좌로 정산됩니다.

## 플랫폼 수수료 — 기본 5%

판매 대금에서 **플랫폼 기본 수수료 5%**가 차감됩니다. 이는 결제 처리, 플랫폼 운영, 고객 지원 등에 사용되는 기본 수수료입니다.

예를 들어 100,000원짜리 상품이 팔리면, 기본 수수료 5%인 5,000원을 제외한 금액이 정산 기준이 됩니다.

## 원천징수 — 기본 3.3%

정산 시 세법에 따라 **원천징수**가 적용됩니다. 기본은 **사업소득 3.3%**입니다. 원천징수된 세금은 관련 법령에 따라 처리되며, 정산 내역에서 확인할 수 있습니다. 소득 유형에 따라 적용 세율이 달라질 수 있으니 정산 안내를 참고하세요.

## 정산 계산 예시

이해를 돕기 위한 간단한 예시입니다(실제 금액은 상품·정책에 따라 다를 수 있습니다).

| 항목 | 금액 |
|---|---|
| 판매 금액 | 100,000원 |
| 플랫폼 수수료(5%) | -5,000원 |
| 수수료 차감 후 | 95,000원 |
| 원천징수(3.3% 기준) | 정산 내역에서 확인 |
| 실 정산액 | 위 절차 반영 후 지급 |

정확한 금액과 세부 항목은 언제나 **셀러 대시보드의 정산 내역**에서 확인하는 것을 권장합니다.

## 셀러 대시보드에서 정산 확인하기

판매 관리 도구인 **셀러 대시보드**에서 주문 현황과 정산 내역을 한곳에서 볼 수 있습니다.

- 어떤 주문이 정산 대상인지
- 수수료와 원천징수가 어떻게 적용됐는지
- 언제 얼마가 지급되는지

투명하게 확인할 수 있으니 정기적으로 살펴보세요.

## 준비해 두면 좋은 것

- **정산 계좌 정보**: 정확한 계좌를 등록해 두어야 지급이 원활합니다.
- **사업자 정보**: 사업자등록 정보가 정확해야 정산과 세금 처리가 매끄럽습니다.
- **정산 주기 확인**: 정산이 언제 이루어지는지 안내를 확인해 두세요.

## 정리

사업자 유저의 정산은 **판매 → 5% 수수료 차감 → 원천징수(기본 3.3%) → 지급**의 명확한 흐름을 따릅니다. 셀러 대시보드에서 내역을 확인하며 안정적으로 판매를 이어가세요.`,
    },
    {
      slug: 'agency-partnership',
      title: '에이전시 파트너십 — 여러 사업자 유저를 함께 관리하기',
      summary: '에이전시는 여러 사업자 유저와 매장을 관리하는 B2B 조직입니다. 에이전시 파트너십이 무엇인지, 어떤 이점이 있는지 안내합니다.',
      tags: '["에이전시", "파트너십", "B2B"]',
      content: `## 에이전시란?

에이전시는 **여러 사업자 유저와 매장을 함께 관리하는 B2B 조직**입니다. 개별 사업자 유저가 각자 판매하는 것을 넘어, 여러 곳을 묶어 체계적으로 관리하고 성장을 지원하는 역할을 합니다.

## 어떤 경우에 에이전시가 필요할까요?

- **여러 매장을 운영**하며 통합 관리가 필요한 경우
- **여러 사업자 유저를 대신해** 판매·운영을 지원하는 조직
- **규모 있는 파트너십**으로 유어딜과 협업하고 싶은 경우

혼자 하나의 링크샵을 운영하는 사업자 유저와 달리, 에이전시는 **다수를 아우르는 관리 관점**에서 유어딜과 함께합니다.

## 에이전시 파트너십의 이점

### 1. 통합 관리
여러 사업자 유저·매장의 현황을 한곳에서 관리할 수 있어, 개별로 흩어져 관리하는 번거로움을 줄입니다.

### 2. 효율적인 운영
반복되는 운영 업무를 체계적으로 처리하고, 관리하는 매장들의 성과를 함께 살필 수 있습니다.

### 3. 성장 지원
관리 대상의 판매가 잘 될수록 에이전시도 함께 성장하는 구조로, 상생하는 파트너십을 만들 수 있습니다.

## 에이전시와 사업자 유저의 관계

유어딜의 구조를 다시 정리하면 이렇습니다.

- **유저**: 가입한 누구나. 자동으로 링크샵을 갖습니다.
- **사업자 유저**: 사업자등록·판매 승인을 거쳐 자신의 링크샵에서 상품을 파는 유저.
- **에이전시**: 여러 사업자 유저·매장을 관리하는 B2B 조직.

에이전시는 개인 축(유저 → 사업자 유저)과는 **별도의 관리 축**에 있습니다. 여러 판매 주체를 아우르는 조직 단위의 파트너인 셈입니다.

## 파트너십을 시작하려면

에이전시 파트너십은 여러 매장·사업자 유저를 관리하는 규모와 체계를 전제로 합니다. 협업을 고려하고 있다면 다음을 준비해 두면 좋습니다.

- 관리하려는 매장·사업자 유저의 규모
- 운영·관리 방식과 목표
- 협업을 위한 조직 정보

구체적인 파트너십 조건과 절차는 유어딜의 안내를 통해 확인할 수 있습니다.

## 정리

에이전시 파트너십은 **여러 사업자 유저와 매장을 함께 관리하며 성장하는** B2B 협업 모델입니다. 규모 있는 운영을 계획하고 있다면, 에이전시로 유어딜과 함께하는 길을 검토해 보세요.`,
    },

  ]
}

// 구(舊) 시드 slug 목록 — 이 글들은 시드가 관리하던 것으로 표시(is_seed=1)해,
// 새 시드에서 빠진 낡은 글(라이브 관련 등)을 자동으로 비공개 처리하기 위함.
const LEGACY_SEED_SLUGS = [
  'why-live-commerce', 'seller-start-guide', 'meal-voucher-business', 'agency-partnership',
  'live-auction-timedeal', 'friend-invite-group-buy', 'yourdeal-vs-others', 'review-reward-system',
  'deal-points-guide', 'seller-settlement-guide', 'live-broadcast-tips', 'consumer-shopping-guide',
  'seller-tier-system', 'supporter-ranking-system', 'voucher-how-to-use', 'influencer-live-commerce',
  'group-buy-success-tips', 'safe-payment-system', 'restaurant-map-guide', 'shorts-content-strategy',
]

// 시드↔DB 동기화: 신규 글 삽입 / 시드 관리 글 최신화 / 낡은 시드 글 비공개.
// 관리자가 수정(manually_edited=1)하거나 직접 작성(is_seed=0)한 글은 절대 건드리지 않음.
async function syncBlogSeed(DB: D1Database) {
  const posts = blogSeedPosts()

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
}

// 버전 게이트: 코드 시드 버전 > DB 저장 버전일 때만 동기화(isolate 당 1회 메모)
let _seedSyncedVersion = -1
async function maybeSyncBlogSeed(DB: D1Database) {
  if (_seedSyncedVersion >= BLOG_SEED_VERSION) return
  try {
    const row = await DB.prepare(
      `SELECT value FROM blog_meta WHERE key = 'seed_version'`
    ).first<{ value: string }>().catch(() => null)
    const stored = row ? Number(row.value) || 0 : 0
    if (stored < BLOG_SEED_VERSION) {
      await syncBlogSeed(DB)
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
  await syncBlogSeed(c.env.DB)
  await c.env.DB.prepare(
    `INSERT INTO blog_meta (key, value) VALUES ('seed_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(String(BLOG_SEED_VERSION)).run().catch(swallow('blog:api:blog'))
  return c.json({ success: true, message: '블로그 시드 동기화 완료', version: BLOG_SEED_VERSION })
})

// ── AI 자동 초안 (홍보 전용) ─────────────────────────────────────
// 아직 다뤄지지 않은 홍보 주제 하나 선택(모두 다뤄졌으면 null).
async function pickPromoTopic(DB: D1Database): Promise<PromoTopic | null> {
  for (const t of PROMO_TOPICS) {
    const exists = await DB.prepare('SELECT 1 FROM blog_posts WHERE slug = ?')
      .bind(t.slug).first().catch(() => null)
    if (!exists) return t
  }
  return null
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
