/**
 * 라이브 방송 상태 동기화 — 5분 cron (시작 + 종료 자동 감지)
 *
 * 셀러가 외부 도구 (YouTube Studio / OBS / Larix) 에서 방송을 시작하거나 끝내면
 * 우리 DB 는 그대로 멈춰있음. YouTube Data API 로 자동 감지하여 status 동기화.
 *
 *   actualStartTime O, actualEndTime X  →  status = 'live'  (방송 중)
 *   actualEndTime O                      →  status = 'ended' (종료)
 *   broadcastStatus = 'completed'        →  status = 'ended'
 *
 * - YOUTUBE_API_KEY 미설정 시 graceful skip (public videos.list — OAuth 불필요).
 * - 한 번에 최대 50개 (videos.list batch limit).
 * - 멱등 (이미 같은 status 이면 변경 안 함).
 *
 * Bonus: 다시보기 차단 자동 감지 (private/embed off/made-for-kids) → 셀러 알림.
 */

import type { Env } from '../types/env';

interface PendingStream {
  id: number;
  seller_id: number;
  youtube_video_id: string | null;
  status: string;
  started_at: string | null;
}

interface VideoItem {
  id: string;
  liveStreamingDetails?: {
    actualStartTime?: string;
    actualEndTime?: string;
  };
  status?: {
    privacyStatus?: 'public' | 'unlisted' | 'private';
    embeddable?: boolean;
    madeForKids?: boolean;
  };
}

const BATCH_SIZE = 50;

export async function handleYoutubeBroadcastEndDetect(env: Env): Promise<void> {
  const DB = env.DB;
  const apiKey = (env as Env & { YOUTUBE_API_KEY?: string }).YOUTUBE_API_KEY;
  if (!DB || !apiKey) return;

  // status IN ('scheduled', 'live') + youtube_video_id 있는 stream — 시작/종료 동기화 대상
  const pending = await DB.prepare(`
    SELECT id, seller_id, youtube_video_id, status, started_at
    FROM live_streams
    WHERE status IN ('scheduled', 'live')
      AND youtube_video_id IS NOT NULL
      AND youtube_video_id != ''
    ORDER BY
      CASE status WHEN 'live' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all<PendingStream>().catch(() => ({ results: [] as PendingStream[] }));

  const streams = pending.results || [];
  if (streams.length === 0) return;

  const videoIds = streams.map(s => s.youtube_video_id).filter(Boolean).join(',');

  let videos: VideoItem[] = [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,status&id=${videoIds}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[cron:yt-broadcast-sync] videos.list ${res.status}`);
      return;
    }
    const data = await res.json() as { items?: VideoItem[] };
    videos = data.items || [];
  } catch (err) {
    console.error('[cron:yt-broadcast-sync] fetch failed:', (err as Error).message);
    return;
  }

  if (videos.length === 0) return;

  let started = 0;
  let ended = 0;

  for (const stream of streams) {
    const video = videos.find(v => v.id === stream.youtube_video_id);
    if (!video) continue;

    const lsd = video.liveStreamingDetails;
    if (!lsd) continue;

    try {
      // 종료 감지 (최우선)
      if (lsd.actualEndTime) {
        if (stream.status !== 'ended') {
          await DB.prepare(`
            UPDATE live_streams
            SET status = 'ended', ended_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status IN ('scheduled', 'live')
          `).bind(lsd.actualEndTime, stream.id).run();
          ended++;

          // 셀러 알림 — 방송 종료 + 다시보기 재생 가능 여부
          const status = video.status;
          const replayBlocked =
            status?.privacyStatus === 'private' ||
            status?.embeddable === false ||
            status?.madeForKids === true;

          const notifTitle = replayBlocked ? '다시보기 재생 차단됨' : '방송 종료';
          const notifBody = replayBlocked
            ? `다시보기가 막혀있어요 (${status?.privacyStatus !== 'public' ? '비공개' : ''}${status?.embeddable === false ? ' 임베드차단' : ''}${status?.madeForKids ? ' 아동용' : ''}). YouTube Studio 에서 "공개" + "임베드 허용" 으로 변경하세요.`
            : '방송이 자동 감지되어 종료 처리되었습니다. 결산을 확인하세요.';

          await DB.prepare(`
            INSERT INTO notifications (user_id, type, title, body, link, created_at)
            VALUES (
              (SELECT user_id FROM sellers WHERE id = ?),
              'broadcast_ended',
              ?,
              ?,
              '/seller/live-analytics',
              CURRENT_TIMESTAMP
            )
          `).bind(stream.seller_id, notifTitle, notifBody).run().catch(() => { /* notifications 테이블 없으면 skip */ });
        }
      }
      // 시작 감지 — actualStartTime 있고 endTime 없음 → live 진행 중
      else if (lsd.actualStartTime && stream.status === 'scheduled') {
        await DB.prepare(`
          UPDATE live_streams
          SET status = 'live', started_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'scheduled'
        `).bind(lsd.actualStartTime, stream.id).run();
        started++;

        // 셀러 알림 — 방송 시작 자동 감지
        await DB.prepare(`
          INSERT INTO notifications (user_id, type, title, body, link, created_at)
          VALUES (
            (SELECT user_id FROM sellers WHERE id = ?),
            'broadcast_started',
            '방송 시작 감지',
            'YouTube Studio 에서 방송 시작이 자동 감지되었습니다. 시청자에게 노출됩니다.',
            ?,
            CURRENT_TIMESTAMP
          )
        `).bind(stream.seller_id, `/live/${stream.id}`).run().catch(() => { /* noop */ });
      }
    } catch (err) {
      console.error(`[cron:yt-broadcast-sync] stream=${stream.id} update failed:`, (err as Error).message);
    }
  }

  console.log(`[cron:yt-broadcast-sync] checked=${streams.length} started=${started} ended=${ended}`);
}
