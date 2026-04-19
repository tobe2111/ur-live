/**
 * 카카오 소셜 API (메시지 + 캘린더)
 * + 글로벌 대안 (Google Calendar .ics)
 *
 * POST /api/kakao-social/message/broadcast   - 방송 시작 카카오 메시지 발송
 * POST /api/kakao-social/calendar/add        - 카카오 캘린더에 방송 일정 등록
 * GET  /api/kakao-social/calendar/ics/:streamId - Google/Apple Calendar용 .ics 파일
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const kakaoSocialRoutes = new Hono<{ Bindings: Env }>();
kakaoSocialRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

/**
 * 카카오 access_token 조회 — 만료 시 refresh_token으로 자동 갱신
 */
async function getKakaoToken(
  DB: D1Database, userId: string | number, kakaoRestApiKey: string
): Promise<string | null> {
  const row = await DB.prepare(
    'SELECT kakao_access_token, kakao_refresh_token FROM users WHERE id = ?'
  ).bind(userId).first<{ kakao_access_token: string | null; kakao_refresh_token: string | null }>();

  if (!row?.kakao_access_token) return null;

  // 토큰 유효성 빠른 체크 (카카오 token_info API)
  const checkRes = await fetch('https://kapi.kakao.com/v1/user/access_token_info', {
    headers: { 'Authorization': `Bearer ${row.kakao_access_token}` },
  });

  if (checkRes.status === 200) return row.kakao_access_token;

  // 401 → refresh_token으로 갱신 시도
  if (row.kakao_refresh_token) {
    try {
      const refreshRes = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: kakaoRestApiKey,
          refresh_token: row.kakao_refresh_token,
        }),
      });

      if (refreshRes.ok) {
        const data: any = await refreshRes.json();
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token || null;

        await DB.prepare(
          'UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?'
        ).bind(newAccessToken, newRefreshToken, userId).run();

        return newAccessToken;
      }
    } catch (e) {
      console.error('[KakaoSocial] Token refresh failed:', e);
    }
  }

  return null;
}

function isKakaoScopeError(data: any, httpStatus: number): boolean {
  if (httpStatus === 403) return true;
  if (data?.code === -402 || data?.code === -401) return true;
  const msg = (data?.msg || data?.error_description || '').toLowerCase();
  return msg.includes('scope') || msg.includes('consent') || msg.includes('koe006');
}

function scopeErrorResponse(c: any, requiredScope: string) {
  return c.json({
    success: false,
    error: '카카오 권한이 필요합니다',
    code: 'KAKAO_SCOPE_REQUIRED',
    required_scope: requiredScope,
  }, 403);
}

// ── POST /message/broadcast — 나에게 카카오톡 메시지 보내기 ──
kakaoSocialRoutes.post('/message/broadcast', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const { stream_id, title, message } = await c.req.json<{
    stream_id: number; title: string; message?: string;
  }>();

  const kakaoToken = await getKakaoToken(DB, user.id, (c.env as any).KAKAO_REST_API_KEY);
  if (!kakaoToken) {
    return c.json({ success: false, error: '카카오 연동이 필요합니다. 다시 로그인해주세요.' }, 400);
  }

  try {
    // 카카오 나에게 보내기 API
    const templateObject = JSON.stringify({
      object_type: 'feed',
      content: {
        title: `🔴 ${title}`,
        description: message || '유어딜에서 라이브 방송이 시작되었습니다!',
        image_url: 'https://live.ur-team.com/og-image.png',
        link: {
          web_url: `https://live.ur-team.com/live/${stream_id}`,
          mobile_web_url: `https://live.ur-team.com/live/${stream_id}`,
        },
      },
      buttons: [{
        title: '라이브 시청하기',
        link: {
          web_url: `https://live.ur-team.com/live/${stream_id}`,
          mobile_web_url: `https://live.ur-team.com/live/${stream_id}`,
        },
      }],
    });

    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kakaoToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `template_object=${encodeURIComponent(templateObject)}`,
    });

    const data: any = await res.json();
    if (isKakaoScopeError(data, res.status)) {
      return scopeErrorResponse(c, 'talk_message');
    }
    if (data.result_code === 0) {
      return c.json({ success: true, message: '카카오톡 메시지가 발송되었습니다' });
    }
    return c.json({ success: false, error: data.msg || '메시지 발송 실패' }, 400);
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '카카오 API 오류' }, 500);
  }
});

// ── POST /calendar/add — 카카오 캘린더에 방송 일정 등록 ──
kakaoSocialRoutes.post('/calendar/add', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const { stream_id } = await c.req.json<{ stream_id: number }>();

  // 방송 정보 조회
  const stream = await DB.prepare(
    'SELECT id, title, scheduled_at, seller_id FROM live_streams WHERE id = ?'
  ).bind(stream_id).first<any>();
  if (!stream || !stream.scheduled_at) {
    return c.json({ success: false, error: '예정 방송 정보를 찾을 수 없습니다' }, 404);
  }

  const seller = await DB.prepare('SELECT name FROM sellers WHERE id = ?')
    .bind(stream.seller_id).first<{ name: string }>();

  const kakaoToken = await getKakaoToken(DB, user.id, (c.env as any).KAKAO_REST_API_KEY);
  if (!kakaoToken) {
    return c.json({ success: false, error: '카카오 연동이 필요합니다. 다시 로그인해주세요.' }, 400);
  }

  try {
    const startAt = new Date(stream.scheduled_at);
    startAt.setMinutes(Math.ceil(startAt.getMinutes() / 5) * 5, 0, 0);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // +1시간

    const event = {
      title: `🔴 ${seller?.name || '셀러'} 라이브: ${stream.title}`,
      time: {
        start_at: startAt.toISOString().replace('.000Z', 'Z'),
        end_at: endAt.toISOString().replace('.000Z', 'Z'),
        time_zone: 'Asia/Seoul',
      },
      description: `유어딜 라이브 방송\n${stream.title}\n\n시청하기: https://live.ur-team.com/live/${stream.id}`,
      reminders: [5], // 5분 전 알림
      color: 'RED',
    };

    const res = await fetch('https://kapi.kakao.com/v2/api/calendar/create/event', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kakaoToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `event=${encodeURIComponent(JSON.stringify(event))}`,
    });

    const data: any = await res.json();
    if (isKakaoScopeError(data, res.status)) {
      return scopeErrorResponse(c, 'talk_calendar');
    }
    if (data.event_id) {
      return c.json({ success: true, data: { event_id: data.event_id }, message: '카카오 캘린더에 등록되었습니다' });
    }
    return c.json({ success: false, error: data.msg || '캘린더 등록 실패' }, 400);
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '카카오 캘린더 API 오류' }, 500);
  }
});

// ── GET /calendar/ics/:streamId — Google/Apple Calendar용 .ics 파일 (글로벌) ──
kakaoSocialRoutes.get('/calendar/ics/:streamId', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  const stream = await DB.prepare(
    'SELECT id, title, scheduled_at, seller_id FROM live_streams WHERE id = ?'
  ).bind(streamId).first<any>();

  if (!stream || !stream.scheduled_at) {
    return c.json({ success: false, error: '방송 정보 없음' }, 404);
  }

  const seller = await DB.prepare('SELECT name FROM sellers WHERE id = ?')
    .bind(stream.seller_id).first<{ name: string }>();

  const start = new Date(stream.scheduled_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YourDeal//Live//KO',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:🔴 ${seller?.name || 'Seller'} Live: ${stream.title}`,
    `DESCRIPTION:Watch at https://live.ur-team.com/live/${stream.id}`,
    `URL:https://live.ur-team.com/live/${stream.id}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Live starts in 30 minutes!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="yourdeal-live-${streamId}.ics"`,
    },
  });
});

// ── POST /message/send-to-subscribers — 구독자 전원에게 카카오 메시지 (크론용) ──
kakaoSocialRoutes.post('/message/send-to-subscribers', async (c) => {
  const { DB } = c.env;
  const { stream_id } = await c.req.json<{ stream_id: number }>();

  const stream = await DB.prepare('SELECT id, title, seller_id FROM live_streams WHERE id = ?')
    .bind(stream_id).first<any>();
  if (!stream) return c.json({ success: false, error: '방송 없음' }, 404);

  const seller = await DB.prepare('SELECT name FROM sellers WHERE id = ?')
    .bind(stream.seller_id).first<{ name: string }>();

  // 구독자 중 카카오 토큰이 있는 유저
  const { results: subs } = await DB.prepare(`
    SELECT bs.user_id, u.kakao_access_token
    FROM broadcast_subscriptions bs
    JOIN users u ON CAST(bs.user_id AS TEXT) = CAST(u.id AS TEXT)
    WHERE bs.stream_id = ? AND bs.notified = 0 AND u.kakao_access_token IS NOT NULL
  `).bind(stream_id).all<{ user_id: string; kakao_access_token: string }>();

  let sent = 0;
  const kakaoApiKey = (c.env as any).KAKAO_REST_API_KEY;
  if (subs) {
    for (const sub of subs) {
      try {
        const freshToken = await getKakaoToken(DB, sub.user_id, kakaoApiKey);
        if (!freshToken) continue;
        const templateObject = JSON.stringify({
          object_type: 'feed',
          content: {
            title: `🔴 ${seller?.name || '셀러'} 라이브 시작!`,
            description: stream.title,
            image_url: 'https://live.ur-team.com/og-image.png',
            link: {
              web_url: `https://live.ur-team.com/live/${stream.id}`,
              mobile_web_url: `https://live.ur-team.com/live/${stream.id}`,
            },
          },
          buttons: [{
            title: '시청하기',
            link: {
              web_url: `https://live.ur-team.com/live/${stream.id}`,
              mobile_web_url: `https://live.ur-team.com/live/${stream.id}`,
            },
          }],
        });

        await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `template_object=${encodeURIComponent(templateObject)}`,
        });
        sent++;
      } catch {}
    }
  }

  return c.json({ success: true, data: { sent } });
});

// ── POST /test/message — 테스트용 카카오 메시지 발송 (서버 경유) ──
kakaoSocialRoutes.post('/test/message', async (c) => {
  const { access_token } = await c.req.json<{ access_token: string }>();
  if (!access_token) return c.json({ success: false, error: '토큰이 필요합니다' }, 400);

  try {
    const templateObject = JSON.stringify({
      object_type: 'feed',
      content: {
        title: '🔴 유어딜 라이브 시작!',
        description: '테스트 메시지입니다. 카카오 메시지 API 연동 확인용.',
        image_url: 'https://live.ur-team.com/og-image.png',
        link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' },
      },
      buttons: [{ title: '유어딜 바로가기', link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' } }],
    });

    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `template_object=${encodeURIComponent(templateObject)}`,
    });
    const data: any = await res.json();

    if (isKakaoScopeError(data, res.status)) return scopeErrorResponse(c, 'talk_message');
    if (data.result_code === 0) return c.json({ success: true });
    return c.json({ success: false, error: data.msg || JSON.stringify(data) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── POST /test/calendar — 테스트용 카카오 캘린더 (서버 경유) ──
kakaoSocialRoutes.post('/test/calendar', async (c) => {
  const { access_token } = await c.req.json<{ access_token: string }>();
  if (!access_token) return c.json({ success: false, error: '토큰이 필요합니다' }, 400);

  try {
    const start = new Date(Date.now() + 3600000);
    // 카카오 캘린더는 5분 단위 필수
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);
    const end = new Date(start.getTime() + 3600000);

    // 1. 일정 생성
    const event = {
      title: '🔴 유어딜 라이브 테스트',
      time: { start_at: start.toISOString(), end_at: end.toISOString(), time_zone: 'Asia/Seoul' },
      description: '카카오 캘린더 API 테스트',
      reminders: [30],
      color: 'RED',
    };
    const createRes = await fetch('https://kapi.kakao.com/v2/api/calendar/create/event', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `event=${encodeURIComponent(JSON.stringify(event))}`,
    });
    const createData: any = await createRes.json();

    if (isKakaoScopeError(createData, createRes.status)) return scopeErrorResponse(c, 'talk_calendar');
    if (!createData.event_id) {
      return c.json({ success: false, error: createData.msg || JSON.stringify(createData) });
    }

    // 2. 일정 삭제 (정리)
    await fetch(`https://kapi.kakao.com/v2/api/calendar/delete/event?event_id=${createData.event_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    return c.json({ success: true, detail: `일정 생성 성공 (event_id: ${createData.event_id}) → 삭제 완료` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── POST /test/friends — 친구 목록 조회 테스트 (서버 경유) ──
kakaoSocialRoutes.post('/test/friends', async (c) => {
  const { access_token } = await c.req.json<{ access_token: string }>();
  if (!access_token) return c.json({ success: false, error: '토큰 필요' }, 400);

  try {
    const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });
    const data: any = await res.json();

    if (isKakaoScopeError(data, res.status)) return scopeErrorResponse(c, 'friends');
    if (data.elements) {
      return c.json({ success: true, count: data.elements.length, friends: data.elements.slice(0, 5) });
    }
    return c.json({ success: false, error: data.msg || JSON.stringify(data) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── POST /test/friend-message — 친구에게 메시지 전송 테스트 (서버 경유) ──
kakaoSocialRoutes.post('/test/friend-message', async (c) => {
  const { access_token, friend_uuid } = await c.req.json<{ access_token: string; friend_uuid?: string }>();
  if (!access_token) return c.json({ success: false, error: '토큰 필요' }, 400);

  try {
    let uuid = friend_uuid;
    let friendName = '친구';

    if (!uuid) {
      // friend_uuid가 없으면 친구 목록 조회
      const friendsRes = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      const friendsData: any = await friendsRes.json();

      if (!friendsData.elements || friendsData.elements.length === 0) {
        return c.json({ success: false, error: '친구가 없습니다 (앱에 가입한 친구가 필요합니다)' });
      }
      uuid = friendsData.elements[0].uuid;
      friendName = friendsData.elements[0].profile_nickname || '친구';
    }

    // 친구에게 메시지 전송
    const templateObject = JSON.stringify({
      object_type: 'feed',
      content: {
        title: '🔴 유어딜 라이브 커머스',
        description: '친구에게 보내는 테스트 메시지입니다.',
        image_url: 'https://live.ur-team.com/og-image.png',
        link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' },
      },
      buttons: [{ title: '유어딜 바로가기', link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' } }],
    });

    const msgRes = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `receiver_uuids=${encodeURIComponent(JSON.stringify([uuid]))}&template_object=${encodeURIComponent(templateObject)}`,
    });
    const msgData: any = await msgRes.json();

    if (isKakaoScopeError(msgData, msgRes.status)) return scopeErrorResponse(c, 'friends,talk_message');
    if (msgData.successful_receiver_uuids && msgData.successful_receiver_uuids.length > 0) {
      return c.json({ success: true, detail: `${friendName}님에게 메시지 전송 성공!` });
    }
    return c.json({ success: false, error: msgData.msg || JSON.stringify(msgData) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export { kakaoSocialRoutes };
