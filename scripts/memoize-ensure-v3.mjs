#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: ensure 함수 conservative memoize (v3 — 가장 안전).
 *
 *   v2 의 import 영역 깨짐 문제 해결: flag 선언을 파일 END 에 추가.
 *   end-of-file insertion 은 무조건 안전 (어떤 코드 구조에도 영향 없음).
 *
 *   동작:
 *     - 각 ensure 함수에 `if (_done_X) return; _done_X = true;` 삽입
 *     - 파일 끝에 `let _done_X = false` 선언 추가
 *
 *   ⚠️ var hoisting 이용 — JS 는 `let` 선언 전 사용시 ReferenceError 인데
 *      Node ES module 에서 module-level `let` 은 module evaluation 시
 *      모두 선언됨. 함수 body 실행 시점엔 이미 선언되어 있음 (TDZ 후).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const targets = []
function scan(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) scan(p)
    else if (['.ts', '.tsx'].includes(extname(p))) targets.push(p)
  }
}
scan('src')

let modified = 0
let skipped = 0

for (const file of targets) {
  const src = readFileSync(file, 'utf-8')

  if (/_done_ensure\w+\s*=\s*false/.test(src)) {
    skipped++
    continue
  }

  const re = /^([ \t]*)(export[ \t]+)?async function (ensure[A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)[^{}]*\{[ \t]*$/gm
  const matches = [...src.matchAll(re)]
  if (matches.length === 0) continue

  let result = src
  const flags = new Set()
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

  // Append flag declarations at END of file (always safe).
  const decls = '\n\n// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).\n' +
    [...flags].map((f) => `let ${f} = false`).join('\n') + '\n'
  result = result.endsWith('\n') ? result + decls : result + '\n' + decls

  writeFileSync(file, result, 'utf-8')
  modified++
}

console.log(`총 ${targets.length} 파일 / ${modified} 수정 / ${skipped} skip`)
