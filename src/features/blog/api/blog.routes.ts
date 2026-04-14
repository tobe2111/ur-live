/**
 * Blog Posts API
 * Admin: CRUD for blog posts
 * Public: GET published posts
 */

import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'

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
  // 자동 시드: 글이 없으면 기본 콘텐츠 생성
  const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM blog_posts').first<{ cnt: number }>()
  if (!count || count.cnt === 0) {
    try {
      const seedUrl = new URL(c.req.url)
      seedUrl.pathname = '/api/admin/blog/seed'
      await fetch(seedUrl.toString(), { method: 'POST' }).catch(() => {})
    } catch {}
  }
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 9)
  const tag = c.req.query('tag')
  const offset = (page - 1) * limit

  const where = tag
    ? `WHERE is_published = 1 AND tags LIKE '%${tag.replace(/'/g, "''")}%'`
    : 'WHERE is_published = 1'

  const [posts, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, slug, title, summary, tags, author, thumbnail_url, published_at
      FROM blog_posts ${where}
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM blog_posts ${where}`).first<{ cnt: number }>(),
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

  const existing = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM blog_posts').first<{ cnt: number }>()
  if (existing && existing.cnt > 0) return c.json({ success: true, message: 'already seeded' })

  const posts = [
    {
      slug: 'why-live-commerce',
      title: '라이브 커머스가 대세인 이유 — 셀러가 알아야 할 5가지',
      summary: '왜 인플루언서들이 라이브 커머스로 전환하고 있을까요? 유어딜에서 라이브 판매를 시작해야 하는 이유를 알려드립니다.',
      tags: '["셀러", "라이브커머스", "트렌드"]',
      content: `## 라이브 커머스, 왜 지금인가?

2025년 국내 라이브 커머스 시장은 10조원을 돌파했습니다. 기존 이커머스의 전환율이 2-3%에 불과한 반면, 라이브 커머스는 **10-15%의 전환율**을 기록하고 있습니다.

### 1. 실시간 소통이 신뢰를 만든다

소비자는 셀러와 직접 대화하며 상품을 확인합니다. "이거 진짜 맛있어요?"라고 물으면 바로 답변을 받을 수 있죠. 이 실시간 소통이 구매 결정을 빠르게 만듭니다.

### 2. 공동구매로 최저가 달성

유어딜은 공동구매 시스템을 통해 목표 인원이 모이면 추가 할인을 제공합니다. 소비자는 더 싸게, 셀러는 더 많이 팔 수 있는 윈윈 구조입니다.

### 3. 맛집 식사권이라는 새로운 카테고리

일반 상품뿐 아니라 **맛집 식사권**을 라이브로 판매할 수 있습니다. 인플루언서가 직접 방문한 맛집을 추천하고, 바우처로 판매하는 방식입니다.

### 4. 경매와 타임딜로 긴장감 UP

라이브 방송 중 실시간 경매와 한정 타임딜을 진행할 수 있습니다. 시청자의 참여도와 체류 시간이 극적으로 증가합니다.

### 5. 유어딜은 수수료가 5%뿐

다른 플랫폼은 15-25%의 수수료를 부과하지만, 유어딜은 **라이브 판매 수수료 5%**만 받습니다. 셀러의 수익을 최대화합니다.

---

지금 바로 유어딜에서 셀러로 시작하세요. YouTube 계정만 있으면 됩니다.`,
    },
    {
      slug: 'seller-start-guide',
      title: '유어딜 셀러 시작 가이드 — 가입부터 첫 라이브까지',
      summary: '유어딜에서 셀러로 시작하는 방법을 단계별로 안내합니다. 5분이면 첫 방송 준비 완료!',
      tags: '["셀러", "가이드", "시작하기"]',
      content: `## 유어딜 셀러, 이렇게 시작하세요

### Step 1: 셀러 가입

유어딜 홈페이지에서 "셀러 등록" 버튼을 클릭하세요. 사업자등록번호, 통신판매업 신고번호가 필요합니다.

### Step 2: YouTube 연동

셀러 대시보드에서 YouTube 계정을 연동합니다. Google 로그인 한 번이면 끝입니다. YouTube 채널이 없어도 자동으로 생성됩니다.

### Step 3: 상품 등록

판매할 상품을 등록합니다. 상품명, 가격, 이미지, 재고를 입력하세요. 식사권 상품은 별도 식사권 등록 페이지에서 맛집 정보와 함께 등록합니다.

### Step 4: 방송 시작

"바로 방송" 버튼을 클릭하면 YouTube 방송이 자동 생성됩니다. YouTube Studio에서 "라이브 시작"만 누르면 됩니다.

### Step 5: 판매 & 정산

방송 중 시청자가 구매하면 주문이 자동으로 접수됩니다. 매주 정산이 이루어지며, 수수료는 5%입니다.

---

어렵지 않죠? 지금 바로 시작하세요!`,
    },
    {
      slug: 'meal-voucher-business',
      title: '맛집 식사권 공동구매 — 소상공인과 인플루언서의 만남',
      summary: '인플루언서가 맛집을 추천하고, 소비자가 할인된 가격으로 식사권을 구매하는 새로운 비즈니스 모델.',
      tags: '["맛집", "공동구매", "바우처"]',
      content: `## 맛집 공동구매, 이렇게 작동합니다

### 인플루언서가 맛집을 발굴합니다

인플루언서가 직접 방문한 맛집을 유어딜에서 소개합니다. 실제 경험을 기반으로 한 추천이라 소비자 신뢰도가 높습니다.

### 공동구매로 최대 70% 할인

목표 인원이 모이면 대폭 할인된 가격에 식사권을 구매할 수 있습니다. 맛집 사장님은 마케팅 비용 없이 고객을 확보하고, 소비자는 저렴하게 맛집을 즐깁니다.

### PIN 바우처로 간편 사용

구매한 식사권은 바우처 코드(UR-XXXX-XXXX)로 발급됩니다. 식당에서 코드를 보여주면 끝! POS 연동이 필요 없어 소상공인 부담이 없습니다.

### 맛집 지도에서 탐색

유어딜 맛집 지도에서 바우처 사용 가능 맛집을 한눈에 볼 수 있습니다. 내 주변 맛집을 찾아 바로 구매하세요.

### 수수료는 단 5%

맛집 바우처 수수료는 5%로, 소상공인 우대 정책을 적용하고 있습니다.

---

맛집 사장님, 인플루언서와 함께 매출을 올려보세요!`,
    },
    {
      slug: 'agency-partnership',
      title: '에이전시 파트너십 — 소속 셀러를 한눈에 관리하세요',
      summary: 'MCN/에이전시를 위한 전용 대시보드. 소속 셀러의 매출, 방송, 정산을 통합 관리합니다.',
      tags: '["에이전시", "MCN", "파트너"]',
      content: `## 에이전시 전용 대시보드

유어딜은 MCN, 에이전시, 매니지먼트사를 위한 전용 대시보드를 제공합니다.

### 소속 셀러 통합 관리

- 셀러 목록 한눈에 확인
- 셀러 대신 상품 등록/수정
- 셀러 대신 방송 예약
- 새 셀러 초대 (계정 자동 생성)

### 매출 통합 분석

- 전체/개별 셀러 매출 실시간 확인
- 셀러 성과 랭킹 (매출순, 주문순, 팔로워순)
- 주간/월간 리포트

### 정산 관리

에이전시 소속 셀러의 정산은 에이전시에게 일괄 지급됩니다. 에이전시가 소속 셀러에게 분배하는 구조입니다.

- 에이전시 수수료: 2% (어드민 조정 가능)
- 셀러 수수료: 5%
- 총 수수료: 7%

### 방송 스케줄 & CS 관리

- 소속 셀러의 방송 스케줄을 캘린더로 확인
- 반품/CS 현황 통합 모니터링

---

에이전시 파트너십에 관심이 있다면 jiwon@ur-team.com으로 문의해주세요.`,
    },
    {
      slug: 'live-auction-timedeal',
      title: '라이브 경매 & 타임딜 — 시청자 참여를 극대화하는 방법',
      summary: '라이브 방송 중 실시간 경매와 타임딜을 활용하면 시청자 체류 시간과 구매 전환율이 극적으로 올라갑니다.',
      tags: '["셀러", "경매", "타임딜", "라이브"]',
      content: `## 라이브를 더 재미있게 만드는 두 가지 무기

### 실시간 경매

방송 중 "경매 시작" 버튼 하나로 실시간 입찰이 시작됩니다.

- 시작가를 설정하고 시청자들이 경쟁 입찰
- 실시간 카운트다운 + 최고 입찰자 표시
- 시청자 간 경쟁심리 → 체류 시간 증가
- 낙찰자는 바로 구매 가능

### 타임딜

방송 중 불시에 등장하는 초특가 한정 딜!

- 셀러가 원하는 시점에 "타임딜 시작" 클릭
- 30초~1분 제한 시간 + 수량 한정
- FOMO(놓칠까 봐 두려운) 심리 → 즉시 구매
- 소진되면 자동 종료

### 실제 효과

유어딜 셀러들의 경험에 따르면:
- 경매 진행 시 **시청자 체류 시간 3배 증가**
- 타임딜 진행 시 **구매 전환율 5배 증가**
- 일반 판매 대비 **매출 2배 이상**

### 셀러 대시보드에서 바로 설정

방송 관리 화면에서 상품 선택 → 할인율/시작가 설정 → 버튼 클릭. 별도 설정이 필요 없습니다.

---

다음 라이브에서 경매와 타임딜을 활용해보세요!`,
    },
    {
      slug: 'friend-invite-group-buy',
      title: '친구 초대 공동구매 — 카카오톡으로 친구 모아 추가 할인!',
      summary: '친구를 초대해서 함께 사면 10% 추가 할인! 바이럴 마케팅과 할인을 동시에.',
      tags: '["소비자", "공동구매", "할인"]',
      content: `## 함께 사면 더 싸다!

### 이렇게 작동합니다

1. 마음에 드는 상품을 발견!
2. "공동구매 그룹 만들기" 클릭
3. 카카오톡으로 친구에게 링크 공유
4. 3명이 모이면 **10% 추가 할인** 적용
5. 할인된 가격으로 구매!

### 48시간 내에 모이면 OK

그룹은 48시간 동안 유지됩니다. 실시간 카운트다운이 표시되어 긴급감을 줍니다.

### 셀러에게도 좋은 이유

- 자연스러운 바이럴 마케팅 (셀러 광고비 0원)
- 3명이 한 번에 구매 → 배송 효율 증가
- 신규 고객 유입 → 재구매 가능성

### 소비자에게 좋은 이유

- 혼자 사는 것보다 10% 더 저렴
- 친구와 함께하는 재미
- 모이지 않으면 취소 → 리스크 없음

---

다음 구매 때 친구를 초대해보세요. 함께 사면 더 싸니까!`,
    },
    {
      slug: 'yourdeal-vs-others',
      title: '유어딜 vs 다른 라이브커머스 — 셀러가 유어딜을 선택해야 하는 이유',
      summary: '네이버 쇼핑라이브, 쿠팡라이브와 비교했을 때 유어딜만의 차별점은 무엇인가요?',
      tags: '["셀러", "비교", "수수료"]',
      content: `## 셀러를 위한 플랫폼

### 수수료 비교

| 플랫폼 | 수수료 |
|--------|--------|
| 네이버 쇼핑라이브 | 10-25% + 광고비 |
| 쿠팡 라이브 | 10-15% |
| **유어딜** | **5%** |

### 진입 장벽

- 네이버/쿠팡: 심사 + 계약 + 최소 매출 조건
- **유어딜: 회원가입 즉시 판매 시작**

### 자유도

- 네이버/쿠팡: 플랫폼 규격에 맞춰야 함
- **유어딜: 내 스토어 페이지, 내 브랜딩**

### 맛집 바우처

- 네이버/쿠팡: 없음
- **유어딜: O2O 맛집 바우처 공동구매 가능**

### 후원 시스템

- 네이버/쿠팡: 없음
- **유어딜: 아프리카TV식 후원 (딜 포인트)**

### 셀러 등급제

- 매출/리뷰 기반 자동 승급
- 등급 올라갈수록 수수료 인하 (5% → 4% → 3%)
- 다른 플랫폼으로 이동하면 등급 리셋 → 락인 효과

---

수수료 5%, 진입 장벽 없음, 맛집 바우처. 유어딜이 셀러의 최선입니다.`,
    },
    {
      slug: 'review-reward-system',
      title: '리뷰 쓰면 딜 포인트 지급! — 유어딜 리뷰 리워드 시스템',
      summary: '상품 리뷰를 작성하면 딜 포인트가 지급됩니다. 텍스트 50딜, 사진 100딜, 영상 200딜!',
      tags: '["소비자", "리뷰", "포인트"]',
      content: `## 리뷰 쓰고 포인트 받자!

### 리워드 체계

| 리뷰 유형 | 지급 포인트 |
|-----------|-----------|
| 텍스트 리뷰 | 50딜 |
| 사진 리뷰 | 100딜 |
| 영상 리뷰 | 200딜 |

### 딜 포인트란?

1딜 = 1원입니다. 충전도 가능하고, 상품 구매나 셀러 후원에 사용할 수 있습니다.

### 리뷰 작성 방법

1. 구매한 상품의 상세 페이지 접속
2. "리뷰 작성하기" 클릭
3. 별점 + 텍스트 (선택적으로 사진/영상 첨부)
4. 작성 완료 → 딜 포인트 즉시 지급!

### 셀러에게도 중요한 이유

- 리뷰가 많을수록 상품 신뢰도 증가
- 별점이 높을수록 검색 상위 노출
- 사진/영상 리뷰는 다른 소비자의 구매 결정에 큰 영향

---

지금 구매한 상품에 리뷰를 남겨보세요. 50~200딜이 바로 적립됩니다!`,
    },
  ]

  for (const post of posts) {
    try {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO blog_posts (slug, title, summary, content, tags, author, is_published, published_at)
        VALUES (?, ?, ?, ?, ?, '유어딜 팀', 1, datetime('now'))
      `).bind(post.slug, post.title, post.summary, post.content, post.tags).run()
    } catch {}
  }

  return c.json({ success: true, message: `${posts.length}개 블로그 글 생성 완료` })
})

export { app as blogRoutes }
