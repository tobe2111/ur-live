/** 🧬 주입 — 옛 유어샵 핸들 302. 가드: src/tests/unit/curator-moved-redirect-2026-11-13.test.ts */
const T = 'src/tests/unit/curator-moved-redirect-2026-11-13.test.ts'
export default [
  { name: '유어샵이동 — 쿼리(귀속)가 있어도 넘긴다', file: 'src/worker/index.ts', find: "if (ssrSlot === 'CURATOR' && !url.search) {", replace: "if (ssrSlot === 'CURATOR') {", test: T, why: '?ref= 귀속은 앱이 적고 넘긴다 — 서버가 먼저 넘기면 그 줄이 안 돈다.' },
  { name: '유어샵이동 — 이상한 핸들도 그대로 Location 에', file: 'src/worker/utils/curator-moved-redirect.ts', find: "|| !HANDLE_RE.test(d.new_handle)) return null", replace: ") return null", test: T, why: '시드 값을 검사 없이 헤더에 넣으면 경로 조작이 된다.' },
  { name: '유어샵이동 — 제자리로 넘겨 무한 반복', file: 'src/worker/utils/curator-moved-redirect.ts', find: "if (d.new_handle === m[1] || d.new_handle === 'me') return null", replace: "if (d.new_handle === 'me') return null", test: T, why: '같은 주소로 302 하면 끝없이 돈다.' },
]
