#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: sitemap 이 **존재하지 않는 URL** 을 검색엔진에 제출하는 것을 차단한다.
 *
 * ## 왜 (네 번째 재발이라 가드로 박는다)
 *
 * sitemap 은 "이 URL 들을 색인해 달라"는 선언이다. 그런데 라우트가 사라져도 sitemap 은 남는다.
 * 죽은 URL 을 제출하면 크롤 예산이 낭비되고 **사이트맵 신뢰도가 깎인다**(서치어드바이저/서치콘솔이
 * 수집 오류로 집계). 에러가 안 나므로 아무도 모른다.
 *
 *   · 2026-07-28  `/search` — robots.txt 가 Disallow 하는데 sitemap 이 제출(상호 모순)
 *   · 2026-07-29  `/group-buy` — 실제로는 `<Navigate to="/" replace/>` 인데 **priority 0.95·hourly**
 *   · 2026-07-29  `/vouchers?category=cafe|convenience|restaurant|beauty|department|mobile`
 *                 — 필터는 **한글 표시 카테고리**로 도는데 영문 슬러그를 제출 → 6개 전부 0건(soft-404)
 *   · 2026-07-29  `/live/{id}` ×100 — 라이브커머스 영구중단으로 **라우트 자체가 없는데** hourly 로 발행.
 *                 같은 파일의 정적 목록엔 "미노출"이라고 적어 놓고 **동적 섹션만 정리에서 빠졌다.**
 *
 * ## 판정
 *
 * `sitemap.routes.ts` 의 정적 `loc:` 리터럴이 ① 실제 라우트와 매칭되고 ② 리다이렉트 전용이 아니며
 * ③ robots.txt 의 Disallow 와 모순되지 않을 것.
 *
 * ## 한계
 *
 *   - **동적 URL(`/products/${id}` 등)은 경로 모양만 검사**한다 — 그 id 가 실재하는지는 런타임 문제다.
 *     (이번에 잡힌 `/live/{id}` 는 *경로 모양 자체*가 라우트에 없어서 걸린 경우다.)
 *   - 도매(`/wholesale/*`)는 호스트 분기로 별도 발행돼 소비자 라우트 표에 없다 → 검사 제외.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_SITEMAP=1 또는 `-s`.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_SITEMAP === '1' || process.argv.includes('-s')
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'

if (!existsSync(SITEMAP)) {
  console.error(`❌ [sitemap-routes] ${SITEMAP} 없음 — 스캔 대상 부재는 통과가 아니다.`)
  process.exit(1)
}

/** 라우트 정의는 App.tsx 에만 있지 않다(실측: `/s/:sellerId` 는 routes/seller.routes.tsx). */
const routeFiles = ['src/App.tsx', ...readdirSync('src/routes').filter((f) => f.endsWith('.tsx')).map((f) => join('src/routes', f))]
  .filter((f) => existsSync(f))

const routes = [] // { path, redirect }
for (const f of routeFiles) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"([^>]*)>?/g)) {
    // ⚠️ "Navigate 를 포함하면 리다이렉트" 로 보면 안 된다 — 홈은
    //   `element={isUtongstart() ? <Navigate to="/wholesale"/> : <HomeRoute/>}` 처럼
    //   **조건부 분기**라 urdeal.kr 에선 정상 렌더된다(첫 구현이 이걸 오탐했다).
    //   `element={` 바로 뒤가 `<Navigate` 인 **무조건 리다이렉트**만 리다이렉트로 센다.
    routes.push({ path: m[1], redirect: /element=\{\s*<Navigate\b/.test(m[2] || '') })
  }
}
if (routes.length === 0) {
  console.error('❌ [sitemap-routes] 라우트를 한 건도 못 찾았다 — 스캔이 깨졌다(통과 아님).')
  process.exit(1)
}

/** `/a/:id` 형태를 정규식으로. */
const toRe = (p) => new RegExp('^' + p.replace(/:[A-Za-z0-9_]+/g, '[^/]+').replace(/\*/g, '.*') + '$')
/**
 * ⚠️ catch-all(`*` · `/*` = NotFound 핸들러)은 **매칭 대상에서 제외**한다.
 *   포함하면 모든 경로가 "라우트 있음"으로 통과해 이 검사가 통째로 무의미해진다 —
 *   첫 구현이 실제로 그랬고, 죽은 `/live/1` 을 주입했는데 초록불이 떴다.
 *   catch-all 에만 걸린다는 건 **그 URL 이 404 페이지로 간다**는 뜻이므로 오히려 위반이다.
 */
// 🏬 2026-08-01 `/:mallSlug`(운영자 몰, catch-all 직전) 도 **제외**한다.
//   `*` 는 아니지만 **1-세그먼트 URL 을 전부 매치**하므로, 포함하면 죽은 1-세그먼트 URL
//   (예: 삭제된 `/group-buy`)이 "라우트 있음"으로 통과해 이 검사가 무의미해진다.
//   — 위 catch-all 제외와 정확히 같은 논리다. 몰 URL 은 사이트맵에 넣지 않는다(운영자별 링크 배포).
const NEAR_CATCH_ALL = new Set(['*', '/*', '/:mallSlug'])
const realRoutes = routes.filter((r) => !NEAR_CATCH_ALL.has(r.path))
const matchRoute = (path) => realRoutes.find((r) => toRe(r.path).test(path))

const sitemap = readFileSync(SITEMAP, 'utf8')
// 주석 제거 — 설명 문장 안의 예시 URL 을 제출로 오인하지 않도록.
const code = sitemap.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

const robots = existsSync('public/robots.txt') ? readFileSync('public/robots.txt', 'utf8') : ''
const disallow = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1].replace(/\*$/, ''))

const violations = []
let checked = 0
for (const m of code.matchAll(/loc:\s*[`'"]([^`'"]+)[`'"]/g)) {
  const raw = m[1]
  if (raw.startsWith('/wholesale')) continue        // 호스트 분기 — 소비자 라우트 표 밖
  // 템플릿 보간은 경로 모양만 남기고 세그먼트로 치환
  const path = raw.replace(/\$\{[^}]*\}/g, 'X').split('?')[0]
  checked++
  const hit = matchRoute(path)
  if (!hit) {
    violations.push(`라우트 없음: ${raw}`)
  } else if (hit.redirect) {
    violations.push(`리다이렉트 전용 URL 제출: ${raw} (라우트 ${hit.path} 가 <Navigate>)`)
  }
  const blocked = disallow.find((d) => d && path.startsWith(d))
  if (blocked) violations.push(`robots.txt Disallow 와 모순: ${raw} (Disallow: ${blocked})`)
}

if (checked === 0) {
  console.error('❌ [sitemap-routes] loc 항목을 한 건도 못 찾았다 — 형식이 바뀌었다(통과 아님).')
  process.exit(1)
}

if (violations.length) {
  console.error(`❌ [sitemap-routes] 죽은/모순 sitemap URL ${violations.length}건:`)
  for (const v of violations) console.error(`   ${v}`)
  console.error(`\n   → 죽은 URL 제출은 크롤 예산 낭비 + 사이트맵 신뢰도 하락입니다(에러가 안 나서 안 보입니다).`)
  process.exit(STRICT ? 1 : 0)
}

console.log(`✅ sitemap-routes: loc ${checked}건 — 전부 실재 라우트 + robots 모순 없음.`)
