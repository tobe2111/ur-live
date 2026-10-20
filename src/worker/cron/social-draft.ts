/**
 * 🆕 2026-07-15: 소셜 홍보 초안 주간 생성 cron (스레드/인스타/유튜브).
 *
 * 플랫폼별 미작성 주제로 **비공개 초안**을 생성한다(관리자 검토 후 발행). 자동 발행 없음.
 * 킬스위치: env.SOCIAL_AUTO_DRAFT_ENABLED === 'true' 일 때만(기본 OFF → API 토큰 낭비 0).
 * 미검토 초안 과다 시 자동 skip(createSocialDraft 내부 캡).
 * 🎯 2026-10-15: ANTHROPIC 키 게이트 제거 — 키가 없으면 결정론 작성기로 만든다(2026-08-01 라우트와 같은 판단.
 *    이 크론에만 게이트가 남아 있어서, 키 없는 환경에선 스위치를 켜도 초안이 0건이었다).
 *    대상(매장·소개 파트너·손님)은 createSocialDraft 가 어드민 혼합비로 고른다.
 */
import type { Env } from '../types/env';
import { logInfo, logError } from '../utils/logger';

export async function handleSocialDraft(env: Env): Promise<void> {
  const e = env as unknown as Record<string, string | undefined>;
  if (e.SOCIAL_AUTO_DRAFT_ENABLED !== 'true') return; // 킬스위치 OFF → no-op
  try {
    const { createSocialDraft } = await import('../../features/social-media/api/social-draft');
    const { SOCIAL_PLATFORMS } = await import('../../features/social-media/api/social-brief');
    for (const platform of SOCIAL_PLATFORMS) {
      const r = await createSocialDraft(env, platform);
      if (r.ok) {
        logInfo(`[cron:social-draft] ${platform} 초안 생성: "${r.title}" (id=${r.id}, 비공개)`);
        // 🖼️ 2026-10-17: 인스타는 이미지가 없으면 게시가 막힌다 → 초안과 함께 카드 이미지를 만든다(실패해도 초안은 남음).
        if (platform === 'instagram') {
          const { attachCardImage } = await import('../../features/social-media/api/social-image-render');
          const img = await attachCardImage(env, r.id).catch((e) => ({ ok: false as const, error: String(e) }));
          if (img.ok) logInfo(`[cron:social-draft] instagram 카드 이미지: ${img.url}`);
          else logError('[cron:social-draft] 카드 이미지 실패(초안은 유지)', { id: r.id, error: img.error });
        }
      }
      else if (r.skipped) logInfo(`[cron:social-draft] ${platform} skip — ${r.skipped}`);
      else logError(`[cron:social-draft] ${platform} 생성 실패`, { error: r.error });
    }
  } catch (err) {
    logError('[cron:social-draft] 예외', { error: String(err) });
  }
}
