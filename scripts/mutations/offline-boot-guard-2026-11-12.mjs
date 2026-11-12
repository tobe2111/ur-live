/** 🧬 주입 — index.html 부트 가드 오프라인 보호. 가드: src/tests/unit/offline-boot-guard-2026-11-12.test.ts */
const T = 'src/tests/unit/offline-boot-guard-2026-11-12.test.ts'
export default [
  { name: '오프라인부트 — 청크 실패에 오프라인 확인을 뺀다(브라우저 오류 화면)', file: 'index.html', find: "          if (offlineWait()) return; // 📵 오프라인 실패는 배포 탓이 아니다 — 예산도 안 쓴다\n", replace: '', test: T, why: '2026-11-12 라이브 실측.' },
  { name: '오프라인부트 — 복구 화면이 저장본을 덮는다', file: 'index.html', find: "          if (offlineWait()) return; // 📵 오프라인 — 저장된 화면을 덮지 않는다\n", replace: '', test: T, why: '완전복구 버튼이 저장본까지 지운다.' },
  { name: '오프라인부트 — 연결이 돌아와도 새로고침하지 않는다', file: 'index.html', find: "              window.addEventListener('online', function () {", replace: "              window.addEventListener('online-never', function () {", test: T, why: '연결 뒤 최신 화면을 받아야 한다.' },
]
