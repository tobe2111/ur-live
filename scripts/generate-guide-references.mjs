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
  const appFile = path.join(ROOT, 'src/App.tsx')
  const src = fs.readFileSync(appFile, 'utf-8')
  // <Route path="..." element={...} />
  const routes = []
  const routeRe = /<Route\s+path=["']([^"']+)["']/g
  let m
  while ((m = routeRe.exec(src)) !== null) {
    routes.push(m[1])
  }
  return routes
}

function classifyRoute(p) {
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

function classifyEndpoint(fullPath) {
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
  const buckets = { admin: { pages: [], endpoints: [] }, seller: { pages: [], endpoints: [] }, agency: { pages: [], endpoints: [] } }
  for (const r of routes) {
    const role = classifyRoute(r)
    if (role) buckets[role].pages.push(r)
  }
  for (const e of uniqueEndpoints) {
    const role = classifyEndpoint(e.fullPath)
    if (role) buckets[role].endpoints.push(e)
  }

  // Sort
  for (const role of ['admin', 'seller', 'agency']) {
    buckets[role].pages = [...new Set(buckets[role].pages)].sort()
    buckets[role].endpoints = buckets[role].endpoints.sort((a, b) =>
      a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method))
  }

  // Generate markdown content per role
  const sections = {}
  for (const role of ['admin', 'seller', 'agency']) {
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
} as const
`
  fs.writeFileSync(OUT_FILE, ts)
  console.log(`✅ Generated ${path.relative(ROOT, OUT_FILE)}`)
  console.log(`   admin:  ${buckets.admin.pages.length} pages, ${buckets.admin.endpoints.length} endpoints`)
  console.log(`   seller: ${buckets.seller.pages.length} pages, ${buckets.seller.endpoints.length} endpoints`)
  console.log(`   agency: ${buckets.agency.pages.length} pages, ${buckets.agency.endpoints.length} endpoints`)
}

main()
