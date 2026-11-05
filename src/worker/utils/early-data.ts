/**
 * ⚡ 2026-11-05 대표 *"여전히 이용권 불러오거나, 첫 페이지 로딩 등 최적화할게 많아"* — 로그인 화면의 데이터를 **HTML 이 오자마자** 받기 시작한다.
 *
 * ## 무엇이 느렸나 (실사용 p75 · 8일)
 * 마이 LCP 2.5초 — 주요 화면 중 가장 늦다. 로그인 화면은 서버가 첫 화면을 그리지 못해(사람마다 다르다)
 * [HTML → 앱 JS 받기·실행(폰에서 1~2초) → 로그인 확인 → 데이터 요청] 이 **차례로** 간다. 데이터 요청이 앱이 다 뜬 뒤에야 출발한다.
 *
 * ## 어떻게
 * 세션 쿠키가 있는 요청의 `<head>` 맨 앞에 작은 스크립트를 넣어, 그 화면이 처음에 부를 GET 을 **바로** 출발시킨다
 * (`window.__urWarm[경로] = { at, p }`). 앱의 요청 계층(`http-client.ts` `takeEarlyData`)이 같은 경로를 처음 부를 때
 * 그 결과를 한 번만 꺼내 쓴다 — 15초가 지났거나, 앱이 인증 헤더를 붙이는 요청(이메일 로그인 등)이거나, 2xx 가 아니면
 * 쓰지 않고 종전대로 다시 요청한다(최악 = 같은 요청 한 번 더, 종전과 같은 결과).
 *
 * 🔒 쿠키 인증 GET 만 · 응답은 그 브라우저 안에만 머문다(캐시·다른 사람과 무관). 돈을 움직이는 요청은 없다.
 */

/** 화면 → 그 화면이 처음 부르는 GET(앱이 보내는 주소와 **글자까지 같아야** 꺼내 쓴다 — 시험이 화면 코드와 대조한다). */
export const EARLY_DATA: Record<string, readonly string[]> = {
  '/user/profile': [
    '/api/auth/me', '/api/points/balance', '/api/vouchers/my', '/api/coupons/my', '/api/wishlists',
    '/api/curator/me/dashboard', '/api/account/notification-prefs',
  ],
  '/my-vouchers': ['/api/auth/me', '/api/vouchers/my', '/api/curator/me/dashboard'],
}

export function earlyDataPaths(pathname: string, authed: boolean): readonly string[] {
  if (!authed) return []
  return EARLY_DATA[pathname.replace(/\/+$/, '') || '/'] || []
}

/** `<head>` 맨 앞에 넣을 스크립트 — ES5(구형 브라우저에서도 실패하지 않게) · 실패는 조용히(앱이 종전대로 받는다). */
export function earlyDataScript(paths: readonly string[], nonce: string): string {
  if (paths.length === 0) return ''
  const js = `(function(){try{var w=window.__urWarm||(window.__urWarm={}),t=Date.now(),P=${JSON.stringify(paths)};` +
    `for(var i=0;i<P.length;i++)(function(p){w[p]={at:t,p:fetch(p,{credentials:'include',headers:{Accept:'application/json, text/plain, */*'}})` +
    `.then(function(r){return r.text().then(function(x){return{s:r.status,t:x,ct:r.headers.get('content-type')||''}})})['catch'](function(){return null})}})(P[i])}catch(e){}})()`
  return `<script nonce="${nonce}">${js}</script>`
}

export function applyEarlyData(rw: HTMLRewriter, pathname: string, authed: boolean, nonce: string): HTMLRewriter {
  const s = earlyDataScript(earlyDataPaths(pathname, authed), nonce)
  if (!s) return rw
  return rw.on('head', { element(el) { el.prepend(s, { html: true }) } })
}
