#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — 듀얼 로그인(소비자 ↔ 대시보드 동시) 재발 방지.
 *
 * 배경(2026-06-17): 소비자(메인)와 대시보드(셀러/어드민/에이전시/제조사)를 한 브라우저에서
 *   동시 로그인할 때, 단일 키 `user_type` 으로 "로그인 여부"를 판단하던 코드가 멀쩡한 소비자
 *   세션을 로그아웃으로 오인 → "로그인이 계속 풀린다" 사고. 근본수정으로 전 경로를 토큰/세션
 *   존재 기반(`hasConsumerSession()` / `isLoggedInSync()`)으로 통일했다.
 *
 * 이 검사: 클라이언트에서 `localStorage.getItem('user_type') === 'user'` 로 *로그인을 판단*하는
 *   안티패턴이 다시 추가되면 경고한다. (DISPLAY/active_role 표시용 user_type 읽기는 OK — 이 검사는
 *   `=== 'user'` 비교만 잡는다.)
 *
 * 올바른 패턴:
 *   import { hasConsumerSession } from '@/utils/auth'   // 소비자 세션 존재 (user_type 비의존)
 *   import { isLoggedInSync } from '@/utils/auth'        // 임의 역할 로그인 (토큰/세션 존재)
 *
 * 예외: 라인에 `dual-login-ok` 주석이 있거나 ALLOWLIST 에 등록된 파일.
 * 기본 warn-only(exit 0). 차단: STRICT_DUAL_LOGIN=1.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

// localStorage 기반 user_type 로그인 게이트만 매칭 (DB 행 `.user_type` 속성 접근은 제외).
const PATTERN = /getItem\(\s*['"]user_type['"]\s*\)\s*===\s*['"]user['"]/

// 정당한 비-세션-드롭 사용처 (의도적 유지).
//   - App.tsx: 글로벌 Firebase 초기화 skip 게이트 (세션 삭제 아님, KR 무관). user_type 이 'user' 일 때만
//     Firebase 초기화 생략 — 듀얼유저(user_type='admin'/'seller')는 line 331 에서 이미 early-return.
const ALLOWLIST = new Set([
  'src/App.tsx',
])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests' || name === '__tests__') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const offenders = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (rel.includes('/tests/') || rel.includes('/__tests__/')) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    // 주석 라인 스킵 (// 또는 * 또는 /* 시작)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (line.includes('dual-login-ok')) return
    if (!PATTERN.test(line)) return
    if (ALLOWLIST.has(rel)) return
    offenders.push(`${rel}:${i + 1}: ${trimmed.slice(0, 120)}`)
  })
}

if (offenders.length === 0) {
  console.log('✅ dual-login guard: localStorage user_type 로그인 게이트 안티패턴 없음 (allowlist 외).')
  process.exit(0)
}

console.log('⚠️  듀얼 로그인 재발 위험 — `localStorage.getItem(\'user_type\') === \'user\'` 로 로그인 판단 발견:')
for (const o of offenders) console.log('   - ' + o)
console.log('')
console.log('   소비자(메인) 로그인 판단은 user_type 비의존 헬퍼를 쓰세요:')
console.log("     import { hasConsumerSession } from '@/utils/auth'   // 소비자 세션 (구매자)")
console.log("     import { isLoggedInSync } from '@/utils/auth'        // 임의 역할 로그인")
console.log('   정당한 예외는 라인에 `dual-login-ok` 주석 또는 스크립트 ALLOWLIST 에 등록.')

if (process.env.STRICT_DUAL_LOGIN === '1') {
  console.log('\n❌ STRICT_DUAL_LOGIN=1 — 차단.')
  process.exit(1)
}
console.log('\n(warn-only — 차단하려면 STRICT_DUAL_LOGIN=1)')
process.exit(0)
