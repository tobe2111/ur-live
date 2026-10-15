/**
 * 🧊 이용권 상세(`/pass/:id`)를 **리액트 그대로** 서버에서 그린다 (2026-10-15 대표 *"가장 이상적이고 영구적으로"* — 서버 렌더 3단계).
 *
 * ## 왜 — 손그림 첫 화면은 제목까지였다
 * 종전 첫 화면(`detail-ssr-body.ts`)은 사진·제목까지만 손으로 옮겨 그렸다. 가격·구매하기는 앱 코드(느린 폰에서 1~2초)가
 * 받아지고 실행된 **뒤에야** 떴다. 더 그리려면 손으로 옮길 양이 늘고, 옮긴 사본은 언젠가 원본과 갈린다(에러 0).
 * ⇒ 페이지 컴포넌트를 **그대로** 서버에서 그린다(`src/ssr/pass-detail-entry.tsx` — 워커용 한 파일 번들).
 *
 * ## 무엇이 같고 무엇이 다른가
 *  - 앱은 여전히 `createRoot`(교체)다. 같은 코드·같은 시드라 마운트 때 다시 그린 결과가 **글자·박스까지 같다**
 *    (로컬 A/B: 화면 안 글자 36개 위치 전부 일치 — 하단 탭 이름 5개만 더해지고 구매 바 뒤에 가려진다).
 *  - 사람마다 다른 자리(로그인·찜·잔액·내 위치 거리)는 서버가 **비운 채** 그린다(2단계 `useStoredValue` — 서버 스냅샷 null).
 *  - 폰 UA 만. PC 는 위에 데스크톱 상단 네비가 더해져 내용이 밀리므로 종전 첫 화면(빵부스러기 + 로더).
 *
 * ## 캐시 — 상품 시드가 같으면 같은 HTML
 * 사람마다 같은 HTML 이라(위 규칙) 상품별로 엣지 캐시에 둔다. 키 = 시드 해시 + 빌드 번호 — 가격이 바뀌면 시드가
 * 바뀌어 키가 바뀌고, 배포하면 빌드 번호가 바뀐다. 적중하면 서버 렌더 번들을 **불러오지도 않는다**(격리 첫 렌더 비용 0).
 *
 * ## 실패하면 '' — 호출부가 종전 첫 화면으로 폴백한다(무회귀).
 */
import { isMobileUserAgent } from '../../shared/detail-hero-image'

declare const __SSR_BUILD__: string
const SSR_BUILD = typeof __SSR_BUILD__ === 'string' ? __SSR_BUILD__ : 'dev'
/** 클라 `lib/boot-first-screen.ts` 의 `BOOT_FIRST_SCREEN_ID` 와 같아야 한다(시험이 대조 — 갈리면 조용히 no-op). */
export const PASS_SSR_NODE_ID = 'ur-first-screen'

/** 서버 렌더 대상 주소 — `/pass/:id` 만(쿼리는 안 본다 — 그리는 내용이 쿼리에 따라 갈리지 않는다). */
export function isPassSsrPath(pathname: string): boolean {
  return /^\/pass\/\d+$/.test(pathname)
}

/**
 * 앱이 붙기 전에 누른 버튼을 기억하는 스크립트 — `data-early-tap` 버튼만. 링크(`<a href>`)는 그대로 둔다(브라우저가 이동).
 * 앱이 붙으면 첫 화면 노드가 통째로 교체되므로 이 리스너도 함께 사라진다.
 */
export function earlyTapScript(nonce: string): string {
  const js =
    `(function(){var r=document.getElementById(${JSON.stringify(PASS_SSR_NODE_ID)});if(!r)return;` +
    `r.addEventListener('click',function(e){var t=e.target,b=t&&t.closest&&t.closest('[data-early-tap]');` +
    `if(!b||!document.getElementById(${JSON.stringify(PASS_SSR_NODE_ID)}))return;e.preventDefault();` +
    `window.__urEarlyTap=b.getAttribute('data-early-tap');b.style.opacity='.6'},true)})()`
  return `<script nonce="${String(nonce).replace(/[^A-Za-z0-9_-]/g, '')}">${js}</script>`
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface PassSsrOptions {
  payload: string
  pathname: string
  userAgent: string | undefined
  nonce: string
  origin: string
  waitUntil?: (p: Promise<unknown>) => void
}

/** 서버가 그린 상세 첫 화면(노드 + 누름 기억 스크립트). 못 그리면 ''. */
export async function passDetailSsr(o: PassSsrOptions): Promise<string> {
  if (!isPassSsrPath(o.pathname) || !isMobileUserAgent(o.userAgent)) return ''
  try {
    const data = (JSON.parse(o.payload) as { data?: { id?: number } & Record<string, unknown> })?.data
    if (!data || typeof data.id !== 'number' || !data.name) return ''
    const key = new Request(`${o.origin}/__ssr_pass/${data.id}?h=${await sha1Hex(o.payload)}&v=${encodeURIComponent(SSR_BUILD)}`)
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
    let body = ''
    if (cache) {
      const hit = await cache.match(key).catch(() => undefined)
      if (hit) body = await hit.text()
    }
    if (!body) {
      const mod = await import('virtual:pass-ssr')
      if (!mod.renderPassDetail) return ''
      body = mod.renderPassDetail(data as { id: number } & Record<string, unknown>, o.pathname)
      if (!body || body.length < 2000) return '' // 이상하게 짧으면 쓰지 않는다(로더·빈 화면이 그려진 것)
      if (cache) {
        const put = cache.put(key, new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })).catch(() => {})
        if (o.waitUntil) o.waitUntil(put)
      }
    }
    return `<div id="${PASS_SSR_NODE_ID}">${body}</div>${earlyTapScript(o.nonce)}`
  } catch {
    return ''
  }
}
