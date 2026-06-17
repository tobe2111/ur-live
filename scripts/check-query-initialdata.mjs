#!/usr/bin/env node
/**
 * 🛡️ 2026-06-17: React Query "stale initialData" 버그 클래스 방어.
 *
 * 배경 (실제 사고): useBalance 가 initialData(localStorage seed, 미캐시면 0)를 갖는데
 *   initialDataUpdatedAt 도 refetchOnMount:'always' 도 없어, RQ 가 seed 를 "fresh" 로 간주 →
 *   cold mount 에서 refetchOnMount:true 가 발동 안 함 → 잘못된 0 을 staleTime 동안 노출 →
 *   교환권 상세에서 '딜 부족' 오표시. 같은 패턴이 7개 훅에 잠복.
 *
 * 룰: useQuery / useApiQuery 옵션 객체에 `initialData` 키가 있으면 반드시
 *   `initialDataUpdatedAt` (보통 0) 또는 `refetchOnMount: 'always'` 중 하나가 함께 있어야 한다.
 *   (seed 를 즉시 stale 처리하거나, 마운트마다 무조건 refetch → cold mount 1회 서버 보정.)
 *
 * 자동 제외:
 *   - 값이 passthrough 인 wrapper (`initialData: opts?.initialData` 등 — 값에 `.initialData` 포함).
 *   - 옵션 객체에 `initialdata-check-ok` 주석.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_INITIALDATA=1 (exit 1).
 * 미래 자동 적용: pre-commit hook + verify.yml CI 등록.
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_INITIALDATA === '1'
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/**
 * 주석/문자열 "내용"을 공백으로 치환 — 길이/줄 위치는 그대로 보존(원본 인덱스와 1:1).
 * → brace 매칭이 문자열·주석 속 `{}` 에 오작동하지 않게 하면서, 같은 인덱스로 원본을 다시 읽을 수 있다.
 */
function stripNoise(code) {
  const out = code.split('')
  const n = code.length
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ' }
  let i = 0
  while (i < n) {
    const ch = code[i]
    const nx = code[i + 1]
    if (ch === '/' && nx === '/') {
      let j = i; while (j < n && code[j] !== '\n') j++
      blank(i, j); i = j; continue
    }
    if (ch === '/' && nx === '*') {
      let j = i + 2; while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++
      j = Math.min(n, j + 2); blank(i, j); i = j; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; let j = i + 1
      while (j < n) { if (code[j] === '\\') { j += 2; continue } if (code[j] === q) break; j++ }
      blank(i + 1, j); i = j + 1; continue
    }
    i++
  }
  return out.join('')
}

/** idx 를 포함하는 가장 안쪽 { ... } 객체의 [start, end] 인덱스를 반환 (stripped 코드 기준). */
function enclosingObject(code, idx) {
  let depth = 0
  let start = -1
  for (let i = idx; i >= 0; i--) {
    const ch = code[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth === 0) { start = i; break }
      depth--
    }
  }
  if (start === -1) return null
  let d = 0
  for (let i = start; i < code.length; i++) {
    const ch = code[i]
    if (ch === '{') d++
    else if (ch === '}') { d--; if (d === 0) return [start, i] }
  }
  return null
}

const lineOf = (code, idx) => code.slice(0, idx).split('\n').length

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(full)
  }
  return acc
}

const files = walk(SRC, [])
const violations = []

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('initialData')) continue
  const code = stripNoise(raw) // 인덱스는 raw 와 1:1
  const re = /\binitialData\s*:/g // initialDataUpdatedAt / 타입 `initialData?:` 는 자동 미매칭
  let m
  while ((m = re.exec(code))) {
    const keyIdx = m.index
    const valTail = code.slice(keyIdx, keyIdx + 80)
    if (/\binitialData\s*:\s*[^,\n]*\.initialData/.test(valTail)) continue // wrapper passthrough
    if (/\binitialData\s*:\s*undefined\b/.test(valTail)) continue
    const span = enclosingObject(code, keyIdx)
    if (!span) continue
    const [start, end] = span
    const rawBlock = raw.slice(start, end + 1) // 가드/주석은 원본 텍스트로 검사 ('always' 보존)
    if (!/\bquery(Key|Fn)\b/.test(rawBlock)) continue // useQuery/useApiQuery 옵션 객체만
    if (/initialdata-check-ok/i.test(rawBlock)) continue // 명시 예외
    const guarded = /\binitialDataUpdatedAt\b/.test(rawBlock) ||
                    /\brefetchOnMount\s*:\s*['"]always['"]/.test(rawBlock)
    if (!guarded) violations.push({ file: path.relative(ROOT, file), line: lineOf(code, keyIdx) })
  }
}

if (violations.length === 0) {
  console.log("✅ initialData 검사 — 모든 useQuery/useApiQuery 의 initialData 가 initialDataUpdatedAt 또는 refetchOnMount:'always' 로 보호됨")
  process.exit(0)
}

console.log(`${STRICT ? '❌' : '⚠️'}  initialData 가 "fresh 로 간주"되는 stale 위험 ${violations.length}건:`)
for (const v of violations) console.log(`   - ${v.file}:${v.line}`)
console.log('')
console.log("   fix: 같은 옵션 객체에 `initialDataUpdatedAt: 0` 추가(캐시 seed 즉시 stale → cold mount 1회 보정)")
console.log("        또는 `refetchOnMount: 'always'`. 의도적 예외면 옵션 객체에 `initialdata-check-ok` 주석.")
console.log("   배경: useBalance '딜 부족' 오표시 사고 (2026-06-17).")

process.exit(STRICT ? 1 : 0)
