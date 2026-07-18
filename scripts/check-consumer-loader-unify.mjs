#!/usr/bin/env node
/**
 * 🎯 2026-07-18 (대표 지시 — "로딩 중엔 무조건 하나로 통일, 도매몰 제외"): 소비자 페이지의 PAGE-level
 *   로딩 상태는 유어딜 BrandLoader 로 통일. 커스텀 풀페이지 스피너(min-h-screen/min-h-[100dvh] + animate-spin
 *   또는 Loader2)나 텍스트-온리 풀페이지 로더가 소비자 파일에 새로 생기면 경고.
 *
 * 판정(보수적 — 오탐 최소):
 *   - 소비자 스코프 파일(도매몰/대시보드/공급자 제외)에서
 *   - 풀뷰포트 로딩 컨테이너 패턴: `min-h-screen`|`min-h-[100dvh]` 와 같은 블록에 `animate-spin` 또는 `Loader2`
 *     가 함께 있고, 그 파일이 `BrandLoader` 를 import 하지 않으면 = 풀페이지 스피너 로더로 간주 → 위반.
 *   - BrandLoader 를 이미 import 한 파일은 통과(남은 스피너는 버튼/인라인으로 간주 — 인라인은 통일 대상 아님).
 *
 * 예외: 파일에 `consumer-loader-ok` 주석. 잠금 파일(PaymentSuccessPage 등)은 KNOWN_EXCEPTIONS.
 *
 * warn 기본. 차단: STRICT_CONSUMER_LOADER=1 또는 verify.yml.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src/pages', 'src/components', 'src/features']
// 도매몰(서비스 분리) + 대시보드(라이트 고정 로더) = 통일 제외 스코프.
const EXCLUDE_RE = /(wholesale|supplier|Wholesale|Supplier|\/admin\/|Admin|\/agency|Agency|Seller|seller-page|seller-dashboard|dashboard|DashboardLoading|WholesaleLoading)/
// 잠금/보류 파일 — 별도 결정 대기(대표 승인 필요). 승인 후 제거.
const KNOWN_EXCEPTIONS = new Set([
  'src/pages/PaymentSuccessPage.tsx', // Toss V2 audit 잠금 — 로더 통일은 대표 승인 대기
])

function walk(dir, out = []) {
  let ents
  try { ents = readdirSync(dir) } catch { return out }
  for (const e of ents) {
    const p = join(dir, e)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx|jsx)$/.test(p)) out.push(p)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r))
const violations = []

for (const f of files) {
  const norm = f.replace(/\\/g, '/')
  if (EXCLUDE_RE.test(norm)) continue
  if (KNOWN_EXCEPTIONS.has(norm)) continue
  const src = readFileSync(f, 'utf8')
  if (/consumer-loader-ok/.test(src)) continue
  if (/BrandLoader/.test(src)) continue // 이미 유어딜 로더 도입 → 남은 스피너는 인라인/버튼으로 간주

  // 풀뷰포트 로딩 컨테이너: min-h-screen|min-h-[100dvh] 를 가진 요소 블록 안에 스피너.
  // 라인 윈도우(±6줄)로 근접성 판정 — 버튼 스피너(min-h-screen 없는 곳)와 구분.
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/min-h-screen|min-h-\[100dvh\]/.test(lines[i])) continue
    const win = lines.slice(i, Math.min(lines.length, i + 8)).join('\n')
    if (/animate-spin|\bLoader2\b/.test(win)) {
      violations.push({ file: norm, line: i + 1, snippet: lines[i].trim().slice(0, 90) })
      break
    }
  }
}

if (violations.length === 0) {
  console.log('✅ consumer-loader-unify: 소비자 풀페이지 스피너 로더 없음 — 로딩은 BrandLoader 로 통일됨.')
  process.exit(0)
}

console.error('❌ [consumer-loader-unify] 소비자 페이지에 유어딜 BrandLoader 아닌 풀페이지 로더 발견:')
for (const v of violations) {
  console.error(`   ${v.file}:${v.line}  ${v.snippet}`)
}
console.error('\n→ 소비자 PAGE-level 로딩은 `<BrandLoader fullScreen />`(다크표면은 forceDark)로 통일하세요.')
console.error('  버튼/인라인 스피너는 대상 아님(그 파일이 BrandLoader 를 import 하면 자동 통과).')
console.error('  의도적 예외는 `consumer-loader-ok` 주석. (도매몰/대시보드는 자동 제외.)')

const strict = process.env.STRICT_CONSUMER_LOADER === '1' || process.env.CI === 'true'
process.exit(strict ? 1 : 0)
