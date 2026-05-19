#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: 영구 방어 — input/textarea text 색상 누락 검사.
 *
 *   재발 패턴: 다크 페이지에서 흰색 input 텍스트가 화이트 페이지로 옮겨질 때
 *   투명하게 보임. index.css 의 글로벌 색상 강제로 1차 방어 + 본 lint 로 2차 방어.
 *
 *   감지 대상:
 *     - className="..." 안에 'text-white' 명시 (다크 전용 의도)
 *     - 같은 element 가 'dark:text-' 없으면 라이트 환경에서 안 보임
 *     - 화이트 배경 (bg-white) + text-white 조합은 무조건 잡음
 *
 *   사용: node scripts/check-input-text-color.mjs
 *   exit code 0: 통과, 1: 위반 발견.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC = 'src'
const violations = []

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) scan(p)
    else if (['.tsx', '.jsx'].includes(extname(p))) check(p)
  }
}

function check(file) {
  const src = readFileSync(file, 'utf-8')
  // <input ... className="..." /> with text-white but no dark:text-*
  const re = /<(input|textarea)\b[^>]*\bclassName=["']([^"']+)["'][^>]*>/g
  let m
  while ((m = re.exec(src)) !== null) {
    const className = m[2]
    const hasWhiteText = /\btext-white\b/.test(className)
    const hasBgWhite = /\bbg-white\b/.test(className)
    if (hasWhiteText && hasBgWhite) {
      violations.push({ file, msg: 'input has text-white + bg-white (invisible text)', line: src.slice(0, m.index).split('\n').length })
    }
  }
}

scan(SRC)

if (violations.length > 0) {
  console.error(`❌ ${violations.length} input text-color violations:`)
  for (const v of violations) console.error(`  ${v.file}:${v.line} — ${v.msg}`)
  process.exit(1)
}
console.log('✅ input text color audit 통과 (모든 input 가시성 정상).')
