/**
 * 🌍 SSR 페이로드 획득 3계층 (worker/index.ts 에서 추출 — 2026-08-22)
 *
 * ⚠️ 이 파일은 **잠긴 로딩 최적화**(CLAUDE.md "🔒 로딩 최적화 잠금")의 핵심이다.
 *    추출은 순수 이동이고 순서·타임아웃·이스케이프는 byte-불변이다. 계층 순서를 바꾸거나
 *    타임아웃을 줄이면 콜드 콜로 TTFB 가 그대로 회귀한다.
 *
 *   ① `caches.default` — **콜로별**. hit 이면 ~5ms. KV write 한도를 안 쓰므로 비용 $0.
 *   ② `CACHE_KV` — **전역**. cron 이 15분 표본화로 기록(`cache-prewarm.ts` SSR_KV_PATHS).
 *      ①이 콜로별이라 예열이 다른 지역에 안 미치는 것을 메운다. 미바인딩이면 조용히 건너뛴다.
 *   ③ self-fetch — 콜드 D1. 슬롯별 타임아웃(아래) 안에 못 끝내면 미주입 → 클라가 직접 받는다.
 */

import type { Context } from 'hono';

export interface SsrTarget {
  slot: string;
  path: string;
}

export interface SsrPayloadResult {
  /** `<script>` 안에 넣어도 안전하게 이스케이프된 JSON 문자열. 실패 시 null. */
  payload: string | null;
  /** `X-SSR-Status` 에 실리는 진단값(`edge-hit`·`kv-hit`·`self-fetch-404` …). */
  status: string;
  /** `Server-Timing` 항목들. */
  timings: string[];
}

/**
 * 슬롯별 self-fetch 타임아웃.
 * ⚠️ 값의 근거(전부 실측 사고에서 나왔다 — 임의로 줄이지 말 것):
 *   · 상세/셀러/큐레이터 2000ms — 1500ms 로는 콜드에서 자주 timeout → 스켈레톤 노출(2026-06-30).
 *   · 도매 3000ms — 저트래픽이라 콜로 캐시가 대부분 cold, 1500ms 로는 카탈로그가 고착(2026-06-19).
 *   · 섹션 2000ms — **위 2026-06-30 사고와 같은 것인데 이 슬롯만 빠져 있었다**(2026-08-27 대표
 *     신고 "지금 인기 이용권·숙소 섹션이 안 보인다"). 홈은 시드가 둘인데(MAIN·SECTIONS) 섹션만
 *     기본값 1500ms 로 떨어져, 콜드 콜로에서 self-fetch 가 자주 끊겼다 → 시드 없음 → 스켈레톤 +
 *     클라 왕복. 피드는 멀쩡한데 섹션만 늦는 그 화면의 정체다.
 */
export function timeoutFor(slot: string): number {
  if (
    slot === 'DETAIL' || slot === 'SELLER' || slot === 'PRODUCT' ||
    slot === 'CURATOR' || slot === 'BLOGPOST' || slot === 'BLOG' || slot === 'STAYDETAIL' ||
    slot === 'SECTIONS'
  ) return 2000;
  if (slot === 'WHOLESALE') return 3000;
  return 1500;
}

/** `</script` 로 페이로드가 스크립트 태그를 조기 종료하는 것을 막는다(XSS). */
function escapeForScript(body: string): string {
  return body.replace(/<\/script/gi, '<\\/script');
}

export async function fetchSsrPayload(
  target: SsrTarget,
  origin: string,
  env: { CACHE_KV?: { get(key: string, type: 'text'): Promise<string | null> } },
): Promise<SsrPayloadResult> {
  let payload: string | null = null;
  let status = 'skip';
  const timings: string[] = [];

  // ① 콜로 엣지 캐시 — 가장 싸고 빠르다.
  const edgeStart = Date.now();
  try {
    const cacheKey = new Request(`${origin}${target.path}`, { method: 'GET' });
    // @ts-expect-error — Cloudflare Workers 전역 caches
    const cached = await caches.default.match(cacheKey);
    if (cached && cached.status >= 200 && cached.status < 300) {
      payload = escapeForScript(await cached.text());
      status = 'edge-hit';
    }
  } catch { /* edge cache unavailable */ }
  timings.push(`edge;dur=${Date.now() - edgeStart}`);

  // ② 전역 KV — 다른 콜로에서 예열된 것을 받는다.
  if (!payload && env.CACHE_KV) {
    const kvStart = Date.now();
    try {
      const raw = await env.CACHE_KV.get(`ssr:${target.path}`, 'text');
      if (raw && raw.startsWith('{')) {
        payload = escapeForScript(raw);
        status = 'kv-hit';
      }
    } catch { /* KV 불가 — self-fetch 폴백 */ }
    timings.push(`kv;dur=${Date.now() - kvStart}`);
  }

  // ③ self-fetch — 콜드 D1. 여기까지 오면 첫 사용자는 기다린다.
  if (!payload) {
    const ctlr = new AbortController();
    const timer = setTimeout(() => ctlr.abort(), timeoutFor(target.slot));
    const selfStart = Date.now();
    try {
      const r = await fetch(`${origin}${target.path}`, {
        signal: ctlr.signal,
        headers: { 'x-ssr-prefetch': '1', 'User-Agent': 'ur-live-ssr-prefetch/1.0' },
      });
      if (r.ok) {
        payload = escapeForScript(await r.text());
        status = 'self-fetch-hit';
      } else {
        status = `self-fetch-${r.status}`;
      }
    } catch {
      status = 'self-fetch-timeout';
    } finally {
      clearTimeout(timer);
    }
    timings.push(`self;dur=${Date.now() - selfStart}`);
  }

  return { payload, status, timings };
}

/** 진단 헤더를 응답에 붙인다(추출 전과 동일 형식). */
export function applySsrDiagHeaders(c: Context, slot: string, r: SsrPayloadResult): void {
  c.res.headers.set('X-SSR-Status', `${slot}:${r.status}`);
  if (r.timings.length > 0) c.res.headers.set('Server-Timing', r.timings.join(', '));
}
