/**
 * 🧮 손으로 만든 `IN (?,?,…)` 자리 스캐너 — **순수 모듈**(부작용 없음).
 *
 * 왜 분리했나: 가드 스크립트(`check-d1-bind-limit.mjs`)는 import 되는 순간 스캔하고
 * `process.exit` 한다. 그걸 시험이 import 하면 시험 프로세스가 죽거나 레포를 건드린다
 * (2026-10-06 에 그 클래스로 `CURRENT_WORK.md` 를 5,957 → 470줄로 날린 적이 있다).
 * ⇒ 판정 로직만 여기 두고 시험은 **이 모듈**을 부른다.
 */

/** 플레이스홀더 목록을 손으로 조립하는 모양. */
export const PH_RE = /\.map\(\(\)\s*=>\s*'\?'\)|\.map\(\(\)=>'\?'\)|\.fill\('\?'\)/
/** 한도를 한 곳이 세는 SSOT. 이 이름이 같은 자리에 보이면 표면으로 세지 않는다. */
export const SSOT_RE = /chunkForBinds/
/** 의도한 예외 — 그 줄에 이유와 함께 적는다. */
export const OK_RE = /d1-bind-ok/
/** SSOT 를 찾아볼 앞쪽 범위(줄). */
export const CTX_LINES = 25

/**
 * 파일별 "손으로 조립한 플레이스홀더" 줄 수.
 * @param files 검사 대상 경로
 * @param read  경로 → 소스. 시험은 합성 소스를 넘긴다.
 * @returns {Record<string, number>} 0건인 파일은 넣지 않는다.
 */
export function countBindSites(files, read) {
  const counts = {}
  for (const f of files) {
    let s
    try { s = read(f) } catch { continue }
    if (!PH_RE.test(s)) continue
    const lines = s.split('\n')
    let n = 0
    lines.forEach((ln, i) => {
      if (!PH_RE.test(ln)) return
      if (OK_RE.test(ln)) return
      // 같은 자리에서 SSOT 를 쓰고 있으면 세지 않는다 — 옮긴 자리는 표면이 아니다.
      const ctx = lines.slice(Math.max(0, i - CTX_LINES), i + 2).join('\n')
      if (SSOT_RE.test(ctx)) return
      n += 1
    })
    if (n > 0) counts[f] = n
  }
  return counts
}

/** 파일별 개수 → 총합. */
export function totalOf(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

/**
 * 동결값 대비 늘어난/줄어든 파일.
 * ⚠️ **줄 번호로 동결하지 않는다** — 코드가 위아래로 밀리면 줄은 바뀌지만 위험은 그대로다.
 */
export function diffAgainst(counts, prev) {
  const grew = []
  const shrank = []
  for (const [f, n] of Object.entries(counts)) {
    const p = prev[f] ?? 0
    if (n > p) grew.push({ file: f, from: p, to: n })
  }
  for (const [f, p] of Object.entries(prev)) {
    const n = counts[f] ?? 0
    if (n < p) shrank.push({ file: f, from: p, to: n })
  }
  return { grew, shrank }
}
