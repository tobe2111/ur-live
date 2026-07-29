#!/usr/bin/env node
/**
 * 🛡️ 2026-06-27: "로그인했는데 '로그인하세요'" 버그 클래스 방어 (도매몰 판매사 surface).
 *
 * 배경 (대표 신고 — `/wholesale/product/:id` 반복 재발): 페이지가 `distributor_price == null`
 *   (가격 없음) 하나로 **로그인 여부**와 **가격 유무**를 동시에 판단했다. 둘은 평소 일치하지만
 *   "로그인했는데 그 등급 공급가가 미설정/스테일" 일 때 어긋나 → 가격없음을 '로그아웃'으로 오판,
 *   주문/담기 클릭 시 `goLogin()` 로 로그인 페이지로 쫓아냄. 2026-06-19 수정은 *표시*만 고치고
 *   (locked=!token) 핸들러엔 옛 price-게이트가 남아 **표면별 패치 → 재발**했다.
 *
 * 룰: 도매/제조사 surface 에서 `goLogin(`/`navigate('/wholesale/login')` 같은 **로그인 유도**는
 *   '실제 비로그인'(토큰 없음)으로만 게이트해야 한다. **가격 필드(*_price)를 null/0/falsy 로 테스트한
 *   조건 안에서 로그인 유도를 호출하면 위반** — 가격은 로그인 신호가 아니다(미설정/스테일 가능).
 *
 * 자동 제외: 파일/블록에 `login-gate-ok` 주석.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_LOGIN_GATE=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_LOGIN_GATE === '1'
const ROOT = process.cwd()

// 이 버그 클래스가 사는 surface 만 (판매사 대면 도매몰 페이지/컴포넌트).
const TARGET_GLOBS = [
  /^src\/pages\/Wholesale.*\.tsx$/,
  /^src\/pages\/wholesale[^/]*\/.*\.tsx$/,
  /^src\/pages\/Supplier.*\.tsx$/,
  /^src\/pages\/supplier-dashboard\/.*\.tsx$/,
  /^src\/components\/wholesale\/.*\.tsx$/,
]

// 로그인 유도(로그인 페이지로 보내거나 "로그인하면…" 안내 후 redirect).
const LOGIN_REDIRECT = /\bgoLogin\s*\(|navigate\(\s*['"`]\/wholesale\/login/

// 가격 필드의 '부재'를 테스트하는 조건 — 이게 로그인 게이트의 근거면 안 됨.
//   form: xxx_price == null | === null | <= 0 | < 1 | == 0 | !xxx.price
const PRICE_ABSENCE = /(?:\w*_price|\bprice)\b\s*(?:===?\s*null|<=?\s*0|<\s*1|===?\s*0)/
const PRICE_FALSY = /!\s*\w+(?:\.\w+)*\.?\w*_?price\b/

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
  if (/login-gate-ok/.test(code)) continue
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (!/\bif\s*\(/.test(ln)) continue
    // 이 if 의 조건이 가격-부재를 테스트하나?
    if (!(PRICE_ABSENCE.test(ln) || PRICE_FALSY.test(ln))) continue
    // 같은 줄 또는 블록(다음 6줄) 안에서 로그인 유도 호출이 있나?
    const windowText = lines.slice(i, i + 7).join('\n')
    if (LOGIN_REDIRECT.test(windowText)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/')
      violations.push(`${rel}:${i + 1} — 가격(*_price) 부재 조건이 로그인 유도(goLogin/login)를 게이트함`)
    }
  }
}

if (violations.length === 0) {
  console.log('✅ 로그인 게이트 — 도매 surface 에서 가격으로 로그인 유도하는 곳 없음(토큰으로만 판정).')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} 가격-기반 로그인 유도 ${violations.length}건 (로그인했는데 '로그인하세요' 재발 위험):`)
for (const v of violations) console.error('   ' + v)
console.error("\n   수정: 로그인 유도는 `if (!token)` 로만. 가격 null/0 은 '공급가 미설정 · 제조사 문의' 안내(redirect 금지).")
console.error('   예외: 파일/블록에 `login-gate-ok` 주석.')
process.exit(STRICT ? 1 : 0)
