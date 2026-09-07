#!/usr/bin/env node
/**
 * 🪦 **같은 앱에 같은 메서드·같은 경로를 두 번 등록하지 않았는가**
 *
 * ## 왜 (2026-09-05 — 실제로 하나 있었다)
 * `sellerOrdersRoutes.get('/products/:id', …)` 가 **두 번** 정의돼 있었다. Hono 는 먼저 등록된
 * 쪽이 이기므로 뒤엣것은 등록된 날부터 **한 번도 실행된 적이 없다** — 에러도, 경고도, 빌드 실패도
 * 없다. 하필 그 죽은 쪽이 전 컬럼을 내려주는 '좋은' 구현이라, 다음 사람이 거기를 고치면
 * **아무 일도 일어나지 않는다.**
 *
 * 이 레포는 같은 사고를 화면 쪽에서도 겪었다: `App.tsx` 의 `<Route path="/influencer">` 가 둘이라
 * 두 달 넘게 랜딩이 한 번도 렌더되지 않았다. 그건 `check-duplicate-routes.mjs` 가 잡게 됐는데
 * **서버 라우트는 아무도 안 보고 있었다.** 이 파일이 그 짝이다.
 *
 * ## 판정
 * 같은 파일 안에서 `<앱변수>.<메서드>('<경로>'` 가 두 번 이상 나오면 위반.
 * - 앱 변수명으로 키를 나눈다 → 서로 다른 라우터에 같은 경로가 있는 것은 정상(마운트 지점이 다르다).
 * - 메서드가 다르면 정상(GET/POST 는 공존한다).
 *
 * ⚠️ **못 잡는 것**: ① 파일이 갈린 중복(같은 라우터를 두 파일에서 확장하는 경우)
 * ② 경로는 다른데 한쪽이 다른 쪽을 그림자처럼 가리는 경우(`/a/:id` 가 `/a/new` 를 선점) — 문자열
 * 비교로는 판정 불가다. ③ 미들웨어를 일부러 같은 경로에 얹는 패턴(현재 이 레포엔 없다).
 * 의도적이면 그 줄 앞에 `duplicate-hono-route-ok` 주석.
 *
 * ⚠️ 스캔 대상이 하한(200파일) 밑이면 **통과가 아니라 실패**로 다룬다 — 경로 규칙이 낡아
 * 조용히 0건을 세는 것이 이 레포가 반복해 당한 "헛도는 가드"다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIN_FILES = 200
const STRICT = process.env.STRICT_DUP_ROUTES === '1' || process.argv.includes('-s')

const files = []
;(function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) walk(p) }
    else if (/routes\.ts$/.test(e.name)) files.push(p)
  }
})(path.join(ROOT, 'src'))

// ⚠️ 처음엔 줄 아무 데나 매칭했더니 `c.get('user')`(Hono 컨텍스트 getter)·`formData.get('file')`
//   까지 잡아 **38개 파일을 위반이라 신고**했다 — 신호가 아니라 소음이었고, 그 상태로 켰으면
//   아무도 안 봤을 것이다. 방어는 셋이고 **서로 겹친다**(실측: 하나씩 빼도, 뒤 둘을 같이 빼도
//   오탐 0). 일부러 겹쳐 둔다 — 라우터 이름 규칙이나 경로 표기가 바뀌어도 한 겹은 남는다.
//     ① 줄 맨 앞 앵커(라우트 등록은 늘 문 맨 앞에 온다)
//     ② 수신자 이름이 라우터꼴(`*Routes`/`app`/`api`)
//     ③ 경로가 '/' 로 시작
const RE = /^[ \t]*(?:export\s+)?([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*(['"`])([^'"`]*)\3/gm
const ROUTER_NAME = /(routes?|app|api)$/i
const violations = []

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const lines = src.split('\n')
  const seen = new Map()
  let m
  RE.lastIndex = 0
  while ((m = RE.exec(src))) {
    const lineNo = src.slice(0, m.index).split('\n').length
    const raw = lines[lineNo - 1] ?? ''
    if (raw.trim().startsWith('//') || raw.trim().startsWith('*')) continue   // 주석 속 예시
    if ((lines[lineNo - 2] ?? '').includes('duplicate-hono-route-ok')) continue
    if (!ROUTER_NAME.test(m[1])) continue          // c / formData 등 라우터가 아닌 수신자
    if (!m[4].startsWith('/')) continue             // 경로는 '/' 로 시작한다
    const key = `${m[1]}.${m[2].toUpperCase()} ${m[4]}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(lineNo)
  }
  for (const [key, at] of seen) {
    if (at.length > 1) violations.push({ file: path.relative(ROOT, f), key, at })
  }
}

if (files.length < MIN_FILES) {
  console.error(`❌ duplicate-hono-routes: 스캔 대상이 ${files.length}개뿐 (하한 ${MIN_FILES}).`)
  console.error('   경로 규칙이 낡아 아무것도 안 보고 있을 가능성이 높다 — 통과로 치지 않는다.')
  process.exit(1)
}

if (violations.length === 0) {
  console.log(`✅ duplicate-hono-routes: 같은 앱·같은 메서드·같은 경로 중복 0 (라우트 파일 ${files.length}개).`)
  process.exit(0)
}

console.log('🪦 같은 경로가 두 번 등록됨 — Hono 는 먼저 등록된 쪽만 실행한다(뒤엣것은 죽은 코드):')
for (const v of violations) console.log(`   - ${v.file}\n       ${v.key}  → ${v.at.join('줄, ')}줄`)
console.log('\n   뒤에 등록된 핸들러는 **한 번도 실행되지 않는다** — 고쳐도 아무 일이 안 일어난다.')
console.log('   하나로 합치거나 경로를 나눌 것. 의도적이면 그 줄 앞에 `duplicate-hono-route-ok` 주석.')
process.exit(STRICT ? 1 : 0)
