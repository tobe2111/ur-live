/**
 * 🆕 2026-07-15 소셜 미디어 자동화 — 어드민 라우트(/api/admin/social/*).
 *
 * ⚠️ features/social(팔로우·알림 — 소비자 소셜그래프)과 무관. 여긴 유어딜 "자체 홍보"
 *    자동화(스레드/인스타/유튜브 초안 생성·게시)다. 자동 발행 없음.
 * 🥗 2026-07-15 워커 다이어트: 메인 `_worker.js`(CF Free 1MB) 대신 **ur-ads 독립 워커(3MB)** 에
 *    마운트된다(서비스 분리 + 용량 회복). 메인 adminApp 래퍼 밖이라 requireAdmin 을 **자체 적용**한다
 *    (ur-ads 는 메인과 같은 JWT_SECRET → admin 토큰 검증 동일). 메인은 프록시로 위임만.
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { attachCardImage } from './social-image-render'
import { requireAdmin } from '../../../worker/middleware/auth'
import { SOCIAL_PLATFORMS, isSocialPlatform, PLATFORM_LABEL, PLATFORM_MEDIA } from './social-brief'
import {
  listAccounts, upsertAccount, deleteAccount,
  listPosts, getPost, updatePost, approvePost, archivePost, createPost,
} from './social-store'
import { createSocialDraft } from './social-draft'
import { publishPost, isPlatformEnabled } from './social-publish'
import { generateVideoPlan, startVideoRender, checkVideoRender } from './social-video-flow'
import { videoRenderStatus } from './social-video-render'
import { isSocialAudience, SOCIAL_AUDIENCES, AUDIENCE_LABEL, AUDIENCE_LANDING, INSTAGRAM_BIO_SRC, landingUrl } from './social-audience'
import { loadFunnel } from './social-funnel'

const socialMediaRoutes = new Hono<{ Bindings: Env }>()

// 🔐 자체 어드민 인증 — ur-ads 워커에서 독립 마운트되므로 메인 adminApp 래퍼에 의존하지 않는다.
//    (메인 경유 시에도 프록시가 이 워커로 위임 → 여기서 1회 검증. 같은 JWT_SECRET.)
socialMediaRoutes.use('*', requireAdmin())

// GET /accounts — 연결 계정(토큰 비노출) + 플랫폼별 게이트 상태
socialMediaRoutes.get('/accounts', async (c) => {
  const accounts = await listAccounts(c.env.DB)
  const gates = SOCIAL_PLATFORMS.map((p) => ({ platform: p, label: PLATFORM_LABEL[p], enabled: isPlatformEnabled(c.env, p), mediaRequired: PLATFORM_MEDIA[p] }))
  return c.json({ success: true, accounts, gates, video: videoRenderStatus(c.env) })
})

// POST /accounts — 계정 수동 등록(토큰 암호화 저장)
socialMediaRoutes.post('/accounts', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const platform = String(b.platform || '')
  if (!isSocialPlatform(platform)) return c.json({ success: false, error: '지원하지 않는 플랫폼' }, 400)
  await upsertAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY, {
    platform,
    account_ref: b.account_ref ? String(b.account_ref).slice(0, 200) : undefined,
    display_name: b.display_name ? String(b.display_name).slice(0, 120) : undefined,
    access_token: b.access_token ? String(b.access_token) : undefined,
    refresh_token: b.refresh_token ? String(b.refresh_token) : undefined,
    token_expires_at: b.token_expires_at ? String(b.token_expires_at) : undefined,
    extra: b.extra && typeof b.extra === 'object' ? (b.extra as Record<string, unknown>) : undefined,
  })
  return c.json({ success: true, accounts: await listAccounts(c.env.DB) })
})

// DELETE /accounts/:id
socialMediaRoutes.delete('/accounts/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await deleteAccount(c.env.DB, id)
  return c.json({ success: true, accounts: await listAccounts(c.env.DB) })
})

// GET /posts?platform=&status=
socialMediaRoutes.get('/posts', async (c) => {
  const platform = (c.req.query('platform') || '').trim() || undefined
  const status = (c.req.query('status') || '').trim() || undefined
  return c.json({ success: true, posts: await listPosts(c.env.DB, { platform, status }) })
})

// POST /posts/generate  body: { platform, topicSlug? } — 초안 생성(draft)
//   ✍️ 2026-08-01: ANTHROPIC_API_KEY 게이트 제거. 키가 없으면 createSocialDraft 가 결정론
//   작성기(social-compose)로 만든다 — 키 없다고 버튼이 죽어 있으면 안 된다는 대표 지시.
//   (영상 생성 경로 :137 은 그대로 — 스토리보드는 폴백이 없다.)
socialMediaRoutes.post('/posts/generate', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const platform = String(b.platform || '')
  if (!isSocialPlatform(platform)) return c.json({ success: false, error: '지원하지 않는 플랫폼' }, 400)
  const topicSlug = b.topicSlug ? String(b.topicSlug) : undefined
  // 🎯 2026-10-15 대상(store/creator/consumer). 생략하면 어드민 혼합비(social_audience_mix)로 고른다.
  const audience = isSocialAudience(b.audience) ? b.audience : undefined
  const r = await createSocialDraft(c.env, platform, topicSlug, audience)
  if (!r.ok) return c.json({ success: false, error: r.error, skipped: r.skipped }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, id: r.id, title: r.title, posts: await listPosts(c.env.DB, { platform }) })
})

// GET /funnel — 📈 2026-10-15 공급 모으기 성과: 유입 태그(sns-…)별 랜딩 → 가입 → 매장 등록 → 소개 파트너 신청.
//   게시물과 이어 붙여 "어느 글이 매장을 데려왔나" 를 보여 준다. 읽기 전용.
socialMediaRoutes.get('/funnel', async (c) => {
  const rows = await loadFunnel(c.env.DB)
  const posts = await listPosts(c.env.DB)
  const bySrc = new Map(posts.filter((p) => p.src_tag).map((p) => [p.src_tag as string, p]))
  return c.json({
    success: true,
    rows: rows.map((r) => {
      const p = bySrc.get(r.src)
      return { ...r, post: p ? { id: p.id, platform: p.platform, audience: p.audience, title: p.title, status: p.status, external_url: p.external_url } : null }
    }),
    audiences: SOCIAL_AUDIENCES.map((a) => ({ audience: a, label: AUDIENCE_LABEL[a], landing: AUDIENCE_LANDING[a] })),
    // 인스타 프로필 링크에 걸어 둘 주소(대상별) — 캡션 링크가 안 눌려서 귀속은 이 한 줄로 받는다.
    instagramBioLinks: SOCIAL_AUDIENCES.filter((a) => a !== 'consumer').map((a) => ({ audience: a, url: landingUrl(a, INSTAGRAM_BIO_SRC) })),
  })
})

// POST /posts  body: { platform, title?, body, hashtags?, media_url?, media_kind? } — 수동 초안 작성
socialMediaRoutes.post('/posts', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const platform = String(b.platform || '')
  if (!isSocialPlatform(platform)) return c.json({ success: false, error: '지원하지 않는 플랫폼' }, 400)
  const r = await createPost(c.env.DB, {
    platform,
    title: b.title ? String(b.title).slice(0, 200) : undefined,
    body: String(b.body || ''),
    hashtags: Array.isArray(b.hashtags) ? b.hashtags.map((t: unknown) => String(t)).slice(0, 15) : undefined,
    media_url: b.media_url ? String(b.media_url).slice(0, 1000) : undefined,
    media_kind: (['none', 'image', 'video'].includes(String(b.media_kind)) ? String(b.media_kind) : PLATFORM_MEDIA[platform]) as 'none' | 'image' | 'video',
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, id: r.id, posts: await listPosts(c.env.DB, { platform }) })
})

// PATCH /posts/:id — 초안 편집
socialMediaRoutes.patch('/posts/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const post = await getPost(c.env.DB, id)
  if (!post) return c.json({ success: false, error: '초안을 찾을 수 없습니다' }, 404)
  if (post.status === 'published') return c.json({ success: false, error: '이미 발행된 게시물은 수정할 수 없습니다' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await updatePost(c.env.DB, id, {
    title: b.title !== undefined ? String(b.title).slice(0, 200) : undefined,
    body: b.body !== undefined ? String(b.body) : undefined,
    hashtags: Array.isArray(b.hashtags) ? b.hashtags.map((t: unknown) => String(t)).slice(0, 15) : undefined,
    media_url: b.media_url !== undefined ? String(b.media_url).slice(0, 1000) : undefined,
    media_kind: b.media_kind !== undefined && ['none', 'image', 'video'].includes(String(b.media_kind)) ? String(b.media_kind) : undefined,
    scheduled_at: b.scheduled_at !== undefined ? (b.scheduled_at ? String(b.scheduled_at) : null) : undefined,
  })
  return c.json({ success: true, post: await getPost(c.env.DB, id) })
})

// POST /posts/:id/approve — draft → approved
socialMediaRoutes.post('/posts/:id/approve', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const ok = await approvePost(c.env.DB, id)
  if (!ok) return c.json({ success: false, error: '승인할 수 없습니다(초안 상태가 아님)' }, 400)
  return c.json({ success: true, post: await getPost(c.env.DB, id) })
})

// POST /posts/:id/publish — approved → 실제 게시(게이트 ON + 계정 필요)
socialMediaRoutes.post('/posts/:id/publish', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await publishPost(c.env, id)
  if (!r.ok) return c.json({ success: false, error: r.error, post: await getPost(c.env.DB, id) }, 400)
  return c.json({ success: true, externalId: r.externalId, externalUrl: r.externalUrl, post: await getPost(c.env.DB, id) })
})

// ── 릴스/쇼츠 영상 파이프라인(유튜브 쇼츠 + 인스타 릴스) ──────────────────────
// POST /posts/:id/video-plan — AI 영상 기획(스토리보드/대본) 생성
socialMediaRoutes.post('/posts/:id/video-plan', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await generateVideoPlan(c.env, id)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, storyboard: r.storyboard, post: await getPost(c.env.DB, id) })
})

// POST /posts/:id/render — 스토리보드 → 영상 렌더 제출(게이트 ON + provider 필요)
socialMediaRoutes.post('/posts/:id/render', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await startVideoRender(c.env, id)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, status: r.status, url: r.url, post: await getPost(c.env.DB, id) })
})

// GET /posts/:id/render-status — 렌더 상태 폴링(done 시 media_url 세팅됨)
socialMediaRoutes.get('/posts/:id/render-status', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await checkVideoRender(c.env, id)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, status: r.status, url: r.url, post: await getPost(c.env.DB, id) })
})

// POST /posts/:id/card-image — 🖼️ 2026-10-17 카드 이미지(1080×1350) 생성·교체. 인스타는 이미지 없이 게시 불가.
socialMediaRoutes.post('/posts/:id/card-image', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await attachCardImage(c.env, id)
  if (!r.ok) return c.json({ success: false, error: r.error, post: await getPost(c.env.DB, id) }, 400)
  return c.json({ success: true, url: r.url, post: await getPost(c.env.DB, id) })
})

// DELETE /posts/:id — 보관(archive)
socialMediaRoutes.delete('/posts/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await archivePost(c.env.DB, id)
  return c.json({ success: true })
})

export { socialMediaRoutes }
