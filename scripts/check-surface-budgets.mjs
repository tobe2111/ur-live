#!/usr/bin/env node
/**
 * 📏 화면별 첫 화면 무게 예산 — **래칫** (2026-10-14 대표 *"대기업 수준의 인프라여야 해. 단발적으로
 *    줄이는게 아니라 … 앞으로 추가로 기능 구현이 되어도 최적화된 상태여야 한다"*)
 *
 * ## 왜 있나 — 지금까지의 예산은 전부 '헐거운 선' 이었다
 *
 * | 기존 검사 | 무엇을 보나 | 왜 회귀를 못 막나 |
 * |---|---|---|
 * | `check-bundle-size` 총량 | lazy 청크까지 전부 합친 raw | 상향이 **40번 넘게** 있었다 — 늘 "lazy 라 체감 0" 이라 올린다 |
 * | 같은 파일 critical path | index.html 의 엔트리 폐쇄 gzip | 선이 **240KB** 인데 실측이 ~175KB 라 **65KB 가 새도 초록** |
 * | `check-critical-chunks` | 엔트리 폐쇄의 청크 **이름** | 이미 있는 청크가 **안에서 커지는 것**은 못 본다(스스로 적어 둔 한계) |
 * | `surface-chunk-runtime` | 화면별 청크 **개수** | 브라우저 워크플로라 **PR 게이트가 아니다** · 바이트는 안 본다 |
 *
 * 그리고 **화면별로** 워커가 추가로 미리받게 하는 봉투(route-chunk-map — 상세·지도·유어샵 …)는
 * **어떤 PR 게이트도 바이트를 재지 않았다.** 상세 화면에 30KB 짜리 부품을 하나 더 정적으로 붙여도
 * 빌드·시험 전부 초록이고, 그 화면이 느려진 것은 실사용 수치가 나빠진 **다음 날**에야 안다.
 *
 * ## 무엇을 재나
 *
 * 화면(표면)마다 **첫 화면에 실제로 받는 것**을 brotli(품질 11) 바이트로:
 *   첫 화면 무게 = 엔트리 폐쇄 JS(index.html 의 entry + modulepreload)
 *                + 앱 CSS(index.html 의 /assets/*.css)
 *                + 그 화면 진입점의 정적 import 폐쇄(엔트리 폐쇄에 없는 것 — 2026-10-18 부터 매니페스트로, 상한 없음)
 *   ⚠️ route-chunk-map(워커 미리받기 맵)은 js 를 10개에서 자르므로 무게 측정에 쓰지 않는다 — 대조에만 쓴다.
 * 그리고 `__boot__` 행 = 엔트리 폐쇄 JS + CSS (모든 화면이 공통으로 내는 값 — 따로 잠근다).
 *
 * ## 판정 (래칫 — 양방향)
 *   - 기준 + 허용오차 초과   → ❌ 회귀. 어느 청크가 늘었는지 이름으로 보여 준다.
 *   - 기준 − 잠금여유 미만   → ❌ "개선을 잠그라". 줄인 값을 기준에 반영하지 않으면 그 여유만큼이
 *                                다음 기능에 조용히 다시 먹힌다(= 지금까지 반복된 일).
 *                                `node scripts/check-surface-budgets.mjs --rebaseline` 한 줄이다.
 *   - 기준에 없는 화면        → ❌ 새 하드로드 진입점은 예산을 갖고 들어와야 한다(rebaseline 으로 등록).
 *   - 측정 0건 / 지도 비었음   → ❌ **통과가 아니라 실패**(못 잰 것을 예산 안으로 읽지 않는다).
 *
 * ## 정말 늘려야 할 때 (기능이 그 무게를 정당화할 때)
 *   `--rebaseline --reason "무엇을 왜 더했는가"` — 사유가 `history` 에 남는다. 사유 없는 상향은 거부한다.
 *   ⚠️ 먼저 그 무게가 **첫 화면에 꼭 있어야 하는지** 묻는다: 대부분은 lazy(눌렀을 때)로 내릴 수 있다.
 *
 * ## 못 보는 것
 *   - 이미지·폰트·API 응답(바이트가 아니라 요청 — `duplicate-fetch` · `surface-chunk-runtime` 의 몫)
 *   - 실행 비용(같은 바이트라도 무거운 코드) — 그건 실사용 SLO 감시(`vitals-slo` cron)가 본다
 *   - 진입점 목록 밖 화면 — 손님은 `generate-route-chunk-map` ROUTES, 대시보드·마이는 `dashboard-surfaces.mjs`(2026-10-14 편입)
 *   - 대시보드의 두 번째 이후 화면(어드민 주문 관리 등) — 첫 화면(홈)만 잰다
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { DASHBOARD_SURFACES } from './dashboard-surfaces.mjs'
import { ROUTES, PRELOAD_ONLY_ROUTES } from './generate-route-chunk-map.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(ROOT, 'scripts', 'surface-budgets.json')
const args = process.argv.slice(2)
const REBASE = args.includes('--rebaseline')
const reasonIdx = args.indexOf('--reason')
const REASON = reasonIdx >= 0 ? (args[reasonIdx + 1] || '').trim() : ''

/** 허용오차 — 빌드 환경 차이(더미 env 값 등)로 흔들리는 폭. 실측 흔들림은 수백 바이트다. */
export const TOLERANCE_KB = 1.5
/** 잠금여유 — 이만큼 줄었는데 기준을 안 내리면 실패(개선을 잠근다). */
export const LOCK_SLACK_KB = 3

const brCache = new Map()
export function brKB(buf) {
  return zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length / 1024
}
const chunkName = (f) => f.split('/').pop().replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, '.$1')

/** index.html + route-chunk-map 에서 화면별 파일 목록을 만든다(순수 — 시험이 직접 부른다). */
export function surfacesFrom(html, mapSrc) {
  const boot = new Set()
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g)) boot.add(m[1])
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) boot.add(m[1])
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1])
  // 맵 리터럴만 떼어 낸다 — 뒤에 `ENTRY_CSS` 등 다른 export 가 붙어 있으므로 파일 끝까지 자르지 않는다.
  const m = /ROUTE_CHUNK_MAP[^=]*=\s*(\{[\s\S]*?\n\})/.exec(mapSrc)
  if (!m) throw new Error('route-chunk-map 형식을 못 읽었다(ROUTE_CHUNK_MAP 리터럴 없음)')
  const map = JSON.parse(m[1])
  const out = { __boot__: [...boot, ...css] }
  for (const [k, v] of Object.entries(map)) {
    out[k] = [...boot, ...css, ...v.js.filter((f) => !boot.has(f)), ...(v.css || []).filter((f) => !css.includes(f))]
  }
  return { surfaces: out, bootCount: boot.size, cssCount: css.length, mapCount: Object.keys(map).length }
}

/**
 * 🧰 대시보드·마이 화면(2026-10-14) — route-chunk-map 에 없어(워커 미리받기 대상 아님) 그동안 **바이트를 아무도 안 쟀다.**
 *   Vite 매니페스트에서 진입점의 정적 import 폐쇄를 따라가 손님 화면과 같은 식으로 잰다:
 *   첫 화면 = 엔트리 폐쇄 + CSS + 진입점들의 정적 폐쇄(엔트리와 겹치는 건 한 번만). 이름은 `dash:<화면>`.
 *   진입점을 매니페스트에서 못 찾으면 **실패**다(파일이 옮겨졌는데 조용히 0 으로 재면 가드가 헛돈다).
 */
export function dashboardSurfacesFrom(manifest, bootFiles, cssFiles, dashboards) {
  return closureSurfacesFrom(manifest, bootFiles, cssFiles, dashboards, 'dash:')
}

/**
 * 🔭 손님 화면도 정적 폐쇄로 잰다 (2026-10-18 — #1912 의 stayDetail +6.0KB 착시에서 나온 구멍).
 *   종전엔 손님 화면의 봉투를 route-chunk-map 에서 읽었는데, 그 맵은 **워커 미리받기용**이라 js 를 10개(`MAX_LINKS`)에서
 *   자른다. 그러면 11번째부터는 **무게 예산에서도 안 보인다** — 실측: stayDetail 의 `lz-vouchers`(6.0KB)가 main 에서 11번째라
 *   안 세였다가, 다른 봉투 하나가 사라지자 상한 안으로 들어와 **아무것도 안 늘었는데 +6.0** 이 찍혔다(정적 폐쇄 실측은 −0.2).
 *   반대 방향이 더 나쁘다 — 11번째 이후로 30KB 가 붙어도 초록이다. ⇒ 대시보드와 같은 방식(매니페스트 정적 폐쇄, 상한 없음).
 *   route-chunk-map 은 여기선 **대조용**으로만 쓴다(맵의 js 는 폐쇄의 부분집합이어야 한다 — 아니면 둘 중 하나가 틀렸다).
 */
export function routeSurfacesFrom(manifest, bootFiles, cssFiles, routes) {
  return closureSurfacesFrom(manifest, bootFiles, cssFiles, routes, '')
}

/** 진입점 표 → 화면별 파일 목록(엔트리 폐쇄 + CSS + 진입점들의 정적 폐쇄, 겹치는 건 한 번만). */
export function closureSurfacesFrom(manifest, bootFiles, cssFiles, table, prefix) {
  const out = {}
  const entries = Object.entries(manifest)
  const resolve = (src) => {
    if (manifest[src]) return src
    const bySrc = entries.find(([, v]) => v.src === src)
    if (bySrc) return bySrc[0]
    // 같은 진입점이 여러 곳에서 lazy 로 불리면 Vite 가 키를 `_이름-해시.js` 로 바꾼다(UserProfilePage 실측).
    const base = src.split('/').pop().replace(/\.[tj]sx?$/, '')
    const byName = entries.filter(([, v]) => v.isDynamicEntry && v.name === base)
    if (byName.length === 1) return byName[0][0]
    throw new Error(`진입점을 매니페스트에서 못 찾았다: ${src} (후보 ${byName.length}개) — 파일이 옮겨졌으면 scripts/dashboard-surfaces.mjs · generate-route-chunk-map.mjs ROUTES 를 고칠 것`)
  }
  const boot = new Set(bootFiles)
  for (const [name, srcs] of Object.entries(table)) {
    const js = new Set(), css = new Set()
    const stack = srcs.map(resolve)
    const seen = new Set()
    while (stack.length) {
      const k = stack.pop()
      if (seen.has(k)) continue
      seen.add(k)
      const v = manifest[k]
      if (!v) continue
      const f = '/' + v.file
      if (!boot.has(f)) js.add(f)
      for (const c of v.css || []) if (!cssFiles.includes('/' + c)) css.add('/' + c)
      for (const x of v.imports || []) stack.push(x)
    }
    out[`${prefix}${name}`] = [...bootFiles, ...cssFiles, ...js, ...css]
  }
  return out
}

/**
 * 맵(미리받기용, 잘린 목록)이 폐쇄(무게용, 전체)의 부분집합인지 — 아니면 두 계산 중 하나가 틀렸다(순수).
 *   예: 생성기가 다른 진입점을 읽거나, 폐쇄가 import 를 덜 따라가면 여기서 갈린다.
 */
export function mapSubsetErrors(mapSurfaces, closureSurfaces) {
  const errors = []
  for (const [s, files] of Object.entries(mapSurfaces)) {
    if (s === '__boot__') continue
    const c = closureSurfaces[s]
    if (!c) { errors.push(`${s}: 미리받기 맵엔 있는데 진입점 표(ROUTES·PRELOAD_ONLY_ROUTES)엔 없다`); continue }
    const set = new Set(c)
    const miss = files.filter((f) => f.endsWith('.js') && !set.has(f))
    if (miss.length) errors.push(`${s}: 미리받기 맵의 청크가 정적 폐쇄에 없다 — ${miss.map(chunkName).join(', ')}`)
  }
  return errors
}

/** 기준과 실측을 대조해 위반 목록을 낸다(순수). */
export function judge(measured, baseline, { tolerance = TOLERANCE_KB, slack = LOCK_SLACK_KB } = {}) {
  const errors = []
  for (const [s, m] of Object.entries(measured)) {
    const b = baseline.surfaces?.[s]
    if (!b) { errors.push({ s, kind: 'new', msg: `${s}: 기준에 없는 화면 (${m.totalKB.toFixed(1)} KB) — 예산을 갖고 들어와야 한다` }); continue }
    if (m.totalKB > b.totalKB + tolerance) {
      const grew = Object.entries(m.chunks)
        .map(([n, kb]) => [n, kb - (b.chunks?.[n] ?? 0)])
        .filter(([, d]) => d > 0.3).sort((a, b2) => b2[1] - a[1]).slice(0, 6)
        .map(([n, d]) => `${n} +${d.toFixed(1)}`)
      errors.push({ s, kind: 'grew', msg: `${s}: ${b.totalKB.toFixed(1)} → ${m.totalKB.toFixed(1)} KB (+${(m.totalKB - b.totalKB).toFixed(1)}, 허용 ${tolerance}) · 늘어난 것: ${grew.join(', ') || '(새 청크 없음 — 기존 청크 내부)'}` })
    } else if (m.totalKB < b.totalKB - slack) {
      errors.push({ s, kind: 'slack', msg: `${s}: ${b.totalKB.toFixed(1)} → ${m.totalKB.toFixed(1)} KB 로 줄었다 — 개선을 잠그라(--rebaseline). 안 잠그면 그 여유가 다음 기능에 조용히 먹힌다` })
    }
  }
  for (const s of Object.keys(baseline.surfaces || {})) {
    if (!measured[s]) errors.push({ s, kind: 'gone', msg: `${s}: 기준엔 있는데 측정되지 않았다 — 화면이 사라졌으면 --rebaseline` })
  }
  return errors
}

function main() {
  const htmlPath = path.join(ROOT, 'dist/client/index.html')
  const mapPath = path.join(ROOT, 'src/worker/generated/route-chunk-map.build.ts')
  if (!fs.existsSync(htmlPath)) {
    console.error('❌ surface-budgets: dist/client/index.html 없음 — `npm run build` 뒤에 돌릴 것(못 잰 것은 통과가 아니다).')
    process.exit(1)
  }
  const { surfaces, bootCount, cssCount, mapCount } = surfacesFrom(fs.readFileSync(htmlPath, 'utf8'), fs.readFileSync(mapPath, 'utf8'))
  const manifestPath = path.join(ROOT, 'dist/client/.vite/manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ surface-budgets: dist/client/.vite/manifest.json 없음 — 대시보드 화면을 잴 수 없다(통과가 아니다).')
    process.exit(1)
  }
  const bootFiles = surfaces.__boot__.filter((f) => f.endsWith('.js'))
  const bootCss = surfaces.__boot__.filter((f) => f.endsWith('.css'))
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  // 🔭 2026-10-18: 손님 화면은 맵(10개 상한)이 아니라 정적 폐쇄로 잰다 — 맵은 대조에만 쓴다.
  const routeSurfaces = routeSurfacesFrom(manifest, bootFiles, bootCss, { ...ROUTES, ...PRELOAD_ONLY_ROUTES })
  const subsetErrs = mapSubsetErrors(surfaces, routeSurfaces)
  if (subsetErrs.length) {
    console.error('❌ surface-budgets: 미리받기 맵과 정적 폐쇄가 어긋난다(둘 중 하나가 틀렸다):')
    for (const e of subsetErrs) console.error(`   · ${e}`)
    process.exit(1)
  }
  for (const k of Object.keys(surfaces)) if (k !== '__boot__') delete surfaces[k]
  Object.assign(surfaces, routeSurfaces, dashboardSurfacesFrom(manifest, bootFiles, bootCss, DASHBOARD_SURFACES))
  if (bootCount === 0 || cssCount === 0 || mapCount === 0) {
    console.error(`❌ surface-budgets: 측정 대상이 비었다(엔트리 ${bootCount} · CSS ${cssCount} · 화면 ${mapCount}).`)
    console.error('   route-chunk-map 이 빈 맵이면 `npm run build:worker` 가 안 돈 것이다. 이 가드가 무력화된 상태다.')
    process.exit(1)
  }
  const kbOf = (f) => {
    if (!brCache.has(f)) brCache.set(f, brKB(fs.readFileSync(path.join(ROOT, 'dist/client', f))))
    return brCache.get(f)
  }
  const measured = {}
  for (const [s, files] of Object.entries(surfaces)) {
    const chunks = {}
    for (const f of files) chunks[chunkName(f)] = +kbOf(f).toFixed(2)
    measured[s] = { totalKB: +Object.values(chunks).reduce((a, b) => a + b, 0).toFixed(2), chunks }
  }

  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { surfaces: {}, history: [] }

  console.log('📏 화면별 첫 화면 무게 (brotli KB) — 기준 / 실측')
  for (const [s, m] of Object.entries(measured)) {
    const b = baseline.surfaces?.[s]?.totalKB
    console.log(`   ${s.padEnd(14)} ${b == null ? '   —  ' : b.toFixed(1).padStart(6)} / ${m.totalKB.toFixed(1).padStart(6)}`)
  }

  if (REBASE) {
    const errs = judge(measured, baseline)
    const raised = errs.filter((e) => e.kind === 'grew' || e.kind === 'new')
    if (raised.length && !REASON) {
      console.error('❌ 기준을 **올리는** rebaseline 은 사유가 필요하다: --reason "무엇을 왜 더했는가"')
      for (const e of raised) console.error(`   · ${e.msg}`)
      console.error('   먼저 그 무게가 첫 화면에 꼭 있어야 하는지 볼 것 — 대부분은 lazy 로 내릴 수 있다.')
      process.exit(1)
    }
    const history = baseline.history || []
    if (errs.length) history.push({ date: new Date().toISOString().slice(0, 10), reason: REASON || '개선 잠금(줄어든 값 반영)', changes: errs.map((e) => e.msg) })
    fs.writeFileSync(BASELINE, JSON.stringify({
      _doc: '화면별 첫 화면 무게 예산(brotli KB). 손으로 고치지 말 것 — scripts/check-surface-budgets.mjs --rebaseline [--reason ...]',
      toleranceKB: TOLERANCE_KB, lockSlackKB: LOCK_SLACK_KB, surfaces: measured, history: history.slice(-40),
    }, null, 2) + '\n')
    console.log(`✅ 기준 갱신 → scripts/surface-budgets.json (${Object.keys(measured).length}개 화면)`)
    return
  }

  const errs = judge(measured, baseline)
  if (errs.length) {
    console.error(`\n❌ surface-budgets: ${errs.length}건`)
    for (const e of errs) console.error(`   · ${e.msg}`)
    console.error('\n   늘었으면: 그 코드를 lazy 로 내릴 수 있는지 먼저 본다. 정말 필요하면')
    console.error('   node scripts/check-surface-budgets.mjs --rebaseline --reason "…"')
    process.exit(1)
  }
  console.log(`✅ surface-budgets: ${Object.keys(measured).length}개 화면 전부 예산 안 (허용 +${TOLERANCE_KB} KB · 잠금 −${LOCK_SLACK_KB} KB)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
