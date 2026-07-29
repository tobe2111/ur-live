#!/usr/bin/env node
/**
 * 🌐 2026-07-29: 라이브 계약 검증 — 레포가 "제공한다"고 선언한 URL 이 실제로 살아 있는가.
 *
 * ## 왜 정적 가드로는 부족한가
 *
 * 이 레포에는 URL 목록이 **코드 안에 선언**돼 있다: 예열 대상(`HOT_PATHS`), SSR 전역 워밍
 * 키(`SSR_KV_PATHS`), 색인 요청(`sitemap.xml`), 크롤 정책(`public/robots.txt`). 정적 가드(`check-sitemap-routes`)는
 * **라우트가 존재하는가**만 본다. 그런데 라우트가 있어도 실제로는 죽어 있을 수 있다:
 *
 *   · **번들 분리** — 도매 라우트는 `__INCLUDE_WHOLESALE__` 빌드에만 있다. 소비자 오리진에선 404.
 *   · **기능 중단** — 라이브커머스·쇼츠는 라우트가 통째로 제거됐다.
 *   · **게이트/배포 상태** — 코드에 있어도 그 환경에 안 올라갔을 수 있다.
 *
 * 2026-07-29 실측: `HOT_PATHS` 31개 중 **9개가 404** 였다. 예열은 실패해도 조용히 넘어가므로
 * (`if (res.ok)`) 몇 달간 아무도 몰랐고, 그 낭비가 서브리퀘스트 예산(무료 50/인보케이션, 실측 ≈49)을
 * 갉아 **다른 경로의 예열 실패**로 이어지고 있었다. sitemap 에서도 죽은 URL 3종이 나왔다.
 *
 * 그 12건을 **사람이 손으로** 찾았다. 이 스크립트는 그 작업을 기계가 하게 한다.
 *
 * ## 판정 규칙 (오탐을 줄이는 장치)
 *
 *   · **200 = 통과.**
 *   · **3xx 는 경로가 같으면 통과** — `live.ur-team.com` 은 `urdeal.kr` 로 영구 301 하는
 *     도메인 이전 중이라, 같은 path 로의 리다이렉트는 *정상 계약*이다. 반대로 **경로가 바뀌는
 *     3xx 는 실패** — 이번에 `/group-buy → /`(리다이렉트 전용 라우트를 priority 0.95 로 제출)를
 *     잡아낸 것이 정확히 이 경우다.
 *   · **오리진 전체가 응답 없음 = 스킵**(실패 아님). 이 컨테이너의 에이전트 프록시는
 *     `urdeal.kr`·`utongstart.com` 을 CONNECT 403 으로 막는다 — 그건 URL 이 죽은 게 아니라
 *     환경 문제다. 같은 오리진에서 *일부만* 실패하면 그건 진짜 죽은 URL 이라 잡는다.
 *   · 실패는 **1회 재시도** 후에만 확정한다(일시 5xx/타임아웃 흡수).
 *   · `robots.txt` 는 **응답 본문이 레포 선언을 담고 있는지**까지 본다 — 파일이 200 이어도
 *     내용이 딴 것일 수 있다(아래 checkRobots 주석의 실측 참조).
 *
 * ## 어떻게 쓰나
 *
 *   node scripts/check-live-contracts.mjs                    # 기본 https://live.ur-team.com
 *   BASE_URL=https://urdeal.kr node scripts/check-live-contracts.mjs
 *   node scripts/check-live-contracts.mjs --json             # CI 집계용
 *
 * ⚠️ **PR 게이트가 아니다.** 외부 네트워크에 의존해 간헐 실패가 나므로 PR 을 막으면 안 된다.
 *    `.github/workflows/live-contracts.yml` 에서 **주기 실행 + 수동 실행**으로만 돌린다.
 */
import { readFileSync, existsSync } from 'node:fs'

const BASE = (process.env.BASE_URL || 'https://live.ur-team.com').replace(/\/$/, '')
const WHOLESALE_BASE = (process.env.WHOLESALE_BASE_URL || 'https://utongstart.com').replace(/\/$/, '')
const JSON_OUT = process.argv.includes('--json')
const UA = 'Mozilla/5.0 (compatible; ur-live-contract-check/1.0; +https://urdeal.kr)'
const TIMEOUT_MS = 20_000

/** 코드 안에 선언된 URL 목록을 뽑는다. 주석 줄은 제외 — 설명 속 경로는 계약이 아니다. */
function sourceOf(file) {
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

const between = (src, startRe, endMark) => {
  const m = src.match(startRe)
  if (!m) return ''
  const from = m.index + m[0].length
  const to = src.indexOf(endMark, from)
  return src.slice(from, to === -1 ? undefined : to)
}

const targets = []
const push = (path, source, origin = BASE) => {
  if (!path.startsWith('/')) return
  if (!targets.some((t) => t.path === path && t.origin === origin)) targets.push({ path, source, origin })
}

// ── ① 캐시 예열 대상 + ② SSR 전역 워밍 키 ───────────────────────────────────
const prewarm = sourceOf('src/worker/cron/cache-prewarm.ts')
for (const [re, end, label] of [
  [/HOT_PATHS[^=]*=\s*\[/, '] as const', 'cache-prewarm:HOT_PATHS'],
  [/SSR_KV_PATHS[^=]*=\s*\[/, '\n]', 'cache-prewarm:SSR_KV_PATHS'],
]) {
  const block = between(prewarm, re, end)
  for (const m of block.matchAll(/'(\/api\/[^']*)'/g)) push(m[1], label)
}

// ── ③ 색인 요청(sitemap) ────────────────────────────────────────────────────
//   도매 sitemap 은 utongstart 호스트에서만 발행되고 loc 도 그 도메인이다 → 오리진을 따로 준다.
//   동적 loc(`/group-buy/${id}` 등)은 런타임 값이라 제외하되, `encodeURIComponent('한글')` 처럼
//   **정적으로 확정되는 템플릿**은 풀어서 검사한다 — 이번에 죽어 있던 카테고리 URL 6종이 그 형태였다.
{
  const src = sourceOf('src/worker/routes/sitemap.routes.ts')
  const wholesaleBlock = between(src, /const wholesaleUrls[^=]*=\s*\[/, '\n    ]')
  const resolve = (raw) => {
    const s = raw.replace(/\$\{encodeURIComponent\('([^']*)'\)\}/g, (_, v) => encodeURIComponent(v))
    return s.includes('${') ? null : s
  }
  for (const m of src.matchAll(/loc:\s*(?:`([^`]+)`|'([^']+)')/g)) {
    m[1] = m[1] ?? m[2]
    const path = resolve(m[1])
    if (!path) continue
    const inWholesale = wholesaleBlock.includes(m[0])
    push(path, 'sitemap.xml', inWholesale ? WHOLESALE_BASE : BASE)
  }
}

if (targets.length === 0) {
  console.error('❌ [live-contracts] 선언된 URL 을 하나도 못 찾았다 — 추출이 깨졌다(통과 아님).')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 재시도할 가치가 있는 실패 — 일시 장애 + **중계 구간 throttling**(실측: 동시요청을 올리면 503 이 쏟아진다). */
const RETRYABLE = new Set([0, 429, 500, 502, 503, 504])
const ATTEMPTS = 3

async function probe(t) {
  const url = `${t.origin}${t.path}`
  let last = { status: 0, location: '' }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'manual' })
      clearTimeout(timer)
      last = { status: res.status, location: res.headers.get('location') || '' }
    } catch {
      last = { status: 0, location: '' } // 0 = 네트워크 실패/타임아웃
    }
    if (!RETRYABLE.has(last.status)) return last
    if (attempt < ATTEMPTS) await sleep(2000 * attempt) // 2s → 4s
  }
  return last
}

/** 3xx 는 **경로가 그대로면** 통과(도메인 이전용 영구 301). 경로가 바뀌면 죽은 URL 이다. */
function verdict(t, r) {
  if (r.status === 200) return 'ok'
  if (r.status === 0) return 'unreachable'
  if (r.status >= 300 && r.status < 400 && r.location) {
    try {
      const to = new URL(r.location, `${t.origin}${t.path}`)
      const from = new URL(`${t.origin}${t.path}`)
      if (to.pathname === from.pathname && to.search === from.search) return 'ok-redirect'
    } catch { /* 파싱 실패는 아래 fail 로 */ }
  }
  return 'fail'
}

/**
 * `public/robots.txt` 는 **선언**이고, 크롤러가 실제로 받는 것은 오리진이 주는 응답이다.
 * 그 둘이 갈릴 수 있다 — 2026-07-29 실측: `live.ur-team.com/robots.txt` 는 200 이지만 내용이
 * **Cloudflare Managed robots.txt**(AI 크롤러 차단 목록)로 통째 대체돼 있어, 레포의 규칙 52줄이
 * **하나도 서빙되지 않고** `Sitemap:` 줄도 없다. 이러면 `check-robots-private-routes` 가
 * 지키는 대상이 *현실에 없는 파일*이 된다 — 가드는 초록인데 크롤러는 다른 걸 본다.
 * 그래서 "선언 vs 현실" 검사에 robots 도 포함한다.
 */
async function checkRobots(origin) {
  if (!existsSync('public/robots.txt')) return null
  const declared = readFileSync('public/robots.txt', 'utf8').split('\n').map((l) => l.trim())
  const rules = declared.filter((l) => /^(Disallow|Allow):/i.test(l))
  const wantsSitemap = declared.some((l) => /^Sitemap:/i.test(l))
  if (rules.length === 0) return null

  const r = await probe({ origin, path: '/robots.txt' })
  if (r.status !== 200) return { origin, status: r.status, reason: 'robots.txt 를 200 으로 받지 못했다' }

  let served = ''
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA } })
    served = await res.text()
  } catch { return null } // 본문을 못 읽으면 판정하지 않는다(오탐보다 침묵)

  const missing = rules.filter((l) => !served.includes(l))
  const sitemapMissing = wantsSitemap && !/^Sitemap:/im.test(served)
  const managed = /Cloudflare Managed content/i.test(served)
  if (missing.length === 0 && !sitemapMissing) return null
  return { origin, missing: missing.length, total: rules.length, sitemapMissing, managed, sample: missing.slice(0, 5) }
}

const results = []
const queue = [...targets]
// 동시성 2 + 요청 간 페이싱 — 라이브를 두드리는 것이고, 실측상 동시요청을 올리면 중계 구간이
// 503 을 뿌려 **멀쩡한 URL 이 죽은 것처럼 보인다**(4-way 로 돌렸을 때 12건이 가짜 503 이었다).
await Promise.all(Array.from({ length: 2 }, async () => {
  for (;;) {
    const t = queue.shift()
    if (!t) return
    const r = await probe(t)
    results.push({ ...t, ...r, verdict: verdict(t, r) })
    await sleep(250)
  }
}))
results.sort((a, b) => (a.origin + a.path).localeCompare(b.origin + b.path))

// 오리진 **전체**가 똑같은 실패를 내면 그건 URL 이 죽은 게 아니라 오리진/환경 레벨 조건이다
// (프록시 CONNECT 차단은 status 0 이 아니라 **403 응답**으로 오기도 한다 — 이 컨테이너가 그렇다).
// 그런 오리진은 실패로 세지 않고 **눈에 띄게 스킵으로 보고**한다. 같은 오리진에서 *일부만*
// 실패하면 그건 진짜 죽은 URL 이라 그대로 잡힌다.
const origins = [...new Set(results.map((r) => r.origin))]
const deadOrigins = new Set(
  origins.filter((o) => {
    const rows = results.filter((r) => r.origin === o)
    return rows.every((r) => r.verdict !== 'ok' && r.verdict !== 'ok-redirect')
      && new Set(rows.map((r) => r.status)).size === 1
  })
)

const live = results.filter((r) => !deadOrigins.has(r.origin))
const failures = live.filter((r) => r.verdict === 'fail' || r.verdict === 'unreachable')
const skipped = results.filter((r) => deadOrigins.has(r.origin))

// robots 는 기본 오리진에서만 본다(도매 오리진은 자체 sitemap/robots 정책이 따로다).
const robots = deadOrigins.has(BASE) ? null : await checkRobots(BASE)

if (JSON_OUT) {
  console.log(JSON.stringify({ base: BASE, checked: results.length, failures, skipped, robots, results }, null, 2))
} else {
  console.log(`🌐 라이브 계약 검증 — 선언 URL ${results.length}건 (오리진 ${origins.length}개)`)
  const redirected = live.filter((r) => r.verdict === 'ok-redirect').length
  if (redirected) console.log(`   ↪️  ${redirected}건은 같은 경로로 3xx — 도메인 이전 리다이렉트라 정상.`)
  for (const o of deadOrigins) {
    const rows = skipped.filter((r) => r.origin === o)
    console.log(`\nℹ️  ${o} — ${rows.length}건 전부 동일하게 ${rows[0].status || 'ERR'} → 오리진 레벨 조건이라 스킵.`)
    console.log(`   이 컨테이너의 에이전트 프록시가 막는 도메인일 수 있다(CONNECT 403 을 403 응답으로 준다).`)
    console.log(`   CI 러너에는 그 프록시가 없으므로 거기서는 실제로 검사된다.`)
  }
  if (failures.length) {
    console.error(`\n❌ 선언했지만 응답하지 않는 URL ${failures.length}건:`)
    for (const r of failures) {
      const to = r.location ? `  → ${r.location}` : ''
      console.error(`   ${String(r.status || 'ERR').padStart(3)}  ${r.origin}${r.path}${to}   ← ${r.source}`)
    }
    console.error(`\n   → 기능이 폐기됐으면 **선언에서 지우세요**. 예열은 실패해도 조용히 넘어가므로`)
    console.error(`     죽은 URL 은 서브리퀘스트 예산만 먹고(무료 50/인보케이션) 아무 신호도 남기지 않습니다.`)
    console.error(`     sitemap 이면 크롤 예산 낭비 + 사이트맵 신뢰도 하락입니다.`)
  } else {
    console.log(`\n✅ 검사한 ${live.length}건 전부 살아 있음.`)
  }

  if (robots) {
    console.error(`\n❌ robots.txt — 레포의 선언이 실제로 서빙되지 않는다 (${BASE}):`)
    if (robots.reason) console.error(`   ${robots.reason} (status ${robots.status})`)
    else {
      console.error(`   규칙 ${robots.total}줄 중 ${robots.missing}줄이 응답에 없다`
        + `${robots.sitemapMissing ? ' · Sitemap: 줄도 없다' : ''}`)
      for (const l of robots.sample) console.error(`      누락: ${l}`)
      if (robots.managed) {
        console.error(`   ⚠️ 응답이 **Cloudflare Managed robots.txt** 다 — 오리진 파일을 통째로 대체한다.`)
        console.error(`      대시보드에서 그 기능을 끄거나, 관리 규칙에 우리 Disallow/Sitemap 을 합쳐야 한다.`)
      }
      console.error(`   → 이걸 안 고치면 \`check-robots-private-routes\` 가 지키는 대상이 *현실에 없는 파일*이 된다`)
      console.error(`     (가드는 초록인데 크롤러는 다른 걸 본다).`)
    }
  }
}

process.exit(failures.length || robots ? 1 : 0)
