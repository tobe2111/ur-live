/**
 * 🛡️ 2026-06-20 Pending-Auth fragment 채널 (iOS-safe, 미래 확장 대비 SSOT).
 *
 * 문제: 카카오 OAuth 리다이렉트(`/auth/kakao/sync/callback`)가 링크된 역할 토큰(seller/agency 등)을
 *   `ur_pending_*` **transfer 쿠키**(cross-site 302 응답 set)로 넘겼는데, iOS Safari/WebKit 은
 *   이 쿠키를 미영속 처리 → 토큰이 localStorage 에 안 닿아 **iOS 에서 대시보드 로그인 실패**.
 *   (소비자 세션은 별도 establish 로 해결됨. 이건 그 자매 문제 — 역할 토큰 전달.)
 *
 * 해법: 역할 토큰을 **URL fragment(`#...&auth=<b64url(JSON)>`)** 로 전달. fragment 는 서버/Referer/
 *   로그로 전송되지 않고, **어떤 쿠키 정책에도 안 걸려 모든 브라우저(특히 iOS)에서 생존**한다.
 *   클라(auth-callback-bootstrap)가 decode → 허용목록 키만 localStorage 로 이전 후 hash 제거.
 *
 * 미래 확장(중요): 새 역할 로그인이 `/sync/callback` 에서 토큰을 발급하면, 그 토큰을 이 맵에 한 줄
 *   추가하기만 하면 전달이 자동으로 iOS-safe 해진다. 클라 허용목록은 `seller_`/`agency_`/`supplier_`
 *   네임스페이스 + 명시 키를 포괄하므로 같은 네임스페이스면 클라 변경도 불필요.
 *   ⚠️ 토큰 값 자체는 서명된 JWT 라 서버가 검증 → fragment 위·변조해도 가짜 토큰은 통과 못 함(서명 불필요).
 */

/**
 * localStorage 키→값 맵을 base64url(JSON) 으로 인코딩. 빈 값/누락은 제외. 비면 '' 반환.
 * 호출자: `const a = encodePendingAuth({...}); const frag = a ? '&auth=' + a : ''`
 */
export function encodePendingAuth(ls: Record<string, string | number | undefined | null>): string {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(ls)) {
    if (v === undefined || v === null || v === '') continue;
    clean[k] = String(v);
  }
  if (Object.keys(clean).length === 0) return '';
  const json = JSON.stringify(clean);
  // UTF-8 안전 base64url (seller_name 등 한글 포함 가능 → btoa 직접 호출 불가)
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
