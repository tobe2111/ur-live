/**
 * Multi-Platform Live Streaming Routes (Stub)
 *
 * 2026-04-23 배치 164: TikTok / Naver Chzzk / 기타 플랫폼 확장 기반 (P1)
 *
 * 현재 YouTube Live 만 실제 구현됨. 다른 플랫폼은 스텁으로 동작:
 * - 프론트가 플랫폼 목록을 조회하면 available/coming_soon 상태 반환
 * - 셀러가 미구현 플랫폼 연결 시도 시 501 Not Implemented 와 함께 안내 메시지
 * - 실제 OAuth 연동은 각 플랫폼 API 가이드라인 검토 후 단계적 구현 예정
 *
 * 엔드포인트:
 * - GET  /api/platforms              — 지원 플랫폼 목록
 * - GET  /api/seller/platforms/:p/auth-url — 연결 URL (미구현 플랫폼은 501)
 * - POST /api/seller/platforms/:p/live/create — 라이브 생성 (미구현 플랫폼은 501)
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';

export const multiPlatformRoutes = new Hono<{ Bindings: Env }>();

type PlatformStatus = 'available' | 'coming_soon' | 'deprecated';
interface PlatformInfo {
  key: string;
  label: string;
  status: PlatformStatus;
  icon: string;
  region: 'global' | 'kr' | 'cn' | 'sea';
  features: {
    live_streaming: boolean;
    chat_relay: boolean;
    product_overlay: boolean;
    auth_required: boolean;
  };
  eta?: string;
  note?: string;
}

const PLATFORMS: PlatformInfo[] = [
  {
    key: 'youtube',
    label: 'YouTube Live',
    status: 'available',
    icon: 'youtube',
    region: 'global',
    features: { live_streaming: true, chat_relay: true, product_overlay: true, auth_required: true },
  },
  {
    key: 'tiktok',
    label: 'TikTok Live',
    status: 'coming_soon',
    icon: 'music',
    region: 'global',
    features: { live_streaming: false, chat_relay: false, product_overlay: false, auth_required: true },
    eta: '2026 Q3',
    note: 'TikTok Live Shopping API 파트너 승인 절차 진행 중',
  },
  {
    key: 'naver_chzzk',
    label: '네이버 치지직',
    status: 'coming_soon',
    icon: 'radio',
    region: 'kr',
    features: { live_streaming: false, chat_relay: false, product_overlay: false, auth_required: true },
    eta: '2026 Q3',
    note: '치지직 OpenAPI 미공개 — 공식 배포 후 연동',
  },
  {
    key: 'soop',
    label: 'SOOP (아프리카TV)',
    status: 'coming_soon',
    icon: 'tv',
    region: 'kr',
    features: { live_streaming: false, chat_relay: false, product_overlay: false, auth_required: true },
    eta: '2026 Q4',
    note: '파트너사 계약 검토 중',
  },
];

multiPlatformRoutes.get('/platforms', async (c) => {
  return c.json({ success: true, data: PLATFORMS });
});

multiPlatformRoutes.get('/seller/platforms/:platform/auth-url', async (c) => {
  const platform = c.req.param('platform');
  const info = PLATFORMS.find(p => p.key === platform);
  if (!info) {
    return c.json({ success: false, error: 'Unknown platform', code: 'UNKNOWN_PLATFORM' }, 404);
  }
  if (info.status !== 'available') {
    return c.json({
      success: false,
      error: `${info.label}는 준비 중입니다${info.eta ? ` (${info.eta} 예정)` : ''}.`,
      code: 'NOT_IMPLEMENTED',
      platform: info,
    }, 501);
  }
  if (platform === 'youtube') {
    return c.json({
      success: true,
      data: { redirect: '/api/seller/youtube/auth-url', message: 'Use YouTube auth endpoint' },
    });
  }
  return c.json({ success: false, error: 'Unhandled platform' }, 500);
});

multiPlatformRoutes.post('/seller/platforms/:platform/live/create', async (c) => {
  const platform = c.req.param('platform');
  const info = PLATFORMS.find(p => p.key === platform);
  if (!info) return c.json({ success: false, error: 'Unknown platform' }, 404);
  if (info.status !== 'available') {
    return c.json({
      success: false,
      error: `${info.label} 라이브 생성은 아직 지원하지 않습니다.`,
      code: 'NOT_IMPLEMENTED',
      platform: info,
    }, 501);
  }
  if (platform === 'youtube') {
    return c.json({
      success: true,
      data: { redirect: '/api/seller/youtube/live/create', message: 'Use YouTube live-create endpoint' },
    });
  }
  return c.json({ success: false, error: 'Unhandled platform' }, 500);
});

export default multiPlatformRoutes;
