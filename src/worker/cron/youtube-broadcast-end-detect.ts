/**
 * 라이브 방송 종료 자동 감지 — 5분 cron
 *
 * 셀러가 YouTube Studio / OBS 등 외부 도구에서 방송을 끝내면 우리 DB는 status='live' 상태로 멈춰있음.
 * YouTube Data API videos.list (liveStreamingDetails.actualEndTime) 로 자동 감지하여
 * status='ended' + ended_at 채우기.
 *
 * - YOUTUBE_API_KEY 미설정 시 graceful skip (OAuth 불필요한 public endpoint 사용).
 * - 한 번에 최대 50개 처리 (videos.list 는 id 50개까지 batch 가능).
 * - 실패한 video 는 다음 cron 에서 재시도 (멱등).
 */

import type { Env } from '../types/env';

interface ActiveStream {
  id: number;
  seller_id: number;
  youtube_video_id: string | null;
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

  // status='live' + youtube_video_id 있는 stream 만 polling 대상
  const active = await DB.prepare(`
    SELECT id, seller_id, youtube_video_id, started_at
    FROM live_streams
    WHERE status = 'live'
      AND youtube_video_id IS NOT NULL
      AND youtube_video_id != ''
    ORDER BY started_at ASC
    LIMIT ?
  `).bind(BATCH_SIZE).all<ActiveStream>().catch(() => ({ results: [] as ActiveStream[] }));

  const streams = active.results || [];
  if (streams.length === 0) return;

  const videoIds = streams.map(s => s.youtube_video_id).filter(Boolean).join(',');

  let endedItems: VideoItem[] = [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,status&id=${videoIds}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[cron:yt-broadcast-end] videos.list ${res.status}`);
      return;
    }
    const data = await res.json() as { items?: VideoItem[] };
    endedItems = (data.items || []).filter(v => v.liveStreamingDetails?.actualEndTime);
  } catch (err) {
    console.error('[cron:yt-broadcast-end] fetch failed:', (err as Error).message);
    return;
  }

  if (endedItems.length === 0) return;

  const endedIdSet = new Set(endedItems.map(v => v.id));
  const toEnd = streams.filter(s => s.youtube_video_id && endedIdSet.has(s.youtube_video_id));

  for (const stream of toEnd) {
    const video = endedItems.find(v => v.id === stream.youtube_video_id);
    const endedAt = video?.liveStreamingDetails?.actualEndTime || new Date().toISOString();
    try {
      await DB.prepare(`
        UPDATE live_streams
        SET status = 'ended', ended_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'live'
      `).bind(endedAt, stream.id).run();

      // 셀러 푸시 알림 — 방송 종료 + 다시보기 재생 가능 여부
      const status = video?.status;
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
    } catch (err) {
      console.error(`[cron:yt-broadcast-end] stream=${stream.id} update failed:`, (err as Error).message);
    }
  }

  console.log(`[cron:yt-broadcast-end] checked=${streams.length} ended=${toEnd.length}`);
}
