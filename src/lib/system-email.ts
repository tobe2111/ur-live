/**
 * 🛡️ 2026-04-28: 시스템 이메일 helper.
 *
 * Resend API 미설정 시 silent skip — production 영향 0.
 * 환경변수: RESEND_API_KEY, RESEND_FROM (optional)
 */

interface NotificationContent {
  subject: string;
  html: string;
}

export async function sendSystemEmail(
  env: unknown,
  to: string,
  content: NotificationContent,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const e = env as { RESEND_API_KEY?: string; RESEND_FROM?: string; DB?: D1Database };
  const apiKey = e?.RESEND_API_KEY;
  if (!apiKey) return { success: false, skipped: true };

  // 이메일 형식 검증
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { success: false, error: 'invalid email' };
  }

  try {
    const { sendEmail } = await import('../services/email');
    const result = await sendEmail(
      { to, subject: content.subject, html: content.html },
      apiKey,
      e?.RESEND_FROM,
      e?.DB
    );
    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 가입·승인 등 표준 시스템 메시지 HTML 빌더 (간단 템플릿).
 */
export function buildSystemEmailHtml(opts: {
  title: string;
  greeting: string;        // '안녕하세요 OOO님,'
  body: string;            // 본문 (단락별 줄바꿈)
  actionLabel?: string;    // 버튼 텍스트
  actionUrl?: string;      // 버튼 URL
}): string {
  const button = opts.actionLabel && opts.actionUrl
    ? `<p style="margin:24px 0;">
         <a href="${opts.actionUrl}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
           ${opts.actionLabel}
         </a>
       </p>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <h1 style="font-size:22px;margin:0 0 16px;background:linear-gradient(135deg,#ff6b6b,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">유어딜</h1>
      <h2 style="font-size:18px;margin:0 0 16px;">${opts.title}</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">${opts.greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;white-space:pre-line;">${opts.body}</p>
      ${button}
      <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;">
      <p style="font-size:11px;color:#999;line-height:1.5;text-align:center;">
        본 메일은 시스템 자동 발송 메일입니다.<br>
        <strong>리스터코퍼레이션</strong> | 사업자등록번호: 783-87-03224<br>
        문의: <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a>
      </p>
    </div>
  `;
}
