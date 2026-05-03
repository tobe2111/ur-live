/**
 * 🛡️ 2026-05-03: Cloudflare Turnstile (CAPTCHA) 서버측 검증 헬퍼.
 *
 * 용도: login / register / donate / group_buy_create 등 봇 공격에 노출된 endpoint.
 * 분산 봇이 IP 분산 시 IP 기반 rate limit 만으로는 부족하므로 추가 방어 layer.
 *
 * 사용:
 *   const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, token, ip);
 *   if (!ok) return c.json({ error: 'Bot challenge failed' }, 403);
 *
 * 환경 변수 (Dashboard → Pages → Settings → Variables and Secrets):
 *   TURNSTILE_SITE_KEY (public, VITE_TURNSTILE_SITE_KEY 로 frontend 노출)
 *   TURNSTILE_SECRET   (server-only, 검증용)
 *
 * 미설정 시: 검증 skip (fail-open). production 강제 활성 원할 시 throw 하도록 변경.
 */

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Cloudflare Turnstile 토큰 검증.
 * @param secret - 서버측 비밀 키 (Dashboard 에서 발급)
 * @param token - 클라이언트 cf-turnstile-response 토큰
 * @param ip - CF-Connecting-IP (옵션, 추가 검증)
 * @returns true = 봇 아님 / false = 봇 또는 검증 실패
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined | null,
  ip?: string,
): Promise<boolean> {
  // secret 미설정 = production 활성 안 됨 (fail-open).
  // production 강제 활성 시 이 분기를 false 또는 throw 로 변경.
  if (!secret) {
    if (typeof console !== 'undefined') {
      console.warn('[Turnstile] TURNSTILE_SECRET not configured, skipping verification');
    }
    return true;
  }
  if (!token) return false;

  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: formData },
    );

    if (!response.ok) {
      console.warn('[Turnstile] Verify endpoint returned', response.status);
      return false;
    }

    const data = await response.json() as TurnstileVerifyResponse;
    if (!data.success) {
      console.warn('[Turnstile] Verification failed:', data['error-codes']);
    }
    return data.success === true;
  } catch (err) {
    console.warn('[Turnstile] Verify request failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}
