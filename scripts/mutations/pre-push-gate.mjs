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
    find: 'if (dir && dir.includes(\'/\')) set.add(dir)',
    replace: 'if (dir && dir.includes(\'/\')) set.add(`${dir}/`)',
    test: TEST,
    why: '끝 슬래시가 붙으면 `join(process.cwd(), "docs/decisions")` 를 쓰는 시험이 안 걸린다 — 첫 수리가 실제로 이랬다.',
  },
  {
    name: '🔎 src 를 폴더로 매칭한다 (시험 225개가 딸려 와 푸시가 터진다)',
    file: 'scripts/pre-push-search-terms.mjs',
    /* 🔧 2026-09-29 재조준: 규칙 4 가 들어오며 그 줄이 `if (f.startsWith('src/')) {` 블록이 됐다.
       지키는 것은 그대로 — **src 파일에서 폴더가 검색어가 되면 안 된다**. 블록을 건너뛰게 만들어
       아래 폴더 추가 줄로 떨어뜨린다. */
    find: "    if (f.startsWith('src/')) {",
    replace: "    if (false) {",
    test: TEST,
    why: '`src/pages/Foo.tsx` 의 폴더는 `src/pages/` 다 — 그걸로 매칭하면 사실상 전수가 된다.',
  },
  {
    name: '🔎 그물이 다시 `-- src` 로 좁혀진다 (문서 변경이 통째로 눈이 먼다)',
    file: 'scripts/pre-push-tests.mjs',
    find: "const out = sh('git', ['diff', '--name-only', base, 'HEAD'])",
    replace: "const out = sh('git', ['diff', '--name-only', base, 'HEAD', '--', 'src'])",
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
  {
    name: '🔎 실행 스크립트에 문법 오류가 생긴다 (텍스트 가드가 못 보는 총체적 실패)',
    file: 'scripts/pre-push-tests.mjs',
    find: 'function changedSources() {',
    replace: 'function changedSourcesfunction changedSources() {',
    test: TEST,
    why: '2026-09-28 에 이 모듈을 뽑는 편집이 실제로 이 토큰을 남겼다. 주입은 텍스트만 읽고 tsc 는 .mjs 를 안 봐서 아무도 못 잡았다 — 푸시가 터지고서야 알았다.',
  },
  {
    name: '그물 — src 파일의 상대경로 검색어를 뺀다 (상대경로로 읽는 시험을 다시 놓친다)',
    file: 'scripts/pre-push-search-terms.mjs',
    /* 🔧 2026-09-30 재조준: 규칙 5 가 들어오며 `f.slice(4)` 가 `rel` 변수로 바뀌었다.
       지키는 것은 그대로 — **상대경로(확장자 포함) 검색어가 사라지면 안 된다**. */
    find: "      set.add(rel)                                // 규칙 4",
    replace: "      //  set.add(rel)                          // 규칙 4",
    test: TEST,
    why:
      '🩸 2026-09-29 에 실제로 놓쳤다: `voucher-card-discount-once.test.ts` 가 SSOT 를 ' +
      "`resolve(__dirname, '../../components/deal/DealRow.tsx')` 로 읽는데 그물은 전체 경로만 찾아 " +
      '그 시험을 후보에서 통째로 빠뜨렸다. 로컬 초록 → 5분 뒤 CI 빨간불 — 이 그물이 막으려던 사고다.',
  },
  {
    name: '그물 — 확장자 뗀 검색어를 뺀다 (별칭 import 로만 쓰는 시험을 다시 놓친다)',
    file: 'scripts/pre-push-search-terms.mjs',
    find: "      if (noExt !== rel) set.add(noExt)           // 규칙 5",
    replace: "      if (false) set.add(noExt)                  // 규칙 5",
    test: TEST,
    why:
      '🩸 2026-09-30 에 실제로 놓쳤다: `SearchHeader` 에 필수 prop 을 더했는데 ' +
      "`tests/unit/components/search/SearchHeader.test.tsx` 가 `import … from '@/components/search/SearchHeader'` " +
      '로만 써서(확장자 없음) 후보에서 빠졌다. 로컬 초록 → CI 가 `onPanelChange is not a function` 으로 알려 줬다.',
  },
  {
    name: '그물 — 시험 뿌리를 하나만 본다 (tests/ 가 통째로 눈 밖이 된다)',
    file: 'scripts/pre-push-tests.mjs',
    /* 🔧 2026-09-30 재조준: grep 이 **둘**이 되면서 `'src/tests', 'tests'])` 가 2곳이 됐다(유일해야 한다).
       지키는 것은 그대로 — **검색어 grep 이 뿌리 하나만 보면 안 된다**. 그쪽 줄에만 있는 꼬리를 앵커로. */
    find: "['-e', t]), 'src/tests', 'tests'])",
    replace: "['-e', t]), 'src/tests'])",
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '이 레포엔 시험 뿌리가 **둘**이다(`vitest.config` include: `tests/**` + `src/tests/**`). ' +
      '`src/tests` 만 보면 나머지 뿌리의 시험이 로컬에서 한 번도 안 돈다 — 2026-09-30 에 그래서 깨진 채 푸시됐다.',
  },
  {
    name: '🌲 그물 — 트리 시험을 구해 놓고 안 합친다 (가장 조용한 회귀)',
    file: 'scripts/pre-push-tests.mjs',
    find: 'const files = [...new Set([...termFiles, ...treeFiles])]',
    replace: 'const files = [...new Set([...termFiles])]',
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '구하는 코드는 남아 있고 시험도 통과하는데 최종 목록에만 안 들어간다 — 선택된 시험이 줄어든 걸 ' +
      '아무도 못 본다(에러 0, 초록). 2026-09-30 의 `py-2.5` 가 다시 CI 까지 간다.',
  },
  {
    name: '🌲 그물 — 트리 판정 패턴이 글롭을 못 알아본다',
    file: 'scripts/pre-push-search-terms.mjs',
    find: "export const TREE_SCAN_PATTERN = 'ls-files[^)]*src/|glob(Sync)?\\\\(|readdirSync\\\\('",
    replace: "export const TREE_SCAN_PATTERN = 'ls-files[^)]*srcXX/|globXX(Sync)?\\\\(|readdirSyncXX\\\\('",
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '패턴이 조용히 안 맞게 되는 것이 이 클래스의 가장 흔한 회귀다 — 고르는 시험이 0개가 되고 ' +
      '**그냥 초록**이다. 그래서 가드가 레포의 진짜 시험 본문을 먹여 동작을 잰다.',
  },
  {
    name: '🌲 그물 — 순수 모듈 대신 grep 에 패턴을 손으로 적는다 (두 벌이 갈린다)',
    file: 'scripts/pre-push-tests.mjs',
    find: "'--include=*.test.tsx', TREE_SCAN_PATTERN,",
    replace: "'--include=*.test.tsx', 'readdirSync\\\\(',",
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '판정이 모듈과 스크립트 두 벌이 되면 갈린다 — 시험은 모듈을 재고 푸시는 다른 패턴으로 고른다. ' +
      '이 레포가 반복해 당한 "가드는 초록인데 현실은 다름".',
  },
  {
    name: '🌲 그물 — src 변경 게이트를 없앤다 (문서만 고친 푸시도 29초를 문다)',
    file: 'scripts/pre-push-tests.mjs',
    find: "if (changed.some((f) => f.startsWith('src/'))) {",
    replace: 'if (true) {',
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '느려지면 사람들이 끈다 — 이 레포가 반복해 당한 길이라 머리말이 직접 경고한다. ' +
      '문서만 바꾼 푸시의 트리 리더는 규칙 ② 의 폴더 매칭이 이미 고른다.',
  },
  {
    name: '📄 순수 모듈 — .d.mts 가 구현의 새 export 를 안 따라간다',
    file: 'scripts/pre-push-search-terms.d.mts',
    find: 'export declare function scansTree(source: string): boolean',
    replace: '// export declare function scansTree(source: string): boolean',
    test: 'src/tests/unit/pre-push-roots-2026-09-30.test.ts',
    why:
      '🩸 2026-09-30 에 실제로 밟았다. `allowJs` 가 꺼져 있어 tsc 는 `.mjs` 를 **안 읽고** 손으로 쓴 ' +
      '`.d.mts` 만 읽는다 — 구현에만 export 를 더하면 시험이 import 하는 순간 `TS2305` 로 커밋이 막힌다. ' +
      '더 고약한 건 **나중에 선언된 함수는 멀쩡히 잡혀서** "TS 가 파일을 중간부터 못 읽나" 로 오진하게 되는 것.',
  },
]
