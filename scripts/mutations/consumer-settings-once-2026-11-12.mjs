/** 🧬 주입 — 손님 설정 한 번만 (2026-11-12) · 가드: src/tests/unit/consumer-settings-once-2026-11-12.test.ts */
const T = 'src/tests/unit/consumer-settings-once-2026-11-12.test.ts'
export default [
  { name: 'settings-once: 약속을 기억하지 않는다', file: 'src/lib/consumer-settings.ts',
    find: '  if (!pending) {', replace: '  if (true) {', test: T,
    why: '지도 첫 화면에서 같은 설정 요청이 다시 두 번 나간다.' },
  { name: 'settings-once: 서비스 워커가 직접 부른다', file: 'src/lib/shell-sw.ts',
    find: "    const { loadConsumerSettings } = await import('./consumer-settings')\n    return (await loadConsumerSettings())?.shell_sw_enabled === true",
    replace: "    const r = await fetch('/api/consumer-settings', { credentials: 'same-origin' })\n    const j = await r.json() as { data?: { shell_sw_enabled?: unknown } }\n    return j?.data?.shell_sw_enabled === true",
    test: T, why: '두 곳이 각자 불러 중복 요청이 되살아난다.' },
]
