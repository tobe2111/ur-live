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
import { readFileSync } from 'node:fs'


/**
 * diff 에 이게 있으면 **전수**. 가드 자신·러너 환경·공용 테스트 헬퍼가 바뀌면 무엇이 깨질지 모른다.
 * 특히 매니페스트를 고치는 PR 은 항상 전수여야 **새로 넣은 주입이 그 PR 에서 검증된다.**
 */
export const ALWAYS_FULL = [
  // 🔎 **판정 자신**. 이게 바뀌면 무엇이 어떻게 판정될지 모른다.
  'scripts/guard-mutations-scope.mjs',
  'scripts/guard-mutations-manifest-diff.mjs',
  'package.json',
  'package-lock.json',
  'vitest.config',
  '.github/workflows/verify.yml',
  'src/tests/helpers/',              // 여러 테스트가 함께 쓰는 소스 리더
]

/**
 * 🩸 **2026-09-15 — 여기 `'scripts/'` 한 줄이 있었고, 그게 CI 의 92% 를 느린 길로 보냈다.**
 *
 * 실측(Verify 최근 100 run · 머지 PR 25건): 성공 run 중앙값 **55.9분** vs 좁혀 돈 run **12.1분**.
 * 그런데 **25건 중 23건이 전수**였고, 이유를 세어 보니 —
 *   `check-guard-mutations.mjs` 를 건드림 **11건** · 판정과 무관한 `*-baseline.json`·`live-shot.mjs`·
 *   `install-git-hooks.sh` **6건** · `scripts/mutations/*.mjs` **3건**.
 *
 * 즉 `CLAUDE.md` 가 요구하는 *"새 가드를 만들면 주입을 한 줄 추가하라"* 를 **지킬수록 느려졌다.**
 * 규칙을 지키는 행위가 40분 벌금을 물리는 구조였고, 그래서 이 줄을 걷어냈다.
 *
 * ⚠️ 대신 **좁힌 만큼을 두 가지가 메운다**:
 *   ① 러너·매니페스트 변경은 `guardRunnerScope`(아래)가 **base 와 head 의 주입 목록을 실제로 비교**해
 *      바뀐 주입만 고른다. 로직이 바뀌었으면 전수로 떨어진다.
 *   ② 그 밖의 `scripts/*` 변경은 **하위 프로세스를 띄우는 테스트**(실측 14개)를 쓰는 주입을 함께 고른다 —
 *      그 테스트들은 가드 스크립트를 직접 돌려서, 주입의 `file`·`test` 가 diff 에 없어도 판정이 달라진다.
 *   ③ 그리고 전수는 `guard-mutations-full.yml`(main push + 야간)이 여전히 돈다.
 */
export const GUARD_RUNNER = 'scripts/check-guard-mutations.mjs'

/** `scripts/` 안에서 **주입 판정에 닿을 수 있는** 변경인가(러너·매니페스트 제외). */
export function touchesGuardScripts(files) {
  const list = files ? [...files] : []
  return list.some((f) => f.startsWith('scripts/') && f !== GUARD_RUNNER && !f.startsWith('scripts/mutations/'))
}

/**
 * 순수 — 바뀐 파일 집합을 보고 **전수로 돌 사유**를 돌려준다(좁혀도 되면 `null`).
 * @param {Set<string>|string[]|null|undefined} files
 * @returns {string|null}
 */
export function fullReasonFor(files, { exempt } = {}) {
  const list = files ? [...files] : []
  // 🔴 "0개" 를 "바뀐 게 없으니 돌 것도 없다" 로 읽지 않는다. base 계산이 틀렸을 때도 0 이 나온다.
  if (list.length === 0) return '바뀐 파일이 0개로 보인다 — 믿지 않고 전수로 돈다'
  const hit = list.find((f) => f !== exempt && ALWAYS_FULL.some((p) => f.startsWith(p) || f.includes(p)))
  return hit ? `${hit} 가 바뀌었다 — 가드 자신/러너 환경이라 전수` : null
}

export const VERIFY_WORKFLOW = '.github/workflows/verify.yml'

/**
 * 🧮 **`verify.yml` 에 단계를 *추가만* 했는가** — 2026-11-01 (대표 *"모든 세션에서 배포하는 과정이
 * 순탄하지가 않아 … 왜 이러는거지?"* → *"모두 다 해줘"*).
 *
 * ## 왜
 * `verify.yml` 은 `ALWAYS_FULL` 이라 **새 가드를 CI 에 등록하기만 해도** 주입 전수(5천 건, 1시간+)가 돌았다.
 * 실측: PR #2069 가 가드 한 줄을 등록했을 뿐인데 "변경분" 단계가 전수로 떨어져 60분 넘게 걸렸고, 그동안
 * main 이 움직여 충돌 → 재푸시 → **처음부터 다시**를 두 번 했다. 그런데 주입 판정은 각 주입의 vitest 만
 * 돌린다 — **다른 CI 단계가 하나 더 생기는 것으로는 어떤 주입의 판정도 바뀌지 않는다.**
 * 바뀔 수 있는 것은 *러너 환경*(체크아웃 깊이·node·npm ci·env·주입 단계 자신)이고, 그건 **추가가 아니라 수정**이다.
 *
 * ## 판정 (보수적 — 애매하면 false = 전수)
 *   ① base 의 모든 줄이 head 에 **같은 순서로 그대로** 있다(지우거나 고친 줄 0)
 *   ② 끼워 넣은 줄 중 **새 단계 머리(`      - name:`)** 가 하나 이상 있다
 *   ③ 끼워 넣은 줄이 전부 `- name:` · 한 줄짜리 `run:` · `continue-on-error:` · 주석 · 빈 줄 뿐이다
 *      (`uses:`·`env:`·`with:`·`if:`·다줄 `run: |` 이 끼면 false — 실행 환경을 바꿀 수 있다)
 *
 * ⚠️ **못 보는 것**: 추가한 단계가 *다른 가드를 약하게* 만드는지(그건 이 판정의 일이 아니다 —
 * `check-guard-registry`·`local-ci-parity` 가 strict 여부를 따로 본다). 그리고 좁힌 만큼은
 * 여전히 `guard-mutations-full.yml`(main push + 야간)이 전수로 되찾는다.
 */
const STEP_ADD_LINE = [
  /^      - name: \S/,
  /^        run: [^|>\s]/,
  /^        continue-on-error: (true|false)\s*$/,
  /^\s*#/,
  /^\s*$/,
]
export function verifyChangeIsStepAdditionOnly(baseSrc, headSrc) {
  if (typeof baseSrc !== 'string' || typeof headSrc !== 'string') return false
  const base = baseSrc.split('\n')
  const head = headSrc.split('\n')
  let j = 0
  const added = []
  for (const line of head) {
    if (j < base.length && line === base[j]) j++
    else added.push(line)
  }
  if (j !== base.length) return false // ① 기존 줄이 지워지거나 바뀌었다
  if (!added.some((l) => /^      - name: \S/.test(l))) return false // ② 새 단계가 아니다
  return added.every((l) => STEP_ADD_LINE.some((re) => re.test(l))) // ③ 실행 환경 줄 0
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
export function changedScope({ enabled, run, baseRef = 'origin/main', readFile = (p) => readFileSync(p, 'utf8') }) {
  if (!enabled) return { full: true, why: '--changed 아님(전수)' }
  let files
  let mb
  try {
    mb = run(['merge-base', baseRef, 'HEAD']).trim()
    // 커밋된 변경 + 아직 커밋 안 한 작업트리 — 로컬에서도 CI 와 같은 답이 나오게.
    const a = run(['diff', '--name-only', mb, 'HEAD'])
    const b = run(['diff', '--name-only', mb])
    files = new Set(`${a}\n${b}`.split('\n').map((x) => x.trim()).filter(Boolean))
  } catch {
    return { full: true, why: `base(${baseRef}) 를 못 구했다 — shallow clone 이면 fetch-depth: 0 이 필요하다` }
  }
  let why = fullReasonFor(files)
  // 🧮 verify.yml 만이 전수 사유라면 — 단계를 *추가만* 했는지 실제 내용으로 본다(위 판정).
  // 🔴 다른 전수 사유가 있으면 **그것을** 말한다 — 단계만 추가한 verify.yml 을 탓하면 원인을 오진하게
  //    만든다(시험이 잡았다: package.json 이 진짜 사유인데 메시지가 verify.yml 을 가리켰다).
  const other = why && files.has(VERIFY_WORKFLOW) ? fullReasonFor(files, { exempt: VERIFY_WORKFLOW }) : null
  if (other) why = other
  else if (why && files.has(VERIFY_WORKFLOW)) {
    let baseSrc = null
    let headSrc = null
    try {
      baseSrc = run(['show', `${mb}:${VERIFY_WORKFLOW}`])
      headSrc = readFile(VERIFY_WORKFLOW)
    } catch { /* 못 읽으면 아래에서 전수 */ }
    why = verifyChangeIsStepAdditionOnly(baseSrc, headSrc)
      ? null
      : `${VERIFY_WORKFLOW} 의 기존 줄이 바뀌었거나 실행 환경 줄이 끼었다(단계 추가만이 아니다) — 전수`
  }
  return why ? { full: true, why } : { full: false, files }
}
