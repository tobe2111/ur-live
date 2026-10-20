#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: ensure 함수 conservative memoize (v2 — 안전).
 *
 *   이전 v1 은 함수 body 끝을 찾으려 brace counter 사용 → 다국어 코멘트 / 템플릿 리터럴
 *   에서 brace 오인 → 파일 손상. v2 는 시작 부분만 수정:
 *
 *     async function ensureXxx(args) {
 *   →
 *     async function ensureXxx(args) {
 *       if (_done_ensureXxx) return
 *       _done_ensureXxx = true
 *
 *   설계 결정 — flag 를 함수 시작 시 즉시 true 설정 (try/finally 안 사용):
 *     - 모든 ensure 함수가 best-effort (try/catch swallow). throw 안 함.
 *     - 한 번 실패해도 retry 안 함 — 다음 worker 인스턴스가 재시도.
 *     - 효과: 같은 worker 에서 두 번째 호출부터 0 비용.
 *
 *   안전:
 *     - 이미 memoize 된 (`_done_` 또는 `_ensured` 또는 `_xxxEnsured` 존재) 파일 skip
 *     - 정규식이 다국어 문자 무시 (function 시그니처는 ASCII 만 매칭)
 *     - body 끝 안 찾음 (brace counter 미사용)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC = 'src'
const targets = []

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) scan(p)
    else if (['.ts', '.tsx'].includes(extname(p))) targets.push(p)
  }
}

scan(SRC)

let modified = 0
let skipped = 0

for (const file of targets) {
  const src = readFileSync(file, 'utf-8')

  // 이미 memoize 된 파일 skip.
  if (/_done_ensure|_ensured_ensure|_ensuredTables|let _\w+Ensured\b/.test(src)) {
    skipped++
    continue
  }

  // Find: (^[ \t]*)(export[ \t]+)?async function (ensure[A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(:\s*Promise<[^>]*>)?\s*\{
  // 시그니처가 한 줄에 있는 경우만 처리 (안전).
  const re = /^([ \t]*)(export[ \t]+)?async function (ensure[A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)[^{}]*\{[ \t]*$/gm
  const matches = [...src.matchAll(re)]
  if (matches.length === 0) continue

  let result = src
  const flags = new Set()
  // Insert from end to start to keep indices stable.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const indent = m[1]
    const fnName = m[3]
    const flagName = `_done_${fnName}`
    flags.add(flagName)
    const lineEnd = m.index + m[0].length
    const insertion = `\n${indent}  if (${flagName}) return\n${indent}  ${flagName} = true`
    result = result.slice(0, lineEnd) + insertion + result.slice(lineEnd)
  }

  // Add module-level flag declarations after last import.
  const flagDecls = [...flags].map((f) => `let ${f} = false`).join('\n')
  const importEndMatch = [...result.matchAll(/^import .*$/gm)]
  if (importEndMatch.length > 0) {
    const last = importEndMatch[importEndMatch.length - 1]
    const insertAt = last.index + last[0].length
    result = result.slice(0, insertAt) +
      '\n\n// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션.\n' + flagDecls +
      result.slice(insertAt)
  } else {
    result = '// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션.\n' + flagDecls + '\n' + result
  }

  writeFileSync(file, result, 'utf-8')
  modified++
}

console.log(`총 ${targets.length} 파일 / ${modified} 수정 / ${skipped} skip (이미 memoize)`)
