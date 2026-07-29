/**
 * 🆕 2026-07-15: 소셜 홍보 초안 주간 생성 cron (스레드/인스타/유튜브).
 *
 * 플랫폼별 미작성 주제로 **비공개 초안**을 생성한다(관리자 검토 후 발행). 자동 발행 없음.
 * 킬스위치: env.SOCIAL_AUTO_DRAFT_ENABLED === 'true' 일 때만(기본 OFF → API 토큰 낭비 0).
 * ANTHROPIC_API_KEY 미설정 시 no-op. 미검토 초안 과다 시 자동 skip(createSocialDraft 내부 캡).
 */
import type { Env } from '../types/env';
import { logInfo, logError } from '../utils/logger';

export async function handleSocialDraft(env: Env): Promise<void> {
  const e = env as unknown as Record<string, string | undefined>;
  if (e.SOCIAL_AUTO_DRAFT_ENABLED !== 'true') return; // 킬스위치 OFF → no-op
  if (!env.ANTHROPIC_API_KEY) return;
  try {
    const { createSocialDraft } = await import('../../features/social-media/api/social-draft');
    const { SOCIAL_PLATFORMS } = await import('../../features/social-media/api/social-brief');
    for (const platform of SOCIAL_PLATFORMS) {
      const r = await createSocialDraft(env, platform);
      if (r.ok) logInfo(`[cron:social-draft] ${platform} 초안 생성: "${r.title}" (id=${r.id}, 비공개)`);
      else if (r.skipped) logInfo(`[cron:social-draft] ${platform} skip — ${r.skipped}`);
      else logError(`[cron:social-draft] ${platform} 생성 실패`, { error: r.error });
    }
  } catch (err) {
    logError('[cron:social-draft] 예외', { error: String(err) });
  }
}
