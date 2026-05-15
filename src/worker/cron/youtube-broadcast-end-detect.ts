import { logInfo, logError } from '../utils/logger'
import { broadcastStreamStatus } from '../utils/broadcast-stream-status'
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
    uploadStatus?: 'uploaded' | 'processed' | 'failed' | 'rejected' | 'deleted';
  };
}

const BATCH_SIZE = 50;

export async function handleYoutubeBroadcastEndDetect(env: Env): Promise<void> {
  const DB = env.DB;
  const apiKey = (env as Env & { YOUTUBE_API_KEY?: string }).YOUTUBE_API_KEY;
  if (!DB || !apiKey) return;

  // status IN ('scheduled', 'live') + youtube_video_id 있는 stream — 시작/종료 동기화 대상
  // 🛡️ 2026-05-14: + 최근 24h 안에 종료된 stream 도 vod_ready 재확인 대상.
  //   YouTube VOD 처리는 보통 5-30분, 가끔 몇 시간. 첫 cron 후 vod_ready=0 면 매 cron 마다 재확인 필요.
  //   24h 후엔 거의 모든 케이스 처리 완료 → 더 이상 체크 안 함 (API quota 절약).
  const pending = await DB.prepare(`
    SELECT id, seller_id, youtube_video_id, status, started_at
    FROM live_streams
    WHERE youtube_video_id IS NOT NULL
      AND youtube_video_id != ''
      AND (
        status IN ('scheduled', 'live')
        OR (
          status = 'ended'
          AND ended_at > datetime('now', '-24 hours')
          AND (vod_ready IS NULL OR vod_ready = 0)
          AND (vod_blocked_reason IS NULL OR vod_blocked_reason = '')
        )
      )
    ORDER BY
      CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
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
    logError('[cron:yt-broadcast-sync] fetch failed', { error: (err as Error).message });
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
      // 🛡️ 2026-05-14: VOD 상태 함께 체크 (모든 ended stream 에 대해 매 cron 마다).
      //   uploadStatus = 'processed' 이고 차단 사유 없으면 vod_ready=1.
      //   차단 사유 있으면 vod_blocked_reason 저장.
      const vodStatus = video.status;
      const blockReasons: string[] = [];
      if (vodStatus?.privacyStatus === 'private') blockReasons.push('private');
      if (vodStatus?.embeddable === false) blockReasons.push('embed_disabled');
      if (vodStatus?.madeForKids === true) blockReasons.push('made_for_kids');
      const uploadStatus = vodStatus?.uploadStatus; // 'uploaded' | 'processed' | 'failed' | 'rejected' | 'deleted'
      const isProcessed = uploadStatus === 'processed';
      const isFailed = uploadStatus === 'failed' || uploadStatus === 'rejected' || uploadStatus === 'deleted';
      let vodReady = 0;
      let vodBlockedReason: string | null = null;
      if (blockReasons.length > 0) vodBlockedReason = blockReasons.join(',');
      else if (isFailed) vodBlockedReason = 'processing_failed';
      else if (isProcessed) vodReady = 1;
      // 종료된 stream 만 vod 컬럼 업데이트
      if (stream.status === 'ended' || lsd.actualEndTime) {
        await DB.prepare(`
          UPDATE live_streams
          SET vod_ready = ?, vod_blocked_reason = ?, vod_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(vodReady, vodBlockedReason, stream.id).run().catch(() => { /* column 없으면 skip */ });
        // VOD 상태 변화 알림 (이번 cron 에서 처음 ready 가 됐으면 시청자 WS 알림)
        if (vodReady === 1 || vodBlockedReason) {
          await broadcastStreamStatus(env, stream.id, 'ended', { type: 'system', id: 0 }).catch(() => {})
        }
      }

      // 종료 감지 (최우선)
      if (lsd.actualEndTime) {
        if (stream.status !== 'ended') {
          await DB.prepare(`
            UPDATE live_streams
            SET status = 'ended', ended_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status IN ('scheduled', 'live')
          `).bind(lsd.actualEndTime, stream.id).run();
          // 🛡️ 2026-05-14: DO broadcast — 시청자 즉시 'ended' WS 신호 (Tier S seq + eventLog).
          await broadcastStreamStatus(env, stream.id, 'ended', { type: 'system', id: 0 })
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

        // 🛡️ 2026-05-15 (PRISM 따라잡기): scheduled → live 전환 시 단골 자동 push.
        //   seller_follows 테이블에서 단골 user_id 조회 → web push + dashboard notification.
        //   stream 별 1회만 발송 (started_at 가 NULL 이었던 케이스만, 위 UPDATE 가 처리됨).
        try {
          const streamMeta = await DB.prepare(
            `SELECT id, title, seller_id, youtube_video_id, thumbnail_url
             FROM live_streams WHERE id = ?`
          ).bind(stream.id).first<{ id: number; title: string; seller_id: number; youtube_video_id: string | null; thumbnail_url: string | null }>();
          if (!streamMeta) continue;

          const sellerRow = await DB.prepare(
            `SELECT name FROM sellers WHERE id = ?`
          ).bind(streamMeta.seller_id).first<{ name: string }>().catch(() => null);
          const sellerName = sellerRow?.name || '셀러';

          const { results: followers } = await DB.prepare(
            `SELECT user_id FROM seller_follows WHERE seller_id = ? AND notify_live_start = 1`
          ).bind(streamMeta.seller_id).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }));

          if (followers && followers.length > 0) {
            const { sendSystemPush } = await import('../../lib/system-push');
            const liveUrl = `/live/${streamMeta.id}`;
            const pushBody = `${sellerName}님이 라이브를 시작했어요!`;
            const pushTitle = `📺 ${streamMeta.title.slice(0, 80)}`;
            let pushSent = 0;

            for (const f of followers) {
              try {
                // dashboard notification (D1 영구 기록)
                await DB.prepare(
                  `INSERT INTO user_notifications (user_id, type, title, message, link)
                   VALUES (?, 'live_start_follower', ?, ?, ?)`
                ).bind(f.user_id, pushTitle, pushBody, liveUrl).run().catch(() => { /* table may not exist */ });

                // web push (단골 사용자 본인의 push_subscription 으로)
                const r = await sendSystemPush(env, 'user', f.user_id, {
                  title: pushTitle,
                  body: pushBody,
                  url: liveUrl,
                  tag: `live-start-${streamMeta.id}`,  // 같은 라이브 중복 push 방어
                });
                if (r.success) pushSent++;
              } catch { /* per-follower 실패 skip */ }
            }
            logInfo(`[cron:yt-broadcast-sync] stream=${stream.id} live_start_push followers=${followers.length} sent=${pushSent}`);
          }
        } catch (e) {
          logError(`[cron:yt-broadcast-sync] stream=${stream.id} follower notify failed`, { error: (e as Error).message });
        }
      }
    } catch (err) {
      logError(`[cron:yt-broadcast-sync] stream=${stream.id} update failed:`, { error: (err as Error).message });
    }
  }

  logInfo(`[cron:yt-broadcast-sync] checked=${streams.length} started=${started} ended=${ended}`);
}
