#!/usr/bin/env node
/**
 * generate-guide-references.mjs
 *
 * 각 역할(어드민/셀러/에이전시) 별로 코드를 스캔해서 가이드의 "참조" 섹션을 자동 생성.
 *
 * 입력:
 *   - src/App.tsx (페이지 라우트)
 *   - src/features/{auth,seller,admin,agency,youtube,donations}/api/*.routes.ts
 *   - src/worker/routes/*.routes.ts
 *   - src/worker/index.ts (라우트 마운트 + cat 메타데이터)
 *
 * 출력:
 *   - src/features/guides/api/auto-reference.ts (Generated. DO NOT EDIT MANUALLY.)
 *
 * 자동 호출:
 *   - pre-commit hook (warn if outdated)
 *   - npm run generate:guide-refs
 *   - 직접: node scripts/generate-guide-references.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const OUT_FILE = path.join(ROOT, 'src/features/guides/api/auto-reference.ts')

// ─────────────────────────────────────────────────────────────
// 1. App.tsx 에서 페이지 라우트 추출
// ─────────────────────────────────────────────────────────────

function extractRoutes() {
  // <Route path="..." element={...} />
  // 🏭 2026-06-07: App.tsx 외에 src/routes/*.tsx 도 스캔 — 도매(supplier.routes.tsx)·
  //   admin(admin.routes.tsx) 라우트가 분리 파일에 있어 페이지 목록 누락을 보강.
  //   (admin/seller/agency 버킷에도 누락분이 채워지지만 분류 규칙은 동일 — additive.)
  const files = [path.join(ROOT, 'src/App.tsx')]
  const routesDir = path.join(ROOT, 'src/routes')
  if (fs.existsSync(routesDir)) {
    for (const name of fs.readdirSync(routesDir)) {
      if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
        files.push(path.join(routesDir, name))
      }
    }
  }
  const routes = []
  const routeRe = /<Route\s+path=["']([^"']+)["']/g
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf-8')
    let m
    while ((m = routeRe.exec(src)) !== null) {
      routes.push(m[1])
    }
  }
  return [...new Set(routes)]
}

// 🏭 2026-06-07: 도매몰(wholesale) 버킷 추가. 도매 surface 는 admin/seller 보다
//   먼저 검사해 가로채야 함 (예: /admin/suppliers 는 admin 이 아니라 wholesale).
const WHOLESALE_PAGE_PREFIXES = ['/wholesale', '/supplier']
const WHOLESALE_ADMIN_PAGES = new Set([
  '/admin/suppliers',
  '/admin/distributor-grades',
  '/admin/wholesale-orders',
  '/admin/wholesale-guide',
])

function isWholesalePage(p) {
  if (WHOLESALE_PAGE_PREFIXES.some(pre => p === pre || p.startsWith(pre + '/'))) return true
  if (WHOLESALE_ADMIN_PAGES.has(p)) return true
  return false
}

function classifyRoute(p) {
  if (isWholesalePage(p)) return 'wholesale'
  if (p.startsWith('/admin')) return 'admin'
  if (p.startsWith('/seller')) return 'seller'
  if (p.startsWith('/agency')) return 'agency'
  return null
}

// ─────────────────────────────────────────────────────────────
// 2. API 엔드포인트 추출 (.get/.post/.put/.delete/.patch)
// ─────────────────────────────────────────────────────────────

function findRouteFiles() {
  const dirs = [
    'src/features/auth/api',
    'src/features/seller/api',
    'src/features/admin/api',
    'src/features/agency/api',
    'src/features/youtube/api',
    'src/features/donations/api',
    'src/features/restaurant-map/api',
    'src/features/alimtalk/api',
    // 🏭 2026-06-07: 도매몰(유통스타트 B2B) — 제조사/유통사/공급 API.
    'src/features/supply/api',
    'src/worker/routes',
  ]
  const files = []
  for (const d of dirs) {
    const full = path.join(ROOT, d)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) {
        files.push(path.join(full, name))
      }
    }
  }
  return files
}

function extractEndpoints(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const endpoints = []
  // matches: app.get('/foo' or routerName.post('/foo'
  const re = /\b(\w+)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    endpoints.push({ method: m[2].toUpperCase(), path: m[3], file: path.relative(ROOT, file) })
  }
  return endpoints
}

// ─────────────────────────────────────────────────────────────
// 3. worker/index.ts 마운트 prefix 매핑
// ─────────────────────────────────────────────────────────────

function extractMountedPrefixes() {
  const file = path.join(ROOT, 'src/worker/index.ts')
  if (!fs.existsSync(file)) return {}
  const src = fs.readFileSync(file, 'utf-8')
  // 1단계: 직접 마운트 (app.route, adminApp.route, agencyApp.route)
  // app.route('/api/seller/youtube', youtubeRoutes);
  // adminApp.route('/agencies', adminAgencyRoutes);
  const directMap = {}
  const directRe = /(\w+)\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g
  let m
  while ((m = directRe.exec(src)) !== null) {
    const [, mountApp, mountPath, routerName] = m
    if (!directMap[routerName]) directMap[routerName] = []
    directMap[routerName].push({ mountApp, mountPath })
  }

  // 2단계: 서브앱(adminApp, agencyApp)이 부모(app) 어디에 마운트됐는지 찾기
  // app.route('/api/admin', adminApp);
  const subAppPrefix = {} // adminApp -> '/api/admin'
  for (const [routerName, mounts] of Object.entries(directMap)) {
    for (const { mountApp, mountPath } of mounts) {
      if (mountApp === 'app' && /^\w+App$/.test(routerName)) {
        subAppPrefix[routerName] = mountPath
      }
    }
  }

  // 3단계: 최종 prefix 계산 (서브앱 마운트 prefix + 자체 마운트 path)
  const map = {}
  for (const [routerName, mounts] of Object.entries(directMap)) {
    if (!map[routerName]) map[routerName] = []
    for (const { mountApp, mountPath } of mounts) {
      const parentPrefix = mountApp === 'app' ? '' : (subAppPrefix[mountApp] || '')
      const finalPrefix = (parentPrefix + mountPath).replace(/\/+/g, '/').replace(/\/$/, '') || '/'
      map[routerName].push(finalPrefix)
    }
  }
  return map
}

function extractRouterNames(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const names = []
  // export const fooRoutes = new Hono...
  const re1 = /export\s+const\s+(\w+)\s*=\s*new\s+Hono/g
  let m
  while ((m = re1.exec(src)) !== null) names.push(m[1])
  // export { app as fooRoutes } 또는 export { localName as fooRoutes }
  const re2 = /export\s*\{\s*(\w+)\s+as\s+(\w+)\s*\}/g
  while ((m = re2.exec(src)) !== null) names.push(m[2])
  // export default app — 파일명에서 router 이름 추정 (e.g. youtube.routes.ts → 'default')
  if (/export\s+default\s+\w+/.test(src)) {
    names.push('__default__')
  }
  return [...new Set(names)]
}

// ─────────────────────────────────────────────────────────────
// 4. 엔드포인트를 역할별로 분류
// ─────────────────────────────────────────────────────────────

// 🏭 2026-06-07: 도매몰 엔드포인트 분류. admin/seller 보다 먼저 검사(가로채기).
//   - /api/supplier·/api/wholesale·/api/supply (제조사/유통사/공급 라우터)
//   - /api/admin/suppliers·/api/admin/distributor (도매 어드민)
//   - /api/admin/supplier-products (admin-products.routes.ts 의 공급자 상품 검수)
function isWholesaleEndpoint(fullPath) {
  return (
    fullPath.startsWith('/api/supplier') ||
    fullPath.startsWith('/api/wholesale') ||
    fullPath.startsWith('/api/supply') ||
    fullPath.startsWith('/api/admin/suppliers') ||
    fullPath.startsWith('/api/admin/distributor') ||
    fullPath.startsWith('/api/admin/supplier-products')
  )
}

function classifyEndpoint(fullPath) {
  if (isWholesaleEndpoint(fullPath)) return 'wholesale'
  if (fullPath.startsWith('/api/admin')) return 'admin'
  if (fullPath.startsWith('/api/seller')) return 'seller'
  if (fullPath.startsWith('/api/agency')) return 'agency'
  return null
}

// ─────────────────────────────────────────────────────────────
// 5. 메인
// ─────────────────────────────────────────────────────────────

function main() {
  const routes = extractRoutes()
  const routeFiles = findRouteFiles()
  const mounted = extractMountedPrefixes()

  // file → router name(s) → mount prefix
  const allEndpoints = []
  for (const f of routeFiles) {
    const names = extractRouterNames(f)
    const eps = extractEndpoints(f)

    // Find mount prefix for this file's router(s)
    let prefixes = []
    for (const n of names) {
      if (mounted[n]) prefixes.push(...mounted[n])
    }
    // Default to relative path if no explicit mount
    if (prefixes.length === 0) prefixes = ['']

    for (const ep of eps) {
      // skip CORS/middleware-like /* paths and empty
      if (ep.path === '/*' || ep.path === '*') continue
      for (const pref of prefixes) {
        const full = (pref + ep.path).replace(/\/+/g, '/')
        allEndpoints.push({ ...ep, fullPath: full })
      }
    }
  }

  // De-dupe
  const seen = new Set()
  const uniqueEndpoints = allEndpoints.filter(e => {
    const k = `${e.method} ${e.fullPath}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Bucket by role
  const buckets = { admin: { pages: [], endpoints: [] }, seller: { pages: [], endpoints: [] }, agency: { pages: [], endpoints: [] }, wholesale: { pages: [], endpoints: [] } }
  const ROLES = ['admin', 'seller', 'agency', 'wholesale']
  for (const r of routes) {
    const role = classifyRoute(r)
    if (role) buckets[role].pages.push(r)
  }
  for (const e of uniqueEndpoints) {
    const role = classifyEndpoint(e.fullPath)
    if (role) buckets[role].endpoints.push(e)
  }

  // Sort
  for (const role of ROLES) {
    buckets[role].pages = [...new Set(buckets[role].pages)].sort()
    buckets[role].endpoints = buckets[role].endpoints.sort((a, b) =>
      a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method))
  }

  // Generate markdown content per role
  const sections = {}
  for (const role of ROLES) {
    const b = buckets[role]
    let md = `### 자동 생성 — 페이지 (${b.pages.length}개)\n`
    md += b.pages.map(p => `- \`${p}\``).join('\n')
    md += `\n\n### 자동 생성 — API 엔드포인트 (${b.endpoints.length}개)\n`
    if (b.endpoints.length === 0) {
      md += '(없음)\n'
    } else {
      // Group by base path (first 3 segments)
      const groups = {}
      for (const e of b.endpoints) {
        const parts = e.fullPath.split('/').filter(Boolean)
        const key = '/' + parts.slice(0, 3).join('/')
        if (!groups[key]) groups[key] = []
        groups[key].push(e)
      }
      for (const [key, eps] of Object.entries(groups).sort()) {
        md += `\n**${key}**\n`
        for (const e of eps) {
          md += `- \`${e.method} ${e.fullPath}\`\n`
        }
      }
    }
    md += `\n> 🤖 이 섹션은 \`scripts/generate-guide-references.mjs\` 가 자동 생성합니다. 수동 편집 금지.\n`
    md += `> 마지막 생성: ${new Date().toISOString()}\n`
    sections[role] = md
  }

  // Write auto-reference.ts
  const banner = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
 *
 * Generated by: scripts/generate-guide-references.mjs
 * Generated at: ${new Date().toISOString()}
 *
 * 이 파일은 페이지 라우트와 API 엔드포인트를 코드에서 추출해서
 * 각 역할(admin/seller/agency) 가이드의 "참조" 섹션을 자동 채웁니다.
 *
 * 변경 방법: 코드를 수정하고 \`npm run generate:guide-refs\` 실행.
 */
`
  const ts = banner + `
export const AUTO_REFERENCE = {
  admin: ${JSON.stringify(sections.admin)},
  seller: ${JSON.stringify(sections.seller)},
  agency: ${JSON.stringify(sections.agency)},
  wholesale: ${JSON.stringify(sections.wholesale)},
} as const
`
  fs.writeFileSync(OUT_FILE, ts)
  console.log(`✅ Generated ${path.relative(ROOT, OUT_FILE)}`)
  console.log(`   admin:     ${buckets.admin.pages.length} pages, ${buckets.admin.endpoints.length} endpoints`)
  console.log(`   seller:    ${buckets.seller.pages.length} pages, ${buckets.seller.endpoints.length} endpoints`)
  console.log(`   agency:    ${buckets.agency.pages.length} pages, ${buckets.agency.endpoints.length} endpoints`)
  console.log(`   wholesale: ${buckets.wholesale.pages.length} pages, ${buckets.wholesale.endpoints.length} endpoints`)
}

main()
