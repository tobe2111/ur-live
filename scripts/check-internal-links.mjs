#!/usr/bin/env node
/**
 * 🔗 내부 링크 도달성 정적 검사 (2026-06-24) — "죽은 링크" 출시 차단.
 *
 *   대표 요청("애초에 없도록, 가장 이상적으로 / 다른 사람이 썼을 때도"): 클릭해도 아무 일 없거나
 *   NotFound 로 떨어지는 링크를 **빌드 때 전부** 잡는다. 모든 역할·모든 화면 공통 — 사람 QA 불필요.
 *
 *   방식(순수 정적): 모든 라우트 정의(App + routes/*)를 매처로 만들고, 모든 .tsx 의 내부 네비 타깃
 *   (`to=` / `navigate(` / `<Navigate>` / `<a href>`)이 *구체적인* 라우트와 매칭되는지 단언.
 *   catch-all `path="*"`(NotFound)은 매처에서 제외 — 그래야 "NotFound 로만 떨어지는" 링크가 드러남.
 *
 *   동적 세그먼트 처리: 라우트 `:param`/`*` = 와일드카드. 링크의 `${...}` 세그먼트도 와일드카드로 봐서
 *   `/wholesale/product/${id}` 는 `/wholesale/product/:id` 와 매칭(정적 오타는 잡고, 동적 값은 통과).
 *
 *   제외: 서버 경로(/api /auth /oauth /sync /cdn-cgi /__), 외부(http, //, mailto, tel),
 *   해시-only(#...), 정적파일(.pdf/.png/...), 순수 변수 navigate(변수) — 해석 불가.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROUTE_FILES = [
  'src/App.tsx',
  'src/routes/admin.routes.tsx',
  'src/routes/seller.routes.tsx',
  'src/routes/agency.routes.tsx',
  'src/routes/supplier.routes.tsx',
]
// react-router 가 아니라 워커(서버)가 처리하는 prefix — 풀페이지 네비라 라우트 매칭 대상 아님.
const SERVER_PREFIXES = ['/api/', '/auth/', '/oauth/', '/sync/', '/cdn-cgi/', '/__', '/.well-known/']
const FILE_EXT_RE = /\.(pdf|png|jpe?g|gif|svg|ico|webp|xml|txt|json|csv|xlsx?|zip|mp4|webm|woff2?)$/i

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

// ── 1) 라우트 매처 수집 ──────────────────────────────────────────────────────
/** 라우트 path 문자열 → 세그먼트 배열(앞 '/' 제거). catch-all/relative 는 별도 처리. */
const routePatterns = [] // { segs: string[], hasCatchAll: bool, raw }
let catchAllSeen = false
for (const rf of ROUTE_FILES) {
  let src
  try { src = read(rf) } catch { continue }
  for (const m of src.matchAll(/\bpath=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim()
    if (!raw) continue
    if (raw === '*' || raw === '/*') { catchAllSeen = true; continue } // NotFound — 매처 제외
    if (!raw.startsWith('/')) continue // 상대/중첩 경로는 이 검사 범위 밖(이 앱은 절대경로 사용)
    const segs = raw.replace(/^\//, '').split('/').filter(Boolean)
    routePatterns.push({ segs, hasCatchAll: segs[segs.length - 1] === '*', raw })
  }
}

/** target 세그먼트 배열이 어떤 라우트와 매칭되는가. dyn 세그(`*DYN*`)는 와일드카드. */
function matchesRoute(targetSegs) {
  for (const r of routePatterns) {
    if (r.hasCatchAll) {
      // 라우트가 .../* → 접두 세그먼트만 일치하면 OK
      const head = r.segs.slice(0, -1)
      if (targetSegs.length < head.length) continue
      let ok = true
      for (let i = 0; i < head.length; i++) if (!segMatch(head[i], targetSegs[i])) { ok = false; break }
      if (ok) return true
      continue
    }
    if (r.segs.length !== targetSegs.length) continue
    let ok = true
    for (let i = 0; i < r.segs.length; i++) if (!segMatch(r.segs[i], targetSegs[i])) { ok = false; break }
    if (ok) return true
  }
  return false
}
/** 라우트 세그 rs 와 타깃 세그 ts 매칭. rs 가 :param/* → 와일드카드. ts 가 *DYN*(${}) → 와일드카드. */
function segMatch(rs, ts) {
  if (ts === '*DYN*') return true
  if (rs.startsWith(':') || rs === '*') return true
  return rs === ts
}

// ── 2) 모든 .tsx 의 내부 네비 타깃 수집 ──────────────────────────────────────
function walk(dir, acc = []) {
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const rel = join(dir, name)
    const st = statSync(resolve(ROOT, rel))
    if (st.isDirectory()) { if (name !== 'node_modules') walk(rel, acc) }
    else if (name.endsWith('.tsx')) acc.push(rel)
  }
  return acc
}

/** 원시 타깃 문자열 → 검사용 세그먼트(쿼리/해시 제거, ${} → *DYN*). 검사 제외면 null. */
function normalizeTarget(raw) {
  let t = raw.replace(/\$\{[^}]*\}/g, '*DYN*') // 동적 보간 → 와일드카드 세그
  t = t.split('?')[0].split('#')[0]
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (t === '/') return null // 루트는 항상 존재
  if (SERVER_PREFIXES.some((p) => t.startsWith(p))) return null
  if (FILE_EXT_RE.test(t)) return null
  const segs = t.replace(/^\//, '').split('/').filter(Boolean)
  if (segs.length === 0) return null
  return segs
}

const TARGET_RES = [
  /\bto=(?:"([^"]+)"|'([^']+)'|\{"([^"]+)"\}|\{'([^']+)'\}|\{`([^`]+)`\})/g, // <Link to> / <Navigate to>
  /\bnavigate\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g,                         // navigate('...')
  /\bhref=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\})/g,                              // <a href="/...">
]

const files = walk('src')
const dead = []
let targetCount = 0
for (const f of files) {
  const src = read(f)
  const lines = src.split('\n')
  for (const re of TARGET_RES) {
    for (const m of src.matchAll(re)) {
      const raw = m.slice(1).find((x) => x != null)
      if (raw == null) continue
      const segs = normalizeTarget(raw)
      if (!segs) continue
      targetCount++
      if (!matchesRoute(segs)) {
        // 라인 번호 계산
        const upto = src.slice(0, m.index)
        const line = upto.split('\n').length
        dead.push({ file: f, line, target: raw })
      }
    }
  }
}

// ── 3) 리포트 ───────────────────────────────────────────────────────────────
console.log(`🔗 내부 링크 도달성 검사`)
console.log(`   라우트 매처 ${routePatterns.length}개(catch-all 제외${catchAllSeen ? ', NotFound 있음' : ''}) · 스캔 .tsx ${files.length}개 · 검사 타깃 ${targetCount}개`)
if (dead.length === 0) {
  console.log(`✅ 죽은 링크 0 — 모든 내부 링크가 실재 라우트로 연결됨.`)
  process.exit(0)
}
// 중복 타깃 묶기
const byTarget = new Map()
for (const d of dead) {
  if (!byTarget.has(d.target)) byTarget.set(d.target, [])
  byTarget.get(d.target).push(`${d.file}:${d.line}`)
}
console.log(`\n❌ 정의된 라우트와 매칭 안 되는 내부 링크 ${byTarget.size}종 (${dead.length}곳) — 클릭 시 NotFound:`)
for (const [target, locs] of [...byTarget.entries()].sort()) {
  console.log(`   • ${target}`)
  for (const l of locs.slice(0, 4)) console.log(`        ${l}`)
  if (locs.length > 4) console.log(`        … 외 ${locs.length - 4}곳`)
}
console.log(`\n조치: (a) 오타면 링크 수정, (b) 라우트 누락이면 추가, (c) 서버/외부면 위 제외목록 확인.`)
const STRICT = process.env.STRICT_LINKS === '1'
process.exit(STRICT ? 1 : 0)
