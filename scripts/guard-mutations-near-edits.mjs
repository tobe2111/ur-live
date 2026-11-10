/**
 * 🎯 **올리기 전 — 내가 고친 자리 근처의 주입만** 골라 돌린다 (2026-11-10, `check-guard-mutations.mjs --near-edits`)
 *
 * 대표 *"더 개선할 건?"*.
 *
 * ## 왜 (실측 — 11/9 00시 ~ 11/10 23시 KST, PR 검사 실패 8건)
 * 화면 무게를 푸시 전에 재게 하고(#2295) 나니 **남은 실패의 6건(75%)이 '가드 주입 검증(변경분)'** 이었다.
 * 여섯 다 같은 모양이다 — *"결함을 심었는데 시험이 통과"*. 세션이 그 주입이 심는 바로 그 자리를
 * **일부러** 바꿨기 때문이다(예: 첫 화면 CSS 자격을 검색까지 넓혔더니 *"검색까지 넓어진다"* 주입이 할 일이 없어졌다).
 * 고칠 것은 주입 좌표(재조준)이고 1분이면 되는데, 이 검사는 **푸시 전에 한 번도 안 돌아서** CI 11분 뒤에야 알았다.
 * 같은 세션이 그날 실패 7건 · 취소 22건을 냈다(고쳐서 다시 올릴 때마다 앞 검사가 취소된다).
 *
 * ## 무엇을 고르나 (변경분 `--changed` 보다 훨씬 좁다 — CI 는 그대로 `--changed` 를 돈다)
 *   ① 그 주입의 **시험 파일**이 diff 에 있다
 *   ② 그 주입의 **대상 파일**이 diff 에 있고, 앵커(`find`)가 바뀐 줄에서 `NEAR_LINES` 줄 안에 있다
 *   ③ 대상 파일이 diff 에 있는데 앵커를 **못 찾는다**(낡은 지도 — 돌려 봐야 수 ms)
 * 그날 실패 6건을 이 규칙으로 되짚으면 **6건 모두** 골라지고, 고르는 수는 6~66건이다
 * (변경분은 같은 커밋들에서 41~520건 — 2026-11-10 실측, 근거는 handoff 2026-11-10-pre-push-near-edits).
 *
 * ## 못 하는 것
 *   - 앵커와 먼 곳을 고쳐 시험 결과가 바뀌는 경우(다른 함수가 같은 값을 만든다 등) — CI 의 `--changed` 가 본다.
 *   - 이 브랜치가 **새로 더한 주입**은 시험 파일도 같이 바꿨을 때만 고른다(대부분 그렇다).
 * 안내이지 마지막 방어선이 아니다 — 최종 판정은 여전히 CI 다.
 */

/**
 * 앵커가 바뀐 줄에서 이만큼 안에 있으면 고른다. 그날 6건으로 재면 10 → 5건(지도 시드 주입이 바뀐 줄에서
 * 15줄 떨어져 있었다) · **20 → 6건 전부**, 고르는 수 6~66건(가장 큰 것 로컬 약 4분). 30 은 더 잡는 것 없이 74건.
 */
export const NEAR_LINES = 20

/**
 * 순수 — `git diff -U0` 출력에서 파일별 **새 쪽** 바뀐 줄 범위를 뽑는다.
 * 지우기만 한 덩어리(`+N,0`)는 그 자리 한 줄로 친다(그 옆 앵커가 영향을 받는다).
 * @param {string} diff
 * @returns {Map<string, Array<[number, number]>>}
 */
export function parseHunks(diff) {
  const out = new Map()
  let file = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4)
      file = p === '/dev/null' ? null : p.replace(/^b\//, '')
      continue
    }
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (m && file) {
      const start = Number(m[1])
      const n = m[2] == null ? 1 : Number(m[2])
      if (!out.has(file)) out.set(file, [])
      out.get(file).push([start, start + Math.max(n, 1) - 1])
    }
  }
  return out
}

/**
 * 순수 — 고를 주입 이름들.
 * @param {{ mutations: Array<{name:string,file:string,find:string,test:string}>, files: Set<string>,
 *           hunks: Map<string, Array<[number, number]>>, readSrc: (file: string) => string | null, near?: number }} x
 * @returns {Set<string>}
 */
export function pickNearEdits({ mutations, files, hunks, readSrc, near = NEAR_LINES }) {
  const picked = new Set()
  const cache = new Map()
  const src = (f) => {
    if (!cache.has(f)) cache.set(f, readSrc(f))
    return cache.get(f)
  }
  for (const m of mutations) {
    if (files.has(m.test)) { picked.add(m.name); continue }
    if (!files.has(m.file)) continue
    const s = src(m.file)
    const at = s == null ? -1 : s.indexOf(m.find)
    if (at < 0) { picked.add(m.name); continue }
    const first = s.slice(0, at).split('\n').length
    const last = first + m.find.split('\n').length - 1
    const ranges = hunks.get(m.file) ?? []
    if (ranges.some(([a, b]) => a - near <= last && b + near >= first)) picked.add(m.name)
  }
  return picked
}
