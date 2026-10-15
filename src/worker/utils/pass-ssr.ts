/**
 * 🧊 이용권 상세(`/pass/:id`)를 **앱 전체 그대로** 서버에서 그리고, 브라우저가 그 화면을 **이어받는다**
 *    (2026-10-15 대표 *"가장 이상적이고 영구적으로"* → *"가장 이상적이어야 해. 대기업 수준의 로딩 인프라"* — 서버 렌더 3단계).
 *
 * ## 왜 — 손그림 첫 화면은 제목까지였다
 * 종전 첫 화면(`detail-ssr-body.ts`)은 사진·제목까지만 손으로 옮겨 그렸다. 가격·구매하기는 앱 코드(느린 폰에서 1~2초)가
 * 받아지고 실행된 **뒤에야** 떴다. 더 그리려면 손으로 옮길 양이 늘고, 옮긴 사본은 언젠가 원본과 갈린다(에러 0).
 * ⇒ 앱(`App`)을 **그대로** 서버에서 그린다(`src/ssr/pass-detail-entry.tsx` — 워커용 한 파일 번들).
 *
 * ## 이어받기(hydrate) — 다시 그리지 않는다
 * 브라우저는 `#root[data-ssr="app"]` 를 보면 `createRoot`(통째 교체) 대신 `hydrateRoot` 로 서버 화면에 이벤트만 붙인다
 * (`main.tsx`). 그래서 누를 수 있는 시점이 "다시 그리는 시간" 만큼 늦어지지 않는다. 성립 조건은 서버·브라우저의 첫 렌더가
 * 같은 것이고, 사람마다 다른 자리(로그인·찜·잔액·내 위치 거리·화면 폭)는 서버 스냅샷(비어 있음)으로 그려진 뒤
 * 이어받은 **다음에** 채워진다(`useStoredValue`·`useMediaQuery`). 갈리면 React 가 그 영역을 버리고 다시 그린다 —
 * 화면은 멀쩡하지만 이득이 사라지므로 브라우저가 그 사실을 보고한다(`main.tsx` onRecoverableError).
 *
 * ## 폰 UA 만
 * 서버는 화면 폭을 모른다. 폭으로 갈리는 부품(PC 상단 네비 등)은 서버 스냅샷 = 좁은 화면으로 그려지므로 폰 UA 에만 낸다.
 * PC 는 종전 첫 화면(빵부스러기 + 로더).
 *
 * ## 캐시 — 상품 시드·주소가 같으면 같은 HTML
 * 사람마다 같은 HTML 이라(위 규칙) 엣지 캐시에 둔다. 키 = 시드 해시 + 주소(쿼리 포함 — 그리는 내용이 쿼리에 따라
 * 갈릴 수 있다) + 빌드 번호. 가격이 바뀌면 시드가 바뀌어 키가 바뀌고, 배포하면 빌드 번호가 바뀐다(옛 번들의 HTML 을
 * 새 번들이 이어받으면 갈린다). 적중하면 서버 렌더 번들을 **불러오지도 않는다**(격리 첫 렌더 비용 0).
 *
 * ## 실패하면 null — 호출부가 종전 첫 화면으로 폴백한다(무회귀).
 */
import { isMobileUserAgent } from '../../shared/detail-hero-image'
import { LOCALE_CORE } from '../generated/route-chunk-map'

declare const __SSR_BUILD__: string
const SSR_BUILD = typeof __SSR_BUILD__ === 'string' ? __SSR_BUILD__ : 'dev'
/** `#root` 에 붙이는 표식 — 브라우저(`main.tsx`)가 이걸 보고 이어받는다. 시험이 양쪽을 대조한다. */
export const SSR_APP_ATTR = 'data-ssr'
export const SSR_APP_VALUE = 'app'

/** 서버 렌더 대상 주소 — `/pass/:id` 만. */
export function isPassSsrPath(pathname: string): boolean {
  return /^\/pass\/\d+$/.test(pathname)
}

/**
 * 앱이 붙기 전에 누른 버튼을 기억하는 스크립트 — `data-early-tap` 버튼만. 링크(`<a href>`)는 그대로 둔다(브라우저가 이동).
 * 문서 단위 캡처로 잡고 **전파를 멈춘다** — 이어받기 중인 React 가 같은 클릭을 다시 처리(재생)하면 창이 두 번 토글된다.
 * 버튼이 이어받아져 자기 effect 를 돌리면 `__urHydrated` 를 세우고(`DealBottomBar`) 그 뒤로 이 스크립트는 아무 일도 안 한다.
 * ⚠️ `#root` **바깥**에 둔다 — 안에 두면 React 가 모르는 노드라 이어받기가 갈린다.
 */
export function earlyTapScript(nonce: string): string {
  const js =
    `(function(){document.addEventListener('click',function(e){if(window.__urHydrated)return;` +
    `var t=e.target,b=t&&t.closest&&t.closest('#root [data-early-tap]');if(!b)return;` +
    `e.preventDefault();e.stopPropagation();window.__urEarlyTap=b.getAttribute('data-early-tap');b.style.opacity='.6'},true)})()`
  return `<script nonce="${String(nonce).replace(/[^A-Za-z0-9_-]/g, '')}">${js}</script>`
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface PassSsrOptions {
  payload: string
  pathname: string
  /** `url.search` — 브라우저 주소와 같은 위치로 그린다. */
  search: string
  userAgent: string | undefined
  nonce: string
  origin: string
  waitUntil?: (p: Promise<unknown>) => void
}

/**
 * 한국어 core 문구를 미리 출발시키는 링크 — 워커가 라우트 청크 미리받기와 **같은 자리(head)·같은 rel 규칙**으로 단다.
 * 엔트리가 부팅 뒤에야 동적 import 로 찾는 파일이라 안 당기면 그만큼 늦게 온다 — 서버 화면을 이어받는 페이지는
 * 그 문구를 기다리므로 이어받기가 그만큼 늦어진다(로컬 A/B 실측 0.26초). 다른 화면도 부팅 직후 어차피 받는 파일이라 손해가 없다.
 * ⚠️ body(`#root` 뒤)에 두면 안 된다 — CSS 먼저 부팅(`css-first-boot.ts`)은 CSS 가 오는 순간 **그때까지 파싱된** 지연 링크만 깨운다.
 */
export function localeCorePreload(rel = 'modulepreload', file = LOCALE_CORE): string {
  return file ? `<link rel="${rel.replace(/[^a-z-]/g, '')}" crossorigin href="${file}">` : ''
}

/** `#root` 안에 넣을 앱 HTML 과 `#root` 바로 뒤에 둘 스크립트. */
export interface PassSsrResult { root: string; after: string }

/** 서버가 그린 앱(이어받을 것). 못 그리면 null. */
export async function passDetailSsr(o: PassSsrOptions): Promise<PassSsrResult | null> {
  if (!isPassSsrPath(o.pathname) || !isMobileUserAgent(o.userAgent)) return null
  try {
    const data = (JSON.parse(o.payload) as { data?: { id?: number } & Record<string, unknown> })?.data
    if (!data || typeof data.id !== 'number' || !data.name) return null
    const url = o.pathname + (o.search || '')
    const key = new Request(`${o.origin}/__ssr_pass/${data.id}?h=${await sha1Hex(o.payload + '\n' + url)}&v=${encodeURIComponent(SSR_BUILD)}`)
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
    let body = ''
    if (cache) {
      const hit = await cache.match(key).catch(() => undefined)
      if (hit) body = await hit.text()
    }
    if (!body) {
      const mod = await import('virtual:pass-ssr')
      if (!mod.renderPassApp) return null
      body = await mod.renderPassApp(data as { id: number } & Record<string, unknown>, url)
      if (!body || body.length < 5000) return null // 이상하게 짧으면 쓰지 않는다(로더·빈 화면이 그려진 것)
      if (cache) {
        const put = cache.put(key, new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })).catch(() => {})
        if (o.waitUntil) o.waitUntil(put)
      }
    }
    return { root: body, after: earlyTapScript(o.nonce) }
  } catch {
    return null
  }
}
