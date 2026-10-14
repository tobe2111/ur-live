/**
 * 🌏 실사용자 성능 지표에 우리 측정 트래픽이 섞이지 않는다 (2026-10-14 — `/map` LCP 표본이 전부 미국) — 주입 매니페스트.
 * 가드: src/tests/unit/vitals-real-users-only-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/vitals-real-users-only-2026-10-14.test.ts'
const CLIENT = 'src/lib/web-vitals-report.ts'
const SERVER = 'src/worker/routes/analytics.routes.ts'

export default [
  {
    name: '🌏 자동화 브라우저도 성능 표본을 보낸다',
    file: CLIENT,
    find: "  if (reported || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return\n  if (isAutomatedBrowser()) return\n",
    replace: "  if (reported || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return\n",
    test: TEST,
    why: '미국 컨테이너의 헤드리스 측정이 실사용자 LCP 로 집계돼 /map 이 10.9초로 보였다.',
  },
  {
    name: '🌏 자동화 판정이 webdriver 를 안 본다',
    file: CLIENT,
    find: "navigator.webdriver === true",
    replace: "navigator.webdriver === ('x' as unknown as boolean)",
    test: TEST,
    why: '판정 함수가 항상 false 면 두 필터가 이름만 남는다.',
  },
  {
    name: '🌏 자동화 브라우저도 퍼널을 보낸다',
    file: CLIENT,
    find: "export function reportFunnel(event: 'view' | 'click' | 'join' | 'success', product_id?: number): void {\n  if (isAutomatedBrowser()) return\n",
    replace: "export function reportFunnel(event: 'view' | 'click' | 'join' | 'success', product_id?: number): void {\n",
    test: TEST,
    why: '하네스가 상세를 열 때마다 조회·클릭 수가 부풀어 전환율이 낮아 보인다.',
  },
  {
    name: '🌏 서버가 해외 표본도 받는다',
    file: SERVER,
    find: "  if (!isVitalsCountryAllowed(c.req.header('cf-ipcountry'))) return c.json({ ok: true, skipped: 'country' })\n",
    replace: '',
    test: TEST,
    why: '자동화 표식을 숨긴 해외 트래픽이 한국 전용 서비스의 실사용자 숫자를 부풀린다.',
  },
  {
    name: '🌏 국가 헤더가 없으면 버린다(반대 방향)',
    file: SERVER,
    find: "return cc === '' || cc === 'KR'",
    replace: "return cc === 'KR'",
    test: TEST,
    why: '헤더가 없는 환경(로컬·일부 경로)에서 실사용자 표본까지 통째로 사라진다 — 판정 근거가 없으면 막지 않는다.',
  },
]
