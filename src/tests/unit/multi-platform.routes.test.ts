/**
 * Multi-Platform Routes Tests — batch 167
 *
 * Covers: /api/platforms/destinations, /streaming-tools, /multistream, /preset.
 * Validates:
 *  - YouTube 는 available, TikTok/치지직/SOOP 는 coming_soon
 *  - 미구현 destination 연결 시도 → 501 + code: NOT_IMPLEMENTED
 *  - YouTube 는 기존 youtube 엔드포인트로 redirect
 *  - Preset 엔드포인트가 1080p60/1080p30/720p30 3종 반환
 *  - Streaming tools 4개 (browser, obs, prism, mobile_app) 모두 available
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { multiPlatformRoutes } from '@/features/multi-platform/api/multi-platform.routes';

function buildApp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = new Hono<any>();
  app.route('/api', multiPlatformRoutes);
  return app;
}

describe('Multi-Platform Routes — destinations', () => {
  it('GET /api/platforms/destinations returns 4 destinations with correct status', async () => {
    const res = await buildApp().request('/api/platforms/destinations');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: Array<{ key: string; status: string }> };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(4);

    const youtube = json.data.find((d) => d.key === 'youtube');
    expect(youtube?.status).toBe('available');

    const tiktok = json.data.find((d) => d.key === 'tiktok');
    expect(tiktok?.status).toBe('coming_soon');

    const chzzk = json.data.find((d) => d.key === 'chzzk');
    expect(chzzk?.status).toBe('coming_soon');

    const soop = json.data.find((d) => d.key === 'soop');
    expect(soop?.status).toBe('coming_soon');
  });

  it('GET /api/platforms returns same data (legacy compat)', async () => {
    const res = await buildApp().request('/api/platforms');
    const json = (await res.json()) as { success: boolean; data: Array<{ key: string }>; _deprecated?: string };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(4);
    expect(json._deprecated).toBeDefined();
  });
});

describe('Multi-Platform Routes — streaming tools', () => {
  it('GET /api/platforms/streaming-tools returns 4 tools, all available', async () => {
    const res = await buildApp().request('/api/platforms/streaming-tools');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean
      data: Array<{ key: string; status: string; supports_destinations: string[]; install_url?: string; guide_url?: string }>
    };
    expect(json.success).toBe(true);

    const expectedKeys = ['browser', 'obs', 'prism', 'mobile_app'];
    expect(json.data.map((t) => t.key).sort()).toEqual(expectedKeys.sort());

    // 모두 available
    expect(json.data.every((t) => t.status === 'available')).toBe(true);
    // 모두 YouTube destination 지원
    expect(json.data.every((t) => t.supports_destinations.includes('youtube'))).toBe(true);
  });

  it('GET /api/platforms/streaming-tools/obs/preset returns 3 RTMP presets', async () => {
    const res = await buildApp().request('/api/platforms/streaming-tools/obs/preset');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean
      data: {
        tool: { key: string }
        presets: Array<{ resolution: string; fps: number; video_bitrate_kbps: number }>
      }
    };
    expect(json.data.tool.key).toBe('obs');
    expect(json.data.presets).toHaveLength(3);

    // 1080p60, 1080p30, 720p30 3종
    const resolutions = json.data.presets.map((p) => `${p.resolution}@${p.fps}`);
    expect(resolutions).toContain('1920x1080@60');
    expect(resolutions).toContain('1920x1080@30');
    expect(resolutions).toContain('1280x720@30');
  });

  it('GET preset for unknown tool → 404', async () => {
    const res = await buildApp().request('/api/platforms/streaming-tools/doesnotexist/preset');
    expect(res.status).toBe(404);
  });
});

describe('Multi-Platform Routes — destination auth/create gating', () => {
  it('GET /seller/platforms/destinations/tiktok/auth-url → 501 NOT_IMPLEMENTED', async () => {
    const res = await buildApp().request('/api/seller/platforms/destinations/tiktok/auth-url');
    expect(res.status).toBe(501);
    const json = (await res.json()) as { success: boolean; code?: string; destination?: { eta?: string } };
    expect(json.success).toBe(false);
    expect(json.code).toBe('NOT_IMPLEMENTED');
    expect(json.destination?.eta).toBe('2026 Q3');
  });

  it('GET /seller/platforms/destinations/youtube/auth-url → 200 with redirect hint', async () => {
    const res = await buildApp().request('/api/seller/platforms/destinations/youtube/auth-url');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { redirect: string } };
    expect(json.success).toBe(true);
    expect(json.data.redirect).toBe('/api/seller/youtube/auth-url');
  });

  it('GET auth-url for unknown destination → 404', async () => {
    const res = await buildApp().request('/api/seller/platforms/destinations/fakebook/auth-url');
    expect(res.status).toBe(404);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('UNKNOWN_DESTINATION');
  });

  it('POST live/create for coming_soon destination → 501', async () => {
    const res = await buildApp().request('/api/seller/platforms/destinations/chzzk/live/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(501);
  });
});

describe('Multi-Platform Routes — multistream', () => {
  it('GET /api/platforms/multistream returns coming_soon status with eta', async () => {
    const res = await buildApp().request('/api/platforms/multistream');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean
      data: { status: string; eta: string; preview_destinations: string[] }
    };
    expect(json.data.status).toBe('coming_soon');
    expect(json.data.eta).toBeTruthy();
    // RTMP 가능한 destination 들만 preview 에 포함
    expect(json.data.preview_destinations).toContain('youtube');
  });
});
