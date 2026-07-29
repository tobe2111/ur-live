#!/usr/bin/env node
/**
 * 🛡️ 2026-07-21: KV delete 무료한도(1천/일) 초과 방지 — fan-out KV.delete 가드.
 *
 * 배경(대표 신고 2026-07-21 — Cloudflare "Daily Workers KV delete limit exceeded"):
 *   `cacheGet`(worker/utils/cache.ts)의 L2 KV 쓰기는 2026-06-04 에 무료한도 보호로 OFF
 *   (`L2_KV_ENABLED = false`, 엣지캐시+L1 로 대체). 그런데 삭제 경로 `cacheInvalidate` 는 여전히
 *   `KV.delete` 를 호출 → **KV 에 존재하지도 않는 키를 매 무효화마다 삭제 시도**.
 *   `invalidateGroupBuyProductsCache` 1회 = 28 KV.delete(4 status × 7 category), 셀러/어드민 상품
 *   등록·수정·취소·주문 흐름마다 발생 → 하루 1천 delete 한도를 순수 낭비로 소진(=사고).
 *
 * 이 가드가 지키는 불변식(2가지):
 *   [A] `cacheInvalidate`(worker/utils/cache.ts)의 KV.delete 는 반드시 `L2_KV_ENABLED` 게이트
 *       뒤에 있어야 한다(쓰기 경로와 대칭 — L2 OFF 면 지울 키도 없다). 게이트가 사라지면 위반.
 *   [B] 그 외 어디서도 **fan-out KV.delete**(`arr.map/forEach(... => <kv>.delete(...))`)를
 *       무방비로 추가하지 말 것. fan-out 은 1회 호출에 N delete → 한도 폭식의 근본 클래스.
 *       Cache API(`caches.default`/`cache.delete(new Request(...))`)는 무료·무제한이라 무관 —
 *       수신자 이름에 KV(대/소문자) 가 든 KV 네임스페이스 삭제만 대상.
 *
 * 안전(허용): 단발 KV.delete(상품옵션/OAuth state/관리자 플래그 등 저빈도 — fan-out 아님),
 *   `*_ENABLED` 게이트로 감싼 fan-out, 테스트, `kv-delete-ok` 주석.
 *
 * 사용: node scripts/check-kv-delete-budget.mjs [-s|--strict]
 *   STRICT(-s 또는 STRICT_KV_DELETE=1)면 위반 시 exit 1.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict') || process.env.STRICT_KV_DELETE === '1'

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const violations = []

// ── [A] cacheInvalidate 의 KV.delete 는 L2_KV_ENABLED 게이트 뒤에 있어야 한다 ──────────────
const CACHE_FILE = 'src/worker/utils/cache.ts'
{
  const abs = path.join(ROOT, CACHE_FILE)
  if (fs.existsSync(abs)) {
    const src = fs.readFileSync(abs, 'utf8')
    const fnIdx = src.indexOf('function cacheInvalidate')
    if (fnIdx !== -1) {
      // 함수 본문 경계: cacheInvalidate 시작 ~ 다음 top-level 선언 전까지.
      const rest = src.slice(fnIdx + 'function cacheInvalidate'.length)
      const nextDecl = rest.search(/\n(?:export\s+)?(?:async\s+)?function\b|\nexport\s+function\b|\nexport\s+const\b/)
      const body = nextDecl === -1 ? rest : rest.slice(0, nextDecl)
      // 실행되는 KV.delete 가 있으면(주석/문자열 언급 무관하게 보수적으로) 게이트가 반드시 있어야.
      const hasDelete = /\.delete\s*\(/.test(body)
      // 실제 게이트 구문: `!L2_KV_ENABLED ... return`(설명 주석의 단순 언급엔 이 형태가 없음).
      const hasGate = /!\s*L2_KV_ENABLED[^\n]*return/.test(body)
      if (hasDelete && !hasGate) {
        violations.push({
          file: CACHE_FILE, line: src.slice(0, fnIdx).split('\n').length,
          msg: 'cacheInvalidate 의 KV.delete 가 L2_KV_ENABLED 게이트 없이 실행됨 — 쓰기(cacheGet)가 OFF 인데 삭제만 살아있으면 존재않는 키를 매번 지워 무료한도 폭식(2026-07-21 사고 재발). `if (!KV || !L2_KV_ENABLED) return` 로 감싸세요.',
        })
      }
    }
  }
}

// ── [B] fan-out KV.delete 무방비 추가 금지 ────────────────────────────────────────────────
// 수신자 이름에 KV(대/소문자)가 든 .delete 를 .map/.forEach 콜백 안에서 호출하는 한 줄 패턴.
const FANOUT = /\.(?:map|forEach)\s*\([^\n]*=>[^\n]*\b[A-Za-z_]*[Kk][Vv]\b\.delete\s*\(/
for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f)
  if (/\.test\.|(^|\/)tests\//.test(rel)) continue
  if (rel === CACHE_FILE) continue // [A] 가 전담
  const src = fs.readFileSync(f, 'utf8')
  if (!/\.delete\s*\(/.test(src)) continue
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!FANOUT.test(lines[i])) continue
    // 예외: 같은 줄 또는 위/아래 2줄에 kv-delete-ok 주석, 또는 함수 내 *_ENABLED 게이트
    const ctx = lines.slice(Math.max(0, i - 6), i + 2).join('\n')
    if (/kv-delete-ok/.test(ctx)) continue
    if (/\b\w*_ENABLED\b/.test(ctx) && /return/.test(ctx)) continue
    violations.push({
      file: rel, line: i + 1,
      msg: 'fan-out KV.delete (1회 호출에 N delete) — 무료 delete 한도(1천/일) 초과 위험. 정말 필요하면 `*_ENABLED` 게이트로 감싸거나 `kv-delete-ok` 주석. (Cache API 는 무관하니 KV 대신 caches.default 검토.)',
    })
  }
}

if (!violations.length) {
  console.log('✅ KV delete 무료한도 가드 통과 — fan-out KV.delete 무방비 없음, cacheInvalidate 게이트 유지.')
  process.exit(0)
}
console.log(`\n${STRICT ? '❌' : '⚠️ '} KV delete 한도 위반 ${violations.length}건:`)
for (const v of violations) console.log(`   ${v.file}:${v.line}\n      ${v.msg}`)
console.log('\n   (단발 KV.delete·`*_ENABLED` 게이트·테스트·`kv-delete-ok` 주석은 예외)')
process.exit(STRICT ? 1 : 0)
