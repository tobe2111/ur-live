#!/usr/bin/env node
/**
 * 🛡️ 2026-06-30: "셀러 대시보드 들어가면 도매몰로 튕김" 버그 클래스 방어 (서비스 분리).
 *
 * 배경 (대표 신고 — `/seller` → `/wholesale` 강제 이동): `SellerLayout` 이 `is_distributor === '1'`
 *   하나로 셀러 대시보드 접근을 막아, **소비자 셀러 + 판매사 겸업** 계정이 대시보드에서 영구 차단됐다.
 *   `is_distributor` 는 '도매 접근 권한 있음'(capability)일 뿐 '도매 전용'(exclusivity)이 아니다 —
 *   기존 셀러가 `/become-distributor` 한 번만 해도 같은 셀러 행에 is_distributor=1 이 덧붙어 겸업이 됨.
 *
 * 룰: 소비자-셀러 대시보드 surface(`Seller*` 페이지/컴포넌트)에서 **`is_distributor` 를 직접 게이트로
 *   삼아 `/wholesale` 로 redirect 하거나 `return null` 로 화면을 막으면 위반.** 도매몰 ↔ 셀러 라우팅
 *   판정은 반드시 서버 권위 `wholesale_only`(SSOT `computeWholesaleOnly`, `GET /api/seller/surface`)로 한다.
 *
 * 자동 제외: 파일/블록에 `seller-wholesale-redirect-ok` 주석. (도매몰/제조사 surface 인 Wholesale·Supplier
 *   파일은 애초에 Seller prefix 가 아니라 대상에서 제외 — 그쪽은 is_distributor 로 자기 surface 판정해도 정상.)
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_SELLER_WHS_REDIRECT=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_SELLER_WHS_REDIRECT === '1'
const ROOT = process.cwd()

// 소비자-셀러 대시보드 surface 만 (도매몰/제조사 Wholesale*/Supplier* 는 자연히 제외됨).
const TARGET_GLOBS = [
  /^src\/components\/Seller[A-Za-z0-9_]*\.tsx$/,
  /^src\/pages\/Seller[A-Za-z0-9_]*\.tsx$/,
  /^src\/pages\/seller-[^/]*\/.*\.tsx$/,
]

const HAS_DISTRIBUTOR = /\bis_distributor\b/
const HAS_WHOLESALE_ONLY = /\bwholesale_only\b/
// 도매몰로 보내거나 화면을 막는 행위. (ternary `? '/wholesale'` 등 따옴표 경로 리터럴도 포함.)
const WHS_REDIRECT = /navigate\(\s*['"`]\/wholesale|<Navigate\s+to=['"`]\/wholesale|\bto=['"`]\/wholesale|window\.location[^\n]*\/wholesale|['"`]\/wholesale['"`]/
const RETURN_NULL = /\breturn\s+null\b/
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
  if (/seller-wholesale-redirect-ok/.test(code)) continue
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (!HAS_DISTRIBUTOR.test(ln) || HAS_WHOLESALE_ONLY.test(ln)) continue
    const rel = path.relative(ROOT, file).split(path.sep).join('/')
    // Pattern A — 같은 줄에서 is_distributor 가 /wholesale redirect 또는 return null 을 게이트.
    if (WHS_REDIRECT.test(ln) || RETURN_NULL.test(ln)) {
      violations.push(`${rel}:${i + 1} — is_distributor 직접 게이트로 도매몰 redirect/화면차단`)
      continue
    }
    // Pattern B — `if (...is_distributor...)` 조건 직후(3줄 내) /wholesale redirect 또는 return null.
    if (IF_LINE.test(ln)) {
      const win = lines.slice(i + 1, i + 4).join('\n')
      if (!HAS_WHOLESALE_ONLY.test(win) && (WHS_REDIRECT.test(win) || RETURN_NULL.test(win))) {
        violations.push(`${rel}:${i + 1} — if(is_distributor) 블록이 도매몰 redirect/화면차단`)
      }
    }
  }
}

if (violations.length === 0) {
  console.log('✅ 셀러↔도매 라우팅 — Seller* surface 에서 is_distributor 직접 게이트로 도매몰 튕기는 곳 없음(wholesale_only 권위 판정만).')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} is_distributor 직접 게이트 ${violations.length}건 (겸업 셀러 lock-out 재발 위험):`)
for (const v of violations) console.error('   ' + v)
console.error("\n   수정: 도매몰 redirect 는 서버 권위 `wholesale_only`(GET /api/seller/surface, computeWholesaleOnly)로만.")
console.error('         is_distributor 는 도매 접근권(capability)일 뿐 도매 전용이 아님(겸업 계정 존재).')
console.error('   예외: 파일/블록에 `seller-wholesale-redirect-ok` 주석.')
process.exit(STRICT ? 1 : 0)
