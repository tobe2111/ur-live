/**
 * 🧬 주입 — 세션 컨텍스트 예산 (2026-11-01 대표 지시 *"더이상은 발생하지 않도록 규칙을
 *    가장 이상적이고 현명하게 짜줘"*)
 *    가드: src/tests/unit/context-budget-2026-11-01.test.ts
 *
 * 이 가드가 막는 사고: CLAUDE.md 가 30만 토큰(세션 용량 20만의 151%)이 되어 대화 한 마디 전에
 * `prompt is too long` 이 났고, 그 30만이 매 요청마다 재청구되어 크레딧을 태웠다.
 * 아래 주입은 **그 가드가 실제로 일하는지**를 기계가 확인한다 — 하나라도 통과하면 가드가 헛돈다.
 */
const T = 'src/tests/unit/context-budget-2026-11-01.test.ts'
const G = 'scripts/check-context-budget.mjs'
export default [
  {
    name: '컨텍스트예산 — CLAUDE.md 상한을 10배로 올린다(사고 재발)',
    file: G,
    find: '    limit: 80_000,',
    replace: '    limit: 800_000,',
    test: T,
    why: '상한을 올리는 것이 이 가드를 끄는 가장 쉬운 길이다. 30만 토큰 사고가 그대로 돌아온다.',
  },
  {
    name: '컨텍스트예산 — 지뢰(경고 없는 거대 문서) 검사를 사실상 끈다',
    file: G,
    find: 'const LANDMINE_TOKENS = 120_000',
    replace: 'const LANDMINE_TOKENS = 99_000_000',
    test: T,
    why: '경고 없는 17만 토큰 문서가 다시 생긴다 — 세션이 통째로 읽으면 그 세션이 끝난다.',
  },
  {
    name: '컨텍스트예산 — 측정 0건을 통과로 읽는다(헛도는 가드)',
    file: G,
    find: 'if (checked < 5) {',
    replace: 'if (false) {',
    test: T,
    why: '경로가 낡아 측정 대상이 비면 초록이 뜬다. 이 레포가 반복해 당한 "가드가 실패할 수 없음" 클래스.',
  },
  {
    name: '컨텍스트예산 — 인계 5건에 목차 사이드카를 다시 섞는다',
    file: G,
    find: "    .filter((f) => /^\\d{4}-\\d{2}-\\d{2}/.test(f) && f.endsWith('.md'))",
    replace: "    .filter((f) => f.endsWith('.md'))",
    test: T,
    why: '역순 정렬에서 INDEX.local.md 가 항상 상위 5건에 들어와 인계 예산을 부풀리고 목차를 이중 계산한다. 사람도 같은 함정을 밟았다(11,338 → 32,555 오독).',
  },
  {
    name: '컨텍스트예산 — "먼저 읽어라" 문서 목록을 비운다',
    file: G,
    find: "  'docs/design/urdeal-platform-model.md',",
    replace: '',
    test: T,
    why: 'CLAUDE.md 가 "새 세션은 이 문서로 구조를 먼저 잡는다" 고 지시하는 3만 토큰 문서가 예산 밖으로 나간다 — 첫 판이 정확히 그 상태였고, 그러면 비용이 그 파일로 옮겨 가며 자란다.',
  },
  {
    name: '컨텍스트예산 — 지시받는 문서 상한을 10배로',
    file: G,
    find: 'const DIRECTED_LIMIT = 40_000',
    replace: 'const DIRECTED_LIMIT = 400_000',
    test: T,
    why: '상한을 올리는 것이 이 칸을 끄는 가장 쉬운 길이다.',
  },
  {
    name: '컨텍스트예산 — 경고가 있어도 거대 문서를 잡는다(반대 방향)',
    file: G,
    find: "const LANDMINE_HINTS = ['통째로 읽지 말', '통째로 읽지 않', 'grep']",
    replace: "const LANDMINE_HINTS = []",
    test: T,
    why: '이 가드의 설계는 "큰 파일 금지" 가 아니라 "경고 강제" 다. 경고를 인정하지 않으면 이력 파일을 지우게 되고, 그 이력은 값지다.',
  },
  {
    name: '컨텍스트예산 — verify.yml 에서 strict 를 떼어 warn 으로 만든다',
    file: '.github/workflows/verify.yml',
    find: '        run: node scripts/check-context-budget.mjs -s',
    replace: '        run: node scripts/check-context-budget.mjs',
    test: T,
    why: '-s 가 없으면 초과해도 exit 0 이라 CI 가 통과한다 — 등록은 됐는데 아무것도 막지 않는다.',
  },
]
