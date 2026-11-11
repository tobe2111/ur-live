/**
 * 🎬 **결제 직전에 무엇을 보고 왔는가** — 손님 브라우저에 남기는 꼬리표 (2026-11-11 대표 *"인플루언서 링크를 통해서
 *    들어와선 유어쇼츠를 볼 수도 있잖아 … 이런 케이스들을 체계적으로 잡아줘"*).
 *
 * ## 두 가지를 섞지 않는다
 *   - **누가 데려왔나(돈·성과)** = 소개 링크 `affiliate-ref-store`(24시간, 마지막 링크 우선). 이 꼬리표가 **절대 이기지 않는다.**
 *   - **무엇을 보고 샀나(기록)** = 이 파일. 유어쇼츠 영상에서 '구매' 를 눌렀다 · 상세의 '다녀온 사람들' 콘텐츠를 열었다.
 *   주문마다 둘 다 적힌다(`order_touch`) — 인플루언서 링크로 와서 유어쇼츠를 보고 샀으면 **성과는 인플루언서**, 경로는 유어쇼츠.
 *
 * - 유효기간 24시간(소개 링크와 같은 창) · 마지막으로 본 것이 이긴다.
 * - 모든 요청에 `X-Ur-Via` 로 실린다(`lib/api.ts` — 소개 링크의 `X-Affiliate-Ref` 와 같은 자리). 서버는 **결제 확정 때만** 읽는다.
 * ⚠️ 이 파일은 아무것도 import 하지 않는다 — `lib/api.ts`(엔트리)가 읽으므로 끌어오면 청크 순환이 된다(affiliate-ref-store 와 같은 이유).
 */
export const TOUCH_KEY = 'ur_touch_v1'
export const TOUCH_TTL_MS = 24 * 60 * 60 * 1000
/** `urshorts:<영상 id>` · `content:<항목 id>`(예 `content:c:12`). 서버 `order-touch.ts` 가 같은 모양을 다시 검사한다. */
export const TOUCH_RE = /^(urshorts|content):[A-Za-z0-9_:.-]{1,80}$/

export function writeTouch(via: string, now: number = Date.now()): void {
  try {
    if (!TOUCH_RE.test(via)) return
    localStorage.setItem(TOUCH_KEY, JSON.stringify({ via, at: now }))
  } catch { /* storage unavailable */ }
}

export function readTouch(now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(TOUCH_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { via?: unknown; at?: unknown }
    const at = Number(v?.at)
    if (typeof v?.via !== 'string' || !TOUCH_RE.test(v.via) || !Number.isFinite(at)) return null
    if (at > now + 60_000 || now - at > TOUCH_TTL_MS) return null
    return v.via
  } catch {
    return null
  }
}
