/**
 * 📝 2026-07-01: 블로그 AI 홍보 초안 주간 생성 cron.
 *
 * 매주 1편, 다뤄지지 않은 홍보 주제로 **비공개 초안**을 생성한다(관리자 검토 후 발행).
 * 홍보/마케팅 전용 — 운영/내부 정보는 blog-ai.ts 의 brief/검증에서 원천 차단.
 *
 * 킬스위치: env.BLOG_AI_DRAFTS_ENABLED === 'true' 일 때만 동작(기본 OFF → API 토큰 낭비 0).
 * ANTHROPIC_API_KEY 미설정 시 no-op. 미검토 초안 과다 시 자동 중단(createAiBlogDraft 내부 캡).
 */
import type { Env } from '../types/env';
import { logInfo, logError } from '../utils/logger';

export async function handleBlogAiDraft(env: Env): Promise<void> {
  if (env.BLOG_AI_DRAFTS_ENABLED !== 'true') return; // 킬스위치 OFF → no-op
  if (!env.ANTHROPIC_API_KEY) return;
  try {
    const { createAiBlogDraft } = await import('../../features/blog/api/blog.routes');
    const r = await createAiBlogDraft(env.DB, env.ANTHROPIC_API_KEY);
    if (r.ok) {
      logInfo(`[cron:blog-ai-draft] 초안 생성: "${r.title}" (id=${r.id}, 비공개)`);
    } else if (r.skipped) {
      logInfo(`[cron:blog-ai-draft] skip — ${r.skipped}`);
    } else {
      logError('[cron:blog-ai-draft] 생성 실패', { error: r.error });
    }
  } catch (e) {
    logError('[cron:blog-ai-draft] 예외', { error: String(e) });
  }
}
