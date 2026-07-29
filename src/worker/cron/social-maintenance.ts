/**
 * 🆕 2026-07-15: 소셜 홍보 유지보수 cron (매시간).
 *
 * ① 영상 렌더 폴링 — 진행 중(processing)인 렌더를 확인해 done 이면 media_url 세팅(hands-off 완료).
 * ② 예약 발행 — 관리자가 승인 + 예약(scheduled_at)한 글을 시각이 되면 발행.
 *
 * 안전:
 *  - 렌더 폴링은 항상 안전(진행 중 건만 조회, 없으면 no-op).
 *  - 예약 발행은 킬스위치 SOCIAL_AUTO_PUBLISH_ENABLED === 'true' 일 때만(기본 OFF).
 *    발행 자체는 publishPost 가 [플랫폼 게이트 + 계정 + approved] 3중 조건을 재확인(자동발행 남용 방지).
 *  - 사람이 명시적으로 승인 + 예약한 글만 대상(초안-우선 철학 유지).
 */
import type { Env } from '../types/env';
import { logInfo, logError } from '../utils/logger';

export async function handleSocialMaintenance(env: Env): Promise<void> {
  try {
    const store = await import('../../features/social-media/api/social-store');
    // ① 영상 렌더 폴링
    try {
      const { checkVideoRender } = await import('../../features/social-media/api/social-video-flow');
      const processing = await store.listProcessingRenders(env.DB);
      for (const p of processing) {
        const r = await checkVideoRender(env, p.id);
        if (r.ok && r.status === 'done') logInfo(`[cron:social-maintenance] 렌더 완료 post=${p.id}`);
      }
    } catch (e) { logError('[cron:social-maintenance] 렌더 폴링 예외', { error: String(e) }); }

    // ② 예약 발행 (킬스위치 ON 일 때만)
    if ((env as unknown as Record<string, string | undefined>).SOCIAL_AUTO_PUBLISH_ENABLED === 'true') {
      try {
        const { publishPost } = await import('../../features/social-media/api/social-publish');
        const due = await store.listDuePosts(env.DB);
        for (const p of due) {
          const r = await publishPost(env, p.id);
          if (r.ok) logInfo(`[cron:social-maintenance] 예약 발행 성공 post=${p.id} (${p.platform})`);
          else logInfo(`[cron:social-maintenance] 예약 발행 보류 post=${p.id}: ${r.error}`);
        }
      } catch (e) { logError('[cron:social-maintenance] 예약 발행 예외', { error: String(e) }); }
    }
  } catch (e) {
    logError('[cron:social-maintenance] 예외', { error: String(e) });
  }
}
