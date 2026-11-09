/** 🧬 주입 — 로더 즉시 표시(HTML 이 늦었으면 shy 0.5초 생략) (2026-11-09) */
const T = 'src/tests/unit/loader-early-reveal-2026-11-09.test.ts'
export default [
  { name: '⏱️ 로더즉시 — head 에서 스크립트를 뺀다', file: 'src/worker/utils/css-first-boot.ts', find: "const head = cssFirstBootScript(nonce, true) + loaderEarlyRevealScript(nonce) +", replace: "const head = cssFirstBootScript(nonce, true) +", test: T, why: '느린 회선 손님이 HTML 뒤 0.5초를 또 흰 화면으로 기다린다.' },
  { name: '⏱️ 로더즉시 — 상한이 shy 창과 갈린다', file: 'src/shared/brand-loader-markup.ts', find: 'export const LOADER_EARLY_REVEAL_MS = LOADER_REVEAL_S * 1000', replace: 'export const LOADER_EARLY_REVEAL_MS = 2000', test: T, why: '"0.5초 안에 끝나면 안 보인다" 가 두 뜻이 된다.' },
  { name: '⏱️ 로더즉시 — 앱 로더가 표식을 무시한다', file: 'src/components/brand/BrandLoader.tsx', find: 'const phase = loaderPhaseVars(sinceFirstPaintS(), early)', replace: 'const phase = loaderPhaseVars(sinceFirstPaintS())', test: T, why: '서버 로더는 보였는데 앱 로더로 바뀌는 순간 다시 0.5초 숨는다(깜빡임).' },
]
