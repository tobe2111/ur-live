#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: WeakSet/WeakMap 에 primitive 키 사용 차단.
 *
 * 배경:
 *   memoize-ensure-fix.mjs 가 `ensureLanguageLoaded(lang: string)` 의 boolean
 *   memoize 를 `WeakSet<object>` 로 변환 → `WeakSet.add('ko')` TypeError →
 *   i18n locale 한 개도 로드 안 됨 → 메인 페이지 전체에 raw 키 노출 사고.
 *
 * 검사:
 *   1. `const _xxx = new WeakSet<...>()` 또는 `WeakMap` 선언과 같은 파일에서
 *   2. 그 변수의 `.has(arg)` / `.add(arg)` / `.set(arg, ...)` / `.get(arg)` 호출
 *   3. arg 가 명시적 primitive 타입 (string/number/boolean) 으로 선언된 식별자면 ERROR
 *
 *   휴리스틱: arg 식별자를 받는 함수 시그니처에서 `arg: string` 등 타입 어노테이션 검사.
 *
 * 사용:
 *   node scripts/check-weakset-primitive.mjs        # warn-only (default)
 *   node scripts/check-weakset-primitive.mjs -s     # strict (CI 차단)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

const SEARCH_DIRS = ['src', 'scripts']
const PRIMITIVE_TYPES = /^(string|number|boolean|symbol|bigint)$/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.wrangler') continue
      walk(p, out)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.mjs') || name.endsWith('.js')) {
      out.push(p)
    }
  }
  return out
}

const files = []
for (const d of SEARCH_DIRS) walk(path.join(ROOT, d), files)

const issues = []

for (const file of files) {
  const rel = path.relative(ROOT, file)
  const src = fs.readFileSync(file, 'utf8')

  // 1) WeakSet/WeakMap 변수 이름 수집
  const weakVars = new Set()
  const declRe = /(?:const|let)\s+(\w+)\s*(?::\s*Weak(?:Set|Map)<[^>]*>)?\s*=\s*new\s+Weak(?:Set|Map)/g
  let dm
  while ((dm = declRe.exec(src)) !== null) {
    weakVars.add(dm[1])
  }
  if (weakVars.size === 0) continue

  // 2) primitive-typed 식별자 수집 — 함수 인자 + 변수 선언
  const primitiveIdents = new Map() // name → 'string' | 'number' | ...
  const argRe = /\(\s*([^)]*)\)/g
  // simple param scan: foo(lang: string, x: number) → record
  const fnSigRe = /function\s+\w+\s*\(([^)]*)\)|\(\s*([^)]*)\s*\)\s*=>/g
  let pm
  while ((pm = fnSigRe.exec(src)) !== null) {
    const params = pm[1] || pm[2] || ''
    for (const p of params.split(',')) {
      const t = p.trim()
      const tm = t.match(/^(\w+)\s*:\s*(\w+)/)
      if (tm && PRIMITIVE_TYPES.test(tm[2])) {
        primitiveIdents.set(tm[1], tm[2])
      }
    }
  }
  // also: let foo: string = ...
  const localRe = /(?:const|let|var)\s+(\w+)\s*:\s*(\w+)\s*=/g
  let lm
  while ((lm = localRe.exec(src)) !== null) {
    if (PRIMITIVE_TYPES.test(lm[2])) primitiveIdents.set(lm[1], lm[2])
  }

  if (primitiveIdents.size === 0) continue

  // 3) `weakVar.has(ident)` / `.add(ident)` / `.set(ident, ...)` 호출 검사
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const wv of weakVars) {
      const callRe = new RegExp(`${wv}\\.(has|add|set|get|delete)\\(\\s*([\\w.]+)\\b`, 'g')
      let cm
      while ((cm = callRe.exec(line)) !== null) {
        const method = cm[1]
        const arg = cm[2]
        // arg 이 primitive ident 와 일치하면 BAD
        const baseIdent = arg.split('.')[0]
        if (primitiveIdents.has(baseIdent)) {
          issues.push({
            file: rel,
            line: i + 1,
            weakVar: wv,
            method,
            arg,
            argType: primitiveIdents.get(baseIdent),
            snippet: line.trim().slice(0, 140),
          })
        }
      }
    }
  }
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const NC = '\x1b[0m'

console.log('🔍 WeakSet/WeakMap primitive key check')
console.log(`   Scanned ${files.length} files`)

if (issues.length === 0) {
  console.log(`${GREEN}✅ WeakSet/WeakMap 에 primitive 키 사용 없음${NC}`)
  process.exit(0)
}

console.log(`\n${RED}❌ CRITICAL: ${issues.length} WeakSet/WeakMap primitive 키 사용 발견${NC}`)
console.log(`   런타임 TypeError: Invalid value used in weak set/map → 즉시 crash`)
console.log('')
for (const i of issues) {
  console.log(`  ${i.file}:${i.line}`)
  console.log(`    ${i.weakVar}.${i.method}(${i.arg}: ${i.argType})  ← primitive 키 금지`)
  console.log(`    ${i.snippet}`)
}

if (STRICT) process.exit(1)
process.exit(0)
