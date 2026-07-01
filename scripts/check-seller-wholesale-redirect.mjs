#!/usr/bin/env node
/**
 * 🛡️ 2026-06-30: "대시보드 들어가면 다른 서비스로 튕김" 버그 클래스 방어 (서비스 분리 · 다중역할 보호).
 *
 * 배경 (대표 신고 — `/seller` → `/wholesale` 강제 이동): `SellerLayout` 이 `is_distributor === '1'`
 *   하나로 셀러 대시보드 접근을 막아, **소비자 셀러 + 판매사 겸업** 계정이 대시보드에서 영구 차단됐다.
 *   `is_distributor` 는 '도매 *접근 권한*'(capability)일 뿐 '도매 *전용*'(exclusivity)이 아니다 —
 *   기존 셀러가 `/become-distributor` 한 번만 해도 같은 셀러 행에 is_distributor=1 이 덧붙어 겸업이 됨.
 *
 * 일반 룰(이 클래스 전체): 대시보드 레이아웃/페이지(`*Layout`·`*DashboardPage`·`Seller*`·`supplier-dashboard`)에서
 *   **가산(additive) 권한 플래그(`is_distributor`·`getItem('is_*')`·`is_* === '1'`)를 *단독 게이트*로 삼아
 *   redirect/`return null` 하면 위반.** 가산 플래그는 다중역할(겸업) 사용자도 가질 수 있어, 단독으로
 *   "이 surface 의 주인이 아니다"를 판정하면 정당한 겸업 사용자를 쫓아낸다.
 *
 * 통과(안전) 조건 — 같은 줄/블록에 아래 중 하나가 있으면 OK:
 *   · 서버 권위 판정 `wholesale_only` (셀러↔도매 SSOT computeWholesaleOnly, GET /api/seller/surface)
 *   · 음성 인증 게이트 `!loggedIn` / `!token` / `!localStorage` / `!isXLoggedIn()` (비로그인 → 로그인, 정상)
 *   · 단일역할(가산 아님) 비교 `role !==` / `!== 'wholesale'` (admin role 등 — 겸직 불가 모델)
 *   · 다중역할 보호 동반조건이 있는 파생 플래그 (`supplierOnly = token && !loggedIn` 류)
 *   · escape 주석 `seller-wholesale-redirect-ok` / `multi-role-redirect-ok`
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_SELLER_WHS_REDIRECT=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_SELLER_WHS_REDIRECT === '1'
const ROOT = process.cwd()

// 대시보드 레이아웃/페이지 surface (여기서 다른 서비스로 강제이동 시 겸업 lock-out 위험).
//   도매/제조사 카탈로그(Wholesale*/Supplier* 페이지)는 자기 surface 판정이라 제외 — 그쪽은
//   파생 플래그(supplierOnly=token && !loggedIn)로 이미 겸업 보호함.
const TARGET_GLOBS = [
  /^src\/components\/Seller[A-Za-z0-9_]*\.tsx$/,
  /^src\/pages\/Seller[A-Za-z0-9_]*\.tsx$/,
  /^src\/pages\/seller-[^/]*\/.*\.tsx$/,
  /^src\/components\/[A-Za-z]*Layout\.tsx$/,        // SellerLayout · AdminLayout · AgencyLayout · MobileAppLayout …
  /^src\/pages\/[A-Za-z]*DashboardPage\.tsx$/,      // Supplier/Wholesale/Realtime/StoreOwner/Influencer/Policy …
  /^src\/pages\/supplier-dashboard\/.*\.tsx$/,
]

// 가산(additive) 권한 플래그 — 양성(positive) 사용. 다중역할 사용자도 가질 수 있어 단독 판정 금지.
const ADDITIVE_FLAG = /\bis_distributor\b|getItem\(\s*['"`]is_[a-z_]+['"`]\s*\)|\bis_[a-z_]+\s*===\s*['"`]1['"`]/
// 다른 서비스로 보내거나 화면을 막는 행위.
const REDIRECT_OR_BLOCK = /navigate\(\s*['"`]\/(seller|wholesale|supplier|agency|admin)|<Navigate\s+to=['"`]\/(seller|wholesale|supplier|agency|admin)|\bto=['"`]\/(seller|wholesale|supplier|agency|admin)|window\.location[^\n]*\/(seller|wholesale|supplier|agency|admin)|['"`]\/(seller|wholesale|supplier|agency|admin)['"`]|\breturn\s+null\b/
// 안전(통과) 신호 — 다중역할 보호 또는 음성 인증/단일역할.
const SAFETY = /wholesale_only|!\s*loggedIn|!\s*token\b|!\s*localStorage|!\s*getItem|!\s*is[A-Z][A-Za-z]*LoggedIn|!\s*get[A-Za-z]*Token|\brole\s*!==|!==\s*['"`]\w+['"`]|seller-wholesale-redirect-ok|multi-role-redirect-ok/
// 음성 가드(플래그가 *없을 때* 탈출) — `is_distributor !== '1'` / `!is_distributor` 는 bounce 가 아님.
const NEGATIVE_FLAG = /is_[a-z_]+\s*!==\s*['"`]1['"`]|!\s*\w*\.?is_[a-z_]+\b|!\s*getItem\(\s*['"`]is_/
const IF_LINE = /\bif\s*\(/

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

const files = walk(path.join(ROOT, 'src')).filter(f => {
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  return TARGET_GLOBS.some(re => re.test(rel))
})

const violations = []
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8')
  if (/seller-wholesale-redirect-ok|multi-role-redirect-ok/.test(code)) continue
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (!ADDITIVE_FLAG.test(ln)) continue
    if (NEGATIVE_FLAG.test(ln)) continue          // 음성 가드(플래그 없을 때 exit) — 안전
    if (SAFETY.test(ln)) continue                 // 동반 안전조건 — 안전
    const rel = path.relative(ROOT, file).split(path.sep).join('/')
    // Pattern A — 같은 줄에서 가산 플래그가 다른 서비스 redirect / return null 을 게이트.
    if (REDIRECT_OR_BLOCK.test(ln)) {
      violations.push(`${rel}:${i + 1} — 가산 플래그 단독 게이트로 서비스간 redirect/화면차단`)
      continue
    }
    // Pattern B — `if (...가산 플래그...)` 조건 직후(3줄 내) redirect / return null (창 안에 안전조건 없을 때).
    if (IF_LINE.test(ln)) {
      const win = lines.slice(i + 1, i + 4).join('\n')
      if (!SAFETY.test(win) && REDIRECT_OR_BLOCK.test(win)) {
        violations.push(`${rel}:${i + 1} — if(가산 플래그) 블록이 서비스간 redirect/화면차단`)
      }
    }
  }
}

if (violations.length === 0) {
  console.log('✅ 대시보드 라우팅 — 가산 권한 플래그(is_*) 단독으로 서비스간 강제이동/차단하는 곳 없음(겸업 보호).')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} 가산 플래그 단독 게이트 ${violations.length}건 (다중역할/겸업 lock-out 재발 위험):`)
for (const v of violations) console.error('   ' + v)
console.error('\n   수정: 서비스간 redirect 는 서버 권위 판정(셀러↔도매=`wholesale_only`/computeWholesaleOnly) 또는')
console.error('         다중역할 보호 동반조건(`!loggedIn`/`!token`/단일역할 `role !==`)으로만. is_* 는 가산 권한이라 단독 판정 금지.')
console.error('   예외: 파일/블록에 `seller-wholesale-redirect-ok` 또는 `multi-role-redirect-ok` 주석.')
process.exit(STRICT ? 1 : 0)
