/**
 * 🔎 바뀐 파일 → pre-push 그물이 **시험 본문에서 찾을 검색어** (2026-09-28 분리)
 *
 * ## 왜 별도 파일인가
 * `pre-push-tests.mjs` 안에 있던 순수 함수를 떼어냈다 — 그 스크립트는 최상위에서 바로 실행되는
 * 실행 파일이라 import 하는 순간 돌아 버려서 시험을 붙일 수 없었다
 * (`guard-mutations-scope.mjs` 와 같은 처방).
 * **판정은 한 글자도 안 바뀌었다** — 자리만 옮기고 시험을 붙였다.
 *
 * ## 규칙 셋 (전부 값을 치르고 얻은 것)
 * 1. **바뀐 파일 경로 자체**는 언제나 검색어다.
 * 2. **`src/` 밖이면 담긴 폴더도** 검색어다 — 그쪽 가드는 본문에 파일이 아니라 폴더를 들고 있다
 *    (`readdirSync('docs/decisions')`). 🩸 폴더 검색어에 **끝 슬래시를 붙이면 안 된다**:
 *    `docs/decisions/` 로 찾으면 `join(process.cwd(), 'docs/decisions')` 를 쓰는
 *    `admin-decisions-parse.test.ts` 를 통째로 놓친다 — 하필 그게 그날 사고를 잡던 시험이었다.
 * 3. **`src/` 안에서는 폴더 매칭을 하지 않는다.** `src/pages/Foo.tsx` 의 폴더는 `src/pages` 이고
 *    그걸로 매칭하면 시험 **225개**가 딸려 와(실측) 푸시가 느려진다 — 느려지면 사람들이 끈다.
 *    같은 이유로 **최상위 한 칸**(`docs`·`scripts`)도 제외한다(`dir.includes('/')` 조건).
 */

/**
 * @param {string[]} files 바뀐 파일 경로들(레포 루트 기준)
 * @returns {string[]} grep 에 넘길 검색어(중복 제거)
 */
export function searchTermsFor(files) {
  const set = new Set()
  for (const f of files) {
    if (!f) continue
    set.add(f)                                    // 규칙 1
    if (f.startsWith('src/')) continue            // 규칙 3
    const dir = f.slice(0, f.lastIndexOf('/'))
    if (dir && dir.includes('/')) set.add(dir)    // 규칙 2 — 끝 슬래시 없이, 최상위 한 칸 제외
  }
  return [...set]
}
