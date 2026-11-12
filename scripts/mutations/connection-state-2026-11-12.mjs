/** 🧬 주입 — 연결 상태 띠 세 갈래. 가드: src/tests/unit/connection-state-2026-11-12.test.tsx */
const T = 'src/tests/unit/connection-state-2026-11-12.test.tsx'
const H = 'src/hooks/useOnlineStatus.ts'
export default [
  { name: '연결띠 — 한 번 늦어도 바로 띄운다', file: H, find: "      await new Promise((r) => setTimeout(r, UNSTABLE_CONFIRM_MS));\n      if (!alive) return;\n      const again = await probeConnectivity();", replace: '      const again = false;', test: T, why: '2026-11-12 대표 신고 — 서버가 한 번 늦은 것으로 "끊겼습니다".' },
  { name: '연결띠 — 와이파이가 되는데도 "끊겼어요"', file: H, find: "if (alive) setState(again ? 'ok' : (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unstable'));", replace: "if (alive) setState(again ? 'ok' : 'offline');", test: T, why: '인터넷은 되는데 끊겼다고 말하면 틀린 문장이다.' },
  { name: '연결띠 — 크기 있는 사진까지 다시 부른다', file: H, find: 'if (!el.complete || el.naturalWidth > 0) return;', replace: 'if (!el.complete) return;', test: T, why: '멀쩡한 사진을 다시 받으면 트래픽만 는다.' },
]
