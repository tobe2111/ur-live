/** 🧬 주입 — 오프라인 청크 실패 시 새로고침 보류. 가드: src/tests/unit/chunk-recovery.test.ts(📵) */
const T = 'src/tests/unit/chunk-recovery.test.ts'
const F = 'src/utils/chunk-error.ts'
export default [
  { name: '오프라인청크 — 오프라인에도 바로 새로고침(브라우저 오류 화면)', file: F, find: "    if (typeof navigator !== 'undefined' && navigator.onLine === false && typeof window !== 'undefined'", replace: "    if (false && typeof navigator !== 'undefined' && navigator.onLine === false && typeof window !== 'undefined'", test: T, why: '2026-11-12 라이브 실측 — 오프라인 홈이 빈 오류 화면.' },
  { name: '오프라인청크 — 연결이 돌아와도 새로고침하지 않는다(안내에서 영영 멈춤)', file: F, find: "      window.addEventListener('online', () => { setTimeout(reloadWithCacheBust, 300) }, { once: true })\n", replace: '', test: T, why: '연결이 돌아오면 최신 화면을 받아야 한다.' },
]
