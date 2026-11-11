/** 🧬 주입 — 배포 뒤 실측 규칙과 그 도구. 가드: src/tests/unit/measure-after-deploy-rule-2026-11-11.test.ts */
const T = 'src/tests/unit/measure-after-deploy-rule-2026-11-11.test.ts'
export default [
  { name: '실측규칙 — CLAUDE.md 에서 규칙 절이 사라진다', file: 'CLAUDE.md', find: '## 📏 소비자 화면을 바꿨으면 배포 뒤 속도·밀림을 잰다', replace: '## 📏 (삭제됨)', test: T, why: '다음 세션은 화면을 바꾸고도 재지 않는다 — 가드 초록만 보고 끝낸다.' },
  { name: '실측규칙 — 측정 조건이 바뀐다(옛 값과 비교가 안 된다)', file: 'scripts/measure-live-vitals.mjs', find: 'cpuRate: 4 }', replace: 'cpuRate: 1 }', test: T, why: 'CPU 를 안 늦추면 값이 좋아 보여 회귀를 못 본다.' },
  { name: '실측규칙 — 없는 주소 경고가 사라진다', file: 'scripts/measure-live-vitals.mjs', find: 'if (r.status >= 400) { bad = true;', replace: 'if (false) { bad = true;', test: T, why: '404 로더 2초를 "느린 화면"으로 읽는다(2026-11-11 오판).' },
]
