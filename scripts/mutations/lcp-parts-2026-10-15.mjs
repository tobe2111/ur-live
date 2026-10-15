/**
 * 🔬 LCP 구간 분해 (2026-10-15) — 주입 매니페스트.
 * 가드: src/tests/unit/lcp-parts-2026-10-15.test.ts
 * 이 결함들은 화면을 안 깨뜨린다 — 구간 표본이 조용히 0건이 되거나 엉뚱한 구간을 가리킬 뿐이다.
 */
const TEST = 'src/tests/unit/lcp-parts-2026-10-15.test.ts'
export default [
  {
    name: '🔬 클라가 LCP 구간을 안 보낸다',
    file: 'src/lib/web-vitals-report.ts',
    find: "send('LCP', lcpValue, page, parts)",
    replace: "send('LCP', lcpValue, page)",
    test: TEST,
    why: '구간 표본이 0건 — 무엇을 고칠지 모르는 상태로 돌아간다(에러 0).',
  },
  {
    name: '🔬 교차 출처 사진의 발견 시각을 0 으로 읽는다',
    file: 'src/lib/web-vitals-report.ts',
    find: 'Math.max(ttfb, resource.requestStart || resource.startTime)',
    replace: 'Math.max(ttfb, resource.requestStart || 0)',
    test: TEST,
    why: '카카오·네이버 사진이 LCP 면 발견 지연이 0, 받기가 부풀어 엉뚱한 구간(CDN)을 고치게 된다.',
  },
  {
    name: '🔬 서버가 합이 안 맞는 표본도 저장한다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: '  if (Math.abs(vals.reduce((a, b) => a + b, 0) - lcp) > Math.max(5, lcp * 0.02)) return []\n',
    replace: '',
    test: TEST,
    why: '고장 난 표본이 섞여 구간 분포가 거짓말을 한다.',
  },
  {
    name: '🔬 summary 가 구간을 안 보여준다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: "'HYD', 'SRV', ...LCP_PART_NAMES]) {",
    replace: "'HYD', 'SRV']) {",
    test: TEST,
    why: '저장은 되는데 아무도 못 본다 — 판정에 못 쓴다.',
  },
  {
    name: '🔬 서버가 SRV 표본을 거절한다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: "'CONN', 'HYD', 'SRV'] // SRV",
    replace: "'CONN', 'HYD'] // SRV",
    test: TEST,
    why: '클라는 보내는데 서버가 400 으로 버린다 — 첫 바이트가 서버 탓인지 거리 탓인지 영영 모른다.',
  },
]
