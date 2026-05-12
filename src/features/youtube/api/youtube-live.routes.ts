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

const app = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-12: 서브라우터 cors() 제거 — index.ts 전역 cors() 가 처리. 중복 제거.

// PLACEHOLDER