#!/usr/bin/env node
/**
 * 🧾 **결제 복귀 주소는 실재하는 라우트여야 한다** (2026-09-13 신설)
 *
 * ## 왜 생겼나 — 사람이 찾았고, 기계가 찾았어야 했다
 * 대표 *"결제의 다른 부분이 문제가 있는 건 없어?"* 로 결제 경로를 전수로 훑다가
 * `SellerYoutubeGrowthPage` 가 토스에 `successUrl: '/seller/youtube-growth/success'` 를 넘기는데
 * **App.tsx 에 그 라우트가 없다**는 것을 손으로 찾았다. 결제가 승인된 뒤 아무 데도 아닌 곳으로
 * 돌아오는 구조인데, 빌드도 타입체크도 테스트도 초록이었다 — 문자열이라 아무도 안 본다.
 *
 * 이 레포가 반복해 당한 부류다: **실패가 아니라 조용한 부재.**
 * (같은 클래스: 2026-07-29 `check-duplicate-routes` — 라우트가 겹쳐 페이지가 두 달 넘게 죽어 있었다.)
 *
 * ## 무엇을 보는가
 * `successUrl` / `failUrl` 로 넘기는 **리터럴** 목적지의 경로 부분이 `src/App.tsx` 의
 * `<Route path="...">`(App.tsx · src/routes/*.tsx) 에 실재하는지. 쿼리·해시는 떼고, `${...}` 보간은 `:param` 으로 본다.
 *
 * ## ⚠️ 이 가드가 못 보는 것 (과신 금지)
 * - `successUrl: someVariable` 처럼 **변수**로 넘기는 것(호출부에서 만들어짐) — 해석 불가라 건너뛴다.
 *   그 경우는 변수를 만드는 자리에 리터럴이 있으면 그게 잡힌다.
 * - `${window.location.pathname}` 처럼 **런타임에만 정해지는** 주소(유어애즈 결제 모달) — 건너뛴다.
 * - 라우트가 있어도 그 화면이 **실제로 일을 하는지**는 안 본다(그건 staging 실결제가 판정).
 *
 * 예외: 그 줄에 `payment-redirect-ok` 주석.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
// 🩸 2026-09-13: 첫 판은 `src/App.tsx` **하나만** 읽어서, 멀쩡히 살아 있는 셀러 페이지 3개를
//   "라우트 없음"으로 신고했다(실제 라우트는 `src/routes/seller.routes.tsx`). 라우트가 한 파일에
//   있다는 전제가 틀렸다 — **`<Route path=` 을 가진 파일을 전부** 모은다.

/** src 아래 모든 ts/tsx (테스트 제외) */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) { if (e !== 'tests' && e !== 'node_modules') walk(p, out) }
    else if (/\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/** App.tsx 의 <Route path="..."> 전부 */
function routesOf(src) {
  const out = new Set()
  for (const m of src.matchAll(/<Route\s[^>]*\bpath=["'`]([^"'`]+)["'`]/g)) out.add(m[1])
  return [...out]
}

/** `/a/:id` 와 `/a/:productId` 를 같게 보는 정규화 */
const shape = (p) => p.replace(/\/+$/, '').split('/').map((s) => (s.startsWith(':') ? ':x' : s)).join('/') || '/'

/**
 * 목적지 리터럴 → 경로.
 * @returns 경로 문자열, 또는 null(해석 불가 = 건너뜀)
 */
export function destPath(raw) {
  let v = raw.trim()
  // 템플릿/문자열 따옴표 벗기기
  if (!/^['"`]/.test(v)) return null              // 변수 — 해석 불가
  v = v.slice(1, -1)
  v = v.replace('${window.location.origin}', '')
  if (v.includes('${window.location.pathname}') || v.startsWith('${')) return null  // 런타임 결정
  if (/^https?:/.test(v)) return null             // 외부 — 이 가드 밖
  const cut = v.search(/[?#]/)
  let path = cut === -1 ? v : v.slice(0, cut)
  path = path.replace(/\$\{[^}]*\}/g, ':x')       // 보간 세그먼트 → 파라미터
  if (!path.startsWith('/')) return null
  return path
}

const routeFiles = walk(join(ROOT, 'src')).filter((f) => /\.tsx$/.test(f) && readFileSync(f, 'utf8').includes('<Route path='))
const routeShapes = new Set(routeFiles.flatMap((f) => routesOf(readFileSync(f, 'utf8'))).map(shape))
// 🕳️ 라우트를 하나도 못 모으면 그 뒤 검사는 전부 '없음'이 되어 **거짓 빨간불**이 된다(위 사고).
if (routeShapes.size < 50) {
  console.error(`❌ payment-redirect-routes: 라우트를 ${routeShapes.size}개밖에 못 모았다 — 라우트 수집이 깨졌다.`)
  process.exit(1)
}

const bad = []
let checked = 0
for (const f of walk(join(ROOT, 'src'))) {
  const src = readFileSync(f, 'utf8')
  if (!/successUrl|failUrl/.test(src)) continue
  src.split('\n').forEach((line, i) => {
    if (line.includes('payment-redirect-ok')) return
    for (const m of line.matchAll(/\b(?:successUrl|failUrl)\s*:\s*([^,\n]+)/g)) {
      const path = destPath(m[1])
      if (!path) return
      checked++
      if (!routeShapes.has(shape(path))) {
        bad.push(`${f.replace(ROOT + '/', '')}:${i + 1}  → ${path}  (어느 라우트 파일에도 없음)`)
      }
    }
  })
}

// 🕳️ 헛도는 검사 차단 — 이 레포가 반복해 당한 부류다(측정 대상 0건이면 통과가 아니라 실패).
const MIN = 5
if (checked < MIN) {
  console.error(`❌ payment-redirect-routes: 해석된 목적지가 ${checked}건뿐 (최소 ${MIN}). 스캔이 깨졌다 — 통과로 치지 않는다.`)
  process.exit(1)
}

if (bad.length) {
  console.error(`❌ payment-redirect-routes: 결제 복귀 주소 ${bad.length}건이 실재하지 않는 라우트를 가리킨다`)
  for (const b of bad) console.error('   ' + b)
  console.error('\n   결제가 승인된 뒤 아무 데도 아닌 곳으로 돌아온다. 라우트를 추가하거나, 그 결제 경로를 지워라.')
  console.error('   의도적이면 그 줄에 `payment-redirect-ok` 주석.')
  process.exit(1)
}

console.log(`✅ payment-redirect-routes: 결제 복귀 주소 ${checked}건 전부 실재 라우트 (라우트 ${routeShapes.size}개 · 파일 ${routeFiles.length}개 대조).`)
