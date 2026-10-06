import { readCookie } from './read-cookie'

/**
 * 🔁 CSRF 토큰을 **한 번만** 받는다 (2026-10-06 — 지도 첫 화면에서 **6회** 받고 있었다).
 * 쿠키를 세팅하는 건 **응답**이라 요청이 겹친 구간엔 아무도 쿠키를 못 본다 ⇒ in-flight 공유.
 * ⚠️ **반드시 모듈 스코프** — 인터셉터 콜백 안이면 요청마다 새로 만들어지는데 들여쓰기로는
 *   안 보인다(실제로 그렇게 틀렸다. 시험이 중괄호 깊이를 센다).
 *   근거: `docs/handoff/2026-10-06-first-screen-duplicate-fetch.md`
 */
let csrfInFlight: Promise<string> | null = null;
export async function ensureCsrfToken(): Promise<string> {
  const have = readCookie('csrf_token');
  if (have) return have;
  if (!csrfInFlight) {
    csrfInFlight = (async () => {
      try {
        const r = await fetch('/api/csrf-token', { credentials: 'include' });
        const json = await r.json() as { token?: string };
        return json?.token || readCookie('csrf_token') || '';
      } catch {
        // graceful — 서버가 403 을 주면 그때 사용자에게 알린다(종전과 동일)
        return '';
      }
    })();
    // 끝나면 비운다 — 토큰이 만료된 다음 번엔 다시 받아야 한다.
    void csrfInFlight.finally(() => { csrfInFlight = null; });
  }
  return csrfInFlight;
}
