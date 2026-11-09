/**
 * 🏠 Shell Service Worker — 재방문 손님의 검은 화면을 0초로 (2026-11-09 대표 승인, 결재 docs/decisions/2026-11-09-revisit-instant-shell.md)
 *
 * ## 무엇을 하나
 *   손님 폰에 **마지막으로 받은 소비자 화면 HTML** 을 저장해 두고, 다음에 같은 주소로 들어오면 서버(한국→LA 연결 1.8초)를
 *   기다리지 않고 저장본을 **즉시** 돌려준다. 같은 요청을 네트워크로도 받아 **다음 방문용으로 갈아끼운다**(stale-while-revalidate).
 *
 * ## 🔴 2026-04-27 사고와 다른 점 — 이 파일의 존재 이유는 아래 울타리다
 *   그때 vite-plugin-pwa 의 navigateFallback 이 `/auth/kakao/start?redirect=…` 를 가로채 카카오 로그인이 전부 끊겼다.
 *   ① **문서 요청(navigate)만** · GET 만 · 같은 출처만 · **쿼리가 하나라도 있으면 손대지 않는다**(?code= ?state= ?paymentKey= ?orderId= ?ref= ?__cb= 전부 포함)
 *   ② **허용 목록** — 서버가 첫 화면을 그리는 소비자 경로만(아래 ALLOW). 목록에 없으면 SW 는 투명하다(respondWith 를 부르지 않는다).
 *   ③ **금지 목록**(DENY) — 로그인·카카오·결제·API·어드민·사장님·에이전시·매장 등록. 허용 목록보다 **먼저** 본다.
 *   ④ 네트워크 응답이 **리다이렉트**면 저장하지 않고 `Response.redirect` 로 바꿔 돌려준다 — 사고 메시지
 *      "a redirected response was used for a request whose redirect mode is not follow" 가 바로 이 자리다.
 *   ⑤ 킬스위치: 페이지가 `{type:'ur-shell-off'}` 를 보내면 저장소를 지우고 **자기 자신을 해제**한다(`lib/shell-sw.ts` 가 `platform_settings.shell_sw_enabled` 를 보고 보낸다).
 *   ⑥ 저장본에는 `<meta name="ur-shell-cache" content="1">` 를 끼워 돌려준다 — 앱이 이걸 보고 모든 쿼리를 한 번 새로 받는다(옛 시드가 30분 신선으로 남지 않게).
 *
 * ## 로그인 상태
 *   서버는 로그인 여부(`ur_session` 쿠키)에 따라 다른 첫 화면을 그린다. SW 는 HttpOnly 쿠키를 못 읽으므로 워커가 응답 헤더
 *   `X-Shell-Variant: user|guest` 로 알려 주고, 이 SW 는 **마지막으로 본 variant** 의 저장본을 돌려준다(틀리면 앱이 마운트 때 바로잡는다).
 *
 * ## 검사
 *   `src/tests/unit/shell-sw-policy-2026-11-09.test.ts` 가 이 파일을 그대로 평가해 `self.__urShellPolicy` 로 ①~③ 을 대조한다(주입 포함).
 *   ⚠️ 이 파일은 모듈이 아니다(classic SW). import 를 쓰지 말 것.
 */
/* eslint-disable no-restricted-globals */
var SHELL_VERSION = 'v1'
var SHELL_CACHE = 'ur-shell-' + SHELL_VERSION
var META_URL = '/__ur-shell-meta'
var MAX_ENTRIES = 40

/** 서버가 첫 화면을 그리는 소비자 경로만. 쿼리 없는 경로 문자열로 판정한다. */
var ALLOW = [
  /^\/$/,
  /^\/vouchers$/,
  /^\/stays$/,
  /^\/life$/,
  /^\/(?:pass|group-buy|vouchers|stays)\/\d+$/,
  /^\/u\/[A-Za-z0-9_-]{1,40}$/,
  /^\/region\/[^/]+(?:\/[^/]+)?$/,
  /^\/blog(?:\/[^/]+)?$/,
]
/** 허용 목록보다 먼저 본다. 접두사 일치. */
var DENY_PREFIX = [
  '/auth', '/oauth', '/api', '/sync', '/login', '/logout', '/signup',
  '/checkout', '/pay', '/payment', '/toss', '/order', '/orders', '/cart',
  '/admin', '/seller', '/agency', '/store', '/host',
  '/u/me', '/user/', '/my-', '/mypage', '/account', '/wallet', '/points',
  '/cdn-cgi', '/assets', '/static', '/_', '/sw.js', '/push-sw.js', '/pwa-sw.js', '/shell-sw.js',
]

function isDenied(pathname) {
  for (var i = 0; i < DENY_PREFIX.length; i++) {
    var p = DENY_PREFIX[i]
    if (pathname === p || pathname.indexOf(p + '/') === 0 || (p.slice(-1) === '/' && pathname.indexOf(p) === 0) || (p.slice(-1) === '-' && pathname.indexOf(p) === 0)) return true
  }
  return false
}
function isAllowed(pathname) {
  for (var i = 0; i < ALLOW.length; i++) if (ALLOW[i].test(pathname)) return true
  return false
}
/**
 * 이 요청을 SW 가 다룰까. 하나라도 어긋나면 false → SW 는 아무것도 안 하고 브라우저가 평소처럼 네트워크로 간다.
 * @param {string} urlStr  요청 URL
 * @param {string} method  GET 만
 * @param {string} mode    'navigate' 만(문서 요청)
 * @param {string} origin  self.location.origin
 */
function shouldHandle(urlStr, method, mode, origin) {
  if (method !== 'GET' || mode !== 'navigate') return false
  var u
  try { u = new URL(urlStr) } catch (e) { return false }
  if (u.origin !== origin) return false
  if (u.search) return false // ?code= ?state= ?paymentKey= ?orderId= ?ref= ?__cb= … 전부 — 쿼리가 있으면 손대지 않는다
  var path = u.pathname.replace(/\/+$/, '') || '/'
  if (isDenied(path)) return false
  return isAllowed(path)
}

function cacheKey(pathname, variant) {
  return new Request(self.location.origin + pathname + '#' + (variant || 'guest'))
}
async function readVariant(cache) {
  try {
    var m = await cache.match(META_URL)
    if (!m) return 'guest'
    var j = await m.json()
    return j && j.variant === 'user' ? 'user' : 'guest'
  } catch (e) { return 'guest' }
}
async function writeVariant(cache, variant) {
  try { await cache.put(META_URL, new Response(JSON.stringify({ variant: variant }), { headers: { 'Content-Type': 'application/json' } })) } catch (e) { /* quota */ }
}
function variantOf(res) {
  var v = res.headers.get('X-Shell-Variant')
  return v === 'user' ? 'user' : 'guest'
}
function isCacheableHtml(res) {
  if (!res || res.status !== 200 || res.redirected) return false
  var ct = res.headers.get('Content-Type') || ''
  return ct.indexOf('text/html') === 0
}
async function trim(cache) {
  try {
    var keys = await cache.keys()
    if (keys.length <= MAX_ENTRIES) return
    for (var i = 0; i < keys.length - MAX_ENTRIES; i++) if (keys[i].url.indexOf(META_URL) < 0) await cache.delete(keys[i])
  } catch (e) { /* 무시 */ }
}
/** 저장본을 돌려줄 때 표식을 끼운다 — 앱이 쿼리를 한 번 새로 받는다(위 ⑥). */
async function markCached(res) {
  try {
    var html = await res.text()
    var marked = html.replace('<head>', '<head><meta name="ur-shell-cache" content="1">')
    var h = new Headers(res.headers)
    h.delete('Content-Length')
    h.set('X-Shell-Served', 'cache')
    return new Response(marked, { status: 200, headers: h })
  } catch (e) { return res }
}
async function fetchShell(url) {
  // 🔴 새 Request 로 받는다 — navigate 요청(redirect mode 'manual')을 그대로 fetch 하지 않는다(사고 ④).
  return fetch(url, { credentials: 'include', redirect: 'follow', cache: 'no-store' })
}
async function refresh(cache, pathname, url) {
  try {
    var res = await fetchShell(url)
    if (!isCacheableHtml(res)) return
    var variant = variantOf(res)
    await cache.put(cacheKey(pathname, variant), res.clone())
    await writeVariant(cache, variant)
    await trim(cache)
  } catch (e) { /* 다음 방문에 다시 */ }
}

self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys()
      await Promise.all(keys.filter(function (k) { return k.indexOf('ur-shell-') === 0 && k !== SHELL_CACHE }).map(function (k) { return caches.delete(k) }))
    } catch (e) { /* 무시 */ }
    await self.clients.claim()
  })())
})
self.addEventListener('message', function (event) {
  var d = event.data
  if (!d || d.type !== 'ur-shell-off') return
  event.waitUntil((async function () {
    try { await caches.delete(SHELL_CACHE) } catch (e) { /* 무시 */ }
    try { await self.registration.unregister() } catch (e) { /* 무시 */ }
  })())
})
self.addEventListener('fetch', function (event) {
  var req = event.request
  if (!shouldHandle(req.url, req.method, req.mode, self.location.origin)) return // 투명 — 브라우저가 평소대로
  var u = new URL(req.url)
  var pathname = u.pathname.replace(/\/+$/, '') || '/'
  event.respondWith((async function () {
    var cache = await caches.open(SHELL_CACHE)
    var variant = await readVariant(cache)
    var cached = await cache.match(cacheKey(pathname, variant))
    if (cached) {
      event.waitUntil(refresh(cache, pathname, u.href))
      return markCached(cached)
    }
    var res = await fetchShell(u.href)
    if (res.redirected) return Response.redirect(res.url, 302) // 사고 ④ — 리다이렉트된 응답을 navigate 에 그대로 주지 않는다
    if (isCacheableHtml(res)) {
      var v = variantOf(res)
      event.waitUntil((async function () { await cache.put(cacheKey(pathname, v), res.clone()); await writeVariant(cache, v); await trim(cache) })())
    }
    return res
  })())
})

// 시험이 이 파일을 평가해 정책을 대조한다.
self.__urShellPolicy = { shouldHandle: shouldHandle, isDenied: isDenied, isAllowed: isAllowed, version: SHELL_VERSION }
