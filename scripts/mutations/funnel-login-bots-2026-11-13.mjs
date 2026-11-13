/** 🧬 주입 — 퍼널 로그인 성공 · 자동 브라우저 제외 (2026-11-13) · 가드: src/tests/unit/funnel-login-and-bots-2026-11-13.test.ts */
const T = 'src/tests/unit/funnel-login-and-bots-2026-11-13.test.ts'
export default [
  { name: 'funnelfix: 실제 로그인이 표식을 안 남긴다', file: 'src/utils/auth-callback-bootstrap.ts',
    find: "      try { sessionStorage.setItem('ur_login_ok_pending', urlParams.get('new') === '1' ? 'new' : '1') } catch { /* */ }\n",
    replace: '', test: T, why: "'로그인 성공' 이 다시 영영 0건이 된다(로그인 벽 뒤 이탈을 못 잰다)." },
  { name: 'funnelfix: 점검 스크립트가 퍼널에 찍힌다', file: 'src/lib/funnel.ts',
    find: '    if (navigator.webdriver === true) return', replace: '', test: T,
    why: '자동 브라우저 방문이 사람으로 섞여 전환율이 틀린다.' },
  { name: 'funnelfix: 점검 스크립트가 유입으로 찍힌다', file: 'src/utils/affiliate-track.ts',
    find: "    if (typeof navigator !== 'undefined' && navigator.webdriver === true) return\n", replace: '', test: T,
    why: '유어샵을 여는 점검 스크립트가 매번 새 방문자로 찍혀 유입이 부풀려진다.' },
]
