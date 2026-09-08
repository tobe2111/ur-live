/**
 * ⏱️ **주입 전수를 언제 좁히는가** — `check-guard-mutations.mjs` 가 쓰는 순수 판정.
 *
 * ## 왜 별도 파일인가 (두 가지 다 실제로 밟았다)
 * ① **자기참조**: 이 판정을 러너 안에 두면, 그것을 지키는 주입의 `find` 문자열이 **같은 파일의
 *    매니페스트 안에도** 존재해 "주입 대상이 2곳" 으로 잡힌다(실측). 주입은 자기 몸을 못 겨눈다.
 * ② **텍스트가 아니라 동작을 테스트**할 수 있다. 여기 함수는 순수라 테스트가 `Set` 을 넣고
 *    결과를 본다 — 이 레포가 반복해 당한 "문자열만 맞고 실제로는 안 도는" 가드가 안 된다.
 *
 * ## 무엇을 고르나
 * `m.file` 또는 `m.test` 가 이 브랜치가 바꾼 파일에 들어 있는 주입만.
 * 근거: 주입은 그 파일의 소스를 고쳐 그 테스트를 돌리는 것이라, **내가 안 건드린 파일의 가드는
 * 내 PR 이 깨뜨릴 수 없다.**
 *
 * ## 🔴 못 고르는 경우가 있다 — 그래서 전수가 따로 필요하다
 * 주입 M 이 파일 X 를 고쳐 테스트 T 를 돌리는데, T 가 X 말고 **다른 파일 Y 도** 읽는 경우가 있다.
 * PR 이 Y 만 바꿔 T 를 헛돌게 만들면 이 판정은 M 을 안 고른다.
 * ⇒ 전수는 `.github/workflows/guard-mutations-full.yml`(main push + 야간)이 반드시 돈다.
 */

/**
 * diff 에 이게 있으면 **전수**. 가드 자신·러너 환경·공용 테스트 헬퍼가 바뀌면 무엇이 깨질지 모른다.
 * 특히 매니페스트를 고치는 PR 은 항상 전수여야 **새로 넣은 주입이 그 PR 에서 검증된다.**
 */
export const ALWAYS_FULL = [
  'scripts/',                        // 가드 스크립트 자신(매니페스트 · 이 파일 포함)
  'package.json',
  'package-lock.json',
  'vitest.config',
  '.github/workflows/verify.yml',
  'src/tests/helpers/',              // 여러 테스트가 함께 쓰는 소스 리더
]

/**
 * 순수 — 바뀐 파일 집합을 보고 **전수로 돌 사유**를 돌려준다(좁혀도 되면 `null`).
 * @param {Set<string>|string[]|null|undefined} files
 * @returns {string|null}
 */
export function fullReasonFor(files) {
  const list = files ? [...files] : []
  // 🔴 "0개" 를 "바뀐 게 없으니 돌 것도 없다" 로 읽지 않는다. base 계산이 틀렸을 때도 0 이 나온다.
  if (list.length === 0) return '바뀐 파일이 0개로 보인다 — 믿지 않고 전수로 돈다'
  const hit = list.find((f) => ALWAYS_FULL.some((p) => f.startsWith(p) || f.includes(p)))
  return hit ? `${hit} 가 바뀌었다 — 가드 자신/러너 환경이라 전수` : null
}

/**
 * 순수 — 주입 하나가 이 스코프에 드는가.
 * @param {{file:string, test:string}} m
 * @param {{full:boolean, files?:Set<string>}} scope
 */
export function inScope(m, scope) {
  if (scope.full) return true
  return scope.files.has(m.file) || scope.files.has(m.test)
}

/**
 * git 을 실제로 부른다(부수효과 있음). 실패하면 **전수로 폴백** — 애매하면 넓게.
 * @param {{enabled:boolean, root:string, run:(args:string[])=>string, baseRef?:string}} o
 *   `run` 은 `git <args>` 를 돌려 stdout 을 주는 함수(테스트에서 갈아끼우기 쉽게 주입받는다).
 * @returns {{full:true, why:string} | {full:false, files:Set<string>}}
 */
export function changedScope({ enabled, run, baseRef = 'origin/main' }) {
  if (!enabled) return { full: true, why: '--changed 아님(전수)' }
  let files
  try {
    const mb = run(['merge-base', baseRef, 'HEAD']).trim()
    // 커밋된 변경 + 아직 커밋 안 한 작업트리 — 로컬에서도 CI 와 같은 답이 나오게.
    const a = run(['diff', '--name-only', mb, 'HEAD'])
    const b = run(['diff', '--name-only', mb])
    files = new Set(`${a}\n${b}`.split('\n').map((x) => x.trim()).filter(Boolean))
  } catch {
    return { full: true, why: `base(${baseRef}) 를 못 구했다 — shallow clone 이면 fetch-depth: 0 이 필요하다` }
  }
  const why = fullReasonFor(files)
  return why ? { full: true, why } : { full: false, files }
}
