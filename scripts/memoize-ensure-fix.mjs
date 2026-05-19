#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: ensure 메모이제이션을 boolean → WeakSet<object> 으로 전환.
 *
 * 배경:
 *   `memoize-ensure-v3.mjs` 가 module-level `let _done_X = false` 로 메모이즈했으나,
 *   테스트에서 새 mock D1 을 생성해도 flag 가 true 인 상태 유지 → ensureTables() 가
 *   no-op → mock DB 에 테이블 없음 → 후속 INSERT/SELECT 가 undefined 참조로 crash.
 *   사용자 신고: "perf: memoize ALL 76 ensureTables functions" 커밋 이후 CI run failed.
 *
 * 해결:
 *   각 ensure 함수의 첫 번째 인자 (DB 또는 env) 를 키로 WeakSet 추적.
 *     - 같은 DB 인스턴스로 재호출 → skip (production 성능 유지)
 *     - 다른 DB 인스턴스 (테스트 mock) → 정상 실행 (테스트 격리 복구)
 *
 * 변환:
 *   OLD:
 *     async function ensureXyz(DB) {
 *       if (_done_ensureXyz) return
 *       _done_ensureXyz = true
 *       ...
 *     }
 *     // 파일 끝:
 *     let _done_ensureXyz = false
 *
 *   NEW:
 *     async function ensureXyz(DB) {
 *       if (_done_ensureXyz.has(DB)) return
 *       _done_ensureXyz.add(DB)
 *       ...
 *     }
 *     // 파일 끝:
 *     const _done_ensureXyz = new WeakSet<object>()
 *
 *   WeakSet 사용 시 첫 인자가 객체여야 함. ensure 함수는 대부분 DB 또는 env 객체를
 *   받지만, primitive (string lang 등) 받는 함수는 자동 skip 한다.
 *
 *   🛡️ 2026-05-19 회귀 수정: 초기 버전이 ensureLanguageLoaded(lang: string) 까지
 *     변환 → WeakSet.add('ko') TypeError → 모든 i18n 키 raw 노출 사고 (메인 페이지
 *     mainHome.* 노출). 이후 첫 인자 타입이 primitive (string/number/boolean) 이면 skip.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const targets = []
function scan(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (e === 'node_modules' || e === 'dist') continue
      scan(p)
    } else if (['.ts', '.tsx'].includes(extname(p))) {
      targets.push(p)
    }
  }
}
scan('src')

let modified = 0
let skipped = 0
const totalFlags = []

for (const file of targets) {
  const src = readFileSync(file, 'utf-8')

  // 이미 WeakSet 형태이면 skip
  if (/_done_ensure\w+\s*=\s*new\s+WeakSet/.test(src)) {
    skipped++
    continue
  }
  // boolean 형태가 없으면 skip (이 파일은 메모이즈 안 됨)
  if (!/let\s+_done_ensure\w+\s*=\s*false/.test(src)) continue

  let result = src

  // 1) 함수 body 안의 boolean 체크/세팅을 WeakSet 으로 변환.
  //    각 ensure 함수의 첫 인자 이름 + 타입을 알아야 함.
  //    매칭: async function ensureXxx(arg1[: Type][, ...])
  //
  //    🛡️ 2026-05-19 회귀 수정: primitive 타입 (string/number/boolean) 첫 인자는
  //    WeakSet 키로 사용 불가 → TypeError. ensureLanguageLoaded(lang: string) 사고 후 추가.
  const fnSigRe = /async function (ensure[A-Z][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*:\s*([^,)]+))?/g
  const fnFirstArg = new Map()
  const skippedPrimitive = []
  let m
  while ((m = fnSigRe.exec(src)) !== null) {
    const fnName = m[1]
    const argName = m[2]
    const argType = (m[3] || '').trim()
    // primitive 타입이면 skip — WeakSet 키 불가
    if (/^(string|number|boolean|symbol|bigint)$/.test(argType)) {
      skippedPrimitive.push(`${fnName}(${argName}: ${argType})`)
      continue
    }
    fnFirstArg.set(fnName, argName)
  }
  if (skippedPrimitive.length > 0) {
    console.warn(`  ⚠️  ${file} — skipped primitive args: ${skippedPrimitive.join(', ')}`)
  }

  let convertedBoolChecks = 0
  for (const [fnName, argName] of fnFirstArg) {
    const flagName = `_done_${fnName}`
    // pattern: `if (_done_X) return` followed by `_done_X = true`
    const checkPattern = new RegExp(
      `if\\s*\\(\\s*${flagName}\\s*\\)\\s*return\\s*\\n(\\s*)${flagName}\\s*=\\s*true`,
      'g',
    )
    const before = result
    result = result.replace(
      checkPattern,
      `if (${flagName}.has(${argName})) return\n$1${flagName}.add(${argName})`,
    )
    if (before !== result) convertedBoolChecks++
  }

  // 2) module-level 선언 변환:
  //    `let _done_ensureXyz = false`  →  `const _done_ensureXyz = new WeakSet<object>()`
  let convertedDecls = 0
  result = result.replace(
    /let\s+(_done_ensure\w+)\s*=\s*false/g,
    (_match, name) => {
      convertedDecls++
      totalFlags.push(`${file}:${name}`)
      return `const ${name} = new WeakSet<object>()`
    },
  )

  if (convertedDecls > 0) {
    writeFileSync(file, result, 'utf-8')
    modified++
  }
}

console.log(`총 ${targets.length} 파일 / ${modified} 수정 / ${skipped} skip`)
console.log(`변환된 flag: ${totalFlags.length}`)
