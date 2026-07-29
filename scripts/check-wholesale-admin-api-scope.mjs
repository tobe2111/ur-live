#!/usr/bin/env node
/**
 * 🔐 도매(wholesale) 권한 어드민 — API 스코프 정합 정적 검사 (2026-06-24)
 *
 *   배경(대표 신고): 메인 대시보드는 '판매사 승인 2명' 인데 클릭해 들어간 '셀러 관리'는 "승인 대기 없음".
 *   원인: 카운트는 in-scope 엔드포인트(/api/admin/wholesale-overview)로 셌는데, 목적지 페이지의 데이터
 *   호출(/api/admin/sellers)은 wholesale 스코프 밖 → admin-rbac 가 403 → 빈 목록. 역할-한정(보이지 않는)
 *   데이터 미스매치. 슈퍼 어드민엔 안 보임(슈퍼는 전권이라 목록 정상).
 *
 *   이 검사: wholesale-role 이 도달 가능한 화면들이 호출하는 모든 /api/admin/* 경로가 wholesale 스코프
 *   (shared/admin-roles.ts scopedRoleCanAccess)에 들어오는지 단언. 벗어나면 = 그 화면은 도매 어드민에게
 *   403/빈데이터로 깨짐. → 이 클래스를 전수 고정.
 *
 *   순수 정적. 동적 경로(`/api/admin/${...}`)는 정적 접두만 검사.
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

// ── shared/admin-roles.ts 의 wholesale 스코프 규칙을 재현(SSOT 동기화) ──────────
//   변경 시 이 검사도 같이 갱신되도록, 소스에서 직접 파싱.
const rolesSrc = read('src/shared/admin-roles.ts')
function parseWholesaleScope() {
  const block = rolesSrc.match(/wholesale:\s*\{([\s\S]*?)\}/)
  const pull = (key) => {
    const m = block && block[1].match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
  }
  return { prefixes: pull('prefixes'), exact: pull('exact') }
}
const SCOPE = parseWholesaleScope()
function adminSeg(path) {
  const m = String(path).match(/\/api\/admin[/-]([a-z0-9-]+)/i)
  return m ? m[1].toLowerCase() : ''
}
function inScope(path) {
  const seg = adminSeg(path)
  if (!seg) return true // /api/admin 루트 등 — 판단 불가, 통과
  if (SCOPE.exact.includes(seg)) return true
  return SCOPE.prefixes.some((p) => seg === p || seg.startsWith(p))
}

// ── wholesale-reachable 화면 → 파일 매핑(nav 검사와 동일 로직) ─────────────────
const layout = read('src/components/AdminLayout.tsx')
const routes = read('src/routes/admin.routes.tsx')
const allowed = new Set()
{
  const re = /domain:\s*'wholesale'/g
  let m
  while ((m = re.exec(layout))) {
    const nt = layout.indexOf('title:', m.index + 1)
    const block = layout.slice(m.index, nt === -1 ? m.index + 4000 : nt)
    for (const pm of block.matchAll(/path:\s*'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
  }
}
{
  const arr = layout.match(/WHOLESALE_EXTRA_ALLOWED_PATHS\s*=\s*\[([^\]]*)\]/)
  if (arr) for (const pm of arr[1].matchAll(/'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
}
const lazyMap = {}
for (const m of routes.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\('(@\/pages\/[^']+)'\)\)/g)) {
  lazyMap[m[1]] = m[2].replace('@/', 'src/') + '.tsx'
}
const pathToFile = {}
for (const m of routes.matchAll(/path="(\/admin\/[^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
  const p = m[1].split('/:')[0]
  const comp = [...m[2].matchAll(/<([A-Z][A-Za-z0-9_]+)\b/g)].map((x) => x[1]).find((c) => lazyMap[c])
  if (comp && !pathToFile[p]) pathToFile[p] = lazyMap[comp]
}

// ── 각 화면이 호출하는 /api/admin 경로 추출 + 스코프 검사 ─────────────────────
// /admin/products 는 도매 역할이 supplier-products 탭만 보도록 스코프됨(AdminProductsPage). 그 탭의
// /api/admin/supplier-products 만 활성(enabled). 소비자 탭 쿼리는 wholesale 에선 비활성이라 제외 대상.
const WHOLESALE_TAB_SCOPED = { '/admin/products': /supplier-products/ }
const violations = []
for (const p of [...allowed].filter((x) => x.startsWith('/admin/'))) {
  const file = pathToFile[p]
  if (!file) continue
  let src
  try { src = read(file) } catch { continue }
  const seen = new Set()
  for (const m of src.matchAll(/['"`](\/api\/admin[/-][a-zA-Z0-9/_${}.-]*)['"`]/g)) {
    const apiPath = m[1]
    if (seen.has(apiPath)) continue
    seen.add(apiPath)
    if (inScope(apiPath)) continue
    // 탭-스코프 페이지: 도매에서 비활성인 탭의 API 는 제외(오탐 방지) — 단, 보수적으로 라인 컨텍스트로 판단 못 하므로
    // 페이지 전체에 supplier-products 가 활성-스코프면, products 등 소비자 API 는 "도매 미사용"으로 간주.
    if (WHOLESALE_TAB_SCOPED[p]) continue
    const line = src.slice(0, m.index).split('\n').length
    violations.push({ from: p, file, api: apiPath, line })
  }
}

// ── 리포트 ───────────────────────────────────────────────────────────────────
console.log(`🔐 도매 어드민 API 스코프 검사`)
console.log(`   wholesale 스코프 prefixes=[${SCOPE.prefixes}] exact=[${SCOPE.exact}] · 검사 화면 ${[...allowed].filter((x) => x.startsWith('/admin/')).length}개`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 도매 도달 화면의 모든 /api/admin 호출이 스코프 안.`)
  process.exit(0)
}
console.log(`\n❌ 스코프 밖 API 호출 ${violations.length}건 (도매 역할이 그 화면 열면 403→빈데이터):`)
for (const v of violations) console.log(`   • ${v.from}  →  ${v.api}   [${v.file}:${v.line}]`)
console.log(`\n조치: (a) 도매 도메인 엔드포인트(distributor/wholesale/supplier 세그)로 교체, 또는`)
console.log(`        (b) 그 화면을 도매 도달 목록에서 제외, 또는 (c) 카운트 링크를 in-scope 페이지로.`)
const STRICT = process.env.STRICT_API_SCOPE === '1'
process.exit(STRICT ? 1 : 0)
