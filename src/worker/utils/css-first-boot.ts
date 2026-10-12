/**
 * 🚦 처음 오는 기기에서 **CSS 를 먼저** 받는다 (2026-10-12 대표 *"페이지들 로딩이 너무 느려 특히 처음 접속하는
 * 디바이스 유저는"* · *"첫 로딩이 중요해. 이용권 사진들도 너무 늦게 뜨고"* · *"대기업 수준이어야 해"*).
 *
 * ## 무엇이 느렸나 (라이브 응답을 녹화해 같은 조건으로 재생 — 느린 4G 150ms/1.6Mbps · CPU 4배)
 * 화면을 그리려면 CSS(약 33KB) 한 장이 **반드시** 먼저 와야 한다(렌더 차단). 그런데 HTML 이 도착하자마자
 * 스크립트 modulepreload 20여 개 · 사진 preload 4장 · CSS 가 **한꺼번에** 출발해 느린 회선을 30등분했다.
 * CSS 가 2.5초에야 끝났고, 그동안 이미 도착한 이용권 사진은 **CSS 를 기다리느라 화면에 못 나왔다.**
 *
 * 홈·이용권 상세·유어샵은 첫 화면을 **서버가 그린다**(스크립트 없이 보인다). 그러니 스크립트가 CSS 와
 * 회선을 다툴 이유가 없다 ⇒ 스크립트(엔트리 + modulepreload)는 **CSS 가 도착한 직후** 출발시킨다.
 *
 *   실측(5회 중간값)      첫 화면      가장 큰 그림(이용권 사진)   조작 가능
 *   홈 /                3.0 → 1.8s   3.6 → 1.9s                5.9 → 6.3s
 *   이용권 상세          2.7 → 1.1s   3.3 → 1.2s                4.6 → 4.9s
 *   교환권 /vouchers      2.5 → 0.8s   3.0 → 3.2s                3.4 → 3.7s
 *   ⇒ 사진은 1.7~2.1초 일찍, 조작 가능은 0.3~0.4초 늦게 — 대표 승인한 교환이다.
 *
 * ## 🚫 버린 것 (같은 실험에서 효과가 없었다 — 다시 파지 말 것)
 *   사진 preload 의 fetchpriority 낮추기 · 사진 preload 제거 · 웹폰트 미루기/제거 · 사진 3x→2x
 *   → 전부 측정 오차 안. 병목은 사진·폰트가 아니라 **CSS 와 스크립트의 동시 출발**이었다.
 *
 * ## 구조 — 정적 산출물(dist/index.html)은 그대로 두고 **서빙할 때만** 바꾼다
 *   dist 를 바꾸면 그것을 읽는 가드(check-bundle-size·check-critical-chunks)가 전부 헛돈다.
 *   ① `<link rel="modulepreload">` → `rel="ur-modulepreload"`(모르는 rel = 아무것도 안 받는다)
 *   ② 엔트리 `<script type="module" src="/assets/…">` → `type="ur-module"`(모르는 type = 실행 안 함)
 *   ③ `<head>` 맨 앞 인라인 스크립트가 CSS `load`(또는 error · 백스톱)에서 ①②를 진짜로 되돌린다.
 *
 * ⚠️ 이 스크립트가 **유일한 부팅 경로**다 — 안 돌면 앱이 영영 안 뜬다. 그래서:
 *   - `<head>` **맨 앞**에 둔다(스타일시트 뒤의 인라인 스크립트는 그 CSS 를 기다리느라 파싱을 막는다).
 *   - 백스톱 타이머가 CSS 신호와 무관하게 출발시킨다.
 *   - 엔트리는 **문서 파싱이 끝난 뒤** 실행한다 — 동적으로 넣은 module 스크립트는 defer 가 아니라
 *     도착 즉시 실행되므로, 재방문(CSS 캐시 적중)에서 `#root` 가 아직 없을 수 있다.
 *   - nonce 를 단다(CSP `strict-dynamic` — 이 스크립트가 만든 하위 스크립트는 그 신뢰를 물려받는다).
 */

import { shouldRenderMobileFirstScreen } from '../../shared/seo/crawler-ua'

/**
 * 어디에 거나 — **서버가 첫 화면을 그리는 표면만**(폰 UA). 거기선 스크립트 없이도 내용이 보이므로
 * CSS 를 먼저 받는 것이 순이득이다. 첫 화면이 스크립트에 달린 표면(교환권 목록·지도)은 같은 실험에서
 * **오히려 나빠졌다**(교환권 목록 사진 3.0 → 3.5s · 지도 5.4 → 6.1s) — 그래서 범위 밖이다.
 *   홈 `/` · 이용권 상세 `/pass/:id`·`/group-buy/:id` · 교환권 상세 `/vouchers/:id` · 유어샵 `/u/:handle`
 */
export function cssFirstApplies(pathname: string, ua: string): boolean {
  if (!shouldRenderMobileFirstScreen(ua)) return false
  return pathname === '/'
    || /^\/(?:pass|group-buy|vouchers)\/\d+\/?$/.test(pathname)
    || (/^\/u\/[^/]+\/?$/.test(pathname) && !/^\/u\/me\/?$/.test(pathname))
}

/** 받지 않는 상태의 modulepreload — 모르는 rel 이라 브라우저가 아무것도 받지 않는다. */
export const DEFERRED_PRELOAD_REL = 'ur-modulepreload'
/** 실행하지 않는 상태의 엔트리 스크립트 — 모르는 type 이라 브라우저가 실행하지 않는다. */
export const DEFERRED_ENTRY_TYPE = 'ur-module'
/** CSS 신호가 끝내 안 와도 이 시간 뒤엔 출발한다(ms). */
export const CSS_FIRST_BACKSTOP_MS = 3000

/** 앱 CSS 를 가리키는 판정 — Vite 엔트리 CSS 는 `/assets/index-<hash>.css` 다. */
const APP_CSS_TEST = "/\\/assets\\/index-[^/]*\\.css/"

export function cssFirstBootScript(nonce: string): string {
  // ⚠️ 구형 브라우저도 돌 수 있게 ES5 로만 쓴다(이게 실패하면 앱이 안 뜬다).
  const js = `(function(){var go=0,d=document;function run(){if(go)return;go=1;
var ls=d.querySelectorAll('link[rel="${DEFERRED_PRELOAD_REL}"]');for(var i=0;i<ls.length;i++){var l=d.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=ls[i].getAttribute('href');d.head.appendChild(l)}
function entry(){var es=d.querySelectorAll('script[type="${DEFERRED_ENTRY_TYPE}"]');for(var j=0;j<es.length;j++){var s=d.createElement('script');s.type='module';s.crossOrigin='';s.src=es[j].getAttribute('src');d.head.appendChild(s)}}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',entry,{once:true});else entry()}
function hit(e){var t=e.target;if(t&&t.tagName==='LINK'&&t.rel==='stylesheet'&&${APP_CSS_TEST}.test(t.href||''))run()}
d.addEventListener('load',hit,true);d.addEventListener('error',hit,true);setTimeout(run,${CSS_FIRST_BACKSTOP_MS});
d.addEventListener('DOMContentLoaded',function(){var c=d.querySelector('link[rel="stylesheet"][href*="/assets/index-"]');if(!c||c.sheet)run()},{once:true})})()`
  return `<script nonce="${nonce}">${js}</script>`
}

/** 워커가 직접 넣는 라우트 청크의 rel — 적용 표면에선 지연 rel, 아니면 그대로 modulepreload. */
export function routePreloadRel(on: boolean): string { return on ? DEFERRED_PRELOAD_REL : 'modulepreload' }

/** HTMLRewriter 에 세 가지를 건다(`on` 일 때만). 호출부는 한 줄. */
export function applyCssFirstBoot(rw: HTMLRewriter, nonce: string, on: boolean): HTMLRewriter {
  if (!on) return rw
  return rw
    .on('head', { element(el) { el.prepend(cssFirstBootScript(nonce), { html: true }) } })
    .on('link[rel="modulepreload"]', { element(el) { el.setAttribute('rel', DEFERRED_PRELOAD_REL) } })
    .on('script[type="module"]', {
      element(el) {
        // 우리 엔트리만(외부·인라인 module 은 건드리지 않는다).
        if ((el.getAttribute('src') || '').startsWith('/assets/')) el.setAttribute('type', DEFERRED_ENTRY_TYPE)
      },
    })
}

/** 렌더 차단 CSS 두 장 중 우리가 경로를 아는 폰트 CSS — index.html 의 href 와 같아야 한다(테스트가 대조). */
export const FONT_CSS_HREF = '/static/fonts/pretendard-dynamic-subset-v1.3.9.css'

/**
 * 🚦 HTML 응답의 `Link` 헤더 — **렌더 차단 CSS 만** 미리 받으라고 알린다.
 *   ① 브라우저는 헤더가 오는 즉시(본문을 파싱하기 전에) 받기 시작한다.
 *   ② Cloudflare Early Hints 를 켜면 이 헤더가 **103 응답**으로 앞당겨져, 서버가 HTML 을 만드는
 *      동안(한국 실측 TTFB 중앙값 0.45초)에 CSS 가 출발한다.
 *   ⚠️ 스크립트(modulepreload)는 **넣지 않는다** — 그러면 CSS 와 다시 회선을 나눠 쓴다(이 파일 머리말).
 */
export function earlyHintsLink(entryCss: readonly string[]): string {
  return [...entryCss, FONT_CSS_HREF].map((h) => `<${h}>; rel=preload; as=style`).join(', ')
}

/**
 * 📡 HTML 응답 머리에 붙이는 두 가지 — ① 위 Link 헤더 ② 어느 Cloudflare 데이터센터가 응답했는지(`colo`).
 *   ②는 대표 신고(2026-10-12 *"마트 새 폰으로 첫 페이지가 10초"*)를 이 환경에서 재현하지 못해서 넣는다:
 *   한국 사용자의 TTFB 중앙값이 0.45초(워커 자체는 0.07초)인데 **어디로 붙는지 아무도 모른다.**
 *   브라우저는 `Server-Timing` 을 PerformanceNavigationTiming.serverTiming 으로 읽을 수 있고
 *   (`exposeHeaders` 에 이미 있다), `lib/web-vitals-report.ts` 가 그 값을 실사용자 표본으로 보낸다.
 *   ⚠️ `ssr-payload` 가 `Server-Timing` 을 **set** 하므로 여기서는 그 뒤에 **append** 한다.
 */
export function appendEdgeHeaders(h: Headers, entryCss: readonly string[], colo: string | undefined): void {
  h.append('Link', earlyHintsLink(entryCss))
  const c = (colo || '').replace(/[^A-Z]/g, '').slice(0, 4)
  if (c) h.append('Server-Timing', `colo;desc="${c}"`)
}
