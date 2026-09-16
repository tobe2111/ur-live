/**
 * 🔎 **이 브랜치가 실제로 바꾼 주입만 고른다** — 매니페스트를 옮기지 않고.
 *
 * ## 왜 이게 필요했나 (실측 2026-09-15)
 * Verify 성공 run 중앙값이 **55.9분**인데, 같은 워크플로가 빠를 땐 **12.1분**이었다. 4.6배를 가르는
 * 스위치는 하나다 — `--changed` 가 좁히느냐, `ALWAYS_FULL` 에 걸려 1,144건 전수로 가느냐.
 * 그리고 **머지 PR 25건 중 23건이 전수**였다. 주범은 `scripts/` 접두사 하나:
 *
 * | 전수를 부른 이유 | PR 수 |
 * |---|---|
 * | `scripts/check-guard-mutations.mjs` 를 건드림(= 인라인 주입 추가) | **11** |
 * | `*-baseline.json` · `live-shot.mjs` · `install-git-hooks.sh` 같은 **판정 무관 파일** | 6 |
 * | `scripts/mutations/*.mjs` (새 주입 추가) | 3 |
 *
 * ⇒ `CLAUDE.md` 가 요구하는 *"새 가드를 만들면 주입을 한 줄 추가하라"* 를 지키는 것 자체가
 *   **40분짜리 전수를 부르고 있었다.** 규칙을 지킬수록 느려지는 구조다.
 *
 * ## 🚫 매니페스트를 옮기는 처방은 택하지 않았다
 * 인라인 966건을 `scripts/mutations/` 로 들어내면 해결되지만, 그 순간 **열린 PR 9개**가
 * (같은 10,717줄 파일의 배열 안쪽에 추가하고 있다) 전부 충돌한다. 내 시간을 아끼려고
 * 다른 세션 아홉에 수작업 병합을 떠넘기는 셈이라 안 한다.
 *
 * ## 대신 — base 와 head 의 **주입 목록을 실제로 비교**한다
 * 매니페스트가 인라인이든 분할이든 상관없다. 이름 기준으로 diff 해서 **새로 생겼거나 내용이
 * 바뀐 주입**만 고른다. 원래 요구(*"새로 넣은 주입이 그 PR 에서 검증돼야"*)를 1,144건을 다 도는
 * 대신 **정확히 그것만** 돌아서 충족한다.
 *
 * 🔴 **애매하면 전수다.** 아래 모든 함수는 판정 불가일 때 "바뀐 것으로 친다"(넓은 쪽)로 떨어진다.
 * 그리고 좁힌 만큼은 `guard-mutations-full.yml`(main push + 야간)이 전수로 되찾는다 — 둘은 짝이다.
 */

/** 주입 하나의 **동일성**을 이루는 필드. 이 중 하나라도 다르면 "바뀐 주입"이다. */
const IDENTITY = ['file', 'find', 'replace', 'test']

/**
 * 순수 — base·head 두 주입 목록을 견줘 **이 PR 에서 돌아야 할 이름**을 돌려준다.
 *
 * - head 에만 있는 이름 → 새 주입. 반드시 이 PR 에서 검증돼야 한다.
 * - 양쪽에 있는데 `file·find·replace·test` 중 하나라도 다름 → 겨누는 자리가 바뀌었다.
 * - base 에만 있는 이름(삭제됨) → 돌릴 것이 없다. 고르지 않는다.
 *
 * `why`·`name` 외 설명 문구만 바뀐 것은 **고르지 않는다** — 주석 한 줄에 40분을 쓰지 않는다.
 *
 * @param {Array<{name:string}>|null|undefined} base
 * @param {Array<{name:string}>|null|undefined} head
 * @returns {Set<string>}
 */
export function changedInjectionNames(base, head) {
  const out = new Set()
  if (!Array.isArray(head)) return out
  const baseByName = new Map()
  if (Array.isArray(base)) for (const m of base) if (m && typeof m.name === 'string') baseByName.set(m.name, m)
  for (const m of head) {
    if (!m || typeof m.name !== 'string') continue
    const b = baseByName.get(m.name)
    if (!b) { out.add(m.name); continue }
    if (IDENTITY.some((k) => b[k] !== m[k])) out.add(m.name)
  }
  return out
}

/** 인라인 매니페스트를 감싸는 두 앵커. 바뀌면 판정 불가로 떨어진다(= 전수). */
const MANIFEST_START = 'const MUTATIONS = ['
const MANIFEST_END = 'const MUTATIONS_DIR ='

/**
 * 순수 — 러너 소스에서 **인라인 매니페스트 구간만** 도려낸 나머지를 돌려준다.
 * 앵커를 못 찾으면 `null` — 호출부는 그걸 "판정 불가 → 전수" 로 읽는다.
 *
 * ⚠️ 파싱이 아니라 앵커 자르기다. 러너가 재구성돼 앵커가 사라지면 **조용히 틀리는 대신
 * 판정을 포기**하도록 만들었다(이 레포가 반복해 당한 "검사가 실패할 수 없음" 을 피한다).
 *
 * @param {string} src
 * @returns {string|null}
 */
export function stripInlineManifest(src) {
  if (typeof src !== 'string') return null
  const a = src.indexOf(MANIFEST_START)
  if (a < 0) return null
  const b = src.indexOf(MANIFEST_END, a)
  if (b < 0) return null
  return src.slice(0, a) + src.slice(b)
}

/**
 * 순수 — 러너의 **판정 로직**이 바뀌었는가(매니페스트 내용 변화는 제외).
 *
 * 로직이 바뀌면 내가 안 건드린 주입도 다르게 판정될 수 있다 ⇒ 전수.
 * 매니페스트만 바뀌었으면 위 `changedInjectionNames` 가 정확히 그것만 고른다.
 *
 * @returns {boolean} 판정 불가도 `true`(전수 쪽)
 */
export function runnerLogicChanged(baseSrc, headSrc) {
  const a = stripInlineManifest(baseSrc)
  const b = stripInlineManifest(headSrc)
  if (a === null || b === null) return true
  return a !== b
}

/**
 * 순수 — 테스트 파일 소스가 **하위 프로세스를 띄우는가**.
 *
 * 왜 보는가: 주입의 `test` 는 전부 vitest 파일 경로지만(실측 — `node scripts/...` 를 `test` 로 쓰는
 * 주입은 0건), 그중 **14개 테스트가 `execFileSync` 등으로 가드 스크립트를 직접 돌린다.**
 * 그러면 `scripts/check-무엇.mjs` 가 바뀔 때 그 테스트의 판정이 달라질 수 있다 —
 * 주입의 `file` 이나 `test` 가 diff 에 없어도. 그 구멍만 따로 메운다.
 *
 * @param {string} src
 */
export function testSpawnsSubprocess(src) {
  return typeof src === 'string' && /\b(execFileSync|execSync|spawnSync|spawn)\s*\(/.test(src)
}
