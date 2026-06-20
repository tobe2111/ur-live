#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — 라이트 고정 로그인/가입 페이지의 "입력 글자 흰색으로 안 보임" 재발 방지.
 *
 * 배경(2026-06-17): 전역 CSS `.dark input:not(...)`(특이도 0,5,1)가 OS/앱 다크모드(html.dark)에서
 *   모든 입력 글자색을 거의 흰색으로 덮어씀. `text-gray-900` 유틸(0,1,0)은 특이도가 낮아 짐 →
 *   흰 배경에 흰 글자. 어드민/셀러/에이전시/도매의 **로그인·가입·비번재설정 페이지는 레이아웃 밖
 *   (standalone)이라 보호 래퍼(`*-light-theme`)가 없어** 전부 글자가 안 보였다.
 *   근본수정으로 라이트 고정 컨테이너 안의 입력 글자를 `!important` 로 강제하는 CSS 규칙
 *   (.force-light-theme 등)을 두고, standalone 라이트 auth 페이지 루트에 클래스를 붙였다.
 *
 * 이 검사: 라이트 고정 계열(어드민/셀러/에이전시/도매)의 **로그인/가입/비번 페이지**가
 *   ① 자체 풀스크린 라이트 배경(min-h-screen + bg-white/gray-50/#F.. 등)을 그리고
 *   ② <input>/<textarea>/<select> 를 렌더하면서
 *   ③ 레이아웃 래퍼(<AdminLayout> 등)도 없고
 *   ④ 라이트 보호 클래스(force/admin/seller/agency-light-theme)도 없으면
 *   → 다크모드에서 글자가 안 보이는 잠재 버그 → 경고.
 *
 * 올바른 패턴: 루트 div className 앞에 `force-light-theme` 추가.
 *   <div className="force-light-theme min-h-screen bg-[#F4F5F7] ...">
 *
 * 예외: 파일 어딘가에 `light-input-ok` 주석. 소비자(다크 토글) 로그인/가입은 scope 제외.
 * 기본 warn-only(exit 0). 차단: STRICT_LIGHT_INPUT=1 또는 `-s` 플래그.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src', 'pages')
const STRICT = process.env.STRICT_LIGHT_INPUT === '1' || process.argv.includes('-s')

// scope: 라이트 고정 계열의 인증/진입 페이지만 (대시보드 CRUD 는 레이아웃이 보호 → 제외).
const AUTH_NAME = /(Login|Register|ForgotPassword|ResetPassword|Join|StaffLogin|PinSetup|SignUp|SignIn)/i
// 소비자(다크 토글) 진입 페이지 — 라이트 고정 아님(의도적 다크), scope 밖.
const CONSUMER_EXCLUDE = new Set([
  'src/pages/LoginPage.tsx',
  'src/pages/RegisterPage.tsx',
  'src/pages/JoinChoicePage.tsx',
])

const INPUT = /<(input|textarea|select)[\s/>]/
const LIGHT_THEME_CLASS = /(force|admin|seller|agency)-light-theme/
const LAYOUT_WRAPPER = /<(Admin|Seller|Agency|Supplier|Wholesale)Layout[\s>]/
// 라이트 배경 토큰 (풀스크린 루트에서).
const LIGHT_BG = /(bg-white|bg-gray-50|bg-gray-100|bg-slate-50|bg-neutral-50|bg-zinc-50|bg-\[#[Ff]|from-(?:purple|pink|blue|gray|slate|indigo|amber|rose|sky|violet|fuchsia)-(?:50|100))/
// 다크 토글 신호 (root 에 다크 variant 가 있으면 소비자식 토글 페이지로 간주 → scope 밖).
const ROOT_DARK = /dark:bg-/

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests' || name === '__tests__') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p)
  }
  return out
}

const offenders = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const name = basename(file)
  if (!AUTH_NAME.test(name)) continue            // 인증/진입 페이지만
  if (CONSUMER_EXCLUDE.has(rel)) continue         // 소비자 다크 페이지 제외
  const text = readFileSync(file, 'utf8')
  if (text.includes('light-input-ok')) continue   // 명시 예외
  if (!INPUT.test(text)) continue                 // 입력칸 없으면 무관
  if (LIGHT_THEME_CLASS.test(text)) continue       // 이미 보호 클래스 있음 → OK
  if (LAYOUT_WRAPPER.test(text)) continue          // 레이아웃이 보호 → OK

  // 자체 풀스크린 라이트 루트를 그리는가 (다크 토글 variant 없는 라이트 배경)?
  let rootLine = ''
  for (const line of text.split('\n')) {
    if (line.includes('min-h-screen') && LIGHT_BG.test(line) && !ROOT_DARK.test(line)) {
      rootLine = line.trim(); break
    }
  }
  if (!rootLine) continue

  offenders.push(`${rel}: ${rootLine.slice(0, 110)}`)
}

if (offenders.length === 0) {
  console.log('✅ light-input guard: standalone 라이트 로그인/가입 페이지 모두 보호 클래스 보유 (다크모드 글자 안전).')
  process.exit(0)
}

console.log('⚠️  다크모드에서 입력 글자 안 보일 위험 — 라이트 고정 로그인/가입 페이지에 보호 클래스 누락:')
for (const o of offenders) console.log('   - ' + o)
console.log('')
console.log('   루트 div className 앞에 `force-light-theme` 를 추가하세요:')
console.log('     <div className="force-light-theme min-h-screen bg-[#F4F5F7] ...">')
console.log('   (전역 `.dark input` 규칙이 텍스트를 흰색으로 덮어쓰는 것을 CSS !important 로 차단)')
console.log('   정당한 예외는 파일에 `light-input-ok` 주석.')

if (STRICT) {
  console.log('\n❌ STRICT_LIGHT_INPUT — 차단.')
  process.exit(1)
}
console.log('\n(warn-only — 차단하려면 STRICT_LIGHT_INPUT=1)')
process.exit(0)
