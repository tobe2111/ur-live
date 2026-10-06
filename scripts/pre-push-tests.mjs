#!/usr/bin/env node
/**
 * 🧪 2026-09-24 — 푸시 직전, **내가 건드린 코드를 보는 시험만** 골라 돌린다.
 *
 * ## 왜 생겼나 (PR #1543 에서 값을 치렀다)
 * pre-push 게이트(2026-09-14)는 가드 99개를 18.7초에 돌려 CI 57분 루프를 끊었다. 그런데
 * **vitest 는 안 돈다.** 그래서 이런 일이 났다: 대표 문서 이행 중 파일크기 래칫 때문에
 * `SellerCard`·`StoreIntro`·`StayPolicyInfo` 를 **추출**했는데, 그 심볼을 앵커로 쓰던
 * **남의 가드 4개가 조용히 빨간불**이 됐다. 내가 쓴 시험만 돌려 초록을 보고 푸시했고,
 * 7분 뒤 CI 가 알려 줬다 — 로컬에서 **36초**면 알 수 있는 것이었다.
 *
 * 코드를 옮기면 그 코드를 보던 시험이 깨진다. 그리고 **옮긴 사람은 그 시험의 존재를 모른다.**
 * 그게 이 스크립트가 있는 이유다.
 *
 * ## 무엇을 하나
 * `origin/main...HEAD` 에서 바뀐 `src/` 소스 경로를 뽑고, 그 **경로 문자열을 본문에 담은**
 * 시험 파일만 골라 vitest 로 돌린다(이 레포의 가드는 대부분 `readFileSync('src/…')` 로
 * 소스를 읽는 텍스트 가드라 경로가 그대로 박혀 있다 — 그래서 이 단순한 매칭이 실제로 먹는다).
 *
 * ## 🩸 2026-09-28 확장 — `src/` 밖 변경도 본다 (또 값을 치렀다)
 * 결재 파일 `docs/decisions/2026-09-28-*.md` 세 개를 올렸는데 **여기서 0건으로 건너뛰었다** —
 * 바뀐 것이 `src/` 밖이라 애초에 후보에 없었다. 7분 뒤 CI 가 알려 줬다:
 * `admin-decisions-parse.test.ts` 가 **그 폴더를 통째로 읽어** 모든 결재 파일의 파싱을 검사하는데,
 * 내 파일이 한 파일에 질문 셋을 넣느라 `## 선택지`(h2) 대신 `### 선택지`(h3)를 써서 옵션이 0개였다.
 *
 * ⇒ 두 가지를 고쳤다:
 *   ① 후보를 `src/` → **레포 전체**로(시험 자신은 계속 제외).
 *   ② `src/` **밖** 경로는 파일명뿐 아니라 **그 디렉터리 문자열**로도 매칭한다 —
 *      `docs/decisions/...md` 를 바꾸면 `'docs/decisions'` 를 읽는 시험이 걸린다.
 *      ⚠️ `src/` 안에서는 디렉터리 매칭을 **하지 않는다**: `src/pages` 한 줄만 바꿔도 수백 개가
 *         딸려 와 pre-push 가 느려지고, 느려지면 사람들이 끈다(이 레포가 반복해 당한 길).
 *
 * ## 🩸 2026-09-30 확장 — 트리를 통째로 훑는 시험 (세 번째로 값을 치렀다)
 * 새 부품 `SearchSuggestPanel.tsx` 에 `py-2.5` 를 썼는데 `consumer-type-scale-2026-09-29.test.ts`
 * 가 **`src/components/**` 를 글롭으로 훑어** 4px 격자를 강제한다. 그 시험은 본문에 **내 파일
 * 이름을 안 들고 있어서** 검색어로는 **원리상** 못 고른다(새 파일이면 더더욱 — 아직 아무도 그
 * 이름을 모른다). 이 머리말이 바로 위 줄에서 *"그건 CI 담당"* 이라고 **적어 두었던** 한계이고,
 * 적어 두는 것만으로는 안 막힌다는 걸 또 배웠다.
 *
 * ⇒ ③ `src/` 파일이 하나라도 바뀌면 **트리를 읽는 시험 전부**를 검색어 결과에 합친다
 *   (`scansTree` — `globSync`·`readdirSync`·`ls-files … src/`). 실측 48개 29초, 합쳐 **50초**.
 *   ⚠️ `src/` 변경이 없으면 안 돌린다 — 문서만 고친 푸시까지 29초를 물릴 이유가 없다
 *     (그쪽 트리 리더는 규칙 ② 의 폴더 매칭이 이미 고른다).
 *
 * ## ⚠️ 못 잡는 것 (과신 금지)
 *  - 경로를 문자열로 안 들고 import 로만 쓰는 시험(`import X from '@/...'`) — 별칭이라 안 걸린다.
 *  - 런타임 회귀(이 레포 시험 상당수가 텍스트 검사다).
 *  - 바뀐 파일이 0개이거나 base 를 못 구하면 **아무것도 안 돌린다**(그때는 CI 가 유일한 판정).
 *  - 트리를 읽는 시험이 **`src/` 밖만** 훑는 경우도 함께 돈다(과하게 고른다 — 아래 ③).
 * ⇒ 전수는 여전히 CI 담당이다. 이건 "가장 흔한 사고 하나"를 싸게 막는 그물이다.
 */
import { execFileSync } from 'node:child_process'
// 🔎 판정은 순수 모듈에 있다 — 그래야 시험이 문자열이 아니라 **동작**을 잰다(2026-09-28 분리, 판정 불변).
import { searchTermsFor, TREE_SCAN_PATTERN } from './pre-push-search-terms.mjs'

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim()

function changedSources() {
  let base = ''
  for (const ref of ['origin/main', 'main']) {
    try { base = sh('git', ['merge-base', ref, 'HEAD']); break } catch { /* 다음 후보 */ }
  }
  if (!base) return null   // base 를 못 구하면 판정 불가 — 조용히 건너뛴다(거짓 초록 금지).
  // 레포 전체를 본다 — `src/` 로 좁히면 docs/·scripts/ 를 읽는 시험이 통째로 빠진다(2026-09-28 사고).
  const out = sh('git', ['diff', '--name-only', base, 'HEAD'])
  return out ? out.split('\n').filter((f) => f && !f.startsWith('src/tests/')) : []
}

const changed = changedSources()
if (changed === null) {
  console.log('⏭️  pre-push 시험: base(origin/main)를 못 구해 건너뜀 — CI 가 전수로 본다.')
  process.exit(0)
}
if (changed.length === 0) {
  console.log('⏭️  pre-push 시험: 바뀐 src 파일 없음.')
  process.exit(0)
}

// 바뀐 경로를 **본문에 담은** 시험 파일 찾기.
let hits = ''
try {
  // ⚠️ `-e` 는 패턴마다 붙여야 한다 — 한 번만 쓰면 나머지가 **검색 경로**로 먹혀 조용히 적게 본다
  //   (첫 판이 정확히 그랬다: 77개여야 할 것이 30개였고, 에러 없이 초록이었다).
  // 🩸 2026-09-30: 이 레포엔 시험 뿌리가 **둘**이다(`vitest.config` include: `tests/**` + `src/tests/**`).
  //   여기선 `src/tests` 만 보고 있어서 `tests/unit/components/search/SearchHeader.test.tsx` 가
  //   통째로 눈 밖이었다 — 그 파일이 깨진 채 로컬 초록으로 푸시됐고 CI 가 알려 줬다.
  //   ⚠️ 뿌리를 늘릴 땐 `vitest.config` 의 include 와 같이 봐야 한다(갈리면 또 반쪽만 본다).
  hits = sh('grep', ['-rlF', '--include=*.ts', '--include=*.tsx', ...searchTermsFor(changed).flatMap((t) => ['-e', t]), 'src/tests', 'tests'])
} catch { hits = '' }   // grep 은 매치 0 이면 exit 1 — 실패가 아니다.
const termFiles = hits ? hits.split('\n').filter(Boolean) : []

// ③ 트리를 통째로 읽는 시험 — 검색어로는 원리상 못 고른다(본문에 파일 이름이 없다).
//   `src/` 가 바뀐 푸시에서만 합친다. 판정(`TREE_SCAN_PATTERN`)은 순수 모듈에 있고,
//   여기선 **그 패턴 그대로** grep 에 넘긴다 — 두 벌이면 갈린다.
let treeFiles = []
if (changed.some((f) => f.startsWith('src/'))) {
  try {
    // 시험 파일만 — 헬퍼(`src/tests/helpers/source-text.ts`)도 트리를 읽지만 vitest 에 넘길 게 아니다.
    const out = sh('grep', ['-rlE', '--include=*.test.ts', '--include=*.test.tsx', TREE_SCAN_PATTERN, 'src/tests', 'tests'])
    treeFiles = out ? out.split('\n').filter(Boolean) : []
  } catch { treeFiles = [] }   // grep 은 매치 0 이면 exit 1 — 실패가 아니다.
}

const files = [...new Set([...termFiles, ...treeFiles])]

if (files.length === 0) {
  console.log(`⏭️  pre-push 시험: 바뀐 ${changed.length}개 파일을 보는 시험 없음(검색어·트리 둘 다 0건).`)
  process.exit(0)
}

const t0 = Date.now()
try {
  execFileSync('npx', ['vitest', 'run', ...files, '--reporter=dot'], { stdio: 'pipe', timeout: 600_000 })
  console.log(`✅ pre-push 시험: 바뀐 코드를 보는 시험 ${files.length}개 통과 (검색어 ${termFiles.length} · 트리 ${treeFiles.length}, ${((Date.now() - t0) / 1000).toFixed(1)}초).`)
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  console.error(`\n❌ pre-push 시험: 바뀐 코드를 보는 시험이 빨간불 (${((Date.now() - t0) / 1000).toFixed(1)}초).`)
  console.error('   코드를 옮기면 그 코드를 보던 **남의 가드**가 깨진다 — 풀지 말고 새 자리로 재조준할 것.\n')
  const lines = out.split('\n').filter((l) => /FAIL|AssertionError|×|Error:|expected/.test(l))
  console.error((lines.length ? lines : out.split('\n')).slice(0, 30).map((l) => `   ${l}`).join('\n'))
  console.error('\n우회가 정말 필요하면: SKIP_PREPUSH_GATE=1 git push …  (CI 가 다시 막는다)')
  process.exit(1)
}
