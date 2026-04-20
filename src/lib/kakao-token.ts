/**
 * 카카오 토큰 관리 유틸리티
 * - access_token 유효성 체크
 * - 만료 시 refresh_token으로 자동 갱신
 * - 갱신 실패 시 DB에서 만료 토큰 정리
 */

export async function getKakaoToken(
  DB: D1Database, userId: string | number, kakaoRestApiKey: string
): Promise<{ token: string | null; needsReauth: boolean }> {
  const row = await DB.prepare(
    'SELECT kakao_access_token, kakao_refresh_token FROM users WHERE id = ?'
  ).bind(userId).first<{ kakao_access_token: string | null; kakao_refresh_token: string | null }>();

  if (!row?.kakao_access_token) return { token: null, needsReauth: true };

  const checkRes = await fetch('https://kapi.kakao.com/v1/user/access_token_info', {
    headers: { 'Authorization': `Bearer ${row.kakao_access_token}` },
  });

  if (checkRes.status === 200) return { token: row.kakao_access_token, needsReauth: false };

  if (!row.kakao_refresh_token) {
    await DB.prepare('UPDATE users SET kakao_access_token = NULL WHERE id = ?').bind(userId).run();
    return { token: null, needsReauth: true };
  }

  try {
    const refreshRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: kakaoRestApiKey,
        refresh_token: row.kakao_refresh_token,
      }),
    });

    if (refreshRes.ok) {
      const data: any = await refreshRes.json();
      await DB.prepare(
        'UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?'
      ).bind(data.access_token, data.refresh_token || null, userId).run();
      return { token: data.access_token, needsReauth: false };
    }

    // refresh_token도 만료됨 → DB 정리 + 재로그인 필요
    await DB.prepare(
      'UPDATE users SET kakao_access_token = NULL, kakao_refresh_token = NULL WHERE id = ?'
    ).bind(userId).run();
    return { token: null, needsReauth: true };
  } catch (e) {
    console.error('[KakaoToken] Refresh failed:', e);
    return { token: null, needsReauth: true };
  }
}

/**
 * 단순 버전 — 토큰만 반환 (기존 호환)
 */
export async function getKakaoTokenSimple(
  DB: D1Database, userId: string | number, kakaoRestApiKey: string
): Promise<string | null> {
  const { token } = await getKakaoToken(DB, userId, kakaoRestApiKey);
  return token;
}

/**
 * 카카오 API 호출 with 자동 재시도
 * 401 발생 시 토큰 갱신 후 1회 재시도
 */
export async function callKakaoApi(
  DB: D1Database, userId: string | number, kakaoRestApiKey: string,
  url: string, options: { method?: string; body?: string }
): Promise<{ ok: boolean; data: any; needsReauth: boolean }> {
  const { token, needsReauth } = await getKakaoToken(DB, userId, kakaoRestApiKey);
  if (!token) return { ok: false, data: null, needsReauth };

  const res = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: options.body,
  });

  const data: any = await res.json();

  if (res.status === 401) {
    // 토큰이 check와 API 호출 사이에 만료됨 → 1회 재시도
    const retry = await getKakaoToken(DB, userId, kakaoRestApiKey);
    if (!retry.token) return { ok: false, data, needsReauth: true };

    const retryRes = await fetch(url, {
      method: options.method || 'POST',
      headers: {
        'Authorization': `Bearer ${retry.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: options.body,
    });
    const retryData: any = await retryRes.json();
    return { ok: retryRes.ok, data: retryData, needsReauth: false };
  }

  return { ok: res.ok, data, needsReauth: false };
}
