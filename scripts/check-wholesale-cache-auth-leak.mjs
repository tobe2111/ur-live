#!/usr/bin/env node
/**
 * 🛡️ 도매 카탈로그 엣지-캐시 인증 누수 가드 (2026-06-29) — "로그인했는데 공급가 미설정" 영구차단.
 *
 *   배경(대표 신고): /wholesale/product/:id 가 간헐적으로 "공급가 미설정". 원인 — 상세/목록의 *비로그인*
 *   응답이 `CDN-Cache-Control: public` 으로 엣지(CDN)에 캐시되는데 Cloudflare 기본 캐시 키가 Authorization 을
 *   구분 안 함 → 비로그인 'distributor_price=null' 응답이 로그인 판매사에게 서빙됨(목록은 등급 캐시키라
 *   증상 덜함). 캐시 TTL 따라 됐다 안 됐다 = 불안정.
 *
 *   불변식: 인증별로 내용이 다른(가격/등급) 응답에 *공유* CDN 캐시(`CDN-Cache-Control: public`)를 거는 핸들러는,
 *   엣지 캐시 키가 인증별로 분리됨을 명시해야 한다. 분리 방법(클라가 URL 에 v=in 부착 / 서버가 등급 캐시키 사용
 *   등)을 핸들러에 `cache-auth-ok: <이유>` 주석으로 문서화 → 분리 없이 public+auth-varying 면 누수.
 *
 *   탐지: supply 라우트 핸들러 블록에서 (CDN-Cache-Control 에 public) AND (requires_login | distributor_price)
 *   동시 + `cache-auth-ok` 마커 없음 → 위반. 가격 없는 응답(브랜드 목록 등)은 distributor_price/requires_login
 *   미포함이라 자연 제외.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = 'src/features/supply/api'

const files = existsSync(resolve(ROOT, API_DIR))
  ? readdirSync(resolve(ROOT, API_DIR)).filter((f) => f.endsWith('.ts')).map((f) => join(API_DIR, f))
  : []

const HANDLER_RE = /\bapp\.(get|post|patch|delete|put)\s*\(/g
const PUBLIC_CDN_RE = /CDN-Cache-Control['"`\s:,]+[^\n]*public/i
const AUTH_VARY_RE = /requires_login|distributor_price/
const MARKER_RE = /cache-auth-ok/

const violations = []
let scannedHandlers = 0
for (const rel of files) {
  const src = readFileSync(resolve(ROOT, rel), 'utf8')
  // 핸들러 시작 위치들 → 각 블록 = 한 시작부터 다음 시작(또는 파일 끝)까지.
  const starts = []
  let m
  while ((m = HANDLER_RE.exec(src)) !== null) starts.push(m.index)
  for (let i = 0; i < starts.length; i++) {
    const block = src.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : src.length)
    scannedHandlers++
    if (!PUBLIC_CDN_RE.test(block)) continue        // 공유 CDN 캐시 안 검 → 무관
    if (!AUTH_VARY_RE.test(block)) continue          // 인증별로 안 다름(가격/로그인 비노출) → 안전
    if (MARKER_RE.test(block)) continue              // 분리 명시됨(문서화) → 통과
    const line = src.slice(0, starts[i]).split('\n').length
    // 핸들러 라벨(경로) 추출 — app.get('/x' …)
    const lbl = (block.match(/app\.\w+\(\s*['"`]([^'"`]+)/) || [])[1] || '?'
    violations.push({ file: rel, line, path: lbl })
  }
}

console.log('🛡️  도매 카탈로그 엣지-캐시 인증 누수 가드')
console.log(`   스캔 ${files.length} 파일 · 핸들러 ${scannedHandlers}개 (supply 라우트)`)
if (violations.length === 0) {
  console.log('✅ 위반 0 — 인증별로 다른 응답에 public CDN 캐시를 거는 핸들러는 모두 캐시키 분리(cache-auth-ok) 문서화됨.')
  process.exit(0)
}
console.log(`\n❌ 인증 누수 위험 ${violations.length}건 (public CDN 캐시 + 인증별 가격/로그인 응답, 캐시키 분리 미문서화):`)
for (const v of violations) {
  console.log(`   • [${v.path}] ${v.file}:${v.line}`)
  console.log(`     → 엣지 캐시 키를 인증별로 분리(클라가 로그인 요청 URL 에 v=in 부착 / 서버 등급 캐시키)하고`)
  console.log(`       핸들러에 \`cache-auth-ok: <분리방법>\` 주석 추가. 분리 없이 public+가격응답이면 비로그인 캐시가 로그인에 누수.`)
}
const STRICT = process.env.STRICT_CACHE_AUTH === '1'
process.exit(STRICT ? 1 : 0)
