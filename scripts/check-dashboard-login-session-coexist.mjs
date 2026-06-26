#!/usr/bin/env node
/**
 * 🔐 대시보드 로그인 ↔ 소비자 세션 공존 검사 (2026-06-26) — "유저↔어드민/셀러 상호 로그아웃" 영구차단.
 *
 *   배경(대표 신고): 어드민/셀러 로그인 시작 시 무조건 clearAuthData('user') 를 부르면, KR 에선
 *   clearAuthData 가 /api/auth/logout-cookies 까지 호출해 httpOnly ur_session 쿠키를 없앤다 →
 *   "대시보드 로그인 = 소비자 강제 로그아웃". 코드베이스의 이중 로그인 '공존' 설계(RouteGuards 토큰존재
 *   기반 + KakaoCallbackPage hasOtherRoleToken 보존)와 정면 모순. 같은 사람이 어드민+유저를 동시에
 *   쓰지 못함.
 *
 *   규칙: 대시보드 로그인 페이지의 clearAuthData('user') 는 반드시 `!isKorea()`(글로벌 Firebase) 게이트
 *   안에서만 호출. KR 소비자 세션(쿠키)은 대시보드 Bearer 와 독립이라 파괴하면 안 됨.
 *
 *   순수 정적. 각 로그인 파일에서 clearAuthData('user') 호출을 찾아, 직전 12줄 안에 `!isKorea()` 가
 *   없으면(=무조건 호출) 위반. 의도적 예외는 같은 줄/직전 줄에 `login-coexist-ok` 주석.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 소비자 세션과 공존해야 하는 대시보드 로그인 페이지(=KR 에서 유저 세션을 무조건 파괴하면 안 됨).
const LOGIN_PAGES = [
  'src/pages/AdminLoginPage.tsx',
  'src/pages/SellerLoginPage.tsx',
  'src/pages/AgencyLoginPage.tsx',
]

const GATE_LOOKBACK = 12 // clearAuthData('user') 직전 N줄 안에 !isKorea() 가 있어야 함

const violations = []
let scanned = 0
for (const rel of LOGIN_PAGES) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) continue
  scanned++
  const lines = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    // 주석 줄은 무시(설명/근거 텍스트의 clearAuthData('user') 언급 제외).
    const codePart = ln.replace(/\/\/.*$/, '')
    if (!/clearAuthData\(\s*['"]user['"]\s*\)/.test(codePart)) continue
    // 의도적 예외 주석.
    if (/login-coexist-ok/.test(ln) || (i > 0 && /login-coexist-ok/.test(lines[i - 1]))) continue
    // 직전 GATE_LOOKBACK 줄 안에 !isKorea() 게이트가 있는지.
    const ctx = lines.slice(Math.max(0, i - GATE_LOOKBACK), i + 1).join('\n')
    if (!/!\s*isKorea\(\)/.test(ctx)) {
      violations.push({ file: rel, line: i + 1, text: ln.trim() })
    }
  }
}

console.log(`🔐 대시보드 로그인 ↔ 소비자 세션 공존 검사`)
console.log(`   스캔 ${scanned}/${LOGIN_PAGES.length} 로그인 페이지`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 어떤 대시보드 로그인도 KR 소비자 세션을 무조건 파괴하지 않음(공존 유지).`)
  process.exit(0)
}
console.log(`\n❌ 무조건 clearAuthData('user') ${violations.length}건 (KR 소비자 강제 로그아웃 → 상호 로그아웃 회귀):`)
for (const v of violations) {
  console.log(`   • ${v.file}:${v.line}  ${v.text}`)
  console.log(`     → \`!isKorea()\` 게이트 안으로 옮기세요(글로벌 Firebase 만 정리). KR 은 쿠키 세션이라 공존.`)
}
const STRICT = process.env.STRICT_LOGIN_COEXIST === '1'
process.exit(STRICT ? 1 : 0)
