/** 🧬 주입 — 오류 경계 오프라인 안내. 가드: src/tests/unit/error-boundary-offline-2026-11-12.test.tsx */
const T = 'src/tests/unit/error-boundary-offline-2026-11-12.test.tsx'
export default [
  { name: '경계오프라인 — 오프라인에도 "새 버전" 화면(새로고침 버튼은 오류 화면으로 간다)', file: 'src/components/ErrorBoundary.tsx', find: '        if (isOfflineNow()) {', replace: '        if (false && isOfflineNow()) {', test: T, why: '2026-11-12 라이브 실측 — 오프라인인데 "새 버전이 배포" 안내.' },
]
