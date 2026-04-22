/**
 * Blog Posts API
 * Admin: CRUD for blog posts
 * Public: GET published posts
 */

import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth'

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
// ── 블로그 시드 함수 (재사용) ────────────────────────────────────
async function seedBlogPosts(DB: D1Database) {
  const existing = await DB.prepare('SELECT COUNT(*) as cnt FROM blog_posts').first<{ cnt: number }>()
  if (existing && existing.cnt > 0) return

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
    {
      slug: 'deal-points-guide',
      title: '딜 포인트 완벽 가이드 — 충전부터 사용까지',
      summary: '유어딜의 딜 포인트 시스템을 알아보세요. 1딜 = 1원, 충전·결제·후원 모두 가능합니다.',
      tags: '["소비자", "딜포인트", "충전"]',
      content: `## 딜 포인트란?

유어딜에서 사용하는 포인트 시스템입니다. **1딜 = 1원**으로 동일한 가치를 가집니다.

### 충전 방법

마이페이지에서 "딜 충전" 버튼을 클릭하면 토스페이먼츠를 통해 안전하게 충전할 수 있습니다.

- 최소 충전: 1,000딜
- 결제 수단: 카드, 계좌이체, 간편결제
- 충전 수수료: 없음

### 사용처

- **상품 구매**: 장바구니에서 딜 포인트로 결제
- **셀러 후원**: 라이브 방송 중 셀러에게 후원 (최소 500딜)
- **식사권 구매**: 맛집 바우처 결제

### 적립 방법

- 리뷰 작성: 텍스트 50딜, 사진 100딜, 영상 200딜
- 이벤트 참여: 수시 이벤트 적립

---

딜 포인트로 더 스마트하게 쇼핑하세요!`,
    },
    {
      slug: 'seller-settlement-guide',
      title: '셀러 정산 가이드 — 매출부터 입금까지',
      summary: '유어딜 셀러의 정산 프로세스를 상세히 안내합니다. 수수료 5%, 투명한 정산.',
      tags: '["셀러", "정산", "수수료"]',
      content: `## 정산은 이렇게 이루어집니다

### 정산 주기

구매확정 후 7일 이내에 정산이 처리됩니다. 배송 완료 14일 후에는 자동으로 구매확정됩니다.

### 수수료 구조

| 항목 | 비율 |
|------|------|
| 개인 셀러 수수료 | 5% |
| 에이전시 소속 셀러 | 7% (5% + 에이전시 2%) |

### 정산 확인

셀러 대시보드 → 정산 관리에서 실시간으로 확인할 수 있습니다.

- 정산 대기: 구매확정 전
- 정산 가능: 구매확정 완료
- 정산 완료: 입금 처리됨

### 후원 수익 정산

라이브 방송 중 받은 후원금도 동일하게 정산됩니다. 후원 접수 10일 후부터 정산 요청이 가능합니다.

---

투명한 수수료, 빠른 정산. 유어딜 셀러의 수익을 보장합니다.`,
    },
    {
      slug: 'live-broadcast-tips',
      title: '라이브 방송 잘하는 법 — 매출 올리는 10가지 팁',
      summary: '유어딜에서 라이브 커머스 매출을 극대화하는 실전 노하우를 공유합니다.',
      tags: '["셀러", "라이브", "팁", "매출"]',
      content: `## 매출 올리는 라이브 방송 노하우

### 1. 방송 시간대를 정하세요

평일 저녁 7-9시, 주말 오후 2-5시가 가장 시청률이 높습니다.

### 2. 방송 전 SNS로 예고하세요

인스타그램, 카카오톡 채널로 방송 예고를 하면 시청자가 2배 이상 늘어납니다.

### 3. 첫 10분이 승부입니다

시청자는 첫 10분 내에 이탈합니다. 가장 매력적인 상품을 먼저 소개하세요.

### 4. 채팅에 적극 반응하세요

시청자 질문에 바로 답변하면 신뢰감이 생깁니다. 닉네임을 불러주면 더 좋습니다.

### 5. 타임딜을 활용하세요

방송 중간에 깜짝 타임딜을 걸면 이탈률이 급감합니다.

### 6. 경매로 마무리하세요

방송 마지막에 경매를 진행하면 끝까지 시청하는 비율이 높아집니다.

### 7. 조명과 음향에 신경 쓰세요

밝은 조명과 깨끗한 마이크만으로도 전문적인 느낌을 줄 수 있습니다.

### 8. 상품을 직접 사용해 보여주세요

먹방, 착용샷, 사용 후기를 라이브로 보여주면 구매 전환이 높습니다.

### 9. 정기 방송으로 팬을 만드세요

매주 같은 시간에 방송하면 고정 시청자가 생깁니다.

### 10. 방송 후 하이라이트를 공유하세요

방송 끝난 후 쇼츠로 하이라이트를 올리면 새로운 팔로워가 유입됩니다.

---

지금 바로 라이브를 시작하고 이 팁들을 적용해보세요!`,
    },
    {
      slug: 'consumer-shopping-guide',
      title: '유어딜 쇼핑 가이드 — 처음 사용자를 위한 안내서',
      summary: '유어딜에서 쇼핑하는 방법을 A부터 Z까지 안내합니다. 가입부터 배송까지 쉽고 빠르게!',
      tags: '["소비자", "가이드", "쇼핑"]',
      content: `## 유어딜 쇼핑, 이렇게 시작하세요

### 1. 카카오 로그인으로 간편 가입

별도 회원가입 없이 카카오 계정으로 바로 시작할 수 있습니다.

### 2. 라이브 방송에서 쇼핑

메인 화면에서 진행 중인 라이브 방송에 참여하세요. 셀러와 실시간 소통하며 상품을 확인할 수 있습니다.

### 3. 쇼핑탭에서 검색

원하는 상품을 검색하거나 카테고리별로 탐색할 수 있습니다.

### 4. 장바구니에 담기

마음에 드는 상품을 장바구니에 담고 한번에 결제하세요. 같은 셀러 상품은 묶음 배송으로 배송비를 절약합니다.

### 5. 토스페이먼츠로 안전 결제

카드, 계좌이체, 간편결제 모두 가능합니다. 토스페이먼츠의 보안 시스템으로 안전하게 결제됩니다.

### 6. 배송 추적

주문 내역에서 실시간 배송 상태를 확인할 수 있습니다. 택배사별 직접 조회 링크도 제공됩니다.

### 7. 쿠폰 & 딜 포인트 활용

결제 시 쿠폰을 적용하거나 딜 포인트를 사용하여 할인받을 수 있습니다.

---

유어딜에서 새로운 쇼핑 경험을 시작하세요!`,
    },
    {
      slug: 'seller-tier-system',
      title: '셀러 등급제 — 매출 올릴수록 수수료가 내려갑니다',
      summary: '유어딜 셀러 등급 시스템을 소개합니다. Bronze부터 Diamond까지, 등급이 올라가면 수수료가 인하됩니다.',
      tags: '["셀러", "등급", "수수료"]',
      content: `## 셀러 등급에 따라 혜택이 달라집니다

### 등급 체계

| 등급 | 조건 | 수수료 |
|------|------|--------|
| Bronze | 가입 즉시 | 5% |
| Silver | 월 매출 100만원 이상 | 4.5% |
| Gold | 월 매출 500만원 이상 | 4% |
| Platinum | 월 매출 1,000만원 이상 | 3.5% |
| Diamond | 월 매출 3,000만원 이상 | 3% |

### 자동 승급

매월 1일에 전월 실적을 기반으로 자동 평가됩니다. 별도 신청이 필요 없습니다.

### 추가 혜택

- Gold 이상: 메인 페이지 추천 셀러 노출
- Platinum 이상: 전용 CS 매니저 배정
- Diamond: 브랜드 스토어 페이지 커스텀 디자인

---

성장하는 셀러를 위한 공정한 보상 시스템, 유어딜 등급제입니다.`,
    },
    {
      slug: 'supporter-ranking-system',
      title: '서포터 랭킹 시스템 — 응원하면 뱃지가 생겨요',
      summary: '라이브 방송에서 셀러를 후원하면 서포터 랭킹에 올라갑니다. 팬과 셀러의 유대감을 높이는 시스템.',
      tags: '["소비자", "후원", "서포터"]',
      content: `## 좋아하는 셀러를 응원하세요

### 서포터 뱃지

라이브 방송 중 딜 포인트로 후원하면 누적 금액에 따라 뱃지를 받습니다.

- 👑 크라운: 해당 셀러 1위 서포터
- 💎 다이아: 상위 3위 서포터
- ⭐ 스타: 상위 10위 서포터

### 셀러 프로필에 노출

셀러의 프로필 페이지에서 상위 서포터가 공개됩니다. 내가 응원하는 셀러의 탑 서포터가 되어보세요.

### 후원 사용 방법

라이브 방송 시청 중 "후원" 버튼을 누르고 금액을 선택하면 됩니다. 최소 500딜부터 가능합니다.

### 셀러에게 가는 금액

후원금의 85%가 셀러에게 전달됩니다 (플랫폼 수수료 15%).

---

좋아하는 셀러를 응원하고 서포터 뱃지를 모아보세요!`,
    },
    {
      slug: 'voucher-how-to-use',
      title: '식사권 바우처 사용 방법 — PIN 코드로 간편하게',
      summary: '유어딜에서 구매한 식사권 바우처를 사용하는 방법을 안내합니다. 매장에서 PIN 코드만 보여주세요.',
      tags: '["소비자", "식사권", "바우처"]',
      content: `## 식사권 바우처 사용 가이드

### 구매 후 바우처 확인

식사권을 구매하면 "내 주문" 페이지에서 바우처 코드(UR-XXXX-XXXX)를 확인할 수 있습니다.

### 사용 방법

1. 바우처에 표시된 맛집을 방문합니다
2. 주문 후 계산 시 바우처 코드를 보여줍니다
3. 매장에서 코드를 확인하면 결제 완료!

### 유효기간

구매일로부터 3개월이 기본 유효기간입니다. 만료 7일 전에 알림을 보내드립니다.

### 잔액 처리

바우처 금액보다 적게 사용하면 잔액이 유지됩니다. 바우처 금액을 초과하면 차액만 현장 결제합니다.

### 맛집 지도에서 찾기

유어딜 맛집 지도에서 바우처 사용 가능 매장을 확인할 수 있습니다. 내 위치 기반으로 가까운 맛집을 찾아보세요.

---

식사권으로 맛집을 더 저렴하게 즐기세요!`,
    },
    {
      slug: 'influencer-live-commerce',
      title: '인플루언서를 위한 라이브 커머스 시작 가이드',
      summary: '팔로워가 있다면 라이브 커머스로 수익을 만들 수 있습니다. 인플루언서가 유어딜에서 시작하는 방법.',
      tags: '["셀러", "인플루언서", "시작하기"]',
      content: `## 인플루언서, 라이브 커머스를 시작해야 하는 이유

### 광고보다 높은 수익

협찬 1회로 끝나는 광고 대비, 라이브 커머스는 판매할 때마다 수익이 발생합니다.

### 팬과의 직접 소통

댓글이 아닌 실시간 대화로 팬과 교류할 수 있습니다. 이 경험이 팬 충성도를 높입니다.

### 유어딜에서 시작이 쉬운 이유

- 사업자등록증만 있으면 즉시 시작
- YouTube 계정 연동으로 별도 장비 불필요
- 수수료 5%로 수익 극대화
- 셀러 대시보드에서 상품 등록부터 정산까지 원스톱

### 맛집 인플루언서라면?

맛집 탐방 콘텐츠를 만들고 계신다면, 해당 맛집의 식사권을 라이브로 판매할 수 있습니다. 맛집 사장님과 협업하여 공동구매를 진행하세요.

### 에이전시 소속이라면?

유어딜은 MCN/에이전시 전용 대시보드를 제공합니다. 소속사를 통해 가입하면 관리가 더 편합니다.

---

팔로워를 매출로 전환하세요. 유어딜에서 시작하세요!`,
    },
    {
      slug: 'group-buy-success-tips',
      title: '공동구매 성공하는 법 — 목표 인원 빠르게 모으는 전략',
      summary: '유어딜 공동구매에서 목표 인원을 빠르게 채우는 방법과 성공 사례를 소개합니다.',
      tags: '["셀러", "공동구매", "전략"]',
      content: `## 공동구매, 이렇게 하면 성공합니다

### 적정 목표 인원 설정

너무 높으면 달성이 어렵고, 너무 낮으면 할인 효과가 약합니다. 10-30명이 최적입니다.

### 할인율은 최소 15% 이상

소비자가 공동구매에 참여하는 이유는 할인입니다. 최소 15% 이상 할인해야 참여 동기가 생깁니다.

### 마감 기한을 짧게

48시간 내 마감으로 긴급감을 주세요. 기한이 길면 "나중에 하지" 심리가 작동합니다.

### 라이브 방송과 연계

라이브 방송 중 공동구매를 시작하면 즉시 참여자가 모입니다. 방송 중에 실시간 참여 현황을 공유하세요.

### SNS 공유를 유도하세요

"친구와 함께 사면 추가 할인" 기능을 활용하세요. 참여자가 자연스럽게 바이럴을 만듭니다.

---

다음 공동구매에서 이 전략들을 적용해보세요!`,
    },
    {
      slug: 'safe-payment-system',
      title: '유어딜 안전 결제 시스템 — 토스페이먼츠 연동',
      summary: '유어딜은 토스페이먼츠와 연동하여 안전하고 편리한 결제를 제공합니다.',
      tags: '["소비자", "결제", "안전"]',
      content: `## 안전한 결제, 유어딜이 보장합니다

### 토스페이먼츠 연동

국내 대표 PG사인 토스페이먼츠와 연동하여 결제 보안을 보장합니다.

### 다양한 결제 수단

- 신용카드 / 체크카드
- 계좌이체
- 토스페이, 카카오페이, 네이버페이 등 간편결제
- 딜 포인트 결제

### 환불 정책

- 결제 취소: 배송 전 언제든 가능
- 반품: 수령 후 7일 이내 신청 가능
- 환불 처리: 취소 즉시 ~ 3영업일 이내

### 개인정보 보호

결제 정보는 토스페이먼츠 서버에서 암호화 처리됩니다. 유어딜 서버에는 카드 번호가 저장되지 않습니다.

---

안심하고 결제하세요. 유어딜이 책임집니다.`,
    },
    {
      slug: 'restaurant-map-guide',
      title: '맛집 지도 활용법 — 내 주변 맛집 바우처 찾기',
      summary: '유어딜 맛집 지도에서 바우처 사용 가능 맛집을 찾고, 할인된 가격으로 식사를 즐기세요.',
      tags: '["소비자", "맛집", "지도"]',
      content: `## 유어딜 맛집 지도

### 내 위치 기반 탐색

맛집 지도 페이지에서 내 위치를 기반으로 주변 바우처 사용 가능 맛집을 찾을 수 있습니다.

### 카테고리별 필터

한식, 중식, 일식, 양식, 카페 등 카테고리별로 필터링하여 원하는 맛집을 찾으세요.

### 실시간 공동구매 확인

현재 진행 중인 맛집 공동구매를 지도에서 바로 확인할 수 있습니다. 참여 인원과 할인율이 표시됩니다.

### 맛집 사장님이라면?

유어딜에 맛집을 등록하고 인플루언서와 협업하세요.

- 마케팅 비용 없이 고객 유치
- 인플루언서가 직접 추천
- 공동구매로 단체 고객 확보

---

지금 맛집 지도에서 가까운 맛집을 찾아보세요!`,
    },
    {
      slug: 'shorts-content-strategy',
      title: '쇼츠 콘텐츠 전략 — 짧은 영상으로 팔로워 늘리기',
      summary: '유어딜 쇼츠에서 짧은 영상으로 상품을 홍보하고 팔로워를 늘리는 방법을 소개합니다.',
      tags: '["셀러", "쇼츠", "마케팅"]',
      content: `## 쇼츠로 팔로워를 늘리세요

### 쇼츠란?

60초 이내의 짧은 세로 영상입니다. 라이브 방송 하이라이트나 상품 소개를 쇼츠로 올릴 수 있습니다.

### 효과적인 쇼츠 만들기

- 처음 3초에 가장 임팩트 있는 장면을 넣으세요
- 자막을 반드시 넣으세요 (소리 없이 보는 사용자가 많습니다)
- 상품의 핵심 장점을 1가지만 강조하세요
- 가격/할인 정보를 눈에 띄게 표시하세요

### 라이브 방송 하이라이트 활용

라이브 방송 중 가장 반응이 좋았던 순간을 잘라서 쇼츠로 만드세요. 이미 검증된 콘텐츠이므로 성과가 좋습니다.

### 쇼츠 → 라이브 연결

쇼츠를 보고 관심을 가진 시청자가 다음 라이브 방송에 참여합니다. 쇼츠는 라이브의 예고편 역할을 합니다.

---

지금 첫 쇼츠를 올려보세요!`,
    },
  ]

  for (const post of posts) {
    try {
      await DB.prepare(`
        INSERT OR IGNORE INTO blog_posts (slug, title, summary, content, tags, author, is_published, published_at)
        VALUES (?, ?, ?, ?, ?, '유어딜 팀', 1, datetime('now'))
      `).bind(post.slug, post.title, post.summary, post.content, post.tags).run()
    } catch {}
  }
}

app.post('/seed', async (c) => {
  await ensureBlogTable(c.env.DB)
  await seedBlogPosts(c.env.DB)
  return c.json({ success: true, message: '블로그 글 생성 완료' })
})

export { app as blogRoutes }
