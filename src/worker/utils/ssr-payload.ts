/**
 * 🌍 SSR 페이로드 획득 3계층 (worker/index.ts 에서 추출 — 2026-08-22)
 *
 * ⚠️ 이 파일은 **잠긴 로딩 최적화**(CLAUDE.md "🔒 로딩 최적화 잠금")의 핵심이다.
 *    추출은 순수 이동이고 순서·타임아웃·이스케이프는 byte-불변이다. 계층 순서를 바꾸거나
 *    타임아웃을 줄이면 콜드 콜로 TTFB 가 그대로 회귀한다.
 *
 *   ① `caches.default` — **콜로별**. hit 이면 ~5ms. KV write 한도를 안 쓰므로 비용 $0.
 *   ② `CACHE_KV` — **전역**. cron 이 15분 표본화로 기록(`cache-prewarm.ts` SSR_KV_PATHS).
 *      **그 목록에 있는 키만 읽는다**(2026-10-11) — 나머지는 아무도 안 써서 늘 miss 였다.
 *      ①이 콜로별이라 예열이 다른 지역에 안 미치는 것을 메운다. 미바인딩이면 조용히 건너뛴다.
 *   ②-b 직전 사본(2026-10-12) — ①이 만료됐을 때 **콜로에 남겨 둔 최근 사본(최대 1시간)**을 바로 쓰고,
 *      응답 뒤(waitUntil)에 ③을 돌려 새로 채운다. 아래 `STALE_*` 참조.
 *   ③ self-fetch — 콜드 D1. 슬롯별 타임아웃(아래) 안에 못 끝내면 미주입 → 클라가 직접 받는다.
 */

import type { Context } from 'hono';
import { SSR_KV_PATHS } from '../cron/cache-prewarm';

/**
 * 🔑 2026-10-11 [UNLOCK_LOADING] (대표 "로딩 개선 둘 다 진행"): KV 를 읽을 가치가 있는 키 = **cron 이 실제로 쓰는 키**.
 *   KV 는 cron 만 쓰고(`cache-prewarm.ts` SSR_KV_PATHS), 그 밖의 키(상세 `/api/group-buy/products/:id` ·
 *   유어샵 `/api/curator/:h` · 셀러 · 블로그 글 …)는 **영원히 비어 있다.** 그런데도 엣지 miss 마다 KV 를
 *   먼저 물어 콜드 상세·유어샵 하드로드가 **~100ms 를 그냥 기다렸다**(라이브 `kv;dur=95~104`, 결과는 늘 miss).
 *   에러가 안 나고 결과도 같아서 아무도 몰랐다 — 느릴 뿐이다.
 */
const KV_WARMED = new Set<string>(SSR_KV_PATHS);

/** 이 경로를 KV 에서 찾을 가치가 있는가 — 쓰는 쪽(cron) 목록과 같은 집합. */
export function isKvWarmedPath(path: string): boolean {
  return KV_WARMED.has(path);
}

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
 *   · 🧨 2026-10-12: 도매 3000ms **제거** — WHOLESALE 슬롯 자체가 사라졌다(도매몰 철거 #1710).
 *     남겨 두면 호출자 0 인 분기가 "도매는 느리다" 는 낡은 사실을 계속 선언한다. 되살릴 땐 이 값도 함께.
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
  return 1500;
}

/** `</script` 로 페이로드가 스크립트 태그를 조기 종료하는 것을 막는다(XSS). */
function escapeForScript(body: string): string {
  return body.replace(/<\/script/gi, '<\\/script');
}

/**
 * ♻️ 2026-10-12 [UNLOCK_LOADING] (대표 승인 "허가 — 진행": *"처음 접속하는 디바이스 유저는 너무 느려"*)
 *   **직전 사본을 바로 쓰고 뒤에서 새로 받는다**(stale-while-revalidate).
 *
 *   왜: ① 엣지 캐시는 API 의 짧은 TTL(상세 120s · 유어샵 300s)을 그대로 따른다. 한국 콜로는 방문이 드물어
 *   대부분의 첫 방문이 만료된 뒤에 온다 ⇒ 상세·유어샵 하드로드가 매번 ③(콜드 D1)을 기다렸다 — 라이브 실측
 *   `self;dur=418~552ms`(두 번째 요청은 28~37ms). 실사용자 TTFB 중앙값 0.45s(워커 자체 0.07s)와 맞는다.
 *
 *   어떻게: ③이 성공할 때마다 같은 응답을 **별도 키**(`/__ssr_stale` 접두)에 24시간 보관한다(Cache API =
 *   무료·KV 한도 무관). ①이 비면 그 사본을 바로 쓰고(`stale-hit`), **응답 뒤** ③을 돌려 ①과 사본을 둘 다
 *   새로 채운다. 사본이 없으면 종전과 똑같이 ③을 기다린다.
 *
 *   ⚠️ 첫 화면 데이터가 최대 24시간 전 것일 수 있다 — 상세·유어샵·교환권 상세는 마운트 뒤 **항상 최신을 다시
 *      받고**(fetchQuery / fetchCuratorPage), 결제 금액은 서버가 늘 재검증한다. 상품이 내려가면(404) 뒤의
 *      새로고침이 사본을 지운다.
 *   ⚠️ `waitUntil` 이 없으면(테스트·구형 호출) 사본을 **쓰지 않는다** — 새로 채울 수 없는 사본을 쓰면
 *      보관 내내 같은 사본만 돌게 된다.
 *   KV 로 예열되는 목록 경로(②)는 대상이 아니다 — 이미 전역 사본이 있다.
 */
export const STALE_PREFIX = '/__ssr_stale'
// ⏱️ 2026-10-15 1시간 → 24시간 (대표 승인 *"24시간으로 늘리기"*): 덜 보는 상세는 1시간 안에 같은 콜로에서
//   다시 열릴 일이 드물어 사본이 늘 비었다 — 구글로 들어온 첫 방문이 콜드 self-fetch(실측 579ms)를 HTML 앞에서
//   기다렸다. 마운트 뒤 최신 재조회·결제 금액 서버 재검증은 그대로라 대가는 "첫 화면이 하루 전 것일 수 있다" 뿐이다.
export const STALE_MAX_AGE_S = 86400

type WaitUntil = (p: Promise<unknown>) => void

/** Hono 컨텍스트에서 waitUntil 을 꺼낸다 — 실행 컨텍스트가 없으면(테스트) undefined. */
export function ssrWaitUntil(c: Context): WaitUntil | undefined {
  try {
    const ctx = c.executionCtx
    return (p) => ctx.waitUntil(p)
  } catch {
    return undefined
  }
}

async function selfFetch(target: SsrTarget, origin: string): Promise<{ text: string | null; status: string }> {
  const ctlr = new AbortController();
  const timer = setTimeout(() => ctlr.abort(), timeoutFor(target.slot));
  try {
    const r = await fetch(`${origin}${target.path}`, {
      signal: ctlr.signal,
      headers: { 'x-ssr-prefetch': '1', 'User-Agent': 'ur-live-ssr-prefetch/1.0' },
    });
    if (r.ok) return { text: await r.text(), status: 'self-fetch-hit' };
    return { text: null, status: `self-fetch-${r.status}` };
  } catch {
    return { text: null, status: 'self-fetch-timeout' };
  } finally {
    clearTimeout(timer);
  }
}

function staleKey(origin: string, path: string): Request {
  return new Request(`${origin}${STALE_PREFIX}${path}`, { method: 'GET' });
}

/** 사본 갱신 — 성공이면 넣고, 404 면 지운다(내려간 상품을 1시간 동안 살려 두지 않는다). */
async function writeStale(origin: string, path: string, text: string | null, status: string): Promise<void> {
  try {
    // @ts-expect-error — Cloudflare Workers 전역 caches
    const cache = caches.default;
    if (text && text.startsWith('{')) {
      await cache.put(staleKey(origin, path), new Response(text, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${STALE_MAX_AGE_S}` },
      }));
    } else if (status === 'self-fetch-404') {
      await cache.delete(staleKey(origin, path));
    }
  } catch { /* 사본은 가속일 뿐 — 실패해도 무해 */ }
}

export async function fetchSsrPayload(
  target: SsrTarget,
  origin: string,
  env: { CACHE_KV?: { get(key: string, type: 'text'): Promise<string | null> } },
  waitUntil?: WaitUntil,
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

  // ② 전역 KV — 다른 콜로에서 예열된 것을 받는다. **cron 이 쓰는 키만** 묻는다(위 KV_WARMED).
  if (!payload && env.CACHE_KV && isKvWarmedPath(target.path)) {
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

  const staleable = !!waitUntil && !isKvWarmedPath(target.path);

  // ②-b 직전 사본 — 바로 쓰고, 응답 뒤에 ③으로 새로 채운다.
  if (!payload && staleable) {
    const staleStart = Date.now();
    try {
      // @ts-expect-error — Cloudflare Workers 전역 caches
      const hit = await caches.default.match(staleKey(origin, target.path));
      if (hit && hit.status >= 200 && hit.status < 300) {
        const text = await hit.text();
        if (text.startsWith('{')) {
          payload = escapeForScript(text);
          status = 'stale-hit';
          waitUntil!(selfFetch(target, origin).then((r) => writeStale(origin, target.path, r.text, r.status)));
        }
      }
    } catch { /* 사본 불가 — ③ 폴백 */ }
    timings.push(`stale;dur=${Date.now() - staleStart}`);
  }

  // ③ self-fetch — 콜드 D1. 여기까지 오면 첫 사용자는 기다린다.
  if (!payload) {
    const selfStart = Date.now();
    const r = await selfFetch(target, origin);
    status = r.status;
    if (r.text !== null) payload = escapeForScript(r.text);
    timings.push(`self;dur=${Date.now() - selfStart}`);
    if (staleable) waitUntil!(writeStale(origin, target.path, r.text, r.status));
  }

  return { payload, status, timings };
}

/** 진단 헤더를 응답에 붙인다(추출 전과 동일 형식). */
export function applySsrDiagHeaders(c: Context, slot: string, r: SsrPayloadResult): void {
  c.res.headers.set('X-SSR-Status', `${slot}:${r.status}`);
  if (r.timings.length > 0) c.res.headers.set('Server-Timing', r.timings.join(', '));
}
