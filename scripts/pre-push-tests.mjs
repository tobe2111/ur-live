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
 * ## 🩸 2026-09-28 — `src/` 만 보고 있었다 (같은 날 두 번 값을 치렀다)
 * 이 그물은 `git diff -- src` 로 바뀐 파일을 뽑았다. 그런데 이 레포의 가드는 **`docs/` 도 읽는다** —
 * 결재함(`docs/decisions/`)·인계·`CLAUDE.md`·로케일·마이그레이션. 문서만 바꾼 푸시는
 * 선택된 시험이 **0개**라 늘 초록이었고, 깨진 건 7분 뒤 CI 가 알려 줬다. 하루에 두 번 그랬다:
 *   ① 결재 파일의 `## 선택지` 를 `###` 로 써서 어드민 파서가 0개로 읽었다
 *   ② 결재 파일에 `등급: B` 를 달았다(결재함은 C 전용)
 * 둘 다 로컬에서 **1.2초**면 알 수 있었다.
 *
 * ⚠️ 그런데 단순히 "경로 매칭" 을 문서로 넓히면 안 걸린다 — 그 가드들이 본문에 들고 있는 것은
 * *파일*이 아니라 **폴더**(`docs/decisions`)다. 그래서 non-src 는 **폴더로** 매칭한다.
 * 🩸 그 폴더 검색어에 **끝 슬래시를 붙이면 안 된다.** 첫 판이 `docs/decisions/` 로 찾아
 *   `join(process.cwd(), 'docs/decisions')` 를 쓰는 `admin-decisions-parse.test.ts` 를 통째로
 *   놓쳤다 — 그리고 그게 하필 위 사고 ①을 잡는 시험이었다. 되돌려-검증이 아니었으면
 *   "이제 잡힌다" 고 믿은 채 넘어갔을 것이다(고친 그물이 반쪽이면 안 고친 것과 같다).
 * 🔴 **src 는 종전 그대로 파일 경로로만** 매칭한다. `src/pages/Foo.tsx` 의 폴더는 `src/pages/` 이고
 *   그걸로 매칭하면 시험 **225개**가 딸려 와(실측) 푸시가 터진다. non-src 폴더는 전부 저렴하다
 *   (실측: decisions 3 · handoff 1 · design 24 · locales 5 · CLAUDE.md 42 · migrations 3 · mutations 13).
 *
 * ## ⚠️ 못 잡는 것 (과신 금지)
 *  - 경로를 문자열로 안 들고 import 로만 쓰는 시험(`import X from '@/...'`) — 별칭이라 안 걸린다.
 *  - 런타임 회귀(이 레포 시험 상당수가 텍스트 검사다).
 *  - 바뀐 파일이 0개이거나 base 를 못 구하면 **아무것도 안 돌린다**(그때는 CI 가 유일한 판정).
 *  - `src/` 안에서 **폴더를 스캔하는** 가드(파일 경로가 아니라 폴더만 들고 있는 것) — 위 이유로 뺐다.
 * ⇒ 전수는 여전히 CI 담당이다. 이건 "가장 흔한 사고"를 싸게 막는 그물이다.
 */
import { execFileSync } from 'node:child_process'
import { searchTermsFor } from './pre-push-search-terms.mjs'

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim()

function changedSourcesfunction changedSources() {
  let base = ''
  for (const ref of ['origin/main', 'main']) {
    try { base = sh('git', ['merge-base', ref, 'HEAD']); break } catch { /* 다음 후보 */ }
  }
  if (!base) return null   // base 를 못 구하면 판정 불가 — 조용히 건너뛴다(거짓 초록 금지).
  // 🩸 2026-09-28: 종전엔 `-- src` 였다. 문서만 바꾼 푸시가 **아무 시험도 안 돌리고** 초록이었다.
  const paths = ['src', 'docs', 'migrations', 'public/locales', 'scripts/mutations', 'CLAUDE.md']
  const out = sh('git', ['diff', '--name-only', base, 'HEAD', '--', ...paths])
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
  hits = sh('grep', ['-rlF', '--include=*.ts', '--include=*.tsx', ...searchTermsFor(changed).flatMap((t) => ['-e', t]), 'src/tests'])
} catch { hits = '' }   // grep 은 매치 0 이면 exit 1 — 실패가 아니다.
const files = hits ? hits.split('\n').filter(Boolean) : []

if (files.length === 0) {
  console.log(`⏭️  pre-push 시험: 바뀐 ${changed.length}개 파일을 참조하는 시험 없음.`)
  process.exit(0)
}

const t0 = Date.now()
try {
  execFileSync('npx', ['vitest', 'run', ...files, '--reporter=dot'], { stdio: 'pipe', timeout: 600_000 })
  console.log(`✅ pre-push 시험: 바뀐 코드를 보는 시험 ${files.length}개 통과 (${((Date.now() - t0) / 1000).toFixed(1)}초).`)
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  console.error(`\n❌ pre-push 시험: 바뀐 코드를 보는 시험이 빨간불 (${((Date.now() - t0) / 1000).toFixed(1)}초).`)
  console.error('   코드를 옮기면 그 코드를 보던 **남의 가드**가 깨진다 — 풀지 말고 새 자리로 재조준할 것.\n')
  const lines = out.split('\n').filter((l) => /FAIL|AssertionError|×|Error:|expected/.test(l))
  console.error((lines.length ? lines : out.split('\n')).slice(0, 30).map((l) => `   ${l}`).join('\n'))
  console.error('\n우회가 정말 필요하면: SKIP_PREPUSH_GATE=1 git push …  (CI 가 다시 막는다)')
  process.exit(1)
}
