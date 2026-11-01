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
    name: '컨텍스트예산 — "먼저 읽어라"(A등급) 판정 낱말을 비운다',
    file: G,
    find: "  '먼저 읽', '먼저 스캔', '먼저 열', '먼저 볼', '먼저 확인', '먼저 판별',",
    replace: '',
    test: T,
    why: 'A등급이 전부 B로 떨어져 grep 머리말 하나로 면제된다 — 통째로 읽으라고 지시한 3만 토큰 문서의 상한이 무의미해진다.',
  },
  {
    name: '컨텍스트예산 — CLAUDE.md 문서 추출 정규식을 깨뜨린다',
    file: G,
    find: "/(?:docs\\/[A-Za-z0-9_\\-./]*|[A-Z][A-Za-z_]*)\\.md/g",
    replace: "/__없는패턴__\\.md/g",
    test: T,
    why: '추출이 0건이 되면 ①-2 가 통째로 눈먼다. 손 목록을 자동 추출로 바꾼 이유가 "목록은 낡는다" 였으니, 추출이 조용히 비는 것은 같은 사고의 새 얼굴이다.',
  },
  {
    name: '컨텍스트예산 — 추출 0건을 통과로 읽는다',
    file: G,
    find: 'if (directed.length < 20) {',
    replace: 'if (directed.length < 0) {',
    test: T,
    why: '위 주입과 짝이다 — 정규식이 깨져도 초록이 뜬다. 이 레포가 반복해 당한 "헛도는 가드".',
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
]
