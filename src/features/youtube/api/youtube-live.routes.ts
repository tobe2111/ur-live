/**
 * 🛡️ 2026-04-28 TD-006 (split): YouTube Live 관리 API (5 endpoints)
 *
 * 원본: youtube.routes.ts (467-925).
 *
 * - POST   /live/create                    — YouTube live 생성 + RTMP key 저장
 * - POST   /live/:id/start                 — 라이브 시작 (transition + scheduled→live)
 * - GET    /live/:id/status                — 라이브 상태 조회
 * - GET    /live/:id/youtube-stats         — YouTube 측 시청자/조회 수
 * - POST   /live/:id/end                   — 라이브 종료 (live→complete + 종료 메타)
 *
 * 마운트: app.route('/api/youtube/live', youtubeLiveRoutes) — 또는 동일 prefix.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { swallow } from '@/worker/utils/swallow'
import { YouTubeAPIService } from '../services/youtube-api.service'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { ensureYouTubeTables, getValidAccessToken } from './youtube.routes'
import { registerOmePush, stopOmePush, cleanupAllOmePushes, terminateOmeStream } from './ome-push'
import { trackQuota, getQuotaUsage, QUOTA_COST } from './youtube-quota'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { cacheInvalidate } from '@/worker/utils/cache'

const app = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-12: 서브라우터 cors() 제거 — index.ts 전역 cors() 가 처리. 중복 제거.

// YouTube API 상태 조회 서버사이드 캐시 (25s TTL) — API quota 절감
// 셀러 10명 방송 시: 5s polling → 최대 2 API calls/5s (캐시 미스 시) vs 기존 10 calls/5s
const statusCache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL: Record<string, number> = {
  status: 25_000,   // /status 폴링: 25s (라이브 감지 지연 허용)
  'yt-stats': 60_000, // youtube-stats: 60s (ConnectionQualityGauge 8s → 실제 API 1/8)
}
function getCachedStatus(key: string) {
  const entry = statusCache.get(key)
  const prefix = key.split(':')[0]
  const ttl = CACHE_TTL[prefix] ?? 25_000
  if (entry && Date.now() - entry.ts < ttl) return entry.data
  return null
}
function setCachedStatus(key: string, data: unknown) {
  statusCache.set(key, { data, ts: Date.now() })
  // 메모리 누수 방지: 100개 초과 시 오래된 항목 정리
  if (statusCache.size > 100) {
    const oldest = [...statusCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    if (oldest) statusCache.delete(oldest[0])
  }
}

// 🛡️ 2026-05-12: handler 를 named export 로 추출 — worker/index.ts 가 top-level 에
//   직접 등록할 수 있도록. Hono v4 에서 같은 prefix 의 다중 sub-router 마운트 시
//   POST /live/create 가 405 반환되는 문제 우회 (top-level 등록은 sub-router 분쟁 없음).
import type { Context } from 'hono'
type LiveCreateCtx = Context<{ Bindings: Env }>
export async function createLiveBroadcastHandler(c: LiveCreateCtx) {
  await ensureYouTubeTables(c.env.DB)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)

  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const { title, description, thumbnail_url, product_ids, scheduled_start_time, privacy_status, channel_id, frame_rate: bodyFrameRate } = await c.req.json()
  // 🛡️ 2026-05-13: frame_rate — '30fps' (기본) / '60fps' (패션/뷰티) / 'variable'.
  //   sanitize: 허용값만, 기본 30fps.
  const frameRate: '30fps' | '60fps' | 'variable' =
    bodyFrameRate === '60fps' ? '60fps' : bodyFrameRate === 'variable' ? 'variable' : '30fps'

  if (!title) {
    return c.json({
      success: false,
      error: 'Title is required'
    }, 400)
  }

  if (scheduled_start_time) {
    const scheduledMs = new Date(scheduled_start_time).getTime()
    if (isNaN(scheduledMs) || scheduledMs < Date.now() - 60_000) {
      return c.json({ success: false, error: '예약 시간이 과거입니다. 미래 시간으로 설정해주세요.' }, 400)
    }
  }

  // 🛡️ 2026-05-13: 진행 중 LIVE 방송이 있으면 새 broadcast 생성 차단.
  //   사고: setupLiveStreamWithPersistentStream 내부의 endActiveBroadcastsForStream 이
  //         persistent stream 에 묶인 모든 broadcast 를 강제 complete 처리 → 시청자가 보고 있던
  //         LIVE 가 일방적으로 종료. (셀러 의도와 무관, "자동 종료" 사고의 핵심 원인)
  //   해결: 같은 셀러의 status='live' DB 레코드가 있으면 새 방송 만들기 거부 + 안내.
  const existingLive = await c.env.DB.prepare(`
    SELECT id, title FROM live_streams
    WHERE seller_id = ? AND status = 'live'
    ORDER BY created_at DESC LIMIT 1
  `).bind(sellerId).first<{ id: number; title: string }>()
  if (existingLive) {
    return c.json({
      success: false,
      error: `진행 중인 방송 "${existingLive.title}" 이 있어 새 방송을 만들 수 없습니다. 먼저 종료해주세요.`,
      error_code: 'EXISTING_LIVE_BROADCAST',
      existing_stream_id: existingLive.id,
    }, 409)
  }

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  // 🛡️ 2026-05-13: quota 사전 검사 — 95%+ 시 새 방송 생성 차단 (이미 quota 부족할 가능성 큼).
  //   사고: 라이브 시작 직전 quota 초과 → broadcast 생성 실패 → 셀러 혼란.
  //   조치: 사전 차단 + 명확한 대기 안내.
  try {
    const { getQuotaUsage } = await import('./youtube-quota')
    const quotaUsage = await getQuotaUsage(c.env as Env)
    if (quotaUsage.warning === 'critical') {
      // PST 자정 = KST 17:00 다음날 (UTC 08:00)
      const nowUtcHour = new Date().getUTCHours()
      const hoursUntilReset = nowUtcHour < 8 ? 8 - nowUtcHour : 32 - nowUtcHour
      return c.json({
        success: false,
        error: `오늘 YouTube API 사용량이 ${Math.floor(quotaUsage.ratio * 100)}% 도달했어요. 약 ${hoursUntilReset}시간 후 자동 리셋됩니다.`,
        error_code: 'YOUTUBE_QUOTA_NEAR_LIMIT',
        hours_until_reset: hoursUntilReset,
        quota_ratio: quotaUsage.ratio,
      }, 503)
    }
  } catch { /* quota 조회 실패해도 진행 (best-effort) */ }

  // 🛡️ 2026-05-13: 셀러별 일일 생성 한도 — 1명이 quota 다 잡아먹지 못하게.
  //   🛡️ 2026-05-14 (사용자 요청): 한도 비활성. 테스트 + 정상 운영 양쪽에서 5회 너무 빡빡.
  //     YouTube 일일 quota 10,000 자체가 큰 제한이라 추가 셀러별 cap 불필요.
  //     다시 켜고 싶으면 SELLER_DAILY_LIMIT 값 + 아래 if 블록 복원.
  /*
  try {
    const today = new Date().toISOString().slice(0, 10)
    const sellerKey = `live_create_count:${sellerId}:${today}`
    const kv = (c.env as { SESSION_KV?: KVNamespace }).SESSION_KV
    if (kv) {
      const raw = await kv.get(sellerKey)
      const count = raw ? parseInt(raw, 10) : 0
      const SELLER_DAILY_LIMIT = 5
      if (count >= SELLER_DAILY_LIMIT) {
        return c.json({
          success: false,
          error: `오늘 라이브 방송 생성 한도 (${SELLER_DAILY_LIMIT}회) 를 초과했어요. 내일 다시 시도해주세요.`,
          error_code: 'SELLER_DAILY_LIMIT',
          daily_limit: SELLER_DAILY_LIMIT,
          current_count: count,
        }, 429)
      }
    }
  } catch { /* skip */ /*}
  */

  const privacyStatus: 'public' | 'unlisted' | 'private' =
    privacy_status === 'unlisted' || privacy_status === 'private' ? privacy_status : 'public'

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)

    // Get valid access token (channel_id로 특정 채널 지정 가능)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService, channel_id)

    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube authentication required',
        error_code: 'YOUTUBE_AUTH_REQUIRED'
      }, 401)
    }

    // Create YouTube live setup
    // 🛡️ 2026-05-13: "바로 시작" 의 scheduledStartTime 처리 영구 수정.
    //   기존 코드는 항상 +5분 future 로 강제 → YouTube Studio 가 "예약된 라이브" 로 표시 →
    //   셀러가 "바로 시작" 눌렀는데 YouTube 측 예약으로 잡힘 사고 반복.
    //
    //   YouTube API 동작: enableAutoStart=true 면 RTMP 데이터 인입 즉시 ready→live 전환.
    //     - scheduledStartTime 이 미래 → autoStart 가 그 시각까지 대기 (예약 동작)
    //     - scheduledStartTime 이 현재/과거 → autoStart 가 RTMP 인입 즉시 전환 (즉시 시작 동작)
    //   따라서 "바로 시작" 은 scheduledStartTime = NOW (또는 30초 future) 로 보내야 함.
    //
    //   판정: 클라이언트가 보낸 시각이 (NOW + 2분) 보다 미래면 "예약 방송", 아니면 "바로 시작".
    //   - 바로 시작: NOW + 30s (YouTube 가 안전하게 받아들이는 최소 future margin)
    //   - 예약 방송: 클라이언트 시각 그대로
    const TWO_MIN = 2 * 60 * 1000
    const SHORT_BUFFER_MS = 30 * 1000
    const providedMs = scheduled_start_time ? new Date(scheduled_start_time).getTime() : 0
    const isExplicitlyScheduled = providedMs > Date.now() + TWO_MIN
    const scheduledTime = isExplicitlyScheduled
      ? scheduled_start_time!
      : new Date(Date.now() + SHORT_BUFFER_MS).toISOString()

    // Check if seller has a persistent stream key (OBS/Prism set once)
    const sellerAuth = channel_id
      ? await c.env.DB.prepare(`
          SELECT default_stream_id, default_rtmp_url, default_rtmp_key
          FROM seller_youtube_oauth
          WHERE seller_id = ? AND id = ? AND is_active = 1
          LIMIT 1
        `).bind(sellerId, channel_id).first() as any
      : await c.env.DB.prepare(`
          SELECT default_stream_id, default_rtmp_url, default_rtmp_key
          FROM seller_youtube_oauth
          WHERE seller_id = ? AND is_active = 1
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(sellerId).first() as any

    // 🛡️ 2026-05-13: env YOUTUBE_USE_WEBRTC_INGEST=true 면 webrtc ingestion 시도.
    //   🛡️ 2026-05-14: YouTube Data API v3 가 `cdn.ingestionType='webrtc'` 거부 확인됨
    //     ("Invalid value for ingestion type"). YouTube Studio UI 내부 전용이고 API 미노출.
    //     → env 가 true 여도 무조건 'rtmp' 로 fallback. webrtc 분기는 YouTube 가 API 열 때 활성.
    const useWebRTC = false  // 보존된 분기 — YouTube API 가 webrtc ingestion 열면 env 다시 사용
    void (c.env as { YOUTUBE_USE_WEBRTC_INGEST?: string }).YOUTUBE_USE_WEBRTC_INGEST

    let liveSetup
    if (sellerAuth?.default_stream_id && !useWebRTC) {
      // 🛡️ 2026-05-13 v3 (perf): 캐시된 RTMP info 전달 → getStream() 호출 1회 절약 (-300~500ms).
      //   bind 실패 시 setupLiveStreamWithPersistentStream 내부에서 fresh fetch fallback.
      //   useWebRTC=true 면 persistent 무시하고 항상 새 webrtc stream 생성.
      const cachedRtmp = (sellerAuth.default_rtmp_url && sellerAuth.default_rtmp_key)
        ? { rtmpUrl: sellerAuth.default_rtmp_url, rtmpKey: sellerAuth.default_rtmp_key }
        : undefined
      liveSetup = await youtubeService.setupLiveStreamWithPersistentStream(
        accessToken,
        title,
        description || '',
        sellerAuth.default_stream_id,
        scheduledTime,
        privacyStatus,
        cachedRtmp
      )
    } else {
      // First time / no persistent stream / useWebRTC=true → 새 stream 생성
      liveSetup = await youtubeService.setupLiveStream(
        accessToken,
        title,
        description || '',
        scheduledTime,
        privacyStatus,
        frameRate,
        useWebRTC ? 'webrtc' : 'rtmp'
      )
      // 🛡️ 2026-05-11 P3-#10: setupLiveStream = liveBroadcasts.insert(50) + liveStreams.insert(50) + bind(50) = 150
      await trackQuota(c.env, QUOTA_COST.insert * 3, 'setup_live_stream', c.executionCtx)

      // Save as persistent stream for the specific channel (or active default)
      if (channel_id) {
        await c.env.DB.prepare(`
          UPDATE seller_youtube_oauth
          SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
          WHERE seller_id = ? AND id = ? AND is_active = 1
        `).bind(liveSetup.stream.id, liveSetup.rtmpUrl, liveSetup.rtmpKey, sellerId, channel_id).run()
      } else {
        await c.env.DB.prepare(`
          UPDATE seller_youtube_oauth
          SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
          WHERE seller_id = ? AND is_active = 1
        `).bind(liveSetup.stream.id, liveSetup.rtmpUrl, liveSetup.rtmpKey, sellerId).run()
      }
    }

    // Save to database
    // 🛡️ 2026-05-10: 셀러 업로드 썸네일은 custom_thumbnail_url 에 별도 저장 (YouTube 자동 썸네일이 thumbnail_url 덮어쓰기 후에도 보존)
    // 🛡️ 2026-05-13: whip_url — webrtc ingestion 시 YouTube 가 반환하는 WHIP endpoint URL.
    //   rtmp ingestion 이면 NULL. BrowserBroadcaster 가 우선 시도 → 없으면 OME fallback.
    const cdnIngestionType = (liveSetup.stream as { cdn?: { ingestionType?: string } }).cdn?.ingestionType
    const whipUrl = cdnIngestionType === 'webrtc' ? liveSetup.stream.ingestionInfo.ingestionAddress : null
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status, thumbnail_url, custom_thumbnail_url,
        youtube_video_id, youtube_broadcast_id, youtube_stream_key, youtube_live_chat_id,
        rtmp_url, rtmp_key, youtube_embed_url, whip_url,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      sellerId,
      title,
      description || '',
      'scheduled',
      thumbnail_url || null,
      thumbnail_url || null,
      liveSetup.broadcast.id,
      liveSetup.broadcast.id,
      liveSetup.stream.ingestionInfo.streamName,
      liveSetup.broadcast.liveChatId || null,
      liveSetup.rtmpUrl,
      liveSetup.rtmpKey,
      liveSetup.embedUrl,
      whipUrl,
      scheduledTime
    ).run().catch(async (e) => {
      // whip_url 컬럼 없는 경우 (repair-schema 미실행) — fallback INSERT
      console.warn('[create-broadcast] whip_url column missing, fallback INSERT', e)
      return c.env.DB.prepare(`
        INSERT INTO live_streams (
          seller_id, title, description, status, thumbnail_url, custom_thumbnail_url,
          youtube_video_id, youtube_broadcast_id, youtube_stream_key, youtube_live_chat_id,
          rtmp_url, rtmp_key, youtube_embed_url,
          scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        sellerId, title, description || '', 'scheduled', thumbnail_url || null, thumbnail_url || null,
        liveSetup.broadcast.id, liveSetup.broadcast.id, liveSetup.stream.ingestionInfo.streamName,
        liveSetup.broadcast.liveChatId || null, liveSetup.rtmpUrl, liveSetup.rtmpKey, liveSetup.embedUrl, scheduledTime
      ).run()
    })

    const streamId = streamResult.meta.last_row_id

    // Link products + 첫 상품 이미지를 방송 썸네일로 설정
    // 🛡️ 2026-05-13: 셀러 일일 생성 카운터 증가 (성공 후, KV 26h TTL)
    // 🛡️ 2026-05-14 (사용자 요청): 한도 비활성 — 증가 로직도 같이 비활성 + 기존 키 삭제.
    try {
      const today = new Date().toISOString().slice(0, 10)
      const sellerKey = `live_create_count:${sellerId}:${today}`
      const kv = (c.env as { SESSION_KV?: KVNamespace }).SESSION_KV
      if (kv) {
        await kv.delete(sellerKey).catch(() => { /* ignore */ })
      }
    } catch { /* best-effort */ }

    if (product_ids && product_ids.length > 0) {
      for (const productId of product_ids) {
        await c.env.DB.prepare(`
          INSERT INTO stream_products (stream_id, product_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(streamId, productId).run()
      }

      // 첫 번째 상품 이미지 → 방송 썸네일 + current_product_id 설정
      try {
        const firstProduct = await c.env.DB.prepare(
          'SELECT id, image_url FROM products WHERE id = ?'
        ).bind(product_ids[0]).first<{ id: number; image_url: string }>()

        if (firstProduct?.image_url) {
          await c.env.DB.prepare(
            "UPDATE live_streams SET thumbnail_url = ?, current_product_id = ? WHERE id = ?"
          ).bind(firstProduct.image_url, firstProduct.id, streamId).run()
        }
      } catch { /* thumbnail 컬럼 없을 수 있음 */ }
    }

    // 🛡️ 2026-05-11 refactor: 사전 push 등록 + snippet 동기화 (한 번만, /create 시점).
    //   기존: admission webhook 마다 lazy startPush + 60s polling.
    //   현재: create 시점 eager 등록 → RTMP 인입 즉시 fan-out + 폴링 제거.
    //
    //   broadcast.id 가 곧 video_id 이므로 위 INSERT 에서 이미 youtube_video_id 가 저장됨.
    //   admission 은 그저 token 검증 + status='live' 업데이트만 담당.
    const ctx = c.executionCtx
    const accessTokenForBg = accessToken
    const rtmpUrlForPush = liveSetup.rtmpUrl
    const rtmpKeyForPush = liveSetup.rtmpKey
    const broadcastIdForSync = liveSetup.broadcast.id
    const bgWork = async () => {
      // 🛡️ 2026-05-11: /create 시점 OME push 등록 제거 — admission 만 권위 있는 등록 시점.
      //   이유: /create 와 admission 이 race 하면서 둘 다 Duplicate ID 충돌 → 영구 실패.
      //   admission 의 stopPush-first 가 clean state 를 보장.
      // 2) snippet 동기화 — description (셀러 페이지/다시보기 링크) + categoryId(22) + 커스텀 썸네일
      try {
        const sellerRow = await c.env.DB.prepare(
          `SELECT name, username FROM sellers WHERE id = ?`
        ).bind(sellerId).first<{ name?: string; username?: string }>()
        const sellerSlug = sellerRow?.username || String(sellerId)
        const fullDescription = [
          title,
          '',
          `📺 ${sellerRow?.name || '셀러'}의 라이브 쇼핑`,
          `🛍️ 셀러 페이지: https://live.ur-team.com/profile/${sellerSlug}`,
          `🎬 다시보기: https://live.ur-team.com/live/${streamId}`,
          '',
          '함께 라이브 쇼핑을 즐겨보세요!',
          '',
          '#유어딜 #유어딜라이브 #라이브커머스',
        ].join('\n')
        await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessTokenForBg}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: broadcastIdForSync,
            snippet: {
              title,
              scheduledStartTime: scheduledTime,
              description: fullDescription,
              categoryId: '22',
            },
          }),
        }).catch((e) => console.error('[create] snippet sync failed', e))

        // 3) 커스텀 썸네일 업로드 (있을 때만, 2MB 제한)
        if (thumbnail_url) {
          const imgRes = await fetch(thumbnail_url).catch(() => null)
          if (imgRes?.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            const imgBlob = await imgRes.blob()
            if (imgBlob.size <= 2_000_000) {
              await fetch(
                `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcastIdForSync}&uploadType=media`,
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${accessTokenForBg}`, 'Content-Type': contentType },
                  body: imgBlob,
                },
              ).then(() => trackQuota(c.env, QUOTA_COST.thumbnailSet, 'thumbnail_set', c.executionCtx))
                .catch((e) => console.error('[create] thumbnail upload failed', e))
            }
          }
        }
      } catch (e) {
        console.error('[create] snippet/thumbnail sync failed', e)
      }
    }
    if (ctx?.waitUntil) ctx.waitUntil(bgWork())
    else await bgWork()

    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        youtube_url: liveSetup.youtubeUrl,
        embed_url: liveSetup.embedUrl,
        rtmp_url: liveSetup.rtmpUrl,
        backup_rtmp_url: liveSetup.backupRtmpUrl, // 🛡️ 2026-05-07: OBS dual-push 권장
        rtmp_key: liveSetup.rtmpKey,
        broadcast: liveSetup.broadcast,
        stream: liveSetup.stream
      }
    })
  } catch (error: unknown) {
    console.error('[YouTube Live Create] Error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    // 🛡️ 2026-05-13 (#5): YouTube quota 초과 명확한 안내.
    //   YouTube API 에러 메시지 패턴: "quotaExceeded" / "The request cannot be completed because you have exceeded your quota"
    //   에러 코드로 분류하여 프론트엔드에서 전용 모달 표시.
    if (/quotaExceeded|exceeded.*quota|quota.*exceed/i.test(msg)) {
      // PST 자정 = KST 17:00 다음날 (정확히는 PST UTC-8, daylight UTC-7 무시하고 보수적으로 UTC-8 가정)
      // PST midnight = UTC 08:00 = KST 17:00
      const now = new Date()
      const nowUtcHour = now.getUTCHours()
      const hoursUntilReset = nowUtcHour < 8
        ? 8 - nowUtcHour
        : 32 - nowUtcHour  // 24 + 8
      const resetAt = new Date(now.getTime() + hoursUntilReset * 3600 * 1000)
      return c.json({
        success: false,
        error: `YouTube API 일일 사용량을 초과했어요. 약 ${hoursUntilReset}시간 후 자동 리셋됩니다.`,
        error_code: 'YOUTUBE_QUOTA_EXCEEDED',
        reset_at: resetAt.toISOString(),
        hours_until_reset: hoursUntilReset,
      }, 503)
    }
    return c.json({
      success: false,
      error: msg || 'Failed to create live stream'
    }, 500)
  }
}

// sub-router 내부에도 동일하게 등록 (정상 라우팅 시 동작) — 미들웨어 + handler 결합.
// 🛡️ 2026-05-14: 테스트 편의를 위해 rate limit 제거 (사용자 요청).
//   필요 시 다시 `rateLimit({ action: 'youtube_live_create', max: 15, windowSec: 3600 })` 추가.
app.post('/live/create', createLiveBroadcastHandler)

/**
 * POST /api/youtube/live/create-webcam
 * YouTube API 호출 없이 UR 스트림 레코드만 생성 (웹캠 모드)
 */
app.post('/live/create-webcam', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { title, description, product_ids, scheduled_start_time, privacy_status, thumbnail_url } = await c.req.json()
  if (!title) return c.json({ success: false, error: 'Title is required' }, 400)

  // 🛡️ 2026-05-13: webcam mode — "바로 시작" vs "예약" 판정 (창고 /create 와 동일 로직).
  //   기존 +5분 강제 buffer 가 "바로 시작" 의도를 예약으로 만드는 사고 → 30초 minimal buffer.
  const TWO_MIN_WC = 2 * 60 * 1000
  const SHORT_BUFFER_MS_WC = 30 * 1000
  const providedMsWc = scheduled_start_time ? new Date(scheduled_start_time).getTime() : 0
  const isExplicitlyScheduledWc = providedMsWc > Date.now() + TWO_MIN_WC
  const scheduledTime = isExplicitlyScheduledWc
    ? scheduled_start_time
    : new Date(Date.now() + SHORT_BUFFER_MS_WC).toISOString()

  try {
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status, custom_thumbnail_url,
        youtube_video_id, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'scheduled', ?, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(sellerId, title, description || '', thumbnail_url || null, scheduledTime).run()

    const streamId = streamResult.meta.last_row_id

    if (product_ids && product_ids.length > 0) {
      for (const productId of product_ids) {
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO stream_products (stream_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(streamId, productId).run()
      }
      try {
        const firstProduct = await c.env.DB.prepare(
          'SELECT id, image_url FROM products WHERE id = ?'
        ).bind(product_ids[0]).first<{ id: number; image_url: string }>()
        if (firstProduct?.image_url) {
          await c.env.DB.prepare(
            'UPDATE live_streams SET thumbnail_url = ?, current_product_id = ? WHERE id = ?'
          ).bind(thumbnail_url || firstProduct.image_url, firstProduct.id, streamId).run()
        }
      } catch { /* thumbnail optional */ }
    }

    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        rtmp_url: null,
        rtmp_key: null,
        broadcast: null,
        youtube_url: null,
      }
    })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create stream' }, 500)
  }
})

/**
 * PATCH /api/youtube/live/:id/link-broadcast
 * Chrome Extension 이 YouTube Studio 에서 감지한 broadcast ID 를 스트림에 연결
 */
app.patch('/live/:id/link-broadcast', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = c.req.param('id')
  if (!/^\d+$/.test(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  const { youtube_video_id } = await c.req.json()
  if (!youtube_video_id) return c.json({ success: false, error: 'youtube_video_id required' }, 400)

  await c.env.DB.prepare(`
    UPDATE live_streams
    SET youtube_video_id = ?, youtube_broadcast_id = ?,
        youtube_embed_url = ?,
        thumbnail_url = COALESCE(NULLIF(thumbnail_url, ''), ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND seller_id = ?
  `).bind(
    youtube_video_id,
    youtube_video_id,
    `https://www.youtube.com/embed/${youtube_video_id}`,
    `https://i.ytimg.com/vi/${youtube_video_id}/maxresdefault.jpg`,
    streamId, sellerId
  ).run()

  return c.json({ success: true })
})

/**
 * GET /api/youtube/live/:id/detect-webcam
 * 웹캠 모드: 셀러의 YouTube 계정에서 새로 시작된 방송 자동 감지
 * liveBroadcasts.list = 1 unit/call (10s 폴링 × 5분 = 30 unit)
 */
app.get('/live/:id/detect-webcam', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  if (!c.env.YOUTUBE_CLIENT_ID || !c.env.YOUTUBE_CLIENT_SECRET) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }
  const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
  if (!accessToken) return c.json({ success: false, error: 'YouTube 연동이 필요합니다' }, 401)

  try {
    // 셀러 계정의 현재 활성/대기 방송 조회 (최신 10개)
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=all&mine=true&maxResults=10&order=date',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return c.json({ success: true, data: null })

    const data = await res.json() as { items?: Array<{ id: string; snippet: { title: string; publishedAt: string }; status: { lifeCycleStatus: string } }> }

    // 이미 연결된 video_id 가져오기 (중복 연결 방지)
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()
    const alreadyLinked = stream?.youtube_video_id

    // live 또는 ready/testStarting 상태 방송 중 이미 연결된 것 제외
    const ACTIVE = ['live', 'liveStarting', 'testStarting', 'testing', 'ready']
    const candidates = (data.items || []).filter(item =>
      ACTIVE.includes(item.status?.lifeCycleStatus) &&
      item.id !== alreadyLinked
    )

    if (!candidates.length) return c.json({ success: true, data: null })

    // live > testStarting > ready 우선순위, 동순위면 최신 순
    const priority: Record<string, number> = { live: 0, liveStarting: 1, testStarting: 2, testing: 3, ready: 4 }
    candidates.sort((a, b) =>
      (priority[a.status.lifeCycleStatus] ?? 9) - (priority[b.status.lifeCycleStatus] ?? 9)
    )

    const best = candidates[0]
    return c.json({
      success: true,
      data: {
        youtube_video_id: best.id,
        title: best.snippet?.title,
        status: best.status?.lifeCycleStatus,
      }
    })
  } catch {
    return c.json({ success: true, data: null })
  }
})

/**
 * POST /api/youtube/live/:id/start
 * Transition broadcast to live
 */
app.post('/live/:id/start', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)

  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  // 🛡️ 2026-05-11 Option D: body 는 호환성 유지용으로 읽되 mode 분기 불필요 (autoStart=true 가 처리)
  await c.req.json().catch(() => ({}))

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  try {
    // Get stream info
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

    // 🛡️ 2026-05-07: 웹캠 모드 (youtube_broadcast_id 없음) — accessToken 유무 무관하게 DB 만 업데이트.
    //   /create-webcam 으로 만들어진 stream 은 YouTube broadcast 가 없으므로 transition 불가.
    //   셀러가 YouTube Studio 에서 웹캠 방송을 별도로 시작 → DB 상태만 sync.
    if (!stream.youtube_broadcast_id) {
      // 🛡️ 2026-05-07: dead stream 방지 — youtube_video_id 가 link 되지 않은 상태로
      //   start 호출 시 거부. 셀러가 YouTube Studio 팝업에서 방송 시작을 완료하지 않은 케이스.
      //   stream 39 처럼 youtube_video_id='' 로 status='live' 가 되는 것 차단.
      if (!stream.youtube_video_id || String(stream.youtube_video_id).trim() === '') {
        return c.json({
          success: false,
          error: 'YouTube Studio 에서 웹캠 방송을 먼저 시작해주세요. 방송이 자동 감지되면 시작됩니다.',
          code: 'WEBCAM_NOT_LINKED',
        }, 400)
      }
      await c.env.DB.prepare(`
        UPDATE live_streams SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(streamId).run()
      return c.json({ success: true, message: 'Stream marked as live (webcam)' })
    }

    // 일반 모드 (OBS/Prism/Quick) — accessToken 필수
    if (!accessToken) {
      return c.json({ success: false, error: 'YouTube authentication required' }, 401)
    }

    // Check if YouTube already auto-started (enableAutoStart: true)
    const broadcast = await youtubeService.getBroadcast(accessToken, stream.youtube_broadcast_id as string)

    if (broadcast.status === 'live') {
      // Already live (auto-started by OBS/Prism RTMP) — just sync DB
      // 🛡️ 2026-05-13: youtube_video_id 가 비어 있으면 broadcast.id 로 backfill.
      //   YouTube Live 에서 broadcast.id === video_id 이므로 (line 230 주석 참고),
      //   stream 71 처럼 status='live' 이지만 video_id=NULL 인 dead stream 방지.
      //   ReelCard 가 "방송 준비 중" 영구 표시되는 근본 원인.
      const videoIdToSet = (stream.youtube_video_id && String(stream.youtube_video_id).trim())
        || broadcast.id
        || (stream.youtube_broadcast_id as string)
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'live',
            youtube_video_id = COALESCE(NULLIF(youtube_video_id, ''), ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(videoIdToSet, streamId).run()

      return c.json({ success: true, message: 'Stream is already live (auto-started)', video_id: videoIdToSet })
    }

    // 🛡️ 2026-05-11 Option D 최적화: enableAutoStart=true 라 YouTube 가 데이터 도착 즉시
    //   ready→live 자동 전환. 수동 transition 호출 불필요 — best-effort 로 한 번만 시도.
    //   (autoStart 가 아직 트리거 안 됐을 가능성 대비 — 보통 즉시 성공)
    try {
      await youtubeService.transitionBroadcastToLive(accessToken, stream.youtube_broadcast_id as string)
      await trackQuota(c.env, QUOTA_COST.transition, 'transition_live', c.executionCtx)
    } catch (e) {
      // redundantTransition (이미 live) 또는 invalidTransition (아직 active 안 됨) — autoStart 가 처리
      const msg = (e as Error).message || ''
      if (!/redundantTransition|already|invalidTransition/i.test(msg)) {
        console.warn('[YouTube Live Start] Transition non-critical error:', msg)
      }
    }

    // Update database
    // 🛡️ 2026-05-13: youtube_video_id backfill (broadcast.id === video_id).
    const videoIdToSet = (stream.youtube_video_id && String(stream.youtube_video_id).trim())
      || broadcast.id
      || (stream.youtube_broadcast_id as string)
    await c.env.DB.prepare(`
      UPDATE live_streams
      SET status = 'live',
          youtube_video_id = COALESCE(NULLIF(youtube_video_id, ''), ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(videoIdToSet, streamId).run()

    return c.json({ success: true, message: 'Stream is now live', video_id: videoIdToSet })
  } catch (error: unknown) {
    console.error('[YouTube Live Start] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start stream'
    }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/status
 * Check YouTube broadcast status and auto-sync to DB
 * Used by frontend polling to detect when OBS/Prism starts streaming
 */
app.get('/live/:id/status', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)

  if (!sellerId) {
    return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }

  try {
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

    // 웹캠 모드: YouTube OAuth 없어도 DB 상태 반환 (polling이 조용히 실패하지 않도록)
    // 🛡️ 2026-05-07: youtube_broadcast_id 가 null 인 경우 (create-webcam 으로 생성된 stream)
    //   YouTube API 호출 시 500 에러 발생 → DB 상태로 fallback. /detect-webcam 이 별도로 폴링.
    if (!accessToken || !stream.youtube_broadcast_id) {
      const dbStatus = (stream as any).status as string
      return c.json({
        success: true,
        data: { status: dbStatus, youtube_status: dbStatus, synced: dbStatus === 'live' }
      })
    }

    // Check YouTube broadcast status (캐시 확인 → 미스 시 API 호출)
    const cacheKey = `status:${streamId}`
    const cached = getCachedStatus(cacheKey) as { ytStatus: string } | null
    let ytStatus: string
    if (cached) {
      ytStatus = cached.ytStatus
    } else {
      const broadcast = await youtubeService.getBroadcast(accessToken, stream.youtube_broadcast_id as string)
      ytStatus = broadcast.status
      setCachedStatus(cacheKey, { ytStatus })
    }

    // Auto-sync: YouTube says live but our DB says scheduled → update DB
    if (ytStatus === 'live' && stream.status === 'scheduled') {
      // 🛡️ 2026-05-07: 라이브 전환 시 YouTube CDN 썸네일 자동 적용 (비용 0, quota 0)
      //   maxresdefault.jpg 는 YouTube 가 broadcast frame 에서 동적 생성.
      //   30-60초 후엔 셀러 실제 화면 frame 으로 자동 교체.
      // 🛡️ 2026-05-13: youtube_video_id backfill — broadcast.id === video_id.
      //   stream 71 처럼 video_id 비어 있으면 ReelCard 가 "방송 준비 중" 영구 표시.
      const videoIdToSet = (stream.youtube_video_id && String(stream.youtube_video_id).trim())
        || (stream.youtube_broadcast_id as string)
      const ytThumb = videoIdToSet
        ? `https://i.ytimg.com/vi/${videoIdToSet}/maxresdefault.jpg`
        : null

      if (videoIdToSet && ytThumb) {
        await c.env.DB.prepare(`
          UPDATE live_streams
          SET status = 'live',
              youtube_video_id = COALESCE(NULLIF(youtube_video_id, ''), ?),
              thumbnail_url = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(videoIdToSet, ytThumb, streamId).run()
      } else {
        await c.env.DB.prepare(`
          UPDATE live_streams
          SET status = 'live', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(streamId).run()
      }

      return c.json({
        success: true,
        data: {
          status: 'live',
          youtube_status: ytStatus,
          synced: true,
          thumbnail_synced: !!ytThumb,
          video_id: videoIdToSet || null
        }
      })
    }

    // Auto-sync: YouTube says complete but our DB says live → update DB
    if (ytStatus === 'complete' && stream.status === 'live') {
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()

      return c.json({
        success: true,
        data: { status: 'ended', youtube_status: ytStatus, synced: true }
      })
    }

    return c.json({
      success: true,
      data: { status: stream.status, youtube_status: ytStatus, synced: false }
    })
  } catch (error: unknown) {
    console.error('[YouTube Live Status] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status'
    }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/diagnose
 *
 * 🛡️ 2026-05-11: 라이브 파이프라인 전수 진단.
 *   한 stream 의 모든 단계 상태를 한 번에 노출:
 *     DB → OME publish → OME push → YouTube broadcast → 시청자 embed
 *   어디서 막혔는지 한 응답으로 즉시 확인 가능.
 */
app.get('/live/:id/diagnose', async (c) => {
  // 🛡️ 2026-05-11: admin_token 또는 셀러 JWT 둘 중 하나로 인증. admin_token 은
  //   DIAGNOSE_TOKEN env 와 일치해야 함 (정확 비교) — 셀러 외 (운영자) 가 진단하기 위함.
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  let sellerId: number | null = null
  let bypassAuth = false
  if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
    bypassAuth = true
  } else {
    sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인 또는 admin_token 필요' }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  // 1. DB 레코드
  const dbStream = await (bypassAuth
    ? c.env.DB.prepare(`
        SELECT id, seller_id, status, started_at, ended_at, last_error,
               youtube_video_id, youtube_broadcast_id, youtube_stream_key,
               rtmp_url, rtmp_key, youtube_embed_url, whip_url, title, created_at
        FROM live_streams WHERE id = ?
      `).bind(streamId)
    : c.env.DB.prepare(`
        SELECT id, seller_id, status, started_at, ended_at, last_error,
               youtube_video_id, youtube_broadcast_id, youtube_stream_key,
               rtmp_url, rtmp_key, youtube_embed_url, whip_url, title, created_at
        FROM live_streams WHERE id = ? AND seller_id = ?
      `).bind(streamId, sellerId)
  ).first<{
    id: number; seller_id: number; status: string; started_at: string | null; ended_at: string | null;
    last_error: string | null; youtube_video_id: string | null; youtube_broadcast_id: string | null;
    youtube_stream_key: string | null; rtmp_url: string | null; rtmp_key: string | null;
    youtube_embed_url: string | null; whip_url: string | null; title: string; created_at: string;
  }>()

  if (!dbStream) return c.json({ success: false, error: 'Stream not found' }, 404)

  const diagnostics: Record<string, unknown> = {
    db: {
      id: dbStream.id,
      title: dbStream.title,
      status: dbStream.status,
      started_at: dbStream.started_at,
      ended_at: dbStream.ended_at,
      last_error: dbStream.last_error,
      youtube_video_id: dbStream.youtube_video_id,
      youtube_broadcast_id: dbStream.youtube_broadcast_id,
      has_rtmp_key: !!dbStream.rtmp_key,
      rtmp_url: dbStream.rtmp_url,
      whip_url: dbStream.whip_url,
      youtube_embed_url: dbStream.youtube_embed_url,
      created_at: dbStream.created_at,
    },
  }

  // 2. OME stream 인입 여부 + push 등록 여부
  if (c.env.OME_HOST && c.env.OME_API_TOKEN) {
    const auth = btoa(c.env.OME_API_TOKEN)
    const omeBase = `http://${c.env.OME_HOST}:8081/v1/vhosts/default/apps/app`
    // 2a. streams 조회
    try {
      const sRes = await fetch(`${omeBase}/streams`, { headers: { Authorization: `Basic ${auth}` } })
      const sData = sRes.ok ? await sRes.json().catch(() => null) as { response?: string[] } | null : null
      const streamName = `s${streamId}`
      diagnostics.ome_stream = {
        ome_reachable: sRes.ok,
        all_streams: sData?.response || [],
        this_stream_present: (sData?.response || []).includes(streamName),
        expected_name: streamName,
      }
    } catch (e) {
      diagnostics.ome_stream = { error: String((e as Error)?.message || e) }
    }
    // 2b. pushes 조회
    try {
      const pRes = await fetch(`${omeBase}:pushes`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const pData = pRes.ok ? await pRes.json().catch(() => null) as { response?: Array<{ id: string; state?: string; url?: string; sentBytes?: number; sentTime?: number }> } | null : null
      const pushId = `youtube-${streamId}`
      const ourPush = (pData?.response || []).find((p) => p.id === pushId)
      diagnostics.ome_push = {
        pushes_api_ok: pRes.ok,
        all_push_ids: (pData?.response || []).map((p) => p.id),
        our_push_present: !!ourPush,
        our_push_state: ourPush?.state,
        our_push_url: ourPush?.url,
        our_push_sent_bytes: ourPush?.sentBytes,
        expected_id: pushId,
      }
    } catch (e) {
      diagnostics.ome_push = { error: String((e as Error)?.message || e) }
    }
  } else {
    diagnostics.ome_stream = { error: 'OME_HOST or OME_API_TOKEN not configured' }
  }

  // 3. YouTube broadcast 상태
  if (dbStream.youtube_broadcast_id && c.env.YOUTUBE_CLIENT_ID && c.env.YOUTUBE_CLIENT_SECRET) {
    try {
      const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
      const accessToken = await getValidAccessToken(c.env.DB, dbStream.seller_id, youtubeService)
      if (accessToken) {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status,contentDetails&id=${encodeURIComponent(dbStream.youtube_broadcast_id)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        const ytData = ytRes.ok ? await ytRes.json().catch(() => null) as { items?: Array<{ id: string; status?: { lifeCycleStatus?: string; privacyStatus?: string }; contentDetails?: { enableAutoStart?: boolean; boundStreamId?: string } }> } | null : null
        const broadcast = ytData?.items?.[0]
        diagnostics.youtube_broadcast = {
          api_ok: ytRes.ok,
          api_status: ytRes.status,
          found: !!broadcast,
          life_cycle_status: broadcast?.status?.lifeCycleStatus,
          privacy_status: broadcast?.status?.privacyStatus,
          enable_auto_start: broadcast?.contentDetails?.enableAutoStart,
          bound_stream_id: broadcast?.contentDetails?.boundStreamId,
        }
        // 3b. liveStream status (RTMP 인입 받고 있는지)
        if (broadcast?.contentDetails?.boundStreamId) {
          const lsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/liveStreams?part=id,status&id=${encodeURIComponent(broadcast.contentDetails.boundStreamId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          )
          const lsData = lsRes.ok ? await lsRes.json().catch(() => null) as { items?: Array<{ status?: { streamStatus?: string; healthStatus?: { status?: string } } }> } | null : null
          diagnostics.youtube_stream = {
            stream_status: lsData?.items?.[0]?.status?.streamStatus,
            health_status: lsData?.items?.[0]?.status?.healthStatus?.status,
          }
        }
      } else {
        diagnostics.youtube_broadcast = { error: 'no access token (OAuth expired?)' }
      }
    } catch (e) {
      diagnostics.youtube_broadcast = { error: String((e as Error)?.message || e) }
    }
  } else {
    diagnostics.youtube_broadcast = { error: 'no youtube_broadcast_id' }
  }

  // 4. 종합 진단
  const issues: string[] = []
  const ome_stream = diagnostics.ome_stream as { this_stream_present?: boolean }
  const ome_push = diagnostics.ome_push as { our_push_present?: boolean; our_push_state?: string; our_push_sent_bytes?: number }
  const yt = diagnostics.youtube_broadcast as { life_cycle_status?: string; enable_auto_start?: boolean }
  const ys = diagnostics.youtube_stream as { stream_status?: string; health_status?: string } | undefined
  const dbS = diagnostics.db as { status?: string; youtube_video_id?: string | null; ended_at?: string | null }

  if (!ome_stream?.this_stream_present) issues.push(`OME 에 stream "s${streamId}" 미존재 — 셀러가 송출 시작 안 했거나 OME admission 실패`)
  if (!ome_push?.our_push_present) issues.push(`OME 에 push "youtube-${streamId}" 미등록 — admission 의 startPush 실패. last_error 확인`)
  else if (!['pushing', 'pulling', 'connected'].includes(ome_push.our_push_state || '')) issues.push(`OME push state=${ome_push.our_push_state} (정상: pushing/pulling/connected)`)
  else if ((ome_push.our_push_sent_bytes ?? 0) === 0) issues.push(`OME push 등록은 됐지만 sentBytes=0 — RTMP 연결 실패 가능 (YouTube stream key 불일치?)`)
  if (yt?.life_cycle_status && !['live', 'testing'].includes(yt.life_cycle_status)) issues.push(`YouTube broadcast lifeCycleStatus=${yt.life_cycle_status} — RTMP 신호 미수신`)
  if (ys?.stream_status && ys.stream_status !== 'active') issues.push(`YouTube liveStream status=${ys.stream_status} (정상: active)`)
  if (yt?.life_cycle_status === 'testing') issues.push(`YouTube broadcast 가 testing 상태 — 시청자에게 검은 화면. transition 필요.`)

  // 🛡️ 2026-05-13: "왜 시청자 화면에 영상이 안 나오는지" 의 verdict (인간이 읽을 수 있는 분석).
  //   diagnose 의 raw data 를 해석해서 정확한 원인 + 다음 액션 지시.
  let verdict: string
  let next_action: string
  let video_visible_to_viewers = false

  if (dbS?.status === 'ended' || dbS?.ended_at) {
    verdict = '🔚 방송이 이미 종료됨 — 시청자에겐 "방송 종료" 표시'
    next_action = '새 방송 만들기 (/seller/live-broadcast)'
  } else if (dbS?.status !== 'live') {
    verdict = `📅 DB status=${dbS?.status || 'unknown'} — 시청자에겐 "방송 예정" 표시`
    next_action = '셀러가 송출 도구 (BrowserBroadcaster / OBS) 로 송출 시작'
  } else if (!ome_stream?.this_stream_present) {
    verdict = '⚠️ DB.status=live 인데 OME 에 stream 인입 없음 (좀비) — 시청자에겐 "방송 데이터 수신 중" 무한 반복'
    next_action = '셀러 페이지에서 다시 송출 시작 OR POST /api/seller/youtube/live/' + streamId + '/reset-zombie'
  } else if (!ome_push?.our_push_present || (ome_push.our_push_sent_bytes ?? 0) === 0) {
    verdict = '⚠️ OME 가 stream 받았지만 YouTube 로 RTMP push 실패 — 시청자 영상 안 옴'
    next_action = 'last_error 확인 + 셀러가 방송 재시작'
  } else if (ys?.stream_status !== 'active') {
    verdict = `⚠️ OME 가 YouTube 에 push 중 (${ome_push.our_push_sent_bytes} bytes) 인데 YouTube 가 stream 미인식 (streamStatus=${ys?.stream_status}) — 5-30초 더 대기 필요`
    next_action = '30초 대기 후 다시 진단. 1분 후에도 같으면 stream key 검증 (셀러가 YouTube Studio 에서 확인)'
  } else if (yt?.life_cycle_status === 'ready') {
    verdict = `🟡 YouTube 가 stream 받음 (active) 인데 broadcast 가 'ready' 정체 — 시청자에겐 "방송 예정" 페이지. ${yt?.enable_auto_start ? '(enableAutoStart=true 시절 broadcast, race condition)' : '(transition 호출 대기 중)'}`
    next_action = yt?.enable_auto_start
      ? '이 broadcast 는 기존 코드 (autoStart=true) 로 생성됨 — 종료하고 새 broadcast 만들면 즉시 정상 (자동 transition 작동).'
      : 'POST /api/seller/youtube/live/' + streamId + '/force-transition'
  } else if (yt?.life_cycle_status === 'testing') {
    verdict = '🟡 broadcast 가 testing 상태 (monitorStream) — 시청자에겐 검은 화면'
    next_action = 'POST /api/seller/youtube/live/' + streamId + '/force-transition'
  } else if (yt?.life_cycle_status === 'live' || yt?.life_cycle_status === 'liveStarting') {
    verdict = `✅ 모든 상태 정상 (broadcast=${yt.life_cycle_status}) — 시청자에게 영상 정상 노출되어야 함`
    next_action = '시청자 측이 안 보이면: 시청자 페이지 새로고침 / iframe 캐시 / 인터넷 확인'
    video_visible_to_viewers = true
  } else if (yt?.life_cycle_status === 'complete' || yt?.life_cycle_status === 'revoked') {
    verdict = `🔚 broadcast 가 ${yt.life_cycle_status} — 시청자에게 "방송 종료" 표시`
    next_action = '새 방송 만들기'
  } else {
    verdict = `❓ 미분류 상태 (lifecycle=${yt?.life_cycle_status}, streamStatus=${ys?.stream_status})`
    next_action = '운영자에게 위 diagnostics 전체 결과 공유'
  }

  diagnostics.summary = {
    healthy: issues.length === 0,
    issues,
    verdict,
    next_action,
    video_visible_to_viewers,
  }

  return c.json({ success: true, data: diagnostics })
})

/**
 * POST /api/youtube/live/:id/_force-live
 *
 * 🛡️ 2026-05-11: ready 또는 testing 상태에 멈춘 broadcast 를 강제로 live 로 전환.
 *   admin_token 매칭 시 인증 우회. 정상 admission 의 transition 이 실패한 stream 응급 복구용.
 */
/**
 * POST /live/:id/force-transition
 *
 * 🛡️ 2026-05-13: 셀러 본인이 호출 가능한 transition 강제 호출 endpoint.
 *   사고: OME→YouTube 송신 정상인데 broadcast lifeCycleStatus='ready' 정체 → iframe 검은 화면.
 *   원인 가능: admission 시 KV lock 충돌 / transition 폴링 21s 윈도우 놓침 / Worker 재시작 등.
 *   처리: youtube_broadcast_id 로 즉시 transitionBroadcastToLive 호출.
 *   조건: 셀러 소유, status='live', youtube_broadcast_id 존재
 */
app.post('/live/:id/force-transition', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  const stream = await c.env.DB.prepare(`
    SELECT id, status, youtube_broadcast_id FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first<{ id: number; status: string; youtube_broadcast_id: string | null }>()
  if (!stream) return c.json({ success: false, error: 'stream not found' }, 404)
  if (!stream.youtube_broadcast_id) return c.json({ success: false, error: 'youtube_broadcast_id 없음' }, 400)
  if (stream.status !== 'live') return c.json({ success: false, error: 'status 가 live 가 아닙니다' }, 400)
  if (!c.env.YOUTUBE_CLIENT_ID || !c.env.YOUTUBE_CLIENT_SECRET) {
    return c.json({ success: false, error: 'YouTube API 미구성' }, 500)
  }

  try {
    const yt = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, yt)
    if (!accessToken) return c.json({ success: false, error: '유효한 YouTube 토큰 없음 (재연결 필요)' }, 401)

    // broadcast + bound stream status 한 번에 조회
    const statusRes = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status,contentDetails&id=${stream.youtube_broadcast_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) }
    )
    if (!statusRes.ok) {
      return c.json({ success: false, error: `getBroadcast 실패 (${statusRes.status})` }, 500)
    }
    const statusData = await statusRes.json() as {
      items?: Array<{
        status?: { lifeCycleStatus?: string }
        contentDetails?: { boundStreamId?: string; enableAutoStart?: boolean }
      }>
    }
    const item = statusData.items?.[0]
    const lifeCycle = item?.status?.lifeCycleStatus
    const boundStreamId = item?.contentDetails?.boundStreamId
    const enableAutoStart = item?.contentDetails?.enableAutoStart
    if (!lifeCycle) return c.json({ success: false, error: 'broadcast not found' }, 404)
    if (lifeCycle === 'live' || lifeCycle === 'liveStarting') {
      return c.json({ success: true, message: '이미 live 상태입니다', lifeCycleStatus: lifeCycle })
    }
    if (lifeCycle === 'complete' || lifeCycle === 'revoked') {
      return c.json({ success: false, error: `broadcast 가 ${lifeCycle} 상태 — transition 불가` }, 400)
    }
    // 🛡️ 2026-05-13 (v2): bound stream status='active' 확인 후 transition.
    //   active 아니면 transition 절대 성공 못 함 — 의미 없는 API call 차단.
    if (boundStreamId) {
      const sRes = await fetch(
        `https://www.googleapis.com/youtube/v3/liveStreams?part=status&id=${boundStreamId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
      )
      if (sRes.ok) {
        const sData = await sRes.json() as { items?: Array<{ status?: { streamStatus?: string; healthStatus?: { status?: string } } }> }
        const streamStatus = sData.items?.[0]?.status?.streamStatus
        const health = sData.items?.[0]?.status?.healthStatus?.status
        if (streamStatus !== 'active') {
          return c.json({
            success: false,
            error: `YouTube 가 아직 stream 신호 받는 중 (streamStatus=${streamStatus}, health=${health || 'unknown'}). 셀러 송출 도구 확인 후 30초 뒤 재시도.`,
            stream_status: streamStatus,
            health_status: health,
          }, 409)
        }
      }
    }
    // transition 호출
    await yt.transitionBroadcastToLive(accessToken, stream.youtube_broadcast_id)

    const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
    if (kv) await cacheInvalidate(kv, `stream:${streamId}`).catch(() => {})

    return c.json({
      success: true,
      message: 'transition 완료 — 곧 영상이 나옵니다 (5-15초)',
      previousLifeCycleStatus: lifeCycle,
      ...(enableAutoStart ? { note: 'enableAutoStart=true 인 옛 broadcast — 새로 만들면 자동 transition 안정성 ↑' } : {}),
    })
  } catch (e) {
    const msg = (e as Error).message || ''
    if (/redundant|already/i.test(msg)) {
      return c.json({ success: true, message: '이미 live 상태입니다' })
    }
    if (/invalid/i.test(msg)) {
      return c.json({
        success: false,
        error: 'YouTube 가 transition 거부 — enableAutoStart 와 race 중일 수 있어요. 10-30초 뒤 다시 시도하거나, 새 broadcast 만들면 안정적.',
      }, 409)
    }
    return c.json({ success: false, error: msg }, 500)
  }
})

/**
 * POST /live/:id/reset-zombie
 *
 * 🛡️ 2026-05-13: 셀러 본인이 호출 가능한 좀비 reset endpoint.
 *   사고: status='live' 인데 OME 에 실제 stream 없음 → iframe 검은 화면 영구.
 *   처리: status='scheduled' 로 되돌리고 OME push 정리 → 셀러가 새로 송출 가능.
 *   조건 검증: 셀러 소유 + status='live' + OME 에 실제 stream 미존재 (안전장치)
 */
app.post('/live/:id/reset-zombie', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  const stream = await c.env.DB.prepare(`
    SELECT id, status FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first<{ id: number; status: string }>()
  if (!stream) return c.json({ success: false, error: 'stream not found' }, 404)
  if (stream.status !== 'live') return c.json({ success: false, error: 'status 가 live 가 아닙니다' }, 400)

  // OME 에 실제 stream 있으면 거부 (정상 송출 중인 걸 잘못 reset 하면 안 됨)
  if (c.env.OME_HOST && c.env.OME_API_TOKEN) {
    try {
      const auth = btoa(c.env.OME_API_TOKEN)
      const res = await fetch(
        `http://${c.env.OME_HOST}:8081/v1/vhosts/default/apps/app/streams/s${streamId}`,
        { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(5000) },
      )
      if (res.ok) {
        return c.json({
          success: false,
          error: 'OME 에 실제 송출이 감지됩니다. 정상적으로 송출 중이면 잠시 기다리고, 강제 종료하려면 종료 버튼을 사용하세요.'
        }, 409)
      }
    } catch { /* OME 조회 실패 시 reset 진행 (좀비 가능성 큼) */ }
  }

  // reset
  await c.env.DB.prepare(`
    UPDATE live_streams
    SET status = 'scheduled', started_at = NULL,
        last_error = '셀러 수동 reset — 송출 신호 미감지로 대기 상태 복귀',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND seller_id = ? AND status = 'live'
  `).bind(streamId, sellerId).run()

  // OME push 정리
  await stopOmePush(c.env, streamId)

  // KV 캐시 무효화
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (kv) {
    await cacheInvalidate(kv, [`stream:${streamId}`, `streams:status:live:limit:20:offset:0`]).catch(() => {})
  }

  return c.json({ success: true, message: '방송 상태가 대기 상태로 되돌아갔어요. 다시 송출 시작해주세요.' })
})

app.post('/live/:id/_force-live', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  const stream = await c.env.DB.prepare(
    'SELECT seller_id, youtube_broadcast_id FROM live_streams WHERE id = ?'
  ).bind(streamId).first<{ seller_id: number; youtube_broadcast_id: string | null }>()
  if (!stream?.youtube_broadcast_id) return c.json({ success: false, error: 'no broadcast id' }, 404)

  if (!c.env.YOUTUBE_CLIENT_ID || !c.env.YOUTUBE_CLIENT_SECRET) {
    return c.json({ success: false, error: 'YouTube not configured' }, 500)
  }

  const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
  const accessToken = await getValidAccessToken(c.env.DB, stream.seller_id, youtubeService)
  if (!accessToken) return c.json({ success: false, error: 'OAuth token unavailable' }, 401)

  const broadcastId = stream.youtube_broadcast_id
  const results: Record<string, { status: number; body?: string }> = {}

  // 🛡️ 2026-05-11: 1) broadcast contentDetails 를 monitorStream=false + autoStart=false 로 PATCH.
  //   기존 broadcast 가 monitorStream=true 로 만들어졌으면 testing 거쳐야 해서 transition 불가.
  //   PATCH 후 ready→live 직접 transition 가능.
  const patchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=contentDetails`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: broadcastId,
        contentDetails: {
          enableAutoStart: false,
          enableAutoStop: false,
          monitorStream: { enableMonitorStream: false },
          recordFromStart: true,
          enableDvr: true,
          enableEmbed: true,
          // 🛡️ 2026-05-13: 'low' (5-15s) → 'ultraLow' (2-5s) 통일. 라이브 커머스 핵심:
          //   셀러가 "5개 남았어요" 외쳐도 시청자가 30초 뒤에 보면 → 이미 다 팔림.
          latencyPreference: 'ultraLow',
        },
      }),
    }
  )
  results.patch = { status: patchRes.status, body: patchRes.ok ? undefined : await patchRes.text().catch(() => '') }

  // 2) 짧은 대기 후 ready→live transition
  await new Promise(r => setTimeout(r, 2000))
  for (const status of ['live'] as const) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=${status}&id=${encodeURIComponent(broadcastId)}&part=status`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    results[status] = { status: res.status, body: res.ok ? undefined : await res.text().catch(() => '') }
  }
  return c.json({ success: true, results })
})

/**
 * POST /api/youtube/live/_cleanup-pushes
 *
 * 🛡️ 2026-05-11: OME 에 누적된 모든 zombie push 정리 — admin 전용.
 *   admin_token 매칭 시 모든 push 삭제. 새 방송이 정상 등록되도록 clean state 보장.
 */
app.post('/live/_cleanup-pushes', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const removed = await cleanupAllOmePushes(c.env)
  return c.json({ success: true, removed })
})

/**
 * GET /api/youtube/live/_quota
 * 🛡️ 2026-05-11 P3-#10: YouTube API quota 일일 사용량 조회 (admin 전용).
 *   80% / 95% 도달 시 응답에 warning 표시. 알림 채널 추가는 cron 에서 처리.
 */
app.get('/live/_quota', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const usage = await getQuotaUsage(c.env)
  return c.json({ success: true, data: usage })
})

/**
 * GET /api/youtube/live/_health-check
 *
 * 🛡️ 2026-05-13: Launch 전 인프라 health check — env 변수 + DB 스키마 + OME 도달.
 *   어드민이 호출하면 라이브 송출 인프라 전체 상태 한 화면.
 */
app.get('/live/_health-check', requireAdmin(), async (c) => {
  const env = c.env
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // 1. 환경 변수
  checks.OME_HOST = { ok: !!env.OME_HOST, detail: env.OME_HOST ? '설정됨' : '❌ 미설정 — admission webhook 안 옴' }
  checks.OME_WEBHOOK_SECRET = { ok: !!env.OME_WEBHOOK_SECRET, detail: env.OME_WEBHOOK_SECRET ? '설정됨' : '❌ 미설정' }
  checks.OME_API_TOKEN = { ok: !!env.OME_API_TOKEN, detail: env.OME_API_TOKEN ? '설정됨' : '❌ 미설정 — push 등록 불가' }
  checks.YOUTUBE_CLIENT_ID = { ok: !!env.YOUTUBE_CLIENT_ID, detail: env.YOUTUBE_CLIENT_ID ? '설정됨' : '❌ 미설정' }
  checks.YOUTUBE_CLIENT_SECRET = { ok: !!env.YOUTUBE_CLIENT_SECRET, detail: env.YOUTUBE_CLIENT_SECRET ? '설정됨' : '❌ 미설정' }
  checks.IMGBB_API_KEY = { ok: !!(env as unknown as { IMGBB_API_KEY?: string }).IMGBB_API_KEY, detail: (env as unknown as { IMGBB_API_KEY?: string }).IMGBB_API_KEY ? '설정됨' : '❌ 이미지 업로드 불가' }
  checks.SESSION_KV = { ok: !!env.SESSION_KV, detail: env.SESSION_KV ? '설정됨' : '❌ 캐시 동작 안 함' }
  checks.LIVE_STREAM_DO = { ok: !!(env as unknown as { LIVE_STREAM?: DurableObjectNamespace }).LIVE_STREAM, detail: (env as unknown as { LIVE_STREAM?: DurableObjectNamespace }).LIVE_STREAM ? '설정됨' : '❌ WebSocket 채팅/상품 sync 불가' }

  // 2. DB 스키마 — disconnected_at 컬럼 존재 확인 (PRAGMA)
  try {
    const cols = await env.DB.prepare(`PRAGMA table_info(live_streams)`).all<{ name: string }>()
    const colNames = (cols.results || []).map(r => r.name)
    checks['live_streams.disconnected_at'] = {
      ok: colNames.includes('disconnected_at'),
      detail: colNames.includes('disconnected_at') ? '있음' : '❌ repair-schema 실행 필요 (POST /api/_internal/repair-schema)',
    }
    checks['live_streams.last_error'] = { ok: colNames.includes('last_error'), detail: colNames.includes('last_error') ? '있음' : '❌ repair-schema' }
    checks['live_streams.started_at'] = { ok: colNames.includes('started_at'), detail: colNames.includes('started_at') ? '있음' : '❌ repair-schema' }
  } catch (e) {
    checks['db_schema'] = { ok: false, detail: `❌ ${(e as Error).message}` }
  }

  // 3. OME 도달 가능성
  if (env.OME_HOST && env.OME_API_TOKEN) {
    try {
      const auth = btoa(env.OME_API_TOKEN)
      const res = await fetch(`http://${env.OME_HOST}:8081/v1/stats/current`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(5000),
      })
      checks.ome_reachable = { ok: res.ok, detail: res.ok ? `HTTP ${res.status}` : `❌ HTTP ${res.status}` }
    } catch (e) {
      checks.ome_reachable = { ok: false, detail: `❌ ${(e as Error).message}` }
    }
  }

  // 4. 좀비 스트림
  try {
    const zombies = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM live_streams
      WHERE status = 'live' AND started_at IS NOT NULL
        AND datetime(started_at) < datetime('now', '-10 minutes')
    `).first<{ count: number }>()
    checks.zombie_streams = {
      ok: (zombies?.count ?? 0) === 0,
      detail: zombies?.count ? `⚠️ ${zombies.count}개 의심 (cron 가 자동 복구하지만 모니터링 필요)` : '없음',
    }
  } catch { /* skip */ }

  // 5. Quota usage
  try {
    const usage = await getQuotaUsage(env)
    checks.youtube_quota = {
      ok: usage.warning !== 'critical',
      detail: `${Math.floor(usage.ratio * 100)}% (${usage.total} / ${usage.limit}) — ${usage.warning}`,
    }
  } catch { /* skip */ }

  const allOk = Object.values(checks).every(c => c.ok)
  return c.json({
    success: true,
    overall_status: allOk ? 'healthy' : 'issues_detected',
    checks,
    recommendation: allOk
      ? '✅ 라이브 송출 인프라 모두 정상. launch 가능.'
      : '⚠️ 위 ❌ 항목을 먼저 해결해야 launch 안정.',
  })
})

/**
 * POST /api/youtube/live/_verify-whip-proxy
 *
 * 🛡️ 2026-05-14: Worker WHIP proxy 검증 — 셀러 한 명이 토큰 1번 클릭으로 결과 확인.
 *
 * 동작:
 *   1. 셀러 본인의 좀비 라이브 (live/ready/starting) 일괄 종료 (DB + best-effort YouTube)
 *   2. YouTube liveStreams.insert (ingestionType='webrtc') 호출 — 테스트용 stream 생성 (50 quota)
 *   3. cdn.ingestionInfo.ingestionAddress 가 https://(WHIP) 로 시작하는지 확인
 *   4. 테스트 stream 즉시 삭제 (liveStreams.delete) — broadcast 아니므로 quota 추가 비용 거의 없음
 *   5. JSON 결과 반환:
 *      - env.YOUTUBE_USE_WEBRTC_INGEST 설정값
 *      - DB 컬럼 whip_url 존재 여부
 *      - YouTube WebRTC ingestion 작동 여부 + whip_url 샘플
 *      - 정리된 좀비 stream id 목록
 *
 * 인증: 셀러 Bearer 토큰. 본인 데이터만 만지고 본인 토큰으로만 YouTube API 호출.
 */
app.post('/live/_verify-whip-proxy', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureYouTubeTables(c.env.DB)

  const result: {
    env_YOUTUBE_USE_WEBRTC_INGEST: string | null
    db_whip_url_column: boolean
    db_whip_url_column_detail: string
    cleaned_zombies: number[]
    cleanup_errors: { id: number; error: string }[]
    webrtc_supported: boolean | null
    webrtc_detail: string
    sample_whip_url: string | null
    sample_ingestion_type: string | null
    test_stream_id: string | null
    test_stream_deleted: boolean
    overall: 'ok' | 'partial' | 'fail'
    recommendation: string
  } = {
    env_YOUTUBE_USE_WEBRTC_INGEST: (c.env as { YOUTUBE_USE_WEBRTC_INGEST?: string }).YOUTUBE_USE_WEBRTC_INGEST ?? null,
    db_whip_url_column: false,
    db_whip_url_column_detail: '',
    cleaned_zombies: [],
    cleanup_errors: [],
    webrtc_supported: null,
    webrtc_detail: '',
    sample_whip_url: null,
    sample_ingestion_type: null,
    test_stream_id: null,
    test_stream_deleted: false,
    overall: 'fail',
    recommendation: '',
  }

  // 1. DB 스키마 — whip_url 컬럼 확인
  try {
    const cols = await c.env.DB.prepare(`PRAGMA table_info(live_streams)`).all<{ name: string }>()
    const colNames = (cols.results || []).map(r => r.name)
    result.db_whip_url_column = colNames.includes('whip_url')
    result.db_whip_url_column_detail = result.db_whip_url_column
      ? '✅ live_streams.whip_url 컬럼 존재'
      : '❌ whip_url 컬럼 없음 — POST /api/_internal/repair-schema 실행 필요'
  } catch (e) {
    result.db_whip_url_column_detail = `❌ PRAGMA 실패: ${(e as Error).message}`
  }

  // 2. 좀비 stream 일괄 종료 (본인 것만)
  const ytClientId = c.env.YOUTUBE_CLIENT_ID || ''
  const ytClientSecret = c.env.YOUTUBE_CLIENT_SECRET || ''
  const kv = c.env.SESSION_KV
  try {
    const zombies = await c.env.DB.prepare(`
      SELECT id, youtube_broadcast_id FROM live_streams
      WHERE seller_id = ? AND status IN ('live', 'ready', 'starting', 'scheduled')
    `).bind(sellerId).all<{ id: number; youtube_broadcast_id: string | null }>()

    const youtubeService = new YouTubeAPIService(ytClientId, ytClientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

    for (const z of zombies.results || []) {
      try {
        if (accessToken && z.youtube_broadcast_id) {
          await youtubeService.endBroadcast(accessToken, z.youtube_broadcast_id).catch(swallow('verify_end_broadcast'))
        }
        await stopOmePush(c.env, z.id).catch(swallow('verify_stop_ome'))
        await c.env.DB.prepare(`
          UPDATE live_streams
          SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND seller_id = ?
        `).bind(z.id, sellerId).run()
        if (kv) await cacheInvalidate(kv, [`stream:${z.id}`, 'streams:status:live:limit:20:offset:0']).catch(swallow('verify_cache_invalidate'))
        result.cleaned_zombies.push(z.id)
      } catch (e) {
        result.cleanup_errors.push({ id: z.id, error: (e as Error).message })
      }
    }
  } catch (e) {
    result.cleanup_errors.push({ id: 0, error: `좀비 조회 실패: ${(e as Error).message}` })
  }

  // 3. YouTube WebRTC ingestion 실제 호출 테스트
  try {
    const youtubeService = new YouTubeAPIService(ytClientId, ytClientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) {
      result.webrtc_supported = false
      result.webrtc_detail = '❌ YouTube OAuth 토큰 없음 — /seller/youtube/connect 먼저 연결 필요'
    } else {
      const testTitle = `_verify-whip-proxy-${Date.now()}`
      // 🛡️ 2026-05-14: WebRTC ingestion 은 resolution / frameRate 모두 'variable' 만 허용
      const testStream = await youtubeService.createStream(accessToken, testTitle, 'variable', 'variable', 'webrtc')
      await trackQuota(c.env, QUOTA_COST.insert, 'verify_whip_proxy', c.executionCtx)
      result.test_stream_id = testStream.id
      const addr = testStream.ingestionInfo.ingestionAddress || ''
      const itype = testStream.cdn.ingestionType
      result.sample_whip_url = addr
      result.sample_ingestion_type = itype

      // WHIP 패턴 검증: https:// + youtube.com 도메인 (rtmp:// 가 아니어야 함)
      const isWhip = addr.startsWith('https://') && /youtube\.com|youtu\.be|googleapis\.com|googlevideo\.com|ytstatic/.test(addr) && itype === 'webrtc'
      result.webrtc_supported = isWhip
      result.webrtc_detail = isWhip
        ? `✅ YouTube WebRTC ingestion 정상 — ingestionType=${itype}, address=${addr.slice(0, 60)}...`
        : `❌ WebRTC ingestion 반환 안 됨 — ingestionType=${itype}, address=${addr.slice(0, 60)}...`

      // 4. 테스트 stream 즉시 삭제
      try {
        const delRes = await fetch(`${(`https://www.googleapis.com/youtube/v3`)}/liveStreams?id=${testStream.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        })
        await trackQuota(c.env, QUOTA_COST.delete ?? 50, 'verify_whip_proxy_delete', c.executionCtx)
        result.test_stream_deleted = delRes.ok || delRes.status === 204
      } catch (e) {
        result.test_stream_deleted = false
        result.webrtc_detail += ` | 테스트 stream 삭제 실패 (수동 정리 필요 id=${testStream.id}): ${(e as Error).message}`
      }
    }
  } catch (e) {
    result.webrtc_supported = false
    result.webrtc_detail = `❌ YouTube API 호출 실패: ${(e as Error).message}`
  }

  // 5. 종합 평가
  if (
    result.env_YOUTUBE_USE_WEBRTC_INGEST === 'true' &&
    result.db_whip_url_column &&
    result.webrtc_supported === true
  ) {
    result.overall = 'ok'
    result.recommendation = '✅ Worker WHIP Proxy 활성 가능 — 새 방송 시작 시 whip_url 이 자동 채워짐.'
  } else if (result.webrtc_supported === true) {
    result.overall = 'partial'
    const issues: string[] = []
    if (result.env_YOUTUBE_USE_WEBRTC_INGEST !== 'true') issues.push('env YOUTUBE_USE_WEBRTC_INGEST=true 설정 필요')
    if (!result.db_whip_url_column) issues.push('repair-schema 실행 필요 (whip_url 컬럼 추가)')
    result.recommendation = `⚠️ YouTube 는 지원하지만 미배포 항목 있음: ${issues.join(' / ')}`
  } else {
    result.overall = 'fail'
    result.recommendation = '❌ ' + (result.webrtc_detail || '확인 실패')
  }

  return c.json({ success: true, data: result })
})

/**
 * POST /api/youtube/live/:id/admin-force-end
 *
 * 🛡️ 2026-05-13 (사용자 정책): 어드민이 좀비 의심 stream 강제 종료.
 *   자동 종료 cron 다 제거된 환경의 어드민 백업 종료 경로.
 *   - status='live' / 'scheduled' 모두 즉시 'ended' 로
 *   - OME push + stream 정리
 *   - YouTube broadcast complete 시도 (best-effort)
 *   - 셀러 알림 발송
 */
app.post('/live/:id/admin-force-end', requireAdmin(), async (c) => {
  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  const reason = c.req.query('reason') || '어드민 수동 종료'

  const stream = await c.env.DB.prepare(`
    SELECT id, seller_id, title, status, youtube_broadcast_id FROM live_streams WHERE id = ?
  `).bind(streamId).first<{ id: number; seller_id: number; title: string; status: string; youtube_broadcast_id: string | null }>()
  if (!stream) return c.json({ success: false, error: 'stream not found' }, 404)
  if (stream.status === 'ended') return c.json({ success: true, message: '이미 ended 상태' })

  // DB 종료
  await c.env.DB.prepare(`
    UPDATE live_streams
    SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
        last_error = ?
    WHERE id = ?
  `).bind(`[ADMIN 강제 종료] ${reason}`, streamId).run()

  // OME 정리
  await stopOmePush(c.env, streamId).catch(() => {})
  await terminateOmeStream(c.env, `s${streamId}`).catch(() => {})

  // YouTube broadcast complete (best-effort)
  if (stream.youtube_broadcast_id && c.env.YOUTUBE_CLIENT_ID && c.env.YOUTUBE_CLIENT_SECRET) {
    try {
      const yt = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
      const token = await getValidAccessToken(c.env.DB, stream.seller_id, yt)
      if (token) await yt.endBroadcast(token, stream.youtube_broadcast_id).catch(() => {})
    } catch { /* ignore */ }
  }

  // 캐시 + WS broadcast
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (kv) {
    await cacheInvalidate(kv, [`stream:${streamId}`, 'streams:status:live:limit:20:offset:0']).catch(() => {})
  }

  // 셀러 알림
  await c.env.DB.prepare(`
    INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
    VALUES (
      (SELECT user_id FROM sellers WHERE id = ?),
      'seller', 'broadcast_admin_ended',
      '운영자가 방송을 종료했어요',
      ?, ?, CURRENT_TIMESTAMP
    )
  `).bind(
    stream.seller_id,
    `"${stream.title}" 방송이 운영자에 의해 종료됐어요. 사유: ${reason}`,
    `/seller/live-broadcast`,
  ).run().catch(() => { /* skip */ })

  // 관련 admin_alerts resolved 처리
  await c.env.DB.prepare(`
    UPDATE admin_alerts SET resolved = 1 WHERE kind = ? AND resolved = 0
  `).bind(`zombie_stream:${streamId}`).run().catch(() => {})

  return c.json({ success: true, message: `Stream ${streamId} 강제 종료 완료` })
})

/**
 * GET /api/youtube/live/_admin-quota-dashboard
 *
 * 🛡️ 2026-05-13: 어드민용 풀 quota 대시보드 데이터.
 *   - 전체 일일 사용량 + 시간별 분포 (어제/그제 비교)
 *   - 셀러별 일일 생성 횟수 (상위 N명)
 *   - 좀비 의심 streams (status='live' AND started_at > 5min)
 *   - 라이브 / 예약 / 종료 stream 개수
 */
app.get('/live/_admin-quota-dashboard', requireAdmin(), async (c) => {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10)

  const usage = await getQuotaUsage(c.env)

  // 어제 사용량
  const yKv = c.env.SESSION_KV
  let yesterdayTotal = 0
  if (yKv) {
    try {
      const yRaw = await yKv.get(`yt_quota:${yesterday}`)
      const yData = yRaw ? JSON.parse(yRaw) as { total: number } : { total: 0 }
      yesterdayTotal = yData.total
    } catch { /* ignore */ }
  }

  // 셀러별 일일 생성 횟수 (KV scan 불가하므로 active sellers 조회 후 각각 lookup)
  const activeSellers = await c.env.DB.prepare(`
    SELECT DISTINCT seller_id FROM live_streams
    WHERE created_at >= datetime('now', '-1 day') AND seller_id IS NOT NULL
    LIMIT 50
  `).all<{ seller_id: number }>()

  const sellerCounts: Array<{ seller_id: number; seller_name?: string; count: number }> = []
  if (yKv && activeSellers.results) {
    for (const s of activeSellers.results) {
      try {
        const raw = await yKv.get(`live_create_count:${s.seller_id}:${today}`)
        const count = raw ? parseInt(raw, 10) : 0
        if (count > 0) {
          const sellerRow = await c.env.DB.prepare(
            `SELECT name FROM sellers WHERE id = ? LIMIT 1`
          ).bind(s.seller_id).first<{ name: string }>().catch(() => null)
          sellerCounts.push({ seller_id: s.seller_id, seller_name: sellerRow?.name, count })
        }
      } catch { /* ignore */ }
    }
    sellerCounts.sort((a, b) => b.count - a.count)
  }

  // 좀비 의심 streams
  const zombieCandidates = await c.env.DB.prepare(`
    SELECT id, seller_id, title, started_at, last_error
    FROM live_streams
    WHERE status = 'live' AND started_at IS NOT NULL
      AND datetime(started_at) < datetime('now', '-5 minutes')
    ORDER BY started_at ASC
    LIMIT 20
  `).all<{ id: number; seller_id: number; title: string; started_at: string; last_error: string | null }>()

  // Stream 카운트 (오늘)
  const streamStats = await c.env.DB.prepare(`
    SELECT status, COUNT(*) AS count FROM live_streams
    WHERE created_at >= datetime('now', '-1 day')
    GROUP BY status
  `).all<{ status: string; count: number }>()
  const streamCountsByStatus: Record<string, number> = {}
  for (const r of streamStats.results || []) {
    streamCountsByStatus[r.status] = r.count
  }

  return c.json({
    success: true,
    data: {
      quota: {
        today: { date: today, total: usage.total, limit: usage.limit, ratio: usage.ratio, warning: usage.warning, calls: usage.calls },
        yesterday: { date: yesterday, total: yesterdayTotal },
      },
      sellers_today: sellerCounts.slice(0, 20),
      zombie_suspect: zombieCandidates.results || [],
      stream_counts_24h: streamCountsByStatus,
    },
  })
})

/**
 * GET /api/youtube/live/:id/youtube-stats
 * YouTube Live API 로부터 실시간 시청자/좋아요 등 조회.
 * Step 3 대시보드에서 OBS 미연결 사용자도 metrics 확인 가능.
 */
app.get('/live/:id/youtube-stats', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'YouTube API not configured' }, 500)

  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()
    if (!stream?.youtube_video_id) return c.json({ success: false, error: 'Stream not found' }, 404)

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) return c.json({ success: false, error: 'YouTube auth required' }, 401)

    // videos.list — 60s 캐싱 (ConnectionQualityGauge 8s 폴링 → YouTube API 실제 호출 1/8로 감소)
    const statsCacheKey = `yt-stats:${stream.youtube_video_id}`
    const statsCached = getCachedStatus(statsCacheKey) as Record<string, unknown> | null
    if (statsCached) return c.json({ success: true, data: statsCached })

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${stream.youtube_video_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return c.json({ success: false, error: `YouTube API ${res.status}` }, 500)
    const data = await res.json() as { items?: Array<{ liveStreamingDetails?: { concurrentViewers?: string; actualStartTime?: string }; statistics?: { viewCount?: string; likeCount?: string } }> }
    const item = data.items?.[0]
    const statsData = {
      concurrent_viewers: parseInt(item?.liveStreamingDetails?.concurrentViewers || '0'),
      total_views: parseInt(item?.statistics?.viewCount || '0'),
      like_count: parseInt(item?.statistics?.likeCount || '0'),
      actual_start_time: item?.liveStreamingDetails?.actualStartTime,
    }
    setCachedStatus(statsCacheKey, statsData)

    return c.json({ success: true, data: statsData })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/end
 * End broadcast
 */
app.post('/live/:id/end', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  try {
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404)
    }

    // 🛡️ 2026-05-11: YouTube broadcast 정리는 best-effort.
    // - broadcast_id 가 없거나 (웹캠/OME 모드에서 admission 폴링 실패), YouTube API 가 404 (broadcast 자동 정리됨),
    //   토큰 만료, 등의 경우에 DB status='ended' 까지 막히면 셀러가 영영 정리 못 함.
    // - 따라서 YouTube 호출은 try/catch 후 무시, DB ended 처리는 무조건 진행.
    // 🛡️ 2026-05-13: endBroadcast 재시도 — 일시적 5xx / 네트워크 에러 자동 복구.
    //   non-retryable: 404 (broadcast 없음), 403 (권한), redundant (이미 complete) → 즉시 중단.
    let youtubeEndError: string | null = null
    const broadcastId = stream.youtube_broadcast_id as string | null
    if (broadcastId) {
      const youtubeService = new YouTubeAPIService(clientId, clientSecret)
      const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
      if (!accessToken) {
        youtubeEndError = 'no_access_token'
      } else {
        const MAX_END_RETRIES = 3
        let lastEndErr = ''
        for (let attempt = 0; attempt < MAX_END_RETRIES; attempt++) {
          try {
            await youtubeService.endBroadcast(accessToken, broadcastId)
            await trackQuota(c.env, QUOTA_COST.transition, 'transition_end', c.executionCtx)
            lastEndErr = ''
            break
          } catch (ytErr) {
            const msg = ytErr instanceof Error ? ytErr.message : String(ytErr)
            lastEndErr = msg
            // 404 / 403 / redundant — 재시도 의미 없음
            if (/404|403|redundant|already|not found|complete/i.test(msg)) {
              console.warn('[YouTube Live End] non-retryable, skip:', msg)
              break
            }
            console.warn(`[YouTube Live End] attempt ${attempt + 1}/${MAX_END_RETRIES} failed:`, msg)
            if (attempt < MAX_END_RETRIES - 1) await new Promise((r) => setTimeout(r, 2000))
          }
        }
        if (lastEndErr) youtubeEndError = lastEndErr
      }
    }

    // DB 는 무조건 ended 처리 (셀러가 다음 방송 만들 수 있게)
    await c.env.DB.prepare(`
      UPDATE live_streams
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(streamId).run()

    // 🛡️ 2026-05-13: stopOmePush + terminateOmeStream 2단 정리 — push 만 끊고 stream 남으면
    //   OME 가 다음 broadcast 시 Duplicate ID 충돌 가능. 양쪽 다 호출 (best-effort, idempotent).
    await stopOmePush(c.env, Number(streamId))
    try { await terminateOmeStream(c.env, `s${streamId}`) } catch { /* best-effort */ }

    // 🛡️ 2026-05-13: 시청자 즉시 반영 — main page / live page 의 stale 'live' 표시 차단.
    //   1) SESSION_KV 의 stream:${id} 캐시 무효화
    //   2) 라이브 목록 캐시 무효화 (자주 쓰이는 status=live 쿼리 변형 enumeration)
    //   3) DO 가 viewers 에게 'ended' 이벤트 broadcast
    //   list 캐시 키 형식: buildCacheKey('streams', {status,limit,offset}) → 'streams:status:live:limit:N:offset:M'
    const env = c.env as Env & { SESSION_KV?: KVNamespace; LIVE_STREAM?: DurableObjectNamespace }
    const kv = env.SESSION_KV
    if (kv) {
      const commonLimits = [10, 20, 50]
      const listKeys = commonLimits.flatMap(lim => [
        `streams:status:live:limit:${lim}:offset:0`,
        `streams:status:live:limit:${lim}`,
      ])
      const invalidations = [
        cacheInvalidate(kv, `stream:${streamId}`),
        cacheInvalidate(kv, listKeys),
      ]
      const ctx = c.executionCtx
      if (ctx && typeof ctx.waitUntil === 'function') {
        invalidations.forEach((p) => ctx.waitUntil(p))
      } else {
        await Promise.all(invalidations).catch(() => {})
      }
    }
    // DO broadcast — 라이브 페이지 시청자 즉시 'ended' WebSocket 신호.
    //   handleBroadcast 형식: { type: 'stream_status', data: { status, live_stream_id }, timestamp }
    if (env.LIVE_STREAM) {
      try {
        const doId = env.LIVE_STREAM.idFromName(String(streamId))
        const stub = env.LIVE_STREAM.get(doId)
        const broadcastEnd = stub.fetch('https://internal/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Auth': '1',
            'X-Auth-User-Type': 'seller',
            'X-Auth-User-Id': String(sellerId),
          },
          body: JSON.stringify({
            type: 'stream_status',
            data: { status: 'ended', live_stream_id: streamId },
            timestamp: Date.now(),
          }),
        })
        if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(broadcastEnd.then(() => {}).catch(() => {}))
        else await broadcastEnd.catch(() => {})
      } catch (e) {
        console.warn('[YouTube Live End] DO broadcast failed:', (e as Error).message)
      }
    }

    return c.json({
      success: true,
      message: 'Stream ended successfully',
      ...(youtubeEndError ? { warning: `YouTube 정리 skip: ${youtubeEndError}` } : {}),
    })
  } catch (error: unknown) {
    console.error('[YouTube Live End] Error:', error)
    // DB 정리만이라도 시도
    try {
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()
    } catch { /* ignore */ }
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end stream'
    }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/end-beacon
 * 🛡️ 2026-05-11 P0-#1: sendBeacon 전용 종료 endpoint.
 *   탭/브라우저 닫힘 시 Authorization 헤더 못 보냄 → 토큰을 body 로 받아 검증.
 *   좀비 스트림 방지용 best-effort cleanup. 204 No Content 만 응답 (beacon 응답 무시됨).
 */
app.post('/live/:id/end-beacon', async (c) => {
  // 🛡️ 2026-05-13: 즉시 종료 제거 — 셀러 탭 이탈로 시청자 라이브가 죽는 사고 (stream 77).
  //   기존: sendBeacon 으로 호출되면 status='ended' + YouTube broadcast 종료
  //   현재: marker 만 기록 (last_error = 'browser_tab_left'), status 는 변경 X.
  //   진짜 RTMP 끊김은 OME admission 의 closing event 가 감지 → 그때 ended 처리.
  //   12시간 idle cron + youtube-broadcast-end-detect cron 이 안전망.
  const streamId = parseInt(c.req.param('id'))
  if (!streamId) return c.body(null, 204)

  let body: { token?: string; reason?: string } = {}
  try { body = await c.req.json() } catch { /* ignore */ }

  const sellerId = body.token ? await getSellerIdFromToken(`Bearer ${body.token}`, c.env.JWT_SECRET) : null
  if (!sellerId) return c.body(null, 204)

  try {
    // 진단 marker 만 (status 변경 X). 향후 분석용.
    await c.env.DB.prepare(`
      UPDATE live_streams
      SET last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND seller_id = ? AND status = 'live'
    `).bind(`browser_tab_left: ${body.reason || 'unknown'}`, streamId, sellerId).run()
  } catch (e) {
    console.error('[end-beacon] marker error', e)
  }
  return c.body(null, 204)
})

/**
 * POST /api/youtube/live/:id/notify-followers
 *
 * 🛡️ 2026-05-07: 라이브 시작 시 셀러 팔로워에게 알림톡 자동 발송 (1회).
 *   - 셀러 본인 alimtalk 잔액에서 차감 (우리 비용 0)
 *   - live_notify_log 로 멱등 (1라이브 1회)
 *   - 동시 접속자 1.5-3배 상승 효과
 */
app.post('/live/:id/notify-followers', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    const stream = await c.env.DB.prepare(
      'SELECT id, title, status FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ id: number; title: string; status: string }>()

    if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)
    if (stream.status !== 'live') return c.json({ success: false, error: '라이브 중일 때만 발송 가능' }, 409)
    // 🛡️ 2026-05-07: 연습 모드 — 알림 발송 안 함
    if (stream.title.startsWith('[연습]')) {
      return c.json({ success: false, error: '연습 모드는 알림 발송 불가', code: 'PRACTICE_MODE' }, 409)
    }

    // 멱등 — 1라이브 1회만
    try {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_notify_log (
          live_stream_id INTEGER PRIMARY KEY,
          seller_id INTEGER NOT NULL,
          notified_count INTEGER DEFAULT 0,
          notified_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
    } catch { /* exists */ }

    const dup = await c.env.DB.prepare('SELECT live_stream_id FROM live_notify_log WHERE live_stream_id = ?')
      .bind(streamId).first()
    if (dup) return c.json({ success: false, error: '이미 알림 발송됨', code: 'ALREADY_NOTIFIED' }, 409)

    // 셀러 정보 + 팔로워 phone 목록
    const seller = await c.env.DB.prepare('SELECT name FROM sellers WHERE id = ?').bind(sellerId)
      .first<{ name: string }>()
    const sellerName = seller?.name || '셀러'

    const followers = await c.env.DB.prepare(`
      SELECT DISTINCT u.phone
      FROM seller_follows f
      JOIN users u ON u.id = f.user_id
      WHERE f.seller_id = ? AND u.phone IS NOT NULL AND u.phone != ''
      LIMIT 500
    `).bind(sellerId).all<{ phone: string }>()

    const phones = (followers.results || []).map(r => r.phone).filter(Boolean)
    if (phones.length === 0) {
      return c.json({ success: true, data: { sent: 0, message: '발송할 팔로워가 없습니다' } })
    }

    // alimtalk send (best-effort, 실패는 alimtalk_failures 큐로)
    let sent = 0
    const senderKey = c.env.ALIGO_SENDER_KEY
    const templateCode = (c.env as unknown as { ALIGO_TEMPLATE_LIVE_START?: string }).ALIGO_TEMPLATE_LIVE_START || 'UB_8350'  // 셀러가 등록한 템플릿
    const liveUrl = `https://live.ur-team.com/live/${streamId}`
    const text = `🔴 ${sellerName}님이 라이브 방송을 시작했어요!\n\n"${stream.title}"\n\n바로 입장: ${liveUrl}`

    if (senderKey) {
      try {
        const { sendAlimtalk } = await import('../../../lib/aligo')
        for (const phone of phones) {
          try {
            const r = await sendAlimtalk(c.env as never, {
              senderKey, templateCode, to: phone, message: text,
              buttons: [{ type: 'WL', name: '라이브 입장', url_mobile: liveUrl, url_pc: liveUrl }]
            })
            if (r.success) sent++
          } catch { /* 개별 실패 → retry 큐에 자동 들어감 */ }
        }
      } catch { /* aligo 모듈 로드 실패 */ }
    }

    await c.env.DB.prepare(
      'INSERT INTO live_notify_log (live_stream_id, seller_id, notified_count) VALUES (?, ?, ?)'
    ).bind(streamId, sellerId, sent).run()

    return c.json({ success: true, data: { sent, total_followers: phones.length } })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/rotate-stream-key
 *
 * 🛡️ 2026-05-07: 셀러 본인의 persistent stream key 회전.
 *   - 사용 케이스: 키 유출 의심 / 정기 보안 갱신
 *   - 현재 default_stream_id 폐기 → 다음 방송 시 자동으로 새 stream + 새 key 발급
 *   - 진행 중인 라이브에는 영향 없음 (기존 broadcast 가 끝나야 적용)
 */
app.post('/rotate-stream-key', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  try {
    await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = NULL, default_rtmp_url = NULL, default_rtmp_key = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE seller_id = ? AND is_active = 1
    `).bind(sellerId).run()
    return c.json({
      success: true,
      message: '스트림 키 폐기됨 — 다음 방송에서 새 키가 발급됩니다.',
    })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/admin/rotate-all-stream-keys
 *
 * 🛡️ 2026-05-07: 어드민 응급 — 모든 셀러 stream key 일괄 회전 (대규모 보안 사고 대응).
 */
app.post('/admin/rotate-all-stream-keys', requireAdmin(), async (c) => {
  try {
    const { meta } = await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = NULL, default_rtmp_url = NULL, default_rtmp_key = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE is_active = 1
    `).run()
    return c.json({
      success: true,
      data: { rotated: meta.changes ?? 0 },
      message: '모든 셀러 stream key 폐기됨',
    })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/refresh-thumbnail
 *
 * 🛡️ 2026-05-07: YouTube broadcast frame 으로 썸네일 갱신 (비용 0).
 *   라이브 시작 60초 후 호출 권장 — YouTube 가 실제 셀러 화면을 캡처해서
 *   maxresdefault.jpg 를 갱신했을 시점.
 *   cache-busting 을 위해 ?v={timestamp} 부착.
 */
app.post('/live/:id/refresh-thumbnail', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()

    if (!stream?.youtube_video_id) {
      return c.json({ success: false, error: 'No YouTube video' }, 404)
    }

    // hqdefault → maxresdefault 폴백 (maxres 가 없는 케이스 대비)
    const cacheBust = Date.now()
    const ytThumb = `https://i.ytimg.com/vi/${stream.youtube_video_id}/maxresdefault.jpg?v=${cacheBust}`

    await c.env.DB.prepare(`
      UPDATE live_streams
      SET thumbnail_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND seller_id = ?
    `).bind(ytThumb, streamId, sellerId).run()

    return c.json({ success: true, data: { thumbnail_url: ytThumb } })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/chat?nextPageToken=...
 *
 * 🛡️ 2026-05-07: YouTube Live Chat ↔ 우리 채팅 동기화 (proxy).
 *
 * YouTube Live Chat API 는 셀러의 OAuth 토큰으로 호출. 시청자 측에서 직접 호출 시
 * 토큰 노출 — 그래서 서버 proxy 로 처리. 클라이언트는 nextPageToken 만 들고 polling.
 *
 * Quota 주의: 5건 / poll 호출. 권장 polling 간격 5-10초.
 */
app.get('/live/:id/chat', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  const nextPageToken = c.req.query('nextPageToken') || ''

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'YouTube API not configured' }, 500)

  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_live_chat_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_live_chat_id: string }>()

    if (!stream?.youtube_live_chat_id) {
      return c.json({ success: false, error: 'No live chat ID — broadcast not started yet' }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) return c.json({ success: false, error: 'YouTube auth required' }, 401)

    const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages')
    url.searchParams.set('liveChatId', stream.youtube_live_chat_id)
    url.searchParams.set('part', 'snippet,authorDetails')
    url.searchParams.set('maxResults', '50')
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const err = await res.text()
      return c.json({ success: false, error: `YouTube API ${res.status}: ${err.slice(0, 200)}` }, 500)
    }
    const data = await res.json() as {
      nextPageToken?: string
      pollingIntervalMillis?: number
      items?: Array<{
        id: string
        snippet?: { displayMessage?: string; publishedAt?: string; type?: string }
        authorDetails?: { displayName?: string; profileImageUrl?: string; isChatOwner?: boolean; isChatModerator?: boolean }
      }>
    }
    const items = (data.items ?? []).map(it => {
      const sn = it.snippet as Record<string, unknown> | undefined
      const sc = sn?.superChatDetails as { amountMicros?: string; currency?: string; userComment?: string } | undefined
      const memberDetails = sn?.newSponsorDetails as { memberLevelName?: string } | undefined
      return {
        id: it.id,
        message: it.snippet?.displayMessage || sc?.userComment || '',
        author: it.authorDetails?.displayName || 'YouTube 사용자',
        avatar: it.authorDetails?.profileImageUrl,
        isOwner: !!it.authorDetails?.isChatOwner,
        isModerator: !!it.authorDetails?.isChatModerator,
        published_at: it.snippet?.publishedAt,
        type: it.snippet?.type || 'textMessageEvent',
        super_chat_amount_micros: sc?.amountMicros ? Number(sc.amountMicros) : null,
        super_chat_currency: sc?.currency,
        member_level: memberDetails?.memberLevelName,
      }
    })

    // 🛡️ 2026-05-07: forward=1 시 YouTube 메시지를 우리 chat_messages 에 INSERT
    //   - text 메시지만 forward (superchat / member 이벤트 별도 처리)
    //   - 중복 방지: youtube_message_id 컬럼으로 dedupe (없으면 best-effort)
    //   - user_name 에 "[YT] " prefix
    let forwardedCount = 0
    if (c.req.query('forward') === '1' && items.length > 0) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS youtube_chat_forwards (
            youtube_message_id TEXT PRIMARY KEY,
            chat_message_id INTEGER,
            forwarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run()
      } catch { /* table 이미 존재 */ }

      for (const item of items) {
        if (!item.message) continue
        // 🛡️ 2026-05-07: textMessageEvent 외 superChatEvent / newSponsorEvent 등도 forward
        const isSuperChat = item.type === 'superChatEvent' || item.type === 'superStickerEvent'
        const isMember = item.type === 'newSponsorEvent' || item.type === 'memberMilestoneChatEvent'
        try {
          const existing = await c.env.DB.prepare(
            'SELECT 1 FROM youtube_chat_forwards WHERE youtube_message_id = ?'
          ).bind(item.id).first()
          if (existing) continue

          const prefix = isSuperChat ? '[YT 슈퍼챗]' : isMember ? '[YT 멤버]' : '[YT]'
          const cleanName = `${prefix} ${item.author}`.slice(0, 50)
          const cleanMsg = item.message.slice(0, 500)
          const result = await c.env.DB.prepare(`
            INSERT INTO chat_messages (live_stream_id, user_id, user_name, message, is_seller, is_admin)
            VALUES (?, NULL, ?, ?, ?, 0)
          `).bind(streamId, cleanName, cleanMsg, item.isOwner ? 1 : 0).run()

          const insertedId = result.meta.last_row_id

          await c.env.DB.prepare(`
            INSERT INTO youtube_chat_forwards (youtube_message_id, chat_message_id) VALUES (?, ?)
          `).bind(item.id, insertedId).run()

          // 🛡️ 2026-05-07: DO WebSocket broadcast — 라이브 시청자에게 실시간 노출
          if (c.env.LIVE_STREAM) {
            try {
              const doId = c.env.LIVE_STREAM.idFromName(String(streamId))
              const stub = c.env.LIVE_STREAM.get(doId)
              await stub.fetch('https://internal/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'chat',
                  data: {
                    id: insertedId,
                    user_id: null,
                    user_name: cleanName,
                    message: cleanMsg,
                    is_seller: item.isOwner ? true : false,
                    is_admin: false,
                    is_yt_superchat: isSuperChat,
                    is_yt_member: isMember,
                    created_at: new Date().toISOString(),
                  },
                  timestamp: Date.now(),
                }),
              })
            } catch { /* non-fatal */ }
          }

          forwardedCount++
        } catch (err) {
          if (import.meta.env?.DEV) console.warn('[YT Chat Forward] Skip:', err)
        }
      }
    }

    return c.json({
      success: true,
      data: {
        items,
        next_page_token: data.nextPageToken,
        polling_interval_ms: data.pollingIntervalMillis || 5000,
        forwarded: forwardedCount,
      }
    })
  } catch (error: unknown) {
    if (import.meta.env?.DEV) console.error('[YouTube Chat Sync] Error:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * GET /api/seller/youtube/live-readiness
 * 🛡️ 2026-05-07: 방송 시작 전 사전 진단 — OAuth 상태 + 라이브 권한 활성 여부.
 *
 * 셀러가 시도하기 전에 어디서 막힐지 미리 알려줌:
 *   - oauth: 'missing' | 'expired' | 'connected'
 *   - live_permission: 'ok' | 'needs_verification' | 'unknown'
 *
 * needs_verification = YouTube 첫 라이브 시 24시간 phone verification 미완.
 *   해결: https://youtube.com/features 에서 라이브 스트리밍 활성화 → 24시간 대기.
 */
app.get('/live-readiness', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ success: true, data: { oauth: 'missing', live_permission: 'unknown', reason: 'YouTube API not configured' } })
  }

  const youtubeService = new YouTubeAPIService(clientId, clientSecret)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

  if (!accessToken) {
    // OAuth 한 번도 안 했거나 refresh token 도 만료
    const auth = await c.env.DB.prepare(
      'SELECT id FROM seller_youtube_oauth WHERE seller_id = ? AND is_active = 1 LIMIT 1'
    ).bind(sellerId).first()
    return c.json({
      success: true,
      data: {
        oauth: auth ? 'expired' : 'missing',
        live_permission: 'unknown',
        action_url: '/seller/youtube',
      },
    })
  }

  // OAuth OK → liveBroadcasts.list dry-run 으로 라이브 권한 확인.
  // 200 = 권한 있음 (results 비어 있어도 OK), 403 = 24h verification 필요.
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id&mine=true&maxResults=1',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (res.ok) {
      return c.json({ success: true, data: { oauth: 'connected', live_permission: 'ok' } })
    }
    if (res.status === 403) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; errors?: Array<{ reason?: string }> } }
      const reason = body.error?.errors?.[0]?.reason || body.error?.message || ''
      const needsVerification = /livestream|liveStreamingNotEnabled|live.*not.*enabled/i.test(reason)
      return c.json({
        success: true,
        data: {
          oauth: 'connected',
          live_permission: needsVerification ? 'needs_verification' : 'unknown',
          reason,
          action_url: needsVerification ? 'https://youtube.com/features' : null,
        },
      })
    }
    return c.json({ success: true, data: { oauth: 'connected', live_permission: 'unknown', reason: `HTTP ${res.status}` } })
  } catch (err) {
    return c.json({ success: true, data: { oauth: 'connected', live_permission: 'unknown', reason: (err as Error).message } })
  }
})

/**
 * GET /api/seller/youtube/streaming-setup
 * 🛡️ 2026-05-07: 송출 키 영구 발급 + 조회 (방송 생성과 분리).
 *
 * 셀러는 RTMP URL/Key 를 평생 한 번만 설정하면 됨 — YouTube Studio 와 동일한 패턴.
 *   - 키가 이미 있으면 그대로 반환
 *   - 없으면 status='not_configured' 반환 → 클라이언트가 init 호출
 */
app.get('/streaming-setup', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const auth = await c.env.DB.prepare(`
    SELECT default_stream_id, default_rtmp_url, default_rtmp_key, channel_title, channel_id
    FROM seller_youtube_oauth
    WHERE seller_id = ? AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `).bind(sellerId).first<{ default_stream_id?: string; default_rtmp_url?: string; default_rtmp_key?: string; channel_title?: string; channel_id?: string }>()

  if (!auth) {
    return c.json({ success: true, data: { status: 'no_oauth', oauth_url: '/seller/youtube' } })
  }
  if (!auth.default_stream_id || !auth.default_rtmp_url || !auth.default_rtmp_key) {
    return c.json({ success: true, data: { status: 'not_configured', channel_title: auth.channel_title } })
  }
  return c.json({
    success: true,
    data: {
      status: 'configured',
      rtmp_url: auth.default_rtmp_url,
      rtmp_key: auth.default_rtmp_key,
      stream_id: auth.default_stream_id,
      channel_title: auth.channel_title,
      channel_id: auth.channel_id,
    },
  })
})

/**
 * POST /api/seller/youtube/streaming-setup/init
 * RTMP 키 최초 발급 — broadcast 없이 stream 만 생성.
 * 한 번 호출 후 영구적으로 같은 키 재사용 (YouTube 의 persistent stream).
 */
app.post('/streaming-setup/init', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }

  const youtubeService = new YouTubeAPIService(clientId, clientSecret)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
  if (!accessToken) {
    return c.json({ success: false, error: 'YouTube 연동이 필요합니다', error_code: 'YOUTUBE_AUTH_REQUIRED' }, 401)
  }

  try {
    // 이미 키 있으면 재사용 (idempotent)
    const existing = await c.env.DB.prepare(`
      SELECT default_stream_id, default_rtmp_url, default_rtmp_key
      FROM seller_youtube_oauth
      WHERE seller_id = ? AND is_active = 1 LIMIT 1
    `).bind(sellerId).first<{ default_stream_id?: string; default_rtmp_url?: string; default_rtmp_key?: string }>()

    if (existing?.default_stream_id && existing?.default_rtmp_url && existing?.default_rtmp_key) {
      return c.json({
        success: true,
        data: {
          status: 'already_configured',
          rtmp_url: existing.default_rtmp_url,
          rtmp_key: existing.default_rtmp_key,
          stream_id: existing.default_stream_id,
        },
      })
    }

    // 새 stream 생성 (broadcast 없이)
    const stream = await youtubeService.createStream(accessToken, 'UR Live Persistent Stream', '1080p')

    await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE seller_id = ? AND is_active = 1
    `).bind(stream.id, stream.ingestionInfo.ingestionAddress, stream.ingestionInfo.streamName, sellerId).run()

    return c.json({
      success: true,
      data: {
        status: 'configured',
        rtmp_url: stream.ingestionInfo.ingestionAddress,
        rtmp_key: stream.ingestionInfo.streamName,
        stream_id: stream.id,
      },
    })
  } catch (err) {
    console.error('[YouTube streaming-setup/init] Error:', err)
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

/**
 * 🛡️ 2026-05-08: 자체 미디어 서버 (OvenMediaEngine) 통합.
 *
 * 셀러가 외부 앱 (Larix/OBS) 없이 브라우저에서 바로 라이브 송출.
 *
 * 흐름:
 *   1. 셀러 브라우저 → POST /streaming/whip-token  (이 endpoint)
 *   2. 백엔드 → 단기 (60s) JWT-style 토큰 발급, stream_id 와 매핑
 *   3. 브라우저 → WHIP POST `https://stream.ur-team.com:3334/app/{stream_id}?direction=whip&token=...`
 *   4. OME → POST /api/internal/ome/admission  (admission webhook)
 *   5. 백엔드 → 토큰 검증 + OME REST API 호출 → RTMPPush to YouTube 동적 등록
 *   6. OME → 셀러 WebRTC 인입 → AAC 트랜스코딩 → YouTube RTMP push
 *   7. 기존 /live/:id/status 폴링이 YouTube broadcast 상태 감지 → 라이브 화면 전환
 */

/**
 * GET /api/seller/youtube/streaming/health
 * OME 가용성 조회. 프론트엔드가 BrowserBroadcaster 노출 여부 결정에 사용.
 *
 * 단순 env 존재 + (옵션) ping 으로 즉답. 실제 OME 다운 감지는 publish 단계에서 fallback 처리.
 */
app.get('/streaming/health', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const omeConfigured = !!(c.env.OME_HOST && c.env.OME_WEBHOOK_SECRET && c.env.OME_API_TOKEN)
  // youtube_whip_available: 항상 true — rtmp_key 있는 stream 이면 YouTube WHIP 직접 사용 가능.
  // 실제 rtmp_key 보유 여부는 /streaming/whip-token 에서 stream_id 기준으로 체크.
  return c.json({
    success: true,
    data: { ome_available: omeConfigured, youtube_whip_available: true },
  })
})

/**
 * POST /api/seller/youtube/streaming/whip-token
 * 브라우저 publish 시작 전 호출. WHIP endpoint URL 반환.
 *
 * 🚨 2026-05-12 (LIVE-START-FIX): Option D (YouTube WHIP direct) 제거.
 *   YouTube `a.upload.youtube.com/upload/streamer` 엔드포인트는 CORS 헤더가 없어 브라우저에서
 *   직접 POST 시 preflight 차단. WebRTC/WHIP 브라우저 publish 는 OME 경유만 가능.
 *   OME 서버가 RTMP 로 YouTube 에 재push. (이전: 모든 라이브 시작이 CORS 에러로 영구 실패)
 *
 * 시나리오:
 *   - OME 설정됨 → OME WHIP URL 반환 (정상 경로)
 *   - OME 미구성 + rtmp_key 있음 → OBS 등 외부 도구 안내 (OBS_REQUIRED)
 *   - 둘 다 없음 → 503
 */
/**
 * POST /api/seller/youtube/streaming/whip-proxy/:streamId
 *
 * 🛡️ 2026-05-13: Worker WHIP proxy — OME 우회 / YouTube WHIP direct ingest.
 *
 * 흐름:
 *   1. 셀러 브라우저 → POST (Content-Type: application/sdp, body=SDP offer)
 *   2. 본 endpoint → 셀러 본인의 stream.whip_url (YouTube WHIP endpoint) 로 forward
 *   3. YouTube 응답 (SDP answer + Location header) → 그대로 브라우저 반환
 *
 * CORS 우회: 브라우저 → 우리 Worker (same origin) → YouTube (server-to-server, CORS X)
 *
 * 미디어 데이터는 본 endpoint 통과 X — 이후 브라우저 ↔ YouTube WebRTC P2P.
 * 본 endpoint 는 signaling (SDP 교환) 약 1-3초만 부담.
 */
app.post('/streaming/whip-proxy/:streamId', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('streamId'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid streamId' }, 400)

  // 본인 stream 검증 + whip_url 로드
  const stream = await c.env.DB.prepare(`
    SELECT id, whip_url, status FROM live_streams
    WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first<{ id: number; whip_url: string | null; status: string }>()

  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)
  if (!stream.whip_url) {
    return c.json({
      success: false,
      error: 'WHIP URL 미설정 — broadcast 생성 시 ingestionType=webrtc 로 만들어진 stream 만 가능',
      error_code: 'NO_WHIP_URL',
    }, 400)
  }

  // SDP offer 받기 (브라우저가 보냄)
  const sdpOffer = await c.req.text()
  if (!sdpOffer || !sdpOffer.includes('v=0')) {
    return c.json({ success: false, error: 'Invalid SDP offer' }, 400)
  }

  // YouTube WHIP 으로 forward
  try {
    const ytRes = await fetch(stream.whip_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: sdpOffer,
      signal: AbortSignal.timeout(15_000),
    })

    const responseBody = await ytRes.text()
    // YouTube WHIP 은 보통 201 Created + SDP answer + Location header (resource URL) 반환
    const locationHeader = ytRes.headers.get('Location') || ytRes.headers.get('location') || ''

    if (!ytRes.ok) {
      console.warn('[WHIP proxy] YouTube WHIP rejected:', ytRes.status, responseBody.slice(0, 200))
      return new Response(responseBody, {
        status: ytRes.status,
        headers: { 'Content-Type': 'application/sdp' },
      })
    }

    // 응답: SDP answer + Location (resource URL — DELETE 시 사용)
    const headers: Record<string, string> = { 'Content-Type': 'application/sdp' }
    if (locationHeader) headers['Location'] = locationHeader
    return new Response(responseBody, {
      status: ytRes.status,
      headers,
    })
  } catch (e) {
    return c.json({
      success: false,
      error: 'YouTube WHIP forward failed: ' + (e as Error).message,
    }, 502)
  }
})

/**
 * DELETE /api/seller/youtube/streaming/whip-proxy/:streamId
 *
 * 🛡️ 2026-05-13: WHIP resource 정리 (라이브 종료 시).
 *   브라우저가 받은 Location header 를 streamId 와 함께 보내면 백엔드가 YouTube WHIP 에 DELETE.
 */
app.delete('/streaming/whip-proxy/:streamId', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const resourceUrl = c.req.query('resource')
  if (!resourceUrl) return c.json({ success: false, error: 'resource URL required' }, 400)

  // 본인 stream 확인 (간단한 권한 검증)
  const streamId = parseInt(c.req.param('streamId'))
  const stream = await c.env.DB.prepare(`
    SELECT id FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first()
  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)

  try {
    await fetch(resourceUrl, { method: 'DELETE', signal: AbortSignal.timeout(10_000) })
    return c.json({ success: true })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

app.post('/streaming/whip-token', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { stream_id } = await c.req.json<{ stream_id: number }>()
  if (!stream_id || !Number.isFinite(stream_id)) {
    return c.json({ success: false, error: 'stream_id 가 필요합니다' }, 400)
  }

  // 본인 stream 검증 (whip_url 도 같이 로드 — Worker proxy 모드 지원)
  const stream = await c.env.DB.prepare(`
    SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id, status, whip_url
    FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(stream_id, sellerId).first<{
    id: number; rtmp_url: string; rtmp_key: string;
    youtube_broadcast_id: string | null; status: string; whip_url: string | null;
  }>().catch(async () => {
    // whip_url 컬럼 없으면 (repair-schema 미실행) — fallback 쿼리
    return await c.env.DB.prepare(`
      SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id, status
      FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(stream_id, sellerId).first<{
      id: number; rtmp_url: string; rtmp_key: string;
      youtube_broadcast_id: string | null; status: string;
    }>().then(r => r ? { ...r, whip_url: null as string | null } : null)
  })

  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)

  // 🛡️ 2026-05-13: Worker WHIP proxy 우선 — stream.whip_url 있으면 OME 우회.
  //   YouTube 가 webrtc ingestion 으로 발급한 WHIP URL 을 우리 Worker 가 forward.
  if (stream.whip_url) {
    const proxyUrl = new URL(c.req.url)
    proxyUrl.pathname = `/api/seller/youtube/streaming/whip-proxy/${stream_id}`
    proxyUrl.search = ''
    return c.json({
      success: true,
      data: {
        whip_url: proxyUrl.toString(),
        mode: 'youtube_whip_proxy',
      },
    })
  }

  // OME fallback (whip_url 없는 broadcast / OME 미구성 환경)
  if (!c.env.OME_HOST || !c.env.OME_WEBHOOK_SECRET) {
    // rtmp_key 있으면 OBS 외부 도구로 송출 가능 — 명확히 안내
    if (stream.rtmp_key) {
      return c.json({
        success: false,
        error: '브라우저 라이브 미지원 환경입니다. OBS 등 외부 도구로 송출해주세요.',
        error_code: 'OBS_REQUIRED',
        rtmp_url: stream.rtmp_url,
      }, 503)
    }
    return c.json({ success: false, error: '미디어 서버 미구성', error_code: 'OME_NOT_CONFIGURED' }, 503)
  }
  // (참고: getQuotaUsage 는 YouTube WHIP direct 경로에서만 사용했음 — 제거됨)
  void getQuotaUsage;

  // 1회용 토큰: HMAC-SHA256(secret, sellerId|streamId|exp).
  // OME admission webhook 에서 같은 secret 으로 검증.
  // 🛡️ 2026-05-10: 60s → 120s. 모바일 4G/공개 Wi-Fi 등 느린 네트워크에서 SDP 교환 + ICE
  // gathering 이 50초 이상 걸리면 token 만료 → 무한 재연결 loop. 120s 로 여유 확보.
  const exp = Math.floor(Date.now() / 1000) + 120
  const payload = `${sellerId}|${stream_id}|${exp}`
  const sig = await hmacHex(c.env.OME_WEBHOOK_SECRET, payload)
  const token = `${btoa(payload)}.${sig}`

  // stream_name = 우리 stream id (OME application 안에서의 식별자)
  const streamName = `s${stream_id}`

  // 🛡️ 2026-05-12 (LIVE-FIX-2): 같은 stream name 의 zombie publisher 강제 종료.
  //   이전 publish 가 비정상 종료 (탭 닫힘 / 네트워크 끊김) 시 OME 가 즉시 정리 못 함 →
  //   다음 publish 가 409 Conflict 로 영구 실패. 새 토큰 발급 직전에 항상 정리.
  await terminateOmeStream(c.env, streamName)

  const whipUrl = `https://${c.env.OME_HOST}:3334/app/${streamName}?direction=whip&token=${encodeURIComponent(token)}`

  // 🛡️ 2026-05-14: 모바일 브라우저는 stream.ur-team.com:3334 직접 호출 시 CORS 차단.
  //   Worker proxy 경유 (same origin, 443) → CORS 해결 + 통신사 포트 차단 우회.
  //   기존 PC 동작 영향 없음 (proxy 가 OME 로 그대로 forward).
  const proxyBase = new URL(c.req.url)
  proxyBase.pathname = `/api/seller/youtube/streaming/whip-proxy-ome/${stream_id}`
  proxyBase.search = `?token=${encodeURIComponent(token)}&stream_name=${encodeURIComponent(streamName)}`

  return c.json({
    success: true,
    data: {
      whip_url: proxyBase.toString(),
      mode: 'ome_whip',
      stream_name: streamName,
      expires_at: exp,
      // 원본 직접 URL 도 함께 반환 (디버깅 / 데스크탑 우회용)
      direct_whip_url: whipUrl,
    },
  })
})

/**
 * POST/PATCH/DELETE /api/seller/youtube/streaming/whip-proxy-ome/:streamId
 *
 * 🛡️ 2026-05-14: OME WHIP Worker proxy — CORS 우회 (모바일 통신사 차단 회피).
 *   브라우저 (live.ur-team.com same origin)
 *     → 본 endpoint
 *     → OME (stream.ur-team.com:3334)
 *     → 응답 그대로 반환
 *   미디어 데이터는 통과 X — signaling (SDP 교환) 만 ~1-3초.
 */
const omeProxyHandler = async (c: Context<{ Bindings: Env }>) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('streamId') || '0')
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid streamId' }, 400)

  // 본인 stream 검증
  const stream = await c.env.DB.prepare(`
    SELECT id FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first()
  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)

  if (!c.env.OME_HOST) {
    return c.json({ success: false, error: 'OME_HOST not configured' }, 503)
  }

  const token = c.req.query('token')
  const streamName = c.req.query('stream_name') || `s${streamId}`
  if (!token) return c.json({ success: false, error: 'token query required' }, 400)

  const omeUrl = `https://${c.env.OME_HOST}:3334/app/${streamName}?direction=whip&token=${encodeURIComponent(token)}`

  try {
    // PATCH 는 trickle ICE candidate, DELETE 는 stream 정리
    const body = (c.req.method === 'POST' || c.req.method === 'PATCH')
      ? await c.req.text()
      : undefined
    const headers: Record<string, string> = {}
    const ct = c.req.header('Content-Type')
    if (ct) headers['Content-Type'] = ct

    const omeRes = await fetch(omeUrl, {
      method: c.req.method,
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    })

    const responseBody = await omeRes.text()
    const respHeaders: Record<string, string> = { 'Content-Type': omeRes.headers.get('Content-Type') || 'application/sdp' }
    const location = omeRes.headers.get('Location') || omeRes.headers.get('location')
    if (location) respHeaders['Location'] = location
    return new Response(responseBody, { status: omeRes.status, headers: respHeaders })
  } catch (e) {
    return c.json({
      success: false,
      error: 'OME WHIP forward failed: ' + (e as Error).message,
    }, 502)
  }
}

app.post('/streaming/whip-proxy-ome/:streamId', omeProxyHandler)
app.patch('/streaming/whip-proxy-ome/:streamId', omeProxyHandler)
app.delete('/streaming/whip-proxy-ome/:streamId', omeProxyHandler)

/**
 * POST /api/internal/ome/admission
 * OME 가 publish/play 시도 시 호출. token 검증 후 허용/거부.
 *
 * 이 endpoint 는 별도 라우터에 있어야 함 (`/api/internal/*`) — 마지막 export 후 main router 에서 등록.
 *
 * NOTE: 본 함수는 main app.ts 에서 직접 import 해서 별도 prefix 로 마운트.
 */
export async function omeAdmissionHandler(
  body: OMEAdmissionRequest,
  signatureHeader: string | null,
  env: Env,
  rawBody?: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<OMEAdmissionResponse> {
  if (!env.OME_WEBHOOK_SECRET) {
    return { allowed: false, reason: 'OME not configured' }
  }

  // OME 가 보낸 HMAC 서명 검증 (X-OME-Signature 헤더)
  // 형식: SHA1=base64(HMAC-SHA1(secret, raw_body))
  if (!signatureHeader) return { allowed: false, reason: 'missing signature' }
  const bodyForSig = rawBody ?? JSON.stringify(body)
  const expectedSig = await hmacBase64Sha1(env.OME_WEBHOOK_SECRET, bodyForSig)
  // OME 0.16.7 은 URL-safe base64 (no padding) 사용. 우리는 표준 base64.
  // 같은 byte 인데 인코딩만 다르니 정규화 후 비교: SHA1= prefix 제거 + URL-safe → standard.
  const norm = (s: string) => s.replace(/^SHA1=/i, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '').trim()
  if (norm(signatureHeader) !== norm(expectedSig)) {
    return { allowed: false, reason: 'invalid signature' }
  }

  // closing event — disconnect marker 만 박음. 자동 종료 완전 제거.
  // 🛡️ 2026-05-13 v3 (사용자 정책): 셀러 명시 종료 OR 어드민 강제 종료 만 라이브 종료.
  //   네트워크 끊김 / 페이지 새로고침 / 일시 비활성 등으로 자동 종료 X.
  //   - status='live' 유지 (셀러 의도)
  //   - disconnected_at 마커만 박음 (어드민 대시보드에서 식별용)
  //   - OME push 도 그대로 (다음 송출 즉시 가능)
  //   안전망: scheduled-cleanup cron 12시간 + YouTube actualEndTime 감지만 자동 종료 가능.
  if (body.request.status === 'closing') {
    try {
      const url = new URL(body.request.url)
      const token = url.searchParams.get('token')
      const payloadB64 = token?.split('.')[0]
      if (payloadB64) {
        const closingPayload = atob(payloadB64)
        const [, sidStr] = closingPayload.split('|')
        const sid = parseInt(sidStr)
        if (sid) {
          // disconnect marker 만 박음 (상태는 그대로 'live')
          await env.DB.prepare(`
            UPDATE live_streams SET disconnected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'live'
          `).bind(sid).run().catch((e) => {
            console.warn('[OME admission] disconnect marker failed:', e)
          })
        }
      }
    } catch (e) {
      console.error('[OME admission] closing handler failed', e)
    }
    return { allowed: true }
  }

  // URL 에서 token 추출
  const url = new URL(body.request.url)
  const token = url.searchParams.get('token')
  if (!token) return { allowed: false, reason: 'missing token' }

  // token 검증
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return { allowed: false, reason: 'malformed token' }
  let payload: string
  try { payload = atob(payloadB64) } catch { return { allowed: false, reason: 'token decode failed' } }
  const [sellerIdStr, streamIdStr, expStr] = payload.split('|')
  const sellerId = parseInt(sellerIdStr)
  const streamId = parseInt(streamIdStr)
  const exp = parseInt(expStr)
  if (!sellerId || !streamId || !exp) return { allowed: false, reason: 'invalid payload' }
  if (Date.now() / 1000 > exp) return { allowed: false, reason: 'token expired' }

  const expectedTokenSig = await hmacHex(env.OME_WEBHOOK_SECRET, payload)
  if (sig !== expectedTokenSig) return { allowed: false, reason: 'token signature mismatch' }

  // stream + RTMP key 로드
  // 🛡️ 2026-05-11: youtube_broadcast_id 도 함께 로드 — video_id 폴링 시 mine=true 가 아닌
  //   정확한 broadcast id 로 조회 가능 (다중 active broadcast 있어도 정확히 매칭).
  const stream = await env.DB.prepare(`
    SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first<{ id: number; rtmp_url: string; rtmp_key: string; youtube_broadcast_id: string | null }>()
  if (!stream || !stream.rtmp_url || !stream.rtmp_key) {
    return { allowed: false, reason: 'stream/rtmp_key not found' }
  }

  // 🛡️ 2026-05-13: reconnect 감지 — closing 후 grace period 안에 새 admission 오면 disconnect marker 클리어.
  //   finalize() 가 60s 후 disconnected_at NOT NULL 조건으로만 ended 처리하므로, 여기서 NULL 처리하면 살아남.
  await env.DB.prepare(`UPDATE live_streams SET disconnected_at = NULL WHERE id = ? AND disconnected_at IS NOT NULL`)
    .bind(streamId).run().catch(() => { /* column 없으면 무시 */ })

  // 🛡️ 2026-05-11: admission(opening) 직후엔 OME stream 이 아직 OME 내부에 등록 안 됨.
  //   startPush 는 stream 존재가 전제 — 1500ms 지연으로 stream 인입 완료 시점을 기다림.
  //   /create 시점에도 push 등록을 시도하지만 stream 미존재로 실패할 가능성이 높음 → 여기가 실질적 등록 경로.
  // 🛡️ 2026-05-13 (안정성 #1): 1회 실패 시 끝이었던 로직 → 최대 3회 exponential backoff 재시도.
  //   네트워크 일시 장애 / OME 부팅 중 / OME API rate limit 등 일시적 실패 자동 복구.
  //   비용 0 (waitUntil 안에서 비동기, blocking X).
  // 🛡️ 2026-05-13 (Critical): push 등록 성공 후 +3s 대기 → YouTube transitionBroadcastToLive 호출.
  //   BrowserBroadcaster (WebRTC) 경로에서 YouTube broadcast lifeCycleStatus 가 'ready' 에 정체되어
  //   iframe embed 가 검은 화면이던 사고 직접 해결. transition 은 push 가 YouTube 에 도착해야만 성공.
  // 🛡️ 2026-05-13 (race protection): admission 이 짧은 시간에 중복 호출되거나 reconnect 와 겹치면
  //   reRegisterAndTransition 가 동시 실행 → YouTube API 중복 호출 + invalidTransition 폭주.
  //   SESSION_KV 에 짧은 TTL lock (60s) 으로 reRegister 만 차단. DB status update 는 계속 진행
  //   (idempotent UPDATE 라 안전).
  let omeLockHeld = false
  if (env.OME_HOST && env.OME_API_TOKEN) {
    const lockKey = `lock:admission:${streamId}`
    const kvLock = (env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
    if (kvLock) {
      try {
        const existing = await kvLock.get(lockKey)
        if (existing) {
          omeLockHeld = true
          console.log(`[OME admission] lock held for stream ${streamId}, skipping reRegister (DB update still runs)`)
        } else {
          await kvLock.put(lockKey, String(Date.now()), { expirationTtl: 60 })
        }
      } catch (e) {
        console.warn('[OME admission] lock acquire failed (continuing):', (e as Error).message)
      }
    }
  }

  if (env.OME_HOST && env.OME_API_TOKEN && !omeLockHeld) {
    const reRegisterAndTransition = async () => {
      // 🛡️ 2026-05-13 (안정성 강화): push 재시도 3 → 5회 증가, 네트워크/OME 부팅 지연 더 폭넓게 cover.
      //   exponential backoff: 1.5s → 3s → 6s → 12s → 24s (총 ~46.5s)
      const MAX_RETRIES = 5
      const INITIAL_DELAY_MS = 1500
      let lastError = ''
      let pushOk = false
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
          const r = await registerOmePush(env, streamId, stream.rtmp_url, stream.rtmp_key)
          if (r.ok) {
            await env.DB.prepare(`UPDATE live_streams SET last_error = NULL WHERE id = ? AND last_error IS NOT NULL`)
              .bind(streamId).run().catch(() => {})
            if (attempt > 0) {
              console.log(`[OME admission] push register succeeded on retry ${attempt + 1}/${MAX_RETRIES}`)
            }
            pushOk = true
            break
          }
          lastError = `OME push 등록 실패 (${r.status}): ${(r.body || '').substring(0, 200)}`
          console.warn(`[OME admission] push register attempt ${attempt + 1}/${MAX_RETRIES} failed:`, lastError)
        } catch (e) {
          lastError = (e as Error).message || String(e)
          console.warn(`[OME admission] push register attempt ${attempt + 1}/${MAX_RETRIES} threw:`, lastError)
        }
      }

      if (!pushOk) {
        // 모든 재시도 실패 → DB 에 마지막 에러 기록 + 셀러 알림 (대시보드에서 표시)
        await env.DB.prepare(`UPDATE live_streams SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(`[${MAX_RETRIES}회 재시도 실패] ${lastError}`, streamId)
          .run().catch(() => {})
        await env.DB.prepare(`
          INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
          VALUES (
            (SELECT user_id FROM sellers WHERE id = ?),
            'seller', 'broadcast_push_failed',
            '송출 연결이 불안정해요',
            '서버와의 영상 송출 연결이 ${MAX_RETRIES}회 재시도에도 실패했어요. 인터넷 / 송출 도구를 점검하고 새로 시작해주세요.',
            '/seller/live-broadcast',
            CURRENT_TIMESTAMP
          )
        `).bind(sellerId).run().catch(() => { /* notifications 없으면 skip */ })
        console.error('[OME admission] push register exhausted retries, sellerId=' + sellerId + ' streamId=' + streamId)
        return
      }

      // 🛡️ 2026-05-13 (Critical refinement v3): enableAutoStart=false 로 변경 후 명시적 transition.
      //   stream 79/80/81 사고: streamStatus=active + lifeCycleStatus=ready 인데 transition 거부.
      //   원인: enableAutoStart=true 와 우리 수동 transition 의 race (YouTube 가 "transitioning" 상태로 invalidTransition 응답).
      //   해결: enableAutoStart=false (createBroadcast) → 우리가 명시적으로 streamStatus active 확인 → transition.
      //   재시도: 15회 × 4s = 60s (YouTube auto-start 옛 broadcast 호환 + 새 broadcast 안정 전환).
      if (stream.youtube_broadcast_id && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
        await new Promise((r) => setTimeout(r, 2000))
        const MAX_TX_RETRIES = 15
        const yt = new YouTubeAPIService(env.YOUTUBE_CLIENT_ID, env.YOUTUBE_CLIENT_SECRET)
        const accessToken = await getValidAccessToken(env.DB, sellerId, yt)
        if (!accessToken) {
          console.warn('[OME admission] no valid access token, skipping transition')
          return
        }
        for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt++) {
          try {
            // broadcast + bound stream status 한 번에 조회
            const res = await fetch(
              `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status,contentDetails&id=${stream.youtube_broadcast_id}`,
              { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) }
            )
            if (!res.ok) {
              await new Promise((r) => setTimeout(r, 4000))
              continue
            }
            const data = await res.json() as {
              items?: Array<{
                status?: { lifeCycleStatus?: string }
                contentDetails?: { boundStreamId?: string }
              }>
            }
            const item = data.items?.[0]
            const lifeCycleStatus = item?.status?.lifeCycleStatus
            const boundStreamId = item?.contentDetails?.boundStreamId
            if (!lifeCycleStatus) {
              await new Promise((r) => setTimeout(r, 4000))
              continue
            }
            // 이미 live → 종료
            if (lifeCycleStatus === 'live' || lifeCycleStatus === 'liveStarting') {
              console.log(`[OME admission] broadcast ${stream.youtube_broadcast_id} → ${lifeCycleStatus} ✅`)
              return
            }
            if (lifeCycleStatus === 'complete' || lifeCycleStatus === 'revoked') {
              console.warn(`[OME admission] broadcast already ${lifeCycleStatus}, abort`)
              return
            }
            // ready / created / testing → bound stream status 확인 후 transition
            if (lifeCycleStatus === 'ready' || lifeCycleStatus === 'testing') {
              // 🛡️ bound stream status='active' 확인 — invalidTransition 방지
              if (boundStreamId) {
                const sRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/liveStreams?part=status&id=${boundStreamId}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
                )
                if (sRes.ok) {
                  const sData = await sRes.json() as { items?: Array<{ status?: { streamStatus?: string } }> }
                  const streamStatus = sData.items?.[0]?.status?.streamStatus
                  if (streamStatus !== 'active') {
                    console.log(`[OME admission] streamStatus=${streamStatus} (waiting for active), attempt ${attempt + 1}/${MAX_TX_RETRIES}`)
                    await new Promise((r) => setTimeout(r, 4000))
                    continue
                  }
                }
              }
              // streamStatus active → transition
              try {
                await yt.transitionBroadcastToLive(accessToken, stream.youtube_broadcast_id!)
                console.log(`[OME admission] broadcast ${stream.youtube_broadcast_id} → live ✅ (attempt ${attempt + 1})`)
                return
              } catch (e) {
                const msg = (e as Error).message || ''
                if (/redundant|already/i.test(msg)) {
                  console.log(`[OME admission] transition redundant (already live)`)
                  return
                }
                if (/invalid/i.test(msg)) {
                  console.log(`[OME admission] invalidTransition (race with autoStart), retry ${attempt + 1}/${MAX_TX_RETRIES}`)
                  await new Promise((r) => setTimeout(r, 4000))
                  continue
                }
                console.warn(`[OME admission] transition unknown error:`, msg)
                return
              }
            }
            await new Promise((r) => setTimeout(r, 4000))
          } catch (e) {
            console.warn(`[OME admission] poll attempt ${attempt + 1}/${MAX_TX_RETRIES} threw:`, (e as Error).message)
            await new Promise((r) => setTimeout(r, 4000))
          }
        }
        console.warn(`[OME admission] broadcast ${stream.youtube_broadcast_id} did not reach live within ${MAX_TX_RETRIES * 4}s — cron 가 후속 처리`)
      }
    }
    if (waitUntil) waitUntil(reRegisterAndTransition())
    else await reRegisterAndTransition()
  }

  // 🛡️ 2026-05-10: OME 가 stream 받기 시작했으니 우리 DB status 도 즉시 'live' 로.
  // (기존 polling 방식은 YouTube broadcast.status='live' 가 될 때까지 30-60초 걸림)
  let justWentLive = false
  try {
    const updateRes = await env.DB.prepare(`
      UPDATE live_streams
      SET status = 'live', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'ended' AND status != 'live'
    `).bind(streamId).run()
    justWentLive = (updateRes.meta?.changes ?? 0) > 0
  } catch (e) {
    console.error('[OME admission] DB status update failed', e)
  }

  // 🛡️ 2026-05-13: status='live' 전환 즉시 SESSION_KV 캐시 무효화.
  //   사고: /api/streams/:id 는 30초 KV 캐시 → admission webhook 직후 시청자가 접속하면
  //         stale status='scheduled' 응답 → ScheduledOverlay 영구 표시 → 페이지 새로고침 강제.
  //   해결: 전환 즉시 stream:${id} 캐시 키 제거 → 다음 요청은 fresh DB 응답.
  if (justWentLive) {
    const kv = (env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
    if (kv) {
      // 🛡️ 2026-05-13: 메인 페이지 sync — stream 디테일 + 라이브 목록 양쪽 캐시 무효화.
      //   이전엔 stream:${id} 만 → 메인 페이지 목록은 5-30s stale → 사용자가 "방금 라이브 시작했는데
      //   메인에 안 떠" 사고. 종료 핸들러와 대칭으로 list cache 도 함께 invalidate.
      const commonLimits = [10, 20, 50]
      const listKeys = commonLimits.flatMap(lim => [
        `streams:status:live:limit:${lim}:offset:0`,
        `streams:status:live:limit:${lim}`,
      ])
      const all = [cacheInvalidate(kv, `stream:${streamId}`), cacheInvalidate(kv, listKeys)]
      if (waitUntil) all.forEach(p => waitUntil(p))
      else await Promise.all(all).catch(() => {})
    }
    // 🛡️ 2026-05-13: WebSocket broadcast — 시청 중인 viewer 즉시 'live' 신호 (ScheduledOverlay → iframe 전환)
    const liveDO = (env as Env & { LIVE_STREAM?: DurableObjectNamespace }).LIVE_STREAM
    if (liveDO) {
      const broadcastLive = async () => {
        try {
          const doId = liveDO.idFromName(String(streamId))
          const stub = liveDO.get(doId)
          await stub.fetch('https://internal/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Auth': '1',
              'X-Auth-User-Type': 'seller',
              'X-Auth-User-Id': String(sellerId),
            },
            body: JSON.stringify({
              type: 'stream_status',
              data: { status: 'live', live_stream_id: streamId },
              timestamp: Date.now(),
            }),
          })
        } catch (e) {
          console.warn('[OME admission] live broadcast failed:', (e as Error).message)
        }
      }
      if (waitUntil) waitUntil(broadcastLive())
      else await broadcastLive()
    }
  }

  // 🛡️ 2026-05-10: 'waiting' → 'live' 전환 시 팔로워 알림 발송 (연습 모드 제외)
  if (justWentLive && waitUntil) {
    waitUntil((async () => {
      try {
        const s = await env.DB.prepare(`
          SELECT title, seller_id FROM live_streams WHERE id = ?
        `).bind(streamId).first<{ title: string; seller_id: number }>()
        if (!s || s.title?.startsWith('[연습]')) return
        const { notifyFollowers } = await import('../../../lib/notifications')
        await notifyFollowers(
          env.DB,
          s.seller_id,
          'live_started',
          '🔴 라이브 시작!',
          s.title,
          `/live/${streamId}`
        )
      } catch (e) {
        console.error('[OME admission] notify followers failed', e)
      }
    })())
  }

  // 🛡️ 2026-05-11 Option D 최적화: enableAutoStart=true 라 OME push 시작 즉시 YouTube 가
  //   자동으로 ready→live 전환. 수동 transition 불필요 → 12s 대기 제거.
  //   /live/:id/status polling 이 라이브 상태 감지하면 DB sync.

  return { allowed: true }
}

interface OMEAdmissionRequest {
  client: { address: string; port: number; user_agent?: string }
  request: {
    direction: 'incoming' | 'outgoing'
    protocol: 'webrtc' | 'rtmp' | 'srt' | string
    status: 'opening' | 'closing'
    url: string
    new_url?: string
    time?: string
  }
}

interface OMEAdmissionResponse {
  allowed: boolean
  new_url?: string
  lifetime?: number
  reason?: string
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacBase64Sha1(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export { app as youtubeLiveRoutes }
