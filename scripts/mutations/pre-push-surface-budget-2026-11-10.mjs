/**
 * 🧬 주입 — 올리기 전 화면 무게 사전 측정 (2026-11-10) · 가드: src/tests/unit/pre-push-surface-budget-2026-11-10.test.ts
 */
const T = 'src/tests/unit/pre-push-surface-budget-2026-11-10.test.ts'
const F = 'scripts/pre-push-surface-budget.mjs'
export default [
  {
    name: '📏 화면 코드를 바꿔도 미리 안 잰다 (CI 11분 뒤에야 안다)',
    file: F,
    find: "    if (!f.startsWith('src/')) return false",
    replace: '    return false',
    test: T,
    why: '11/3~11/10 실패의 56% 가 화면 무게·실행 비용이었고 대부분 허용치를 0~0.3KB 넘긴 것이었다.',
  },
  {
    name: '📏 CI 와 다른 환경변수로 빌드한다 (로컬·CI 판정이 갈린다)',
    file: F,
    find: "  VITE_KAKAO_APP_KEY: 'pr-verify',",
    replace: "  VITE_KAKAO_APP_KEY: 'local',",
    test: T,
    why: '환경변수가 다르면 번들 바이트가 달라져 로컬은 통과인데 CI 는 실패(또는 반대)가 된다.',
  },
  {
    name: '📏 푸시 게이트가 빌드 시간 초과에도 푸시를 막는다',
    file: 'scripts/pre-push-gate.mjs',
    find: "    execFileSync('node', ['scripts/pre-push-surface-budget.mjs'], { stdio: 'inherit', timeout: 600_000 })\n  } catch (err) {\n    if (err && err.status === 1) process.exit(1)",
    replace: "    execFileSync('node', ['scripts/pre-push-surface-budget.mjs'], { stdio: 'inherit', timeout: 600_000 })\n  } catch (err) {\n    process.exit(1)",
    test: T,
    why: '이 환경에서 빌드가 안 되는 날 모든 푸시가 막힌다 — 안내는 마지막 방어선이 아니다(CI 가 다시 잰다).',
  },
]
