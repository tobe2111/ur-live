#!/usr/bin/env node
/**
 * ⚡ 도매 로그인 SPA 이동 회귀 잠금 (2026-06-29) — 로그인 속도 보호.
 *
 *   배경(대표 "로그인 느림 / 최대한 빨라져야"): 로그인 성공 후 내부 라우트로 `window.location.assign`
 *   /`window.location.href`(full page reload)를 쓰면 앱 번들(~2MB/30청크)을 통째로 재다운로드+재파싱
 *   → 흰 화면 + 수백 ms 지연. 토큰을 localStorage 에 동기 set 후엔 SPA `navigate()` 로 충분(목적지가
 *   render 시 토큰 읽음). 제조사(SupplierLoginPage)는 원래 navigate, 판매사도 2026-06-29 전환.
 *
 *   규칙: 도매 로그인 페이지에서 로그인 성공 후 *내부 대시보드 라우트*(/wholesale·/supplier)로의
 *   full reload(`window.location.assign('/wholesale...')` / `window.location.href = '/wholesale...'`) 금지.
 *   카카오 OAuth 시작(`/auth/kakao/...`)은 full navigation 필수라 허용. 예외는 `spa-nav-ok` 주석.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => (existsSync(resolve(ROOT, p)) ? readFileSync(resolve(ROOT, p), 'utf8') : null)

const PAGES = [
  'src/pages/WholesaleLoginPage.tsx',
  'src/pages/SupplierLoginPage.tsx',
  'src/pages/wholesale/WholesaleStaffLoginPage.tsx',
  'src/pages/WholesaleJoinPage.tsx',
]

// 내부 대시보드 라우트로의 full reload (OAuth /auth/kakao 는 제외).
const BAD = /window\.location\.(assign\(|href\s*=\s*)['"`]\/(wholesale|supplier)\b/

const violations = []
let scanned = 0
for (const rel of PAGES) {
  const src = read(rel)
  if (src == null) continue
  scanned++
  const lines = src.split('\n')
  lines.forEach((ln, i) => {
    if (/spa-nav-ok/.test(ln)) return
    const code = ln.replace(/\/\/.*$/, '')
    if (BAD.test(code)) violations.push({ file: rel, line: i + 1, text: ln.trim() })
  })
}

console.log(`⚡ 도매 로그인 SPA 이동 가드`)
console.log(`   스캔 ${scanned}/${PAGES.length} 로그인 페이지`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 로그인 성공 후 내부 라우트 이동이 모두 SPA navigate(앱 재다운로드 없음, 빠름).`)
  process.exit(0)
}
console.log(`\n❌ full reload 이동 ${violations.length}건 (앱 번들 재파싱 → 로그인 흰화면·지연 회귀):`)
for (const v of violations) {
  console.log(`   • ${v.file}:${v.line}  ${v.text}`)
  console.log(`     → \`navigate('/wholesale', { replace: true })\` 로 변경(토큰은 applySellerSession 이 동기 set). OAuth(/auth/kakao)만 예외.`)
}
const STRICT = process.env.STRICT_LOGIN_SPA === '1'
process.exit(STRICT ? 1 : 0)
