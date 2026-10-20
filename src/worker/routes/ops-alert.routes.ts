/**
 * 🔔 운영 알림 → 대표 카톡 "나에게 보내기" (2026-10-20 대표 확정 — 무료 방식)
 *
 *   POST /api/ops/alert   { title, text, url? }
 *
 * - 호출자: 마케팅 봇(GitHub Actions). 신원은 **GitHub OIDC 토큰**으로만 증명한다(공유 비밀 0) — utils/github-oidc.ts
 * - 받는 사람: platform_settings `ops_alert_user_id`(기본 3 = 대표 본인 계정, CLAUDE.md 👤 절)
 * - 보내는 길: 대표가 카카오 로그인 때 맡긴 토큰(users.kakao_*_token, 암호화)으로 talk/memo 발송.
 *   토큰 만료는 callKakaoApi 가 refresh 로 자동 갱신한다. 권한(talk_message)이 없으면 409 + 동의 링크.
 * - 하루 상한 20건(platform_settings `ops_alert_count:YYYYMMDD`) — 고장 난 봇이 카톡을 도배하지 않게.
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { verifyGithubOidc } from '../utils/github-oidc';
import { callKakaoApi } from '../../lib/kakao-token';

export const OPS_ALERT_AUDIENCE = 'urdeal-ops-alert';
export const OPS_ALERT_REPO = 'tobe2111/ur-live';
export const OPS_ALERT_DAILY_CAP = 20;
export const OPS_ALERT_CONSENT_URL = 'https://urdeal.kr/auth/kakao/consent/start?scope=talk_message&return=/user/profile';

/** 카톡 텍스트 템플릿 — 본문 200자 상한(카카오 text 템플릿 제한), 버튼 링크는 urdeal.kr 또는 github.com 만 */
export function buildOpsAlertTemplate(title: string, text: string, url?: string): string {
  const safeUrl = url && /^https:\/\/(urdeal\.kr|github\.com)\//.test(url) ? url : 'https://urdeal.kr/';
  const body = `🔔 ${String(title).slice(0, 40)}\n${String(text).slice(0, 150)}`.slice(0, 200);
  return JSON.stringify({ object_type: 'text', text: body, link: { web_url: safeUrl, mobile_web_url: safeUrl }, button_title: '자세히 보기' });
}

const opsAlertRoutes = new Hono<{ Bindings: Env }>();

// 인증 = GitHub OIDC (authenticateGithubWorkflow) — 사람 세션이 아니라 워크플로 신원
async function authenticateGithubWorkflow(authHeader: string | undefined) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return verifyGithubOidc(token, { audience: OPS_ALERT_AUDIENCE, repository: OPS_ALERT_REPO });
}

opsAlertRoutes.post('/api/ops/alert', async (c) => {
  const claims = await authenticateGithubWorkflow(c.req.header('authorization'));
  if (!claims) return c.json({ success: false, error: 'unauthorized' }, 401);

  const body = await c.req.json<{ title?: string; text?: string; url?: string }>().catch(() => ({} as { title?: string; text?: string; url?: string }));
  if (!body.title || !body.text) return c.json({ success: false, error: 'title, text 필요' }, 400);

  const { DB } = c.env;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
  const capKey = `ops_alert_count:${day}`;
  try {
    const row = await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, '1', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = datetime('now')
       RETURNING value`,
    ).bind(capKey).first<{ value: string }>();
    if (Number(row?.value || 0) > OPS_ALERT_DAILY_CAP) return c.json({ success: false, error: 'daily cap', code: 'OPS_ALERT_CAP' }, 429);

    const userRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ops_alert_user_id'").first<{ value: string }>();
    const userId = Number(userRow?.value) || 3;

    const template = buildOpsAlertTemplate(body.title, body.text, body.url);
    const r = await callKakaoApi(DB, userId, c.env.KAKAO_REST_API_KEY || '',
      'https://kapi.kakao.com/v2/api/talk/memo/default/send',
      { body: `template_object=${encodeURIComponent(template)}` }, c.env.DATA_ENCRYPTION_KEY);

    if (r.needsReauth) return c.json({ success: false, code: 'KAKAO_REAUTH_REQUIRED', consent_url: OPS_ALERT_CONSENT_URL }, 409);
    if (r.data?.result_code === 0) return c.json({ success: true });
    // 권한(talk_message) 미동의 = -402 류 — 동의 링크를 돌려준다
    return c.json({ success: false, code: 'KAKAO_SEND_FAILED', kakao_code: r.data?.code ?? null, consent_url: OPS_ALERT_CONSENT_URL }, 409);
  } catch (err) {
    console.error('[ops-alert]', err);
    return c.json({ success: false, error: '알림 발송 중 오류가 발생했습니다' }, 500);
  }
});

export { opsAlertRoutes };
