/**
 * Multi-Platform Live Streaming Routes
 *
 * 🛡️ 2026-04-23 배치 165: 목적지(Destination) / 송출 도구(Streaming Tool) / Multistream 3축 분리
 *
 * 이전 (배치 164) 은 destination 과 tool 을 한 묶음으로 취급해 OBS/Prism 을 "coming_soon"
 * 으로 표기하는 오류가 있었음. OBS/Prism 은 이미 RTMP 송출 도구로 available 상태.
 *
 * ── 개념 ──────────────────────────────────────────────────────────
 *   Destination (목적지)  : 시청자가 보는 플랫폼 — YouTube / TikTok / Chzzk / SOOP
 *   Streaming Tool (도구) : 셀러가 영상을 송출하는 방법 — Browser / OBS / Prism / Mobile
 *   Multistream           : 한 송출을 여러 목적지로 동시 중계 (Restream.io 스타일)
 *
 *   매트릭스: Destination × Tool 의 조합 중 현재 available 한 건 YouTube × (전체 도구).
 *            TikTok/Chzzk 가 추가되면 같은 도구들이 자동으로 해당 목적지로도 송출 가능.
 *
 * ── 엔드포인트 ────────────────────────────────────────────────────
 *   GET /api/platforms/destinations                      — 목적지 목록
 *   GET /api/platforms/streaming-tools                   — 송출 도구 목록
 *   GET /api/platforms/streaming-tools/:tool/preset      — 도구별 RTMP 프리셋 + 가이드
 *   GET /api/platforms/multistream                       — Multistream 상태 (현재 coming_soon)
 *   GET /api/seller/platforms/destinations/:dest/auth-url — 목적지 OAuth URL (미구현은 501)
 *   POST /api/seller/platforms/destinations/:dest/live/create — 목적지별 라이브 생성 (미구현은 501)
 *
 * ── 레거시 ────────────────────────────────────────────────────────
 *   GET /api/platforms — 이전 배치 164 호환용. destinations 만 반환.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';

export const multiPlatformRoutes = new Hono<{ Bindings: Env }>();

// ─── Types ──────────────────────────────────────────────────────────
type AvailabilityStatus = 'available' | 'coming_soon' | 'deprecated';

interface DestinationPlatform {
  key: string;
  label: string;
  status: AvailabilityStatus;
  icon: string;
  region: 'global' | 'kr' | 'cn' | 'sea';
  features: {
    rtmp_ingest: boolean;       // RTMP 로 송출 받음 (즉 OBS/Prism 과 호환)
    chat_relay: boolean;        // 서버에서 채팅 동기화 가능
    product_overlay: boolean;   // 라이브 커머스 상품 오버레이
    oauth_required: boolean;
  };
  eta?: string;
  note?: string;
}

interface StreamingTool {
  key: string;
  label: string;
  status: AvailabilityStatus;
  icon: string;
  os: Array<'web' | 'windows' | 'macos' | 'ios' | 'android'>;
  cost: 'free' | 'freemium' | 'paid';
  best_for: string;
  install_url?: string;
  guide_url?: string;
  supports_destinations: string[]; // 호환 가능한 destination key 목록
}

interface RtmpPreset {
  label: string;
  resolution: string;  // "1920x1080"
  fps: number;
  video_bitrate_kbps: number;
  audio_bitrate_kbps: number;
  keyframe_interval_sec: number;
  buffer_sec: number;
  recommended_for: string;
}

// ─── Data ───────────────────────────────────────────────────────────
const DESTINATIONS: DestinationPlatform[] = [
  {
    key: 'youtube',
    label: 'YouTube Live',
    status: 'available',
    icon: 'youtube',
    region: 'global',
    features: { rtmp_ingest: true, chat_relay: true, product_overlay: true, oauth_required: true },
  },
  {
    key: 'tiktok',
    label: 'TikTok Live',
    status: 'coming_soon',
    icon: 'music',
    region: 'global',
    features: { rtmp_ingest: true, chat_relay: false, product_overlay: false, oauth_required: true },
    eta: '2026 Q3',
    note: 'TikTok Live Shopping API 파트너 승인 절차 진행 중',
  },
  {
    key: 'chzzk',
    label: '네이버 치지직',
    status: 'coming_soon',
    icon: 'radio',
    region: 'kr',
    features: { rtmp_ingest: true, chat_relay: false, product_overlay: false, oauth_required: true },
    eta: '2026 Q3',
    note: '치지직 OpenAPI 공개 대기 중',
  },
  {
    key: 'soop',
    label: 'SOOP (아프리카TV)',
    status: 'coming_soon',
    icon: 'tv',
    region: 'kr',
    features: { rtmp_ingest: true, chat_relay: false, product_overlay: false, oauth_required: true },
    eta: '2026 Q4',
    note: '파트너 계약 검토 중',
  },
];

// 모든 도구는 YouTube 대상으로 현재 available.
// TikTok/Chzzk 가 열리면 supports_destinations 에 추가만 하면 됨.
const YOUTUBE_ONLY = ['youtube'];

const STREAMING_TOOLS: StreamingTool[] = [
  {
    key: 'browser',
    label: 'YouTube Studio (브라우저)',
    status: 'available',
    icon: 'globe',
    os: ['web'],
    cost: 'free',
    best_for: '가장 쉬운 시작 — 설치 필요 없음',
    guide_url: 'https://support.google.com/youtube/answer/9228389',
    supports_destinations: YOUTUBE_ONLY,
  },
  {
    key: 'obs',
    label: 'OBS Studio',
    status: 'available',
    icon: 'video',
    os: ['windows', 'macos'],
    cost: 'free',
    best_for: '고급 씬 구성 / 화면 합성이 필요한 PC 방송',
    install_url: 'https://obsproject.com/download',
    guide_url: 'https://obsproject.com/kb/quick-start-guide',
    supports_destinations: YOUTUBE_ONLY,
  },
  {
    key: 'prism',
    label: 'Naver Prism Live Studio',
    status: 'available',
    icon: 'smartphone',
    os: ['ios', 'android', 'windows', 'macos'],
    cost: 'free',
    best_for: '모바일 라이브 — 한국 셀러에게 가장 친숙',
    install_url: 'https://prismlive.com/',
    guide_url: 'https://prismlive.com/ko_kr/pcapp/',
    supports_destinations: YOUTUBE_ONLY,
  },
  {
    key: 'mobile_app',
    label: 'YouTube 모바일 앱',
    status: 'available',
    icon: 'phone',
    os: ['ios', 'android'],
    cost: 'free',
    best_for: '구독자 1000+ 채널만 가능 (YouTube 정책)',
    guide_url: 'https://support.google.com/youtube/answer/9228390',
    supports_destinations: YOUTUBE_ONLY,
  },
];

const PRESETS: Record<string, RtmpPreset[]> = {
  default: [
    {
      label: '1080p 60fps (고화질 권장)',
      resolution: '1920x1080',
      fps: 60,
      video_bitrate_kbps: 6000,
      audio_bitrate_kbps: 160,
      keyframe_interval_sec: 2,
      buffer_sec: 2,
      recommended_for: '안정적인 유선/Wi-Fi + 최신 PC',
    },
    {
      label: '1080p 30fps (표준)',
      resolution: '1920x1080',
      fps: 30,
      video_bitrate_kbps: 4500,
      audio_bitrate_kbps: 128,
      keyframe_interval_sec: 2,
      buffer_sec: 2,
      recommended_for: '대부분의 PC/Mac — 가장 안정적',
    },
    {
      label: '720p 30fps (저사양/모바일)',
      resolution: '1280x720',
      fps: 30,
      video_bitrate_kbps: 2500,
      audio_bitrate_kbps: 128,
      keyframe_interval_sec: 2,
      buffer_sec: 2,
      recommended_for: '모바일 / LTE / 저사양 PC',
    },
  ],
};

// ─── Public routes ──────────────────────────────────────────────────
// 레거시 호환 (배치 164 의 /api/platforms)
multiPlatformRoutes.get('/platforms', async (c) => {
  return c.json({
    success: true,
    data: DESTINATIONS,
    _deprecated: 'Use /api/platforms/destinations',
  });
});

multiPlatformRoutes.get('/platforms/destinations', async (c) => {
  return c.json({ success: true, data: DESTINATIONS });
});

multiPlatformRoutes.get('/platforms/streaming-tools', async (c) => {
  return c.json({ success: true, data: STREAMING_TOOLS });
});

multiPlatformRoutes.get('/platforms/streaming-tools/:tool/preset', async (c) => {
  const tool = c.req.param('tool');
  const info = STREAMING_TOOLS.find(t => t.key === tool);
  if (!info) return c.json({ success: false, error: 'Unknown tool' }, 404);
  return c.json({
    success: true,
    data: {
      tool: info,
      presets: PRESETS.default,
    },
  });
});

multiPlatformRoutes.get('/platforms/multistream', async (c) => {
  return c.json({
    success: true,
    data: {
      status: 'coming_soon',
      eta: '2026 Q4',
      description: '한 RTMP 송출을 여러 목적지로 동시 중계',
      technical_approach: 'Restream.io / Streamlabs simulcast 방식 또는 자체 SRT relay',
      dependencies: ['TikTok Live API 승인', '치지직 OpenAPI 공개'],
      preview_destinations: DESTINATIONS.filter(d => d.features.rtmp_ingest).map(d => d.key),
    },
  });
});

// ─── Seller routes (destination 별 연결/생성) ───────────────────────
multiPlatformRoutes.get('/seller/platforms/destinations/:dest/auth-url', async (c) => {
  const dest = c.req.param('dest');
  const info = DESTINATIONS.find(d => d.key === dest);
  if (!info) return c.json({ success: false, error: 'Unknown destination', code: 'UNKNOWN_DESTINATION' }, 404);

  if (info.status !== 'available') {
    return c.json({
      success: false,
      error: `${info.label} 는 준비 중입니다${info.eta ? ` (${info.eta} 예정)` : ''}.`,
      code: 'NOT_IMPLEMENTED',
      destination: info,
    }, 501);
  }
  if (dest === 'youtube') {
    return c.json({
      success: true,
      data: { redirect: '/api/seller/youtube/auth-url', message: 'Use YouTube OAuth endpoint' },
    });
  }
  return c.json({ success: false, error: 'Unhandled destination' }, 500);
});

multiPlatformRoutes.post('/seller/platforms/destinations/:dest/live/create', async (c) => {
  const dest = c.req.param('dest');
  const info = DESTINATIONS.find(d => d.key === dest);
  if (!info) return c.json({ success: false, error: 'Unknown destination' }, 404);

  if (info.status !== 'available') {
    return c.json({
      success: false,
      error: `${info.label} 라이브 생성은 아직 지원하지 않습니다.`,
      code: 'NOT_IMPLEMENTED',
      destination: info,
    }, 501);
  }
  if (dest === 'youtube') {
    return c.json({
      success: true,
      data: { redirect: '/api/seller/youtube/live/create', message: 'Use YouTube live-create endpoint' },
    });
  }
  return c.json({ success: false, error: 'Unhandled destination' }, 500);
});

export default multiPlatformRoutes;
