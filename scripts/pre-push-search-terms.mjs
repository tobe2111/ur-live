/**
 * 🔎 바뀐 파일 → pre-push 그물이 **시험 본문에서 찾을 검색어** (2026-09-28 분리)
 *
 * `pre-push-tests.mjs` 안에 있던 순수 함수를 떼어냈다 — 그 스크립트는 최상위에서 바로 실행되는
 * 실행 파일이라 import 하는 순간 돌아 버려서 시험을 붙일 수 없었다(`guard-mutations-scope.mjs` 와 같은 처방).
 *
 * ## 규칙 둘
 * 1. **`src/` 는 파일 경로 그대로.** 폴더로 매칭하면 `src/pages/Foo.tsx` 의 폴더가 `src/pages/` 라
 *    시험 **225개**가 딸려 와(2026-09-28 실측) 푸시가 터진다.
 * 2. **non-src 는 담긴 폴더로, 끝 슬래시 없이.** 그쪽 가드들은 본문에 파일이 아니라 폴더를 들고 있다
 *    (`readdirSync('docs/decisions')`). 🩸 첫 판이 `docs/decisions/`(끝 슬래시)로 찾아
 *    `join(process.cwd(), 'docs/decisions')` 를 쓰는 `admin-decisions-parse.test.ts` 를 통째로 놓쳤고,
 *    하필 그게 그날 사고를 잡는 시험이었다. 되돌려-검증이 아니었으면 "이제 잡힌다" 고 믿었을 것이다.
 */

/** 가드가 본문에 *폴더*를 들고 있는 영역 — 여기만 폴더로 매칭한다. */
export const DIR_MATCHED = ['docs/', 'migrations/', 'public/locales/', 'scripts/mutations/']

/**
 * @param {string[]} files 바뀐 파일 경로들(레포 루트 기준)
 * @returns {string[]} grep 에 넘길 검색어(중복 제거)
 */
export function searchTermsFor(files) {
  const terms = new Set()
  for (const f of files) {
    if (!f) continue
    if (f.startsWith('src/')) { terms.add(f); continue }              // 규칙 1
    const dir = DIR_MATCHED.find((d) => f.startsWith(d))
    const cut = f.lastIndexOf('/')
    if (dir && cut > 0) { terms.add(f.slice(0, cut)); continue }      // 규칙 2 — 끝 슬래시 없이
    terms.add(f)                                                       // 루트 파일(CLAUDE.md 등)
  }
  return [...terms]
}
