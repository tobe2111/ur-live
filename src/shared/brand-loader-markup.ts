/**
 * ⏳ 로딩 화면 SSOT — **위쪽 얇은 막대 + 화면 모양 미리 보여 주기** (2026-11-02 대표 확정).
 *
 * 대표: *"유달이 뜨는게 별로인 것 같아 로딩 중에. 그래서 A처럼 위쪽 얇은 막대를 넣으면서 화면 모양 미리
 * 보여주기로 가는게 좋을 것 같은데?"* (시안 `docs/design/assets/loading-2026-11-02.html` 의 A + B).
 * 종전(2026-10-07 ~): 유달이 통통 + 로고 숨쉬기 + 가로 막대 왕복. 같은 동작이 끝없이 되풀이돼 "멈췄다 → 기다린다" 로 읽혔다.
 *
 * ## 한 벌만 둔다 — 세 곳이 같은 글자를 쓴다
 *   ① 워커가 `#root` 에 넣는 정적 로더(`worker/index.ts` 의 `urdealLoaderHtml`, 첫 화면 모듈들의 아래 자리)
 *   ② 앱의 `BrandLoader`(같은 문자열을 그대로 그린다)
 *   ③ `index.html` 의 `#ur-pre-react`(앱 CSS 전이라 같은 모양을 손으로 옮겨 둔다 — 가드가 대조)
 *   셋이 하나라도 다르면 교체 순간 화면이 튄다(대표가 2026-07-01 에 금지한 "로딩 화면 2~3개").
 *
 * ## 스타일을 문자열 안에 넣는 이유
 *   서버가 그린 첫 화면은 앱 CSS 가 오기 **전에** 보인다(`css-first-boot.ts`). 첫 화면 CSS 생성기는 Tailwind 가
 *   쓰는 클래스만 고르므로, 전용 클래스를 index.css 에 두면 첫 페인트에 빠질 수 있다. 그래서 규칙을 `<style>` 로
 *   같이 싣는다(몇백 바이트). 색은 토큰(`--brand`·`--rule`)만 — 손으로 박은 색 0(다크는 토큰이 알아서 바뀐다).
 *
 * ## 이어 그리기(블링크 0)
 *   막대는 **끝까지 한 번만** 차오르고(되풀이 없음), 빛은 1.2초마다 훑는다. 앱 로더는 첫 페인트 이후 흐른 시간만큼
 *   **음수 delay** 를 줘서(`--ur-ldr-top-d`·`--ur-ldr-shine-d`) 서버 로더가 그리던 자리에서 그대로 이어 간다.
 *   주기 값은 아래 상수 하나 — CSS 문자열도 이 값으로 만든다(둘이 갈릴 수 없다).
 */

/** 위쪽 막대가 0 → 92% 까지 가는 시간(초). 되풀이하지 않는다 — 끝을 향해 가는 게 보여야 덜 지루하다. */
export const LOADER_TOP_S = 10
/** 화면 모양 위를 빛이 한 번 훑는 주기(초). */
export const LOADER_SHINE_S = 1.2
/**
 * 🫥 이만큼(초) 안에 화면이 뜨면 로더를 **아예 안 보인다** — 늦을 때만 스르르 나타난다(2026-11-02 대표 *"섞기"*).
 *   같은 날 두 결정이 갈렸다: 첫 진입 *"아예 안 보이게"*(#2122) ↔ *"위쪽 얇은 막대 + 화면 모양 미리 보여주기"*.
 *   대표가 둘을 섞으라고 골랐다 — 빠르면 깨끗하게, 느리면 멈춘 줄 모르게.
 */
export const LOADER_REVEAL_S = 0.5

const CSS =
  `.ur-ldr{width:100%;max-width:720px;margin:0 auto;padding:16px;box-sizing:border-box}` +
  `.ur-ldr-top{position:fixed;left:0;right:0;top:0;height:3px;z-index:10001;pointer-events:none}` +
  `.ur-ldr-top>i{display:block;height:100%;background:var(--brand);transform-origin:left;transform:scaleX(0);` +
  `animation:ur-ldr-top ${LOADER_TOP_S}s cubic-bezier(.08,.8,.2,1) forwards;animation-delay:var(--ur-ldr-top-d,0s)}` +
  `@keyframes ur-ldr-top{0%{transform:scaleX(0)}15%{transform:scaleX(.45)}100%{transform:scaleX(.92)}}` +
  `.ur-ldr-sk i{display:block;position:relative;overflow:hidden;background:var(--rule);border-radius:8px}` +
  `.ur-ldr-sk i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);` +
  `transform:translateX(-100%);animation:ur-ldr-shine ${LOADER_SHINE_S}s ease-in-out infinite;animation-delay:var(--ur-ldr-shine-d,0s)}` +
  `.dark .ur-ldr-sk i::after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)}` +
  `@keyframes ur-ldr-shine{to{transform:translateX(100%)}}` +
  `.ur-ldr-t{height:20px;width:46%;margin-bottom:20px}` +
  `.ur-ldr-row{display:flex;gap:12px;margin-bottom:16px}` +
  `.ur-ldr-row>.ur-ldr-ph{width:76px;height:76px;flex:none;border-radius:12px}` +
  `.ur-ldr-tx{flex:1;padding-top:4px}.ur-ldr-tx i{height:12px;margin-bottom:8px}` +
  `.ur-ldr-tx i:nth-child(1){width:78%}.ur-ldr-tx i:nth-child(2){width:52%}.ur-ldr-tx i:nth-child(3){width:30%;height:16px}` +
  `.ur-ldr-shy{opacity:0;animation:ur-ldr-in .2s ease-out forwards;animation-delay:var(--ur-ldr-in-d,${LOADER_REVEAL_S}s)}` +
  `@keyframes ur-ldr-in{to{opacity:1}}` +
  `@media (prefers-reduced-motion: reduce){.ur-ldr-top>i,.ur-ldr-sk i::after{animation:none}.ur-ldr-top>i{transform:scaleX(.6)}.ur-ldr-shy{animation-duration:.01s}}`

const ROW = '<div class="ur-ldr-row"><i class="ur-ldr-ph"></i><div class="ur-ldr-tx"><i></i><i></i><i></i></div></div>'

/**
 * 로더 본체(스타일 포함). 바깥 높이·배경은 부르는 쪽이 정한다.
 * `rows` 는 카드 줄 수(인라인은 짧게). 0 이면 화면 모양 없이 **위쪽 막대만**(카카오 로그인처럼 다음 화면이 우리 화면이 아닐 때).
 * `shy` 면 처음 `LOADER_REVEAL_S` 초는 투명하다(빠른 로딩엔 아무것도 안 보인다). 자리는 그대로라 아무것도 안 밀린다.
 *   문구 있는 로더("결제 승인 중")·대시보드·카카오 로그인은 shy 가 아니다 — 누른 직후라 바로 보여야 멈춘 줄 안 안다.
 */
export function brandLoaderMarkup(rows = 4, shy = false): string {
  const body =
    '<div class="ur-ldr-top" aria-hidden="true"><i></i></div>' +
    (rows > 0 ? '<div class="ur-ldr ur-ldr-sk" aria-hidden="true"><i class="ur-ldr-t"></i>' + ROW.repeat(rows) + '</div>' : '')
  return `<style>${CSS}</style>` + (shy ? `<div class="ur-ldr-shy">${body}</div>` : body)
}

/** 첫 페인트 이후 흐른 시간만큼의 음수 delay — 앱 로더가 서버 로더의 위상을 그대로 잇는다. */
export function loaderPhaseVars(sinceFirstPaintS: number): Record<string, string> {
  const t = Math.max(0, sinceFirstPaintS)
  return {
    '--ur-ldr-top-d': `-${Math.min(t, LOADER_TOP_S).toFixed(3)}s`,
    '--ur-ldr-shine-d': `-${(t % LOADER_SHINE_S).toFixed(3)}s`,
    // 서버 로더가 이미 나타났으면(지난 시간 ≥ 0.5초) 음수 → 앱 로더도 처음부터 보인다. 아니면 남은 시간만 더 숨는다.
    '--ur-ldr-in-d': `${(LOADER_REVEAL_S - t).toFixed(3)}s`,
  }
}
