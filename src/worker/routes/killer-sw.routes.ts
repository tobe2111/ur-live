// ============================================================
// Killer Service Worker endpoints — 2026-04-27 OAuth redirect 사고 복구
// ============================================================
//
// 배경: vite-plugin-pwa 의 navigateFallback 이 카카오 OAuth redirect 를 가로채
//       ERR_FAILED 사고 발생 (2026-04-27).
//
// /sw.js: Killer SW 응답 — 기존 등록된 SW 의 install/activate 라이프사이클 시
//         자기 자신 unregister + 캐시 전체 삭제 → 다음 접속부터 정상.
// /workbox-:hash.js: 기존 SW 가 import 하는 workbox 청크. 빈 응답으로 차단.
//
// CDN/브라우저 캐시 우회: Cache-Control: no-cache, no-store
// Service-Worker-Allowed: '/' — 루트 scope 등록 허용
//
// 30일 후 (2026-05-27) 이 라우터 제거 — 모든 클라이언트 SW unregister 완료 시점.
//
// 분리 출처: 이전엔 worker/index.ts 인라인 핸들러. TD-006 partial split (2026-04-27).

import { Hono } from 'hono';
import type { Env } from '../types/env';

export const killerSwRoutes = new Hono<{ Bindings: Env }>();

const KILLER_SW = `// 🚨 Killer SW - 2026-04-27 OAuth redirect 차단 사고 복구
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {}
    try { await self.registration.unregister(); } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch {}
  })());
});
// fetch 핸들러 없음 — 모든 요청 네트워크 직통 (OAuth redirect 통과)
`;

killerSwRoutes.get('/sw.js', (_c) => {
  return new Response(KILLER_SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
});

killerSwRoutes.get('/workbox-:hash{[a-zA-Z0-9]+}.js', (_c) => {
  return new Response('// Killer — workbox 의존성 차단', {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
});

// ============================================================
// 🩺 /recover — 브라우저 자가진단 + 원클릭 완전복구 페이지 (2026-07-04)
// ============================================================
//
// 배경(대표 신고 3회+ — "/admin 만 무한로딩·응답없음·콘솔 무에러"): 서버/배포는 매번 정상으로
//   실측되는데 특정 브라우저에서만 재발 → ERROR_DEBUGGING_PLAYBOOK "같은 에러 2번 = ground truth
//   수집 도구" 룰에 따라, 문제의 브라우저에서 직접 실행되는 진단 페이지를 상시 제공.
//
// 동작: SW 등록/캐시/HTML 신선도(캐시된 /admin vs 서버 최신의 청크 해시 비교)/어드민 청크 실재/
//   localStorage 어드민 상태(JWT exp 디코드)/어드민 API 응답을 자동 점검 → 판정 + 복구 버튼.
//   결과는 /api/_errors/log(type='admin-diag') 로도 자동 전송(운영자가 frontend_errors 에서 확인).
//
// CSP: 전역 보안 미들웨어(worker/index.ts)가 모든 text/html 응답의 <script> 에 요청별 nonce 를
//   HTMLRewriter 로 자동 부여 → 이 페이지의 inline script 도 통과(별도 nonce 배선 불필요).
// 캐시: no-store — 진단 페이지 자체가 stale 이면 무의미.
const RECOVER_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>유어딜 브라우저 진단·복구</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:24px 16px 48px; font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
         background:#fff; color:#111827; max-width:640px; margin-inline:auto; }
  @media (prefers-color-scheme: dark) { body { background:#020202; color:#f5f5f5; } }
  h1 { font-size:20px; font-weight:800; margin:0 0 4px; }
  .sub { font-size:13px; color:#6b7280; margin-bottom:20px; }
  #log { font-size:13px; line-height:1.9; white-space:pre-wrap; word-break:break-all;
         background:rgba(127,127,127,.08); border-radius:12px; padding:14px 16px; min-height:120px; }
  #verdict { font-size:15px; font-weight:700; margin:16px 0 8px; line-height:1.5; }
  .btn { display:block; width:100%; margin-top:10px; padding:14px 20px; border:0; border-radius:12px;
         font-size:15px; font-weight:700; cursor:pointer; }
  .btn-primary { background:#2563eb; color:#fff; }
  .btn-warn { background:#dc2626; color:#fff; }
  .btn-ghost { background:rgba(127,127,127,.12); color:inherit; }
</style>
</head>
<body>
<h1>유어딜 브라우저 진단·복구</h1>
<div class="sub">이 브라우저에서 유어딜이 안 열리는 원인을 자동 점검합니다.</div>
<div id="log">점검 중…</div>
<div id="verdict"></div>
<button id="btn-fix" class="btn btn-primary">🚑 완전 복구 (캐시·서비스워커 정리 후 새로고침)</button>
<button id="btn-reset-admin" class="btn btn-warn">🔑 어드민 로그인 상태 초기화 (다시 로그인)</button>
<button id="btn-go" class="btn btn-ghost">/admin 으로 이동</button>
<script>
(async function () {
  var logEl = document.getElementById('log'), lines = [], findings = [];
  function log(s) { lines.push(s); logEl.textContent = lines.join('\\n'); }
  function short(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

  // 1) 서비스워커
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      var ctrl = navigator.serviceWorker.controller;
      var bad = regs.filter(function (r) {
        var u = (r.active && r.active.scriptURL) || (r.waiting && r.waiting.scriptURL) || '';
        return u.indexOf('push-sw.js') < 0;
      });
      log('1. 서비스워커: 등록 ' + regs.length + '개' + (ctrl ? ' / 이 페이지 제어 중: ' + short(ctrl.scriptURL, 60) : ' / 페이지 제어 없음'));
      if (bad.length) { findings.push('sw'); log('   ⚠️ 캐시형 SW 잔존 — 완전 복구 필요'); } else { log('   ✅ 문제될 SW 없음'); }
    } else { log('1. 서비스워커: 미지원 브라우저'); }
  } catch (e) { log('1. 서비스워커 점검 실패: ' + short(e, 80)); }

  // 2) 브라우저에 캐시된 /admin HTML vs 서버 최신 — 청크 해시 비교 (stale HTML 결정적 감지)
  var freshChunks = [], cachedChunks = [];
  function extractChunks(html) { return (html.match(/assets\\/(?:index|app-routes)-[\\w-]+\\.js/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i; }); }
  try {
    var freshHtml = await (await fetch('/admin', { cache: 'no-store' })).text();
    freshChunks = extractChunks(freshHtml);
    var cachedHtml = await (await fetch('/admin')).text(); // HTTP 캐시 허용 → 브라우저가 낡은 HTML 을 갖고 있으면 그걸 반환
    cachedChunks = extractChunks(cachedHtml);
    var stale = cachedChunks.length && freshChunks.length && cachedChunks.join() !== freshChunks.join();
    log('2. HTML 신선도: 서버 최신 [' + short(freshChunks.join(', '), 90) + ']');
    if (stale) { findings.push('stale-html'); log('   ❌ 브라우저 캐시가 낡음: [' + short(cachedChunks.join(', '), 90) + '] — 완전 복구 필요'); }
    else { log('   ✅ 브라우저 캐시 = 서버 최신'); }
  } catch (e) { log('2. HTML 신선도 점검 실패: ' + short(e, 80)); }

  // 3) 어드민 청크 실재 (최신 라우트 청크가 참조하는 AdminPage/app-admin-components)
  try {
    var routesUrl = (freshChunks.filter(function (c) { return c.indexOf('app-routes') >= 0; })[0]) || '';
    if (routesUrl) {
      var routesJs = await (await fetch('/' + routesUrl, { cache: 'no-store' })).text();
      var adminRefs = (routesJs.match(/(?:AdminPage|app-admin-components)-[\\w-]+\\.js/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
      for (var i = 0; i < adminRefs.length; i++) {
        var r = await fetch('/assets/' + adminRefs[i], { cache: 'no-store' });
        var ctp = r.headers.get('content-type') || '';
        var ok = r.status === 200 && ctp.indexOf('javascript') >= 0;
        log('3. 어드민 청크 ' + adminRefs[i] + ': ' + r.status + ' ' + short(ctp, 30) + (ok ? ' ✅' : ' ❌'));
        if (!ok) findings.push('chunk-missing');
      }
    } else { log('3. 어드민 청크: 라우트 청크를 못 찾음(2번 실패 여파)'); }
  } catch (e) { log('3. 어드민 청크 점검 실패: ' + short(e, 80)); }

  // 4) 어드민 로그인 상태 (localStorage + JWT exp)
  var tokenState = 'none';
  try {
    var tk = localStorage.getItem('admin_token');
    var mustPin = localStorage.getItem('admin_must_set_pin');
    var role = localStorage.getItem('admin_role');
    if (tk) {
      try {
        var payload = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        var expMs = (payload.exp || 0) * 1000;
        tokenState = expMs && expMs < Date.now() ? 'expired' : 'valid';
        log('4. 어드민 토큰: 있음 (' + (tokenState === 'expired' ? '❌ 만료 ' + new Date(expMs).toLocaleString() : '✅ 유효') + ') / role=' + (role || '-') + ' / must_set_pin=' + (mustPin || '-'));
      } catch (e2) { tokenState = 'corrupt'; log('4. 어드민 토큰: 있음 (⚠️ 디코드 불가 — 손상)'); }
    } else { log('4. 어드민 토큰: 없음 (로그인 필요 상태)'); }
    if (tokenState === 'expired' || tokenState === 'corrupt') findings.push('token');
    var guard = sessionStorage.getItem('__ur_chunk_reload__');
    if (guard) log('   복구가드 상태: ' + short(guard, 60));
  } catch (e) { log('4. 로그인 상태 점검 실패: ' + short(e, 80)); }

  // 5) 어드민 API 응답 (토큰+쿠키 동시 — 401=토큰 문제 / 403=IP·권한 / 200=정상)
  try {
    var t0 = Date.now();
    var hdrs = {}; try { var tk2 = localStorage.getItem('admin_token'); if (tk2) hdrs['Authorization'] = 'Bearer ' + tk2; } catch (e3) {}
    var res = await fetch('/api/admin/dashboard/stats', { headers: hdrs, credentials: 'include', cache: 'no-store' });
    var ms = Date.now() - t0;
    log('5. 어드민 API: HTTP ' + res.status + ' (' + ms + 'ms)' + (res.status === 200 ? ' ✅' : res.status === 401 ? ' ❌ 인증 실패(재로그인 필요)' : res.status === 403 ? ' ❌ 차단(IP 화이트리스트/권한)' : ' ⚠️'));
    if (res.status === 401) findings.push('token'); else if (res.status === 403) findings.push('forbidden');
    if (ms > 5000) findings.push('slow-api');
  } catch (e) { log('5. 어드민 API 점검 실패: ' + short(e, 80)); findings.push('network'); }

  // 판정
  var v = document.getElementById('verdict'), verdict;
  if (findings.indexOf('stale-html') >= 0 || findings.indexOf('sw') >= 0 || findings.indexOf('chunk-missing') >= 0)
    verdict = '🔧 원인: 브라우저에 낡은 캐시/서비스워커가 남아 있습니다. 아래 [🚑 완전 복구] 를 눌러주세요.';
  else if (findings.indexOf('token') >= 0)
    verdict = '🔑 원인: 어드민 로그인 상태(토큰)가 만료/손상됐습니다. [🔑 어드민 로그인 상태 초기화] 후 다시 로그인해주세요.';
  else if (findings.indexOf('forbidden') >= 0)
    verdict = '🚫 원인: 서버가 이 접속을 차단(403)합니다 — IP 화이트리스트 또는 권한 설정 문제. 운영자에게 이 화면을 보내주세요.';
  else if (findings.indexOf('network') >= 0 || findings.indexOf('slow-api') >= 0)
    verdict = '🌐 네트워크/서버 응답 문제가 감지됐습니다. 이 화면을 캡처해 운영자에게 보내주세요.';
  else
    verdict = '✅ 브라우저·서버 모두 정상입니다. 아래 [/admin 으로 이동] 을 눌러 다시 시도해보세요. 그래도 안 되면 이 화면을 캡처해 보내주세요.';
  v.textContent = verdict;

  // 운영자용 자동 리포트 (fire-and-forget)
  try {
    fetch('/api/_errors/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'admin-diag', url: '/recover', message: short(verdict + ' | findings=' + findings.join(',') , 480), stack: short(lines.join('\\n'), 1900), user_agent: navigator.userAgent })
    });
  } catch (e) {}

  // 버튼
  function bust(path) {
    try { var u = new URL(path, location.origin); u.searchParams.set('__cb', Date.now().toString(36)); location.replace(u.toString()); }
    catch (e) { location.href = path; }
  }
  document.getElementById('btn-fix').addEventListener('click', async function () {
    this.textContent = '복구 중…';
    try { sessionStorage.removeItem('__ur_chunk_reload__'); sessionStorage.removeItem('__ur_sw_killed_reload__'); } catch (e) {}
    var jobs = [];
    try { if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { var u = (r.active && r.active.scriptURL) || ''; return u.indexOf('push-sw.js') >= 0 ? null : r.unregister(); })); }).catch(function () {})); } catch (e) {}
    try { if ('caches' in window) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).catch(function () {})); } catch (e) {}
    var done = false; function go() { if (!done) { done = true; bust('/admin'); } }
    Promise.all(jobs).then(go, go); setTimeout(go, 2000);
  });
  document.getElementById('btn-reset-admin').addEventListener('click', function () {
    try {
      ['admin_token', 'admin_refresh_token', 'admin_id', 'admin_name', 'admin_email', 'admin_role', 'admin_must_set_pin'].forEach(function (k) { localStorage.removeItem(k); });
      if (localStorage.getItem('user_type') === 'admin') localStorage.removeItem('user_type');
    } catch (e) {}
    bust('/admin/login');
  });
  document.getElementById('btn-go').addEventListener('click', function () { bust('/admin'); });
})();
</script>
</body>
</html>`;

const recoverHandler = () => new Response(RECOVER_HTML, {
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
});
killerSwRoutes.get('/recover', recoverHandler);
killerSwRoutes.get('/admin-diag', recoverHandler);
