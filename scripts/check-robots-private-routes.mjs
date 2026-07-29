#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: robots.txt 와 실제 라우트의 정합.
 *
 * ## 왜
 *
 * 실측: `ProtectedRoute` 로 보호되는 경로 **71개가 robots.txt 에 안 막혀 있었다**(셀러 대시보드만 ~40개).
 * `/admin`·`/supplier` 는 전면 차단인데 셀러/에이전시는 `login`·`register` 두 개만 막혀 있었다 —
 * 규칙이 ad hoc 으로 자라면서 생긴 구멍이다. 크롤러는 로그인 벽/빈 SPA 를 받아 **soft-404** 로 집계하고,
 * 그만큼 크롤 예산이 실제 상품 페이지에서 빠진다. 에러가 없으니 아무도 모른다.
 *
 * ## 무엇을 보는가
 *
 *   R1  비공개(ProtectedRoute) 경로는 **막혀 있을 것**
 *
 * ⚠️ 반대 방향("공개인데 막힘")은 **여기서 보지 않는다.** 처음엔 `ProtectedRoute 없음 + <SEO> 보유`
 *   를 "공개 색인 대상" 신호로 R2 를 넣었는데 **틀렸다** — `<SEO>` 는 브라우저 탭 제목용으로도 쓰여서,
 *   `/wholesale/checkout`·`/agency/forgot-password`·`/search` 처럼 **원래부터 의도적으로 막아온**
 *   비공개 페이지 19건이 전부 위반으로 잡혔다. 색인 의도의 진짜 신호는 **사이트맵 등재**이고,
 *   그 모순(사이트맵에 있는데 robots 가 막음)은 `check-sitemap-routes.mjs` 가 이미 검사한다.
 *
 * 다만 일괄 차단이 공개 페이지를 조용히 deindex 할 위험은 실재한다 — 이번에 그럴 뻔했다:
 *   · `/seller/` prefix → `/seller/plus-friend-guide`(공개 가이드, `<SEO>` 보유)
 *   · `/influencer/` prefix → `/influencer/rankings`(공개 랭킹)
 *   · `/creator` 를 넣었다면 → 공개 모집 `/creators`·`/creators/apply`(사이트맵 등재)
 *   · `/u/me` 를 앵커 없이 넣었다면 → `/u/melon` 같은 **실제 링크샵 핸들** 전부
 *   앞의 둘은 `Allow:` 예외로 살렸고, 뒤의 둘은 규칙 자체를 바꿨다(제외 / `$` 앵커).
 *
 * ## 한계
 *
 *   - robots 매칭을 **prefix + `$` 앵커 + 최장일치 Allow 우선**으로만 근사한다(Google 스펙의 부분집합).
 *     `*` 와일드카드가 중간에 오는 규칙은 정확히 평가하지 못한다 — 현재 이 파일엔 없다.
 *   - "공개인가"의 판정은 `ProtectedRoute` 문자열 유무다. 레이아웃(`SellerLayout` 등)으로만 보호되는
 *     경로는 R1 대상이 아니다(그쪽은 이미 prefix 로 덮여 있다).
 *
 * 기본 warn-only(exit 0). 차단: STRICT_ROBOTS=1 또는 `-s`.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_ROBOTS === '1' || process.argv.includes('-s')
const ROBOTS = 'public/robots.txt'

if (!existsSync(ROBOTS)) {
  console.error(`❌ [robots-routes] ${ROBOTS} 없음 — 스캔 대상 부재는 통과가 아니다.`)
  process.exit(1)
}

/** 의도적으로 막지 않는 비공개 경로 — 이유를 반드시 함께 적을 것. */
const ALLOWED_GAPS = new Set([
  // `/creator` 를 Disallow 하면 prefix 매칭이 공개 모집 페이지 `/creators`·`/creators/apply`
  // (사이트맵 등재, "동의 리드 확보의 유일한 정문")까지 함께 막는다. 크롤 낭비보다 그 손실이 크다.
  '/creator',
])

const routeFiles = ['src/App.tsx', ...readdirSync('src/routes').filter((f) => f.endsWith('.tsx')).map((f) => join('src/routes', f))]
  .filter(existsSync)

const routes = []
for (const f of routeFiles) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"([^>]*)/g)) {
    routes.push({ path: m[1], attrs: m[2] || '', file: f })
  }
}
if (routes.length === 0) {
  console.error('❌ [robots-routes] 라우트를 한 건도 못 찾았다 — 스캔이 깨졌다(통과 아님).')
  process.exit(1)
}

const robots = readFileSync(ROBOTS, 'utf8')
const disallow = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1])
const allow = [...robots.matchAll(/^Allow:\s*(\S+)/gm)].map((m) => m[1]).filter((r) => r !== '/')

const matches = (path, rule) => (rule.endsWith('$') ? path === rule.slice(0, -1) : path.startsWith(rule.replace(/\*$/, '')))
/** 최장일치 우선 — Google 스펙과 동일하게 더 구체적인 규칙이 이긴다. */
function isBlocked(path) {
  const d = disallow.filter((r) => matches(path, r)).sort((a, b) => b.length - a.length)[0]
  if (!d) return null
  const a = allow.filter((r) => matches(path, r)).sort((a, b) => b.length - a.length)[0]
  return a && a.length >= d.length ? null : d
}

const unblockedPrivate = []
for (const r of routes) {
  if (r.path.includes(':') || r.path === '*') continue        // 동적/catch-all 제외
  if (!r.attrs.includes('ProtectedRoute')) continue
  if (ALLOWED_GAPS.has(r.path)) continue
  if (!isBlocked(r.path)) unblockedPrivate.push(r.path)
}

let bad = 0
if (unblockedPrivate.length) {
  bad += unblockedPrivate.length
  console.error(`\n❌ [robots-routes] R1 — 로그인 필요한데 크롤에 열린 경로 ${unblockedPrivate.length}건:`)
  for (const p of unblockedPrivate) console.error(`   ${p}`)
  console.error(`   → robots.txt 에 Disallow 를 추가하세요(크롤러가 로그인 벽을 받아 soft-404 로 집계됩니다).`)
}

if (bad) {
  console.error(`\nrobots ↔ 라우트 불일치 ${bad}건.`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`✅ robots-routes: 라우트 ${routes.length}건 — ProtectedRoute 경로 전부 robots 차단됨.`)
