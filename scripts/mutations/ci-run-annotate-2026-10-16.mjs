/**
 * 🔁 CI 실패를 annotation 으로 읽히게 하는 래퍼 (2026-10-16) — 주입 매니페스트.
 * 가드: src/tests/unit/ci-run-annotate-2026-10-16.test.ts
 *
 * 이 래퍼가 조용히 망가지는 모양은 둘이고 **두 번째가 훨씬 나쁘다**:
 *   ① annotation 을 안 낸다 → 다시 눈먼다(종전 상태로 복귀 — 25분을 쓰게 만든 그 상태)
 *   ② 종료코드를 삼킨다 → **래칫이 통째로 무력화되는데 CI 가 초록이다**
 * 그래서 절반은 ② 방향을 막는다.
 */
const TEST = 'src/tests/unit/ci-run-annotate-2026-10-16.test.ts'
const RUN = 'scripts/ci-run.mjs'
const LIB = 'scripts/lib/ci-annotate.mjs'
const WF_MAIN = '.github/workflows/bundle-budget-main.yml'
const WF_VERIFY = '.github/workflows/verify.yml'

export default [
  {
    name: '[ci-run] 래퍼가 종료코드를 삼킨다 — 래칫이 무력화되는데 초록이 뜬다',
    file: RUN,
    find: '    process.exit(exit)',
    replace: '    process.exit(0)',
    test: TEST,
    why:
      '가장 나쁜 방향이다. 실패 출력은 그대로 로그에 보이는데 잡이 초록이라 **아무도 안 본다** — ' +
      '관측 가능성을 고치려다 가드 자체를 끄는 셈이고, 그건 눈먼 것보다 나쁘다.',
  },
  {
    name: '[ci-run] 신호로 죽은 것을 0 으로 읽는다',
    file: RUN,
    find: '  if (signal) return 128 + (os.constants.signals[signal] || 1)',
    replace: '  if (signal) return 0',
    test: TEST,
    why:
      'OOM·타임아웃 kill 이 가장 조용한 실패 모드다. 0 으로 바꾸면 **측정이 중간에 죽어도 통과**한다 — ' +
      '이 레포가 반복해 당한 "실패가 아니라 부재" 클래스.',
  },
  {
    name: '[ci-run] 실패해도 annotation 을 안 낸다(종전 상태로 복귀)',
    file: RUN,
    find: '      emitAnnotation(level, `${label} 실패(exit ${exit})',
    replace: '      if (false) emitAnnotation(level, `${label} 실패(exit ${exit})',
    test: TEST,
    why:
      '래퍼는 남아 있고 종료코드도 맞아서 **고쳐진 것처럼 보인다.** 그런데 세션은 다시 숫자를 못 읽고 ' +
      '로컬 재현 + 대조군 재빌드(25분)로 돌아간다 — 이 변경의 존재 이유가 사라진다.',
  },
  {
    name: '[ci-run] 로컬에서도 annotation 을 찍는다',
    file: LIB,
    find: "  if (env.GITHUB_ACTIONS !== 'true') return false",
    replace: '  if (false) return false',
    test: TEST,
    why:
      '로컬 가드 출력에 `::error::` 가 섞이면 사람이 읽기 나빠지고, pre-push 게이트 100개의 출력이 ' +
      '워크플로 명령처럼 보이는 줄로 오염된다.',
  },
  {
    name: '[ci-run] 이스케이프 순서를 뒤집는다 — 줄바꿈이 뭉개진다',
    file: LIB,
    find: "  return String(s).replace(/%/g, '%25').replace(/\\r/g, '%0D').replace(/\\n/g, '%0A')",
    replace: "  return String(s).replace(/\\r/g, '%0D').replace(/\\n/g, '%0A').replace(/%/g, '%25')",
    test: TEST,
    why:
      '`%` 를 마지막에 바꾸면 방금 넣은 `%0A` 가 `%250A` 가 되어 **줄바꿈이 리터럴로 찍힌다** — ' +
      'annotation 한 덩어리가 한 줄로 뭉개져 숫자를 눈으로 못 고른다. 출력은 나오니 고장처럼 안 보인다.',
  },
  {
    name: '[ci-run] 속성 값에서 : , 를 안 막는다',
    file: LIB,
    find: "  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')",
    replace: '  return escapeData(s)',
    test: TEST,
    why:
      '`:` 와 `,` 는 워크플로 명령의 구분자다. 제목에 섞이면 GitHub 가 명령을 잘못 파싱해 ' +
      'annotation 이 **통째로 사라지거나** 엉뚱한 속성으로 붙는다.',
  },
  {
    name: '[ci-run] 꼬리 대신 머리를 남긴다',
    file: RUN,
    find: "  return `…(앞부분 ${s.length - n}자 생략 — 전문은 로그)\\n` + s.slice(-n)",
    replace: '  return s.slice(0, n)',
    test: TEST,
    why:
      '이 가드들은 **끝에서 결론을 말한다**(`❌ exec-cost: 4건` + 화면별 초과). 머리를 남기면 ' +
      '빌드 경고 4,000자만 실려 **읽을 수 있게 됐는데도 쓸모가 없다.**',
  },
  {
    name: '[ci-run] 꼬리 상한을 0 으로',
    file: RUN,
    find: 'export const TAIL_CHARS = 4000',
    replace: 'export const TAIL_CHARS = 0',
    test: TEST,
    why: 'annotation 이 제목만 남고 본문이 빈다 — 읽히기는 하는데 숫자가 없어 다시 눈먼다.',
  },
  {
    name: '[ci-run] bundle-budget-main 의 실행비용 스텝에서 래퍼를 뺀다',
    file: WF_MAIN,
    find: 'run: node scripts/ci-run.mjs node scripts/check-exec-cost.mjs',
    replace: 'run: node scripts/check-exec-cost.mjs',
    test: TEST,
    why:
      '하필 **지금 빨간불인 그 스텝**이다. 한 자리만 빠져도 그 가드의 숫자는 다시 안 읽히는데 ' +
      '나머지 다섯이 배선돼 있어 "배선했다" 는 인상만 남는다.',
  },
  {
    name: '[ci-run] verify.yml 쪽만 배선을 뺀다(반쪽 배선)',
    file: WF_VERIFY,
    find: 'run: node scripts/ci-run.mjs node scripts/check-surface-budgets.mjs',
    replace: 'run: node scripts/check-surface-budgets.mjs',
    test: TEST,
    why:
      'main 에서는 읽히고 PR 에서는 안 읽힌다 — PR 이 빨간불인 이유를 세션이 못 밝혀 ' +
      '"선재 실패" 로 떠넘기게 된다(이 레포가 실제로 반복한 오진).',
  },
  {
    name: '[ci-run] 허용목록 밖 속성도 싣는다',
    file: LIB,
    find: "  const allowed = ['title', 'file', 'line', 'endLine', 'col', 'endColumn']",
    replace: '  const allowed = Object.keys(props)',
    test: TEST,
    why:
      '모르는 키가 섞이면 워크플로 명령 문법이 깨져 annotation 이 조용히 버려진다. ' +
      '허용목록은 "읽히는 것" 을 보장하는 최소 계약이다.',
  },
]
