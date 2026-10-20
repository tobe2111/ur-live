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

import { guestTabOf } from './guest-first-screen'
import { shouldRenderMobileFirstScreen } from '../../shared/seo/crawler-ua'
import { CRITICAL_CSS } from '../generated/critical-css'
import { UDAL_LOADER_SRC } from '../../shared/udal-loader'

/**
 * 어디에 거나 — **서버가 첫 화면을 그리는 표면만**(폰 UA). 거기선 스크립트 없이도 내용이 보이므로
 * CSS 를 먼저 받는 것이 순이득이다. 첫 화면이 스크립트에 달린 표면(교환권 목록·지도)은 같은 실험에서
 * **오히려 나빠졌다**(교환권 목록 사진 3.0 → 3.5s · 지도 5.4 → 6.1s) — 그래서 범위 밖이다.
 *   홈 `/` · 이용권 상세 `/pass/:id`·`/group-buy/:id` · 교환권 상세 `/vouchers/:id` · 유어샵 `/u/:handle`
 *   · 교환권 목록 `/vouchers` · 숙소 상세 `/stays/:id`
 *
 * 🔁 2026-10-17 — 교환권 목록·숙소 상세 추가. 위 "범위 밖" 판정은 그 둘이 **스크립트에 달려 있던** 10-12 의 것이고,
 *   그 뒤 서버가 첫 화면을 그리게 됐는데(교환권 10-14 · 숙소 10-12) 이 목록만 안 따라왔다 — 서버가 그린 첫 화면이
 *   JS 20여 개와 회선을 나눈 앱 CSS 를 기다렸다. 라이브 HTML 에 같은 변환을 입혀 실제 회선으로 A/B(느린 4G·CPU 4배):
 *     교환권 목록  HTML 뒤 첫 그림 2.45 → 0.23s(5회) · LCP(배너) 그대로 · 조작 가능 그대로
 *     숙소 상세    HTML 뒤 첫 그림 2.35 → 0.18s(4회) · LCP 3.08 → 2.91s · 조작 가능 +0.4s(위와 같은 교환)
 *   ⚠️ 판정은 경로만 본다 — `/vouchers?category=…` 처럼 첫 화면이 안 그려지는 요청에도 걸린다(그땐 로더 + 조작 +0.3s).
 *   🔒 새 첫 화면을 서버에 붙이면 **이 목록도 같은 커밋에서** 고칠 것(시험 ⑤-2 가 ROOTS 와 대조한다).
 */
export function cssFirstApplies(pathname: string, ua: string, authed = false): boolean {
  if (!shouldRenderMobileFirstScreen(ua)) return false
  return pathname === '/' || pathname === '/vouchers' || pathname === '/stays' // 🏨 2026-10-19 숙소 목록도 서버 첫 화면이 생겼다(stays-first-screen.ts)
    || (!authed && guestTabOf(pathname) !== null) // 🚪 2026-10-19 로그인 전 탭 셋 — 세션 쿠키 없을 때만 서버가 그린다(guest-first-screen.ts)
    || /^\/blog(?:\/[^/]+)?\/?$/.test(pathname) // 📝 2026-10-19 블로그 목록·상세도 서버 첫 화면(blog-*-first-screen.ts)
    || /^\/(?:pass|group-buy|vouchers|stays)\/\d+\/?$/.test(pathname)
    || (/^\/u\/[^/]+\/?$/.test(pathname) && !/^\/u\/me\/?$/.test(pathname))
}

/** 받지 않는 상태의 modulepreload — 모르는 rel 이라 브라우저가 아무것도 받지 않는다. */
export const DEFERRED_PRELOAD_REL = 'ur-modulepreload'
/** 실행하지 않는 상태의 엔트리 스크립트 — 모르는 type 이라 브라우저가 실행하지 않는다. */
export const DEFERRED_ENTRY_TYPE = 'ur-module'
/** CSS 신호가 끝내 안 와도 이 시간 뒤엔 출발한다(ms). */
export const CSS_FIRST_BACKSTOP_MS = 3000
/**
 * 첫 화면 CSS 를 넣은 응답의 백스톱(ms). 그때 앱 CSS 는 렌더를 막지 않으므로, 3초에 스크립트를 출발시키면
 * 앱 CSS 가 아직 안 온 느린 회선에서 React 가 **첫 화면 CSS 만 있는 채로** 다른 화면을 그린다(스타일 깨짐).
 * 첫 화면은 이미 보이므로 기다려도 손해가 없다 — 그래서 길게 잡는다.
 */
export const CRITICAL_BACKSTOP_MS = 10000
/** 첫 화면 CSS `<style>` 의 id — 시험·디버깅용 표식. */
export const CRITICAL_STYLE_ID = 'ur-critical'

/** 앱 CSS 를 가리키는 판정 — Vite 엔트리 CSS 는 `/assets/index-<hash>.css` 다. */
const APP_CSS_TEST = "/\\/assets\\/index-[^/]*\\.css/"

export function cssFirstBootScript(nonce: string, critical = false): string {
  // ⚠️ 구형 브라우저도 돌 수 있게 ES5 로만 쓴다(이게 실패하면 앱이 안 뜬다).
  // 🎨 2026-10-14 `critical` — 첫 화면 CSS 를 넣었으면 앱 CSS 링크는 `media=print`(렌더 안 막음)로 와 있다.
  //   그 CSS 가 도착하면(=run) **스크립트보다 먼저** `media=all` 로 되돌린다 — React 는 앱 CSS 가 붙은 뒤에만 그린다.
  const js = `(function(){var go=0,d=document;function run(){if(go)return;go=1;
var cs=d.querySelectorAll('link[rel="stylesheet"][media="print"][href*="/assets/index-"]');for(var k=0;k<cs.length;k++)cs[k].media='all';
var ls=d.querySelectorAll('link[rel="${DEFERRED_PRELOAD_REL}"]');for(var i=0;i<ls.length;i++){var l=d.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=ls[i].getAttribute('href');d.head.appendChild(l)}
function entry(){var es=d.querySelectorAll('script[type="${DEFERRED_ENTRY_TYPE}"]');for(var j=0;j<es.length;j++){var s=d.createElement('script');s.type='module';s.crossOrigin='';s.src=es[j].getAttribute('src');d.head.appendChild(s)}}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',entry,{once:true});else entry()}
function hit(e){var t=e.target;if(t&&t.tagName==='LINK'&&t.rel==='stylesheet'&&${APP_CSS_TEST}.test(t.href||''))run()}
d.addEventListener('load',hit,true);d.addEventListener('error',hit,true);setTimeout(run,${critical ? CRITICAL_BACKSTOP_MS : CSS_FIRST_BACKSTOP_MS});
d.addEventListener('DOMContentLoaded',function(){var c=d.querySelector('link[rel="stylesheet"][href*="/assets/index-"]');if(!c||c.sheet)run()},{once:true})})()`
  return `<script nonce="${nonce}">${js}</script>`
}

/** 워커가 직접 넣는 라우트 청크의 rel — 적용 표면에선 지연 rel, 아니면 그대로 modulepreload. */
export function routePreloadRel(on: boolean): string { return on ? DEFERRED_PRELOAD_REL : 'modulepreload' }

/**
 * 🎨 첫 화면 CSS 를 넣을 수 있는가 — 생성물이 비었으면(로컬 워커 단독 빌드 등) **종전과 byte-동일**하게 간다.
 *   `</style` 이 들어 있으면 인라인이 HTML 을 깨뜨리므로 넣지 않는다(생성기가 이미 막지만 두 겹).
 */
export function criticalCssUsable(css: string = CRITICAL_CSS): boolean {
  return css.length > 0 && !/<\/style/i.test(css)
}

/**
 * HTMLRewriter 에 건다(`on` 일 때만). 호출부는 한 줄.
 *   ① 부팅 스크립트(+ 첫 화면 CSS `<style>`)를 `<head>` 맨 앞에
 *   ② modulepreload·엔트리를 지연 상태로
 *   ③ 🎨 2026-10-14 첫 화면 CSS 가 있으면 앱 CSS 링크를 `media=print` — **받기는 하되 렌더를 막지 않는다**.
 *      받는 시점은 그대로다: `Link` 헤더 preload(as=style · crossorigin)가 응답 머리에서 이미 출발시켰고,
 *      이 링크는 그 캐시를 쓴다(그래서 crossorigin 이 실제 태그와 같아야 한다 — `earlyHintsLink`).
 */
export function applyCssFirstBoot(rw: HTMLRewriter, nonce: string, on: boolean, critical: string = CRITICAL_CSS): HTMLRewriter {
  if (!on) return rw
  const crit = criticalCssUsable(critical)
  const head = cssFirstBootScript(nonce, crit) + (crit ? `<style id="${CRITICAL_STYLE_ID}">${critical}</style>` : '')
  if (crit) {
    rw = rw.on('link[rel="stylesheet"]', {
      element(el) { if (/^\/assets\/index-[^/]*\.css$/.test(el.getAttribute('href') || '')) el.setAttribute('media', 'print') },
    })
  }
  return rw
    .on('head', { element(el) { el.prepend(head, { html: true }) } })
    // 🦦 2026-10-15 (대표 *"로딩페이지가 있어서 더 로딩이 걸리는건 아닌지"* → 승인 "빼기"): 서버가 첫 화면을 그리는
    //   표면에선 유달이 로더가 첫 화면이 아니다(내용 **아래**에만 있다). 그런데 index.html 의 유달이 preload 가
    //   최우선으로 받아 첫 화면 CSS 와 회선을 나눠 썼다 — 라이브 느린 4G 8회 교차: 홈 첫 그림 1,104 → 1,040ms.
    //   그림 자체는 로더 `<img>` 가 보통 우선순위로 그대로 받는다(로더가 첫 화면인 표면은 이 함수가 안 걸려 preload 유지).
    .on(`link[rel="preload"][href="${UDAL_LOADER_SRC}"]`, { element(el) { el.remove() } })
    .on('link[rel="modulepreload"]', { element(el) { el.setAttribute('rel', DEFERRED_PRELOAD_REL) } })
    .on('script[type="module"]', {
      element(el) {
        // 우리 엔트리만(외부·인라인 module 은 건드리지 않는다).
        if ((el.getAttribute('src') || '').startsWith('/assets/')) el.setAttribute('type', DEFERRED_ENTRY_TYPE)
      },
    })
}

/**
 * 🚦 HTML 응답의 `Link` 헤더 — **렌더 차단 CSS 만** 미리 받으라고 알린다.
 *   🩸 2026-10-14 (대표 신고 — 구글 검색으로 들어가니 *"이 화면이 2초는 넘게"* 비어 있었다):
 *      엔트리 CSS 는 Vite 가 `<link rel="stylesheet" crossorigin>` 으로 내보낸다. 미리 받기에 `crossorigin`
 *      이 없으면 요청 방식(no-cors ↔ cors)이 달라 **브라우저가 미리 받은 것을 버리고 같은 파일을 다시 받는다**.
 *      실측(라이브 · 안드로이드 크롬): index-*.css 가 두 번 — 미리 받은 것(1025→1140ms)은 버려지고, 렌더를
 *      막는 쪽(1206→1276ms)은 파서가 그 줄에 닿은 뒤에야 출발했다. 즉 미리 받기 효과가 0 이었고 첫 그림이
 *      그 두 번째 다운로드를 기다렸다. ⇒ 엔트리 CSS 는 `crossorigin` 을 **실제 태그와 같게** 단다.
 *   🔤 2026-10-15: 폰트 CSS 미리 받기는 뺐다 — 손님 화면이 기기 기본 글꼴로 바뀌어 그 시트가 없다.
 *   ① 브라우저는 헤더가 오는 즉시(본문을 파싱하기 전에) 받기 시작한다.
 *   ② Cloudflare Early Hints 를 켜면 이 헤더가 **103 응답**으로 앞당겨져, 서버가 HTML 을 만드는
 *      동안(한국 실측 TTFB 중앙값 0.45초)에 CSS 가 출발한다.
 *   ⚠️ 스크립트(modulepreload)는 **넣지 않는다** — 그러면 CSS 와 다시 회선을 나눠 쓴다(이 파일 머리말).
 */
//   🔁 2026-10-15 (대표 *"첫 접속 시 2~3배 느려"*): 엔트리 CSS 의 preload 에 `crossorigin` 이 없었다.
//   Vite 는 그 CSS 를 `<link rel="stylesheet" crossorigin href=…>` 로 내므로(같은 출처여도 CORS 모드)
//   모드가 다른 preload 는 **재사용되지 않고 같은 37KB 를 한 번 더** 받았다 — 첫 화면을 막는 바로 그 파일이다.
//   라이브 실측(느린 4G·CPU 4배, 4회×2세트): 요청 2 → 1 · HTML 도착→첫 화면 1.83~1.93초 → 1.65~1.74초.
//   (폰트 CSS 미리 받기는 같은 날 기기 기본 글꼴 전환으로 사라졌다.) 태그와 같은지는
//   `check-critical-chunks` 가 빌드된 index.html 과 대조한다.
export const ENTRY_CSS_CROSSORIGIN = true
export function earlyHintsLink(entryCss: readonly string[]): string {
  return entryCss.map((h) => `<${h}>; rel=preload; as=style${ENTRY_CSS_CROSSORIGIN ? '; crossorigin' : ''}`).join(', ')
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

/**
 * 🦦 2026-10-20: 첫 화면 아래 유달이 로더 `<img>` 는 낮은 우선순위로 받는다.
 *   preload 를 지워도 로더 그림 자신이 보통 우선순위로 **첫 사진 요청**이 됐다(라이브 `/vouchers`·`/pass/:id`
 *   첫 이미지가 유달이 12.5KB, LCP 사진은 그 뒤).
 * 🩸 처음엔 위 재작성기에 `img[src=…]` 규칙으로 넣었는데 **라이브에서 한 번도 안 걸렸다** — 그 `<img>` 는
 *   워커가 `#root` 에 `setInnerContent` 로 **넣는** 마크업이고, HTMLRewriter 는 핸들러가 삽입한 내용을
 *   다시 파싱하지 않는다. 그래서 워커가 마크업을 만들 때 이 속성을 직접 붙인다(시험이 배선까지 본다).
 */
export function loaderImgPriorityAttr(cssFirst: boolean): string {
  return cssFirst ? ' fetchpriority="low"' : ''
}
