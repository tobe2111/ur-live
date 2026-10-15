/**
 * 🔎 **CI 실패를 API 로 읽을 수 있게 만든다** (2026-10-16 — 실제로 막혀서 만들었다).
 *
 * ## 무엇이 막혔나
 * `Bundle budget (main)` 의 실행비용 래칫이 빨간불인데 **무엇이 얼마나 넘었는지 아무도 못 봤다.**
 * 그 가드는 숫자를 stdout 으로만 말하고, 세션은 `actions/jobs/<id>/logs` 를 읽을 수 없다
 * (blob 스토리지로 302 되고 이 환경의 `gh` 는 api.github.com 밖으로 안 나간다). 아티팩트 0건 ·
 * check-run `output` 비어 있음 · annotation 에는 `Process completed with exit code 1` 만 온다.
 * ⇒ 워크플로 머리말이 지시하는 *"로그의 실측을 읽고 기준을 올려라"* 를 **구조적으로 수행할 수 없었다.**
 * 그래서 2026-10-16 세션은 로컬에서 재현하고 **직전 커밋을 대조군으로 다시 빌드해서야** 자기 변경이
 * 무죄임을 밝혔다(빌드 2회 + 측정 2회 ≈ 25분). 그 비용이 매번 들 이유가 없다.
 *
 * ## 무엇을 하나
 * `::error::` **annotation** 과 `$GITHUB_STEP_SUMMARY` 로 같은 내용을 한 번 더 내보낸다.
 * annotation 은 `repos/{o}/{r}/check-runs/<id>/annotations` 로 **읽힌다** — 그게 요점이다.
 *
 * 🔴 **로그를 대체하지 않는다.** 출력은 그대로 stdout 에 남고 이것은 **덧붙이기**다.
 *    사람은 계속 로그를 읽고, 세션은 annotation 을 읽는다.
 */
import fs from 'node:fs'

/**
 * GitHub 워크플로 명령의 이스케이프 규칙(메시지 본문).
 * 순서가 중요하다 — `%` 를 먼저 바꿔야 뒤에 넣는 `%0A` 가 다시 안 먹힌다.
 */
export function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

/** 속성 값은 본문보다 더 막는다(`:` `,` 가 구분자다). */
export function escapeProp(s) {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
}

/** `::error title=…::본문` 한 줄을 만든다(순수 — 테스트가 이것을 잰다). */
export function annotationLine(level, message, props = {}) {
  const allowed = ['title', 'file', 'line', 'endLine', 'col', 'endColumn']
  const pairs = allowed
    .filter((k) => props[k] !== undefined && props[k] !== null && props[k] !== '')
    .map((k) => `${k}=${escapeProp(props[k])}`)
  return `::${level}${pairs.length ? ' ' + pairs.join(',') : ''}::${escapeData(message)}`
}

/**
 * annotation 을 내보낸다 — **GitHub Actions 안에서만.**
 * 로컬에서는 아무것도 찍지 않는다(로컬 출력에 `::error::` 가 섞이면 사람이 읽기 나빠진다).
 */
export function emitAnnotation(level, message, props = {}, env = process.env, out = console.log) {
  if (env.GITHUB_ACTIONS !== 'true') return false
  out(annotationLine(level, message, props))
  return true
}

/** 잡 요약에 덧붙인다(설정돼 있을 때만). 1MB 상한이 있어 호출부가 양을 줄여 넘긴다. */
export function appendSummary(markdown, env = process.env, fsMod = fs) {
  const p = env.GITHUB_STEP_SUMMARY
  if (!p) return false
  fsMod.appendFileSync(p, markdown.endsWith('\n') ? markdown : markdown + '\n')
  return true
}
