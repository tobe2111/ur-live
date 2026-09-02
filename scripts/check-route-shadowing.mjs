#!/usr/bin/env node
/**
 * 🕳️ **정적 경로가 `/:param` 그림자에 가려 죽는다** (2026-09-02 라이브 실측으로 신설)
 *
 * Hono 는 **등록 순서**로 매칭한다. `/:id` 를 먼저 등록하면 그 뒤에 등록한 `/support-contact`
 * 요청이 `id="support-contact"` 로 잡히고, 핸들러의 숫자 검증에 걸려 **영원히 400/404** 가 난다.
 * 에러가 나긴 나는데 **엉뚱한 에러**라 원인을 찾기 어렵고, 라우트는 멀쩡히 코드에 있으므로
 * 아무도 사라졌다고 생각하지 않는다.
 *
 * `check-duplicate-routes` 는 **같은 경로 문자열**만 본다 — 여긴 문자열이 달라서 못 잡는다.
 *
 * 🩸 라이브에서 실제로 죽어 있던 것들(전부 이 가드가 없어서 몇 달 갔다):
 *   • `GET /api/seller/gb/support-contact` → 400 (대표 콘솔 신고)
 *   • `GET /api/group-buy/stays/my-bookings` → 400 "Invalid productId"
 *     ⇒ **내 숙소 예약 페이지가 로그인과 무관하게 항상 "불러오지 못했어요"** 였다(대표 스크린샷)
 *   • `GET /api/curator/recommendations` → 404 "큐레이터를 찾을 수 없습니다"
 *
 * ⚠️ **이 가드가 못 잡는 것**
 *   - 라우터를 변수로 넘겨 조립하거나(`app.route(prefix, sub)`) 경로를 문자열 연결로 만드는 경우.
 *     여기서는 **같은 파일 · 같은 라우터 변수 · 리터럴 경로**만 본다.
 *   - 세그먼트 수가 다른 그림자(`/a/:id` 가 `/a/b/c` 를 가리지는 않는다 — 실제로도 안 가린다).
 *
 * ✅ **정규식 제약이 붙은 파라미터는 그림자가 아니다**: `/sellers/:id{[0-9]+}` 는 숫자만 받으므로
 *   `/sellers/unlinked` 를 가리지 않는다(라이브 200 실측 확인). 그런 파라미터는 건너뛴다.
 *
 * 예외: 그 라우트 줄에 `route-shadow-ok` 주석.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync(
  `grep -rl "\\.\\(get\\|post\\|put\\|patch\\|delete\\)(" src --include=*.ts`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

const RE = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all)\(\s*'([^']+)'/g

/** `:id{[0-9]+}` 처럼 제약이 붙은 세그먼트는 임의 문자열을 못 받는다 → 그림자가 아니다. */
const isOpenParam = (seg) => seg.startsWith(':') && !seg.includes('{')

const findings = []
let scanned = 0

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const lines = src.split('\n')
  const routes = []
  RE.lastIndex = 0
  let m
  while ((m = RE.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    if ((lines[line - 1] || '').includes('route-shadow-ok')) continue
    routes.push({ var: m[1], method: m[2], path: m[3], idx: m.index, line })
  }
  scanned += routes.length

  for (const param of routes) {
    const segs = param.path.split('/')
    if (!segs.some(isOpenParam)) continue
    for (const stat of routes) {
      if (stat.idx <= param.idx) continue           // 뒤에 등록된 것만 가려진다
      if (stat.var !== param.var) continue          // 다른 라우터면 무관
      if (stat.method !== param.method && param.method !== 'all') continue
      if (stat.path.includes('/:')) continue        // 정적 경로만 본다
      const ss = stat.path.split('/')
      if (ss.length !== segs.length) continue
      if (segs.every((s, i) => isOpenParam(s) || s === ss[i])) {
        findings.push(
          `   • ${f}:${stat.line}  ${stat.method.toUpperCase()} ${stat.path}\n` +
          `     ← ${param.method.toUpperCase()} ${param.path} 가 먼저 등록됨 (line ${param.line}) — 이 경로는 절대 안 불린다`,
        )
      }
    }
  }
}

// 🛡️ 측정 대상 0건이면 **통과가 아니라 실패**(이 레포가 반복해 당한 "헛도는 가드" 클래스).
if (scanned < 200) {
  console.error(`❌ route-shadowing: 라우트를 ${scanned}개밖에 못 찾았다 — 스캔이 깨졌다(경로/정규식 확인).`)
  process.exit(1)
}

if (findings.length) {
  console.error(`❌ route-shadowing: 정적 경로가 /:param 에 가려 죽는다 — ${findings.length}건\n`)
  console.error(findings.join('\n'))
  console.error('\n   고치는 법: 그 정적 경로 등록을 /:param 위로 옮길 것(핸들러 내용은 그대로).')
  console.error('   의도한 것이면 그 줄에 `route-shadow-ok` 주석.')
  process.exit(1)
}

console.log(`✅ route-shadowing: 그림자에 가린 정적 경로 0건 (라우트 ${scanned}개 · 파일 ${files.length}개 검사)`)
