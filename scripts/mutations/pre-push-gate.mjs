/**
 * 🔎 pre-push 그물의 검색어 (2026-09-28) — 주입 매니페스트.
 * 가드: src/tests/unit/pre-push-search-terms-2026-09-28.test.ts
 *
 * 되돌리려는 사고: 로컬 그물이 **조용히 눈이 머는 것**. 이건 빨간불로 드러나지 않는다 —
 * 선택된 시험이 0개면 그냥 초록이고, 깨진 건 7분 뒤 CI 가 알려 준다(2026-09-28 하루에 두 번).
 *  ① `-- src` 로 다시 좁혀 문서 변경이 통째로 안 보이게 되는 것
 *  ② 폴더 검색어에 끝 슬래시가 붙어 `join(cwd,'docs/decisions')` 형태를 놓치는 것
 *     (첫 수리가 정확히 이랬고, 하필 그게 그날 사고를 잡던 시험이었다)
 *  ③ src 를 폴더로 매칭해 시험 225개가 딸려 와 푸시가 터지는 것
 *  ④ 배선이 끊겨 실행 스크립트가 이 모듈을 안 쓰게 되는 것
 */
const TEST = 'src/tests/unit/pre-push-search-terms-2026-09-28.test.ts'

export default [
  {
    name: '🔎 폴더 검색어에 끝 슬래시가 붙는다 (결재함 파서 가드를 통째로 놓친다)',
    file: 'scripts/pre-push-search-terms.mjs',
    find: 'terms.add(f.slice(0, cut)); continue }',
    replace: 'terms.add(`${f.slice(0, cut)}/`); continue }',
    test: TEST,
    why: '끝 슬래시가 붙으면 `join(process.cwd(), "docs/decisions")` 를 쓰는 시험이 안 걸린다 — 첫 수리가 실제로 이랬다.',
  },
  {
    name: '🔎 src 를 폴더로 매칭한다 (시험 225개가 딸려 와 푸시가 터진다)',
    file: 'scripts/pre-push-search-terms.mjs',
    find: "if (f.startsWith('src/')) { terms.add(f); continue }",
    replace: "if (f.startsWith('src/')) { terms.add(f.slice(0, f.lastIndexOf('/'))); continue }",
    test: TEST,
    why: '`src/pages/Foo.tsx` 의 폴더는 `src/pages/` 다 — 그걸로 매칭하면 사실상 전수가 된다.',
  },
  {
    name: '🔎 그물이 다시 `-- src` 로 좁혀진다 (문서 변경이 통째로 눈이 먼다)',
    file: 'scripts/pre-push-tests.mjs',
    find: "const paths = ['src', 'docs', 'migrations', 'public/locales', 'scripts/mutations', 'CLAUDE.md']",
    replace: "const paths = ['src']",
    test: TEST,
    why: '종전 동작이다. 문서만 바꾼 푸시는 선택된 시험이 0개라 **에러 없이** 초록이 된다.',
  },
  {
    name: '🔎 실행 스크립트가 검색어 모듈을 안 쓴다 (배선 끊김)',
    file: 'scripts/pre-push-tests.mjs',
    find: 'searchTermsFor(changed).flatMap',
    replace: 'changed.flatMap',
    test: TEST,
    why: '모듈은 남아 있고 시험도 통과하는데 그물만 종전으로 돌아간다 — 가장 조용한 회귀다.',
  },
]
