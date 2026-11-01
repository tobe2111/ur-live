/**
 * 🔐 GitHub Actions OIDC 토큰 검증 (2026-10-20)
 *
 * 마케팅 봇(GitHub Actions)이 서버에 "알림 보내 줘" 를 요청할 때 **공유 비밀 없이** 신원을 증명한다.
 * 워크플로가 `permissions: id-token: write` 로 GitHub 이 서명한 짧은 JWT 를 받아 보내고,
 * 서버는 GitHub 공개키(JWKS)로 서명을 확인한 뒤 "이 레포의 main 에서 돈 워크플로" 인지만 본다.
 * ⇒ 대표가 시크릿을 두 곳(GitHub·Cloudflare)에 맞춰 넣을 필요가 없고, 새어 나갈 비밀도 없다.
 *
 * 순수 WebCrypto(RS256) — 외부 의존 0. 실패는 전부 null(호출부가 401).
 */

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;

export interface GithubOidcClaims {
  iss: string; aud: string | string[]; exp: number; nbf?: number; iat?: number;
  repository: string; ref: string; workflow_ref?: string; run_id?: string; actor?: string;
}

export interface GithubOidcPolicy { audience: string; repository: string; ref?: string }

let jwksCache: { at: number; keys: JsonWebKey[] } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlJson<T>(s: string): T { return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T; }

async function getJwks(fetchImpl: typeof fetch): Promise<JsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const j = (await res.json()) as { keys?: JsonWebKey[] };
  jwksCache = { at: Date.now(), keys: j.keys || [] };
  return jwksCache.keys;
}

/** 클레임 판정만 — 서명 검증과 분리해 시험할 수 있게 */
export function claimsAllowed(c: Partial<GithubOidcClaims>, p: GithubOidcPolicy, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (c.iss !== GITHUB_OIDC_ISSUER) return false;
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(p.audience)) return false;
  if (typeof c.exp !== 'number' || c.exp < nowSec) return false;
  if (typeof c.nbf === 'number' && c.nbf > nowSec + 60) return false;
  if (c.repository !== p.repository) return false;
  if (c.ref !== (p.ref ?? 'refs/heads/main')) return false;
  return true;
}

export async function verifyGithubOidc(
  token: string | null | undefined, policy: GithubOidcPolicy, fetchImpl: typeof fetch = fetch,
): Promise<GithubOidcClaims | null> {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = b64urlJson<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== 'RS256' || !header.kid) return null;
    const jwk = (await getJwks(fetchImpl)).find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const claims = b64urlJson<GithubOidcClaims>(parts[1]);
    return claimsAllowed(claims, policy) ? claims : null;
  } catch {
    return null;
  }
}

/** 시험 전용 — JWKS 캐시 비우기 */
export function _resetJwksCache(): void { jwksCache = null; }
