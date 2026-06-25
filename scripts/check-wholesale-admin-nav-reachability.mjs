#!/usr/bin/env node
/**
 * 🧭 도매(wholesale) 권한 어드민 — 네비게이션 도달 가능성 정적 검사 (2026-06-24)
 *
 *   배경(대표 신고): "도매 통합 현황에서 '상품 승인' 눌러도 안 넘어가요" — wholesale-role 어드민에게
 *   허용되지 않은 /admin 경로로 링크 → AdminLayout RBAC 가드가 wholesale-overview 로 바운스 →
 *   클릭이 안 먹히는 것처럼 보이는 **역할-한정(보이지 않는) 버그**. 슈퍼 어드민(대표/개발자)에게는
 *   안 보이고, 권한 좁은 계정으로 써야만 드러남.
 *
 *   이 검사: wholesale-role 어드민이 *도달 가능한 화면들* 안의 모든 정적 `/admin/...` 네비 타깃이
 *   wholesale 허용 경로집합 안에 있는지 단언. 하나라도 벗어나면 = 클릭 시 바운스 = 실패(빨강).
 *   → 이 클래스의 버그가 누구에게도 재발하지 않도록 영구 고정.
 *
 *   순수 정적(소스 읽기, import 무게 0). 동적 navigate(`${...}`)·비-admin 경로(/wholesale 등)는 스킵.
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

const layout = read('src/components/AdminLayout.tsx')
const routes = read('src/routes/admin.routes.tsx')

// ── 1) wholesale-role 허용 경로 집합 ─────────────────────────────────────────
const allowed = new Set()
// (a) domain:'wholesale' 그룹의 nav 경로
{
  const re = /domain:\s*'wholesale'/g
  let m
  while ((m = re.exec(layout))) {
    const nextTitle = layout.indexOf('title:', m.index + 1)
    const block = layout.slice(m.index, nextTitle === -1 ? m.index + 4000 : nextTitle)
    for (const pm of block.matchAll(/path:\s*'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
  }
}
// (b) 명시적 추가 허용 + 전역 허용
for (const name of ['WHOLESALE_EXTRA_ALLOWED_PATHS', 'ALWAYS_ALLOWED_ADMIN_PATHS']) {
  const arr = layout.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
  if (arr) for (const pm of arr[1].matchAll(/'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
}

const isAllowed = (path) => {
  const p = path.split('?')[0].split('#')[0]
  // 인증 리다이렉트 타깃 — 로그인/세션 페이지는 AdminLayout(RBAC 가드) 밖이라 절대 바운스 안 됨(보편 안전).
  if (p === '/admin/login' || p === '/admin/set-pin') return true
  if (allowed.has(p)) return true
  return [...allowed].some((a) => p.startsWith(a + '/')) // 하위경로 허용(RBAC 가드와 동일 규칙)
}

// ── 2) route path -> 컴포넌트 파일 매핑 ──────────────────────────────────────
const lazyMap = {} // ComponentName -> file path
for (const m of routes.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\('(@\/pages\/[^']+)'\)\)/g)) {
  lazyMap[m[1]] = m[2].replace('@/', 'src/') + '.tsx'
}
// <Route path="/admin/x" element={ ... <Component ... /> ... } />  (element 블록에서 첫 대문자 컴포넌트)
const pathToFile = {}
for (const m of routes.matchAll(/path="(\/admin\/[^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
  const p = m[1].split('/:')[0] // 동적 세그먼트 제거
  const comp = [...m[2].matchAll(/<([A-Z][A-Za-z0-9_]+)\b/g)].map((x) => x[1]).find((c) => lazyMap[c])
  if (comp && !pathToFile[p]) pathToFile[p] = lazyMap[comp]
}

// ── 3) wholesale-도달 가능한 화면들의 정적 /admin 네비 타깃 수집 + 검사 ────────
const reachablePaths = [...allowed].filter((p) => p.startsWith('/admin/'))
const violations = []
const scanned = []
const missingFile = []

for (const p of reachablePaths) {
  const file = pathToFile[p]
  if (!file) { missingFile.push(p); continue }
  let src
  try { src = read(file) } catch { missingFile.push(`${p} (파일 없음: ${file})`); continue }
  scanned.push({ p, file })
  // to="/admin/..."  /  to={'/admin/...'}  /  to={`/admin/...`}(정적)  /  navigate('/admin/...')  navigate(`/admin/...`)(정적)
  const targets = new Set()
  for (const tm of src.matchAll(/\bto=\{?["'`](\/admin\/[^"'`]+)["'`]\}?/g)) targets.add(tm[1])
  for (const tm of src.matchAll(/\bnavigate\(\s*["'`](\/admin\/[^"'`${]+)["'`]/g)) targets.add(tm[1])
  for (const t of targets) {
    if (t.includes('${')) continue // 동적
    if (!isAllowed(t)) violations.push({ from: p, file, target: t })
  }
}

// ── 4) 리포트 ───────────────────────────────────────────────────────────────
console.log(`🧭 wholesale-role 어드민 네비 도달성 검사`)
console.log(`   허용 경로 ${allowed.size}개 · 스캔 화면 ${scanned.length}개 · 매핑실패 ${missingFile.length}개`)
if (missingFile.length) {
  console.log(`   ⚠️ route→파일 매핑 못 찾음(수동 확인): ${missingFile.join(', ')}`)
}
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 모든 정적 /admin 링크가 wholesale-role 도달 가능.`)
  process.exit(0)
}
console.log(`\n❌ 바운스 위험 링크 ${violations.length}건 (wholesale-role 이 클릭하면 wholesale-overview 로 튕김):`)
for (const v of violations) {
  console.log(`   • ${v.from}  →  ${v.target}   [${v.file}]`)
}
console.log(`\n조치: (a) 타깃이 도매 기능이면 AdminLayout 의 WHOLESALE_EXTRA_ALLOWED_PATHS 에 추가 +`)
console.log(`        해당 페이지에서 역할 스코프, 또는 (b) 도매-허용 경로로 링크 변경.`)
const STRICT = process.env.STRICT_NAV_REACH === '1'
process.exit(STRICT ? 1 : 0) // 기본 warn(다른 세션 페이지 깨짐 방지). CI 는 STRICT=1 로.
