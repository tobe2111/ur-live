#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: 같은 경로에 라우트를 두 번 등록하는 것을 차단한다.
 *
 * ## 실제로 있었던 일
 *
 * `src/App.tsx` 에 `<Route path="/influencer">` 가 **두 번** 있었다 —
 *   739줄 `InfluencerDashboardPage` / 742줄 `InfluencerLandingPage`.
 * 같은 `<Routes>` 안 동일 경로라 먼저 선언된 대시보드가 항상 이기고,
 * **2026-05-15 에 만든 B2B 영입 랜딩은 두 달 넘게 한 번도 렌더된 적이 없었다.**
 * 에러도, 경고도, 빌드 실패도 없다 — 라우터는 그냥 첫 번째를 고를 뿐이다.
 *
 * 이 레포가 오늘 반복해서 만난 모양과 같다: **실패가 아니라 조용한 부재.**
 * 페이지를 만들고 라우트를 달았으니 "됐다" 고 믿게 되는데, 실제로는 죽어 있다.
 *
 * ## 판정
 *
 * 같은 파일 안에서 동일한 `path=` 리터럴이 2회 이상 나오면 위반.
 * `index` 라우트나 동적 세그먼트가 다른 경우(`/a/:id` vs `/a/new`)는 서로 다른 문자열이라 무관.
 *
 * ## 한계 (과신 금지)
 *
 *   - **중첩 라우트에서 의도적으로 같은 상대경로**를 쓰는 구조는 오탐이 될 수 있다.
 *     이 레포의 `App.tsx` 는 평평한 단일 `<Routes>` 라 현재 해당 없음. 생기면 예외 주석으로.
 *   - 경로가 *다르지만* 한쪽이 다른 쪽을 그림자처럼 가리는 경우(`/a/:id` 가 `/a/new` 보다 먼저)는
 *     못 잡는다. React Router v6 는 정적 세그먼트를 우선하도록 랭킹하므로 대개 안전하고,
 *     그렇지 않은 케이스는 문자열 비교로 판정할 수 없다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_DUP_ROUTES=1 또는 `-s`.
 * 의도적 예외: 해당 파일에 `duplicate-route-ok` 주석.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const STRICT = process.env.STRICT_DUP_ROUTES === '1' || process.argv.includes('-s')

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (['.tsx', '.jsx'].includes(extname(p))) files.push(p)
  }
}
walk('src')

const violations = []
let scannedRoutes = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('<Route')) continue
  if (src.includes('duplicate-route-ok')) continue

  /** path="..." 별 등장 줄 번호 */
  const seen = new Map()
  const re = /<Route\s[^>]*?\bpath="([^"]+)"/g
  let m
  while ((m = re.exec(src)) !== null) {
    scannedRoutes++
    const line = src.slice(0, m.index).split('\n').length
    if (!seen.has(m[1])) seen.set(m[1], [])
    seen.get(m[1]).push(line)
  }
  for (const [path, lines] of seen) {
    if (lines.length > 1) violations.push({ file, path, lines })
  }
}

// 🛡️ 측정 대상 0건은 통과가 아니다 — 스캔이 깨진 것이다(오늘 이 클래스로 가드 3개가 죽어 있었다).
if (scannedRoutes === 0) {
  console.error('❌ [duplicate-routes] <Route path="..."> 를 한 건도 못 찾았다 — 스캔/매칭이 깨졌다.')
  process.exit(1)
}

if (violations.length) {
  console.error(`❌ [duplicate-routes] 같은 경로에 중복 등록된 라우트 ${violations.length}건:`)
  for (const v of violations) {
    console.error(`   ${v.file}  path="${v.path}"  (줄 ${v.lines.join(', ')})`)
  }
  console.error(`\n   → 먼저 선언된 것만 렌더되고 나머지는 **조용히 죽습니다**(에러 없음).`)
  console.error(`     경로를 나누거나, 의도적이면 파일에 \`duplicate-route-ok\` 주석을 남기세요.`)
  process.exit(STRICT ? 1 : 0)
}

console.log(`✅ duplicate-routes: 중복 경로 없음 — Route ${scannedRoutes}건 검사.`)
