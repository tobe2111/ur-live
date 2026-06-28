#!/usr/bin/env node
/**
 * 🔀 대시보드 교차-역할 API 호출 정적 검사 (2026-06-24) — "다른 역할 토큰으론 403" 클래스 전역 차단.
 *
 *   배경(대표 "다른 사람들이 썼을 때도 / 전역"): 한 역할의 대시보드 화면이 *다른 역할 전용* 토큰-게이트
 *   네임스페이스를 호출하면, 그 역할 사용자에겐 403 → 빈 화면/먹통(소유자=슈퍼는 안 보임). 도매 어드민은
 *   별도 RBAC-스코프 검사로 이미 잠갔고, 이건 **제조사/판매사/에이전시/어드민 대시보드 전부**를 덮어
 *   교차-역할 호출을 영구 차단.
 *
 *   순수 정적. 각 대시보드 파일군에서 /api/<seg> 호출을 수집 → 그 역할이 못 쓰는 전용 네임스페이스면 위반.
 *   동일 토큰 공유(판매사 storefront ↔ /api/seller) 와 공용(/api/upload 등)은 허용.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

// 역할 전용(그 역할 토큰 필요) 네임스페이스 → 소유 역할.
const EXCLUSIVE = {
  admin: ['admin', 'admin-payouts', 'admin-review-bonus'],
  supplier: ['supplier'],
  agency: ['agency'], // agency-public 은 공용(제외)
  seller: ['seller'],
  // 🆕 2026-06-28 유어애즈(UR Ads) — 3번째 서비스. /api/ads 는 seller_token 게이트지만 도매(supplier)/
  //   어드민/에이전시 토큰으론 401 → 그 대시보드에서 부르면 먹통. seller/판매사 와는 토큰 공유(같은 사람).
  ads: ['ads'],
}
// 대시보드군: 파일 prefix + 그 화면이 *호출하면 안 되는* 역할들(=교차역할 403).
//   wholesale storefront 의 사용자 = type='seller'(판매사) → /api/seller 동일토큰이라 forbid 에서 seller 제외.
const GROUPS = [
  { name: '제조사(supplier)',  match: (p) => p.startsWith('src/pages/supplier-dashboard/') || p === 'src/pages/SupplierDashboardPage.tsx' || /^src\/pages\/Supplier[A-Z].*\.tsx$/.test(p), forbid: ['admin', 'agency', 'seller', 'ads'] },
  { name: '에이전시(agency)',  match: (p) => p.startsWith('src/pages/agency/') || /^src\/pages\/Agency[A-Z].*\.tsx$/.test(p), forbid: ['admin', 'supplier', 'seller', 'ads'] },
  { name: '판매사 storefront', match: (p) => p.startsWith('src/pages/wholesale/') || p.startsWith('src/pages/wholesale-catalog/') || p.startsWith('src/components/wholesale/') || /^src\/pages\/Wholesale[A-Z].*\.tsx$/.test(p), forbid: ['admin', 'supplier', 'agency'] },
  // 어드민: 소비자/도매 어드민 페이지. supplier/agency 전용은 못 부름(admin 토큰). seller 는 일부 공용성 있어 제외(오탐 방지).
  { name: '어드민(admin)',     match: (p) => (/^src\/pages\/Admin[A-Z].*\.tsx$/.test(p) || p.startsWith('src/pages/admin/')) && !p.includes('AdminProductsPage'), forbid: ['supplier', 'agency', 'ads'] },
  // 🆕 유어애즈(marketing) 대시보드: 자기 /api/ads 만. 도매(supplier)·어드민·에이전시 전용 API 는 토큰이 달라
  //   401/403 → 먹통. seller 는 토큰 공유(같은 사람의 광고툴)라 forbid 제외(오탐 방지).
  { name: '유어애즈(marketing)', match: (p) => p.startsWith('src/pages/marketing/') || /^src\/components\/Marketing[A-Z].*\.tsx$/.test(p), forbid: ['admin', 'supplier', 'agency'] },
]

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(resolve(ROOT, dir)) } catch { return acc }
  for (const name of entries) {
    const rel = join(dir, name)
    const st = statSync(resolve(ROOT, rel))
    if (st.isDirectory()) { if (name !== 'node_modules') walk(rel, acc) }
    else if (name.endsWith('.tsx')) acc.push(rel)
  }
  return acc
}

const segOwner = {}
for (const [role, segs] of Object.entries(EXCLUSIVE)) for (const s of segs) segOwner[s] = role

const files = walk('src/pages').concat(walk('src/components'))
const violations = []
for (const f of files) {
  const group = GROUPS.find((g) => g.match(f))
  if (!group) continue
  const src = read(f)
  const seen = new Set()
  for (const m of src.matchAll(/['"`]\/api\/([a-z0-9-]+)/g)) {
    const seg = m[1]
    if (seen.has(seg)) continue
    seen.add(seg)
    const owner = segOwner[seg]
    if (owner && group.forbid.includes(owner)) {
      const line = src.slice(0, m.index).split('\n').length
      violations.push({ group: group.name, file: f, line, api: `/api/${seg}`, owner })
    }
  }
}

console.log(`🔀 대시보드 교차-역할 API 검사`)
console.log(`   스캔 ${files.length} 파일 · 그룹 ${GROUPS.length}개(제조사/에이전시/판매사/어드민/유어애즈)`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 어떤 대시보드도 다른 역할 전용 API 를 호출하지 않음(교차역할 403 없음).`)
  process.exit(0)
}
console.log(`\n❌ 교차-역할 호출 ${violations.length}건 (그 대시보드 사용자에겐 403 → 먹통):`)
for (const v of violations) console.log(`   • [${v.group}] ${v.api} (${v.owner} 전용)   ${v.file}:${v.line}`)
const STRICT = process.env.STRICT_CROSSROLE === '1'
process.exit(STRICT ? 1 : 0)
