#!/usr/bin/env node
/**
 * 🔁 **첫 화면이 같은 것을 두 번 받는가** 를 실제 렌더로 센다 (2026-10-06 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   대표: *"마이 페이지에 로딩 속도? 문제 한번 확인해봐. 내 가게 이 부분이 가장 늦게 떠."*
 *   그리고 바로 이어: *"근본적인 문제를 모두 해결해줘. **다른 페이지들도 그런 경우가 많아.**"*
 *
 *   전수로 재 보니 세 화면이 전부 같은 병을 앓고 있었다:
 *   | 화면 | 무엇 | 왜 |
 *   |---|---|---|
 *   | 홈 | `/api/banners` **3회** | 자리(hero·inline·wide)마다 따로 불렀다. 게다가 셋 다 `?type=` 이 붙어 **cron 예열 키(`/api/banners`)와 달라** 예열을 한 번도 못 받았다 |
 *   | 교환권 | `/api/products` **2회** | 카테고리 목록이 오면 첫 카테고리를 자동 선택 → **첫 응답을 버리고** 다시 받았다(SSR 시드·예열도 같이 버려졌다) |
 *   | 마이 | `/api/seller/products` | `판매 중 N개` **한 줄** 때문에 상품 목록 전체를, 그것도 좌석이 정해진 **뒤에**(직렬 2단) |
 *
 *   셋 다 **에러가 안 난다.** 빌드도 테스트도 초록이고 화면도 안 깨진다. 느릴 뿐이라
 *   그 순간을 재 본 사람만 안다 — 사람에게 맡기면 반드시 다시 생긴다.
 *
 * ■ 무엇을 재나
 *   첫 화면(사람이 아무것도 안 누른 상태)에서 나간 `/api/*` 요청을 **경로별로 센다.**
 *   같은 경로가 두 번 이상이면 빨간불이다. 첫 화면에는 사용자 필터도 페이지네이션도 없으므로
 *   "같은 경로 두 번" 은 거의 언제나 낭비다 — 그 둘이 쿼리가 달라도 마찬가지다(교환권이 그랬다).
 *
 * ■ 측정기를 **두 벌 만들지 않는다**
 *   `scripts/visual-preview.mjs --trace-api` 를 그대로 자식 프로세스로 부르고, 그 하네스가 찍는
 *   `FETCH_RESULT {json}` 한 줄만 읽는다. 사람이 보는 목록과 같은 출처라 둘이 갈리지 않는다.
 *
 * ■ 한계 (과신 금지)
 *   - **스텁은 즉답이다.** 그래서 "몇 ms 걸리나" 는 여기서 안 보인다 — 세는 것은 **횟수**다.
 *   - 상호작용 뒤(탭·스크롤·시트 열기)의 요청은 안 본다. 첫 화면만이 범위다.
 *   - 직렬 2단(앞 응답을 기다렸다 나가는 요청)은 **횟수로는 안 잡힌다.** 그건 사람이 폭포를 봐야 한다
 *     (`node scripts/visual-preview.mjs --route=... --trace-api`).
 *   - 경로 목록이 곧 범위다. 새 소비자 화면을 만들면 여기 한 줄 추가할 것.
 *
 * 사용법:  node scripts/check-duplicate-fetch.mjs
 *          node scripts/check-duplicate-fetch.mjs --only=교환권
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')
const BASELINE = path.join(ROOT, 'scripts/duplicate-fetch-baseline.json')

const ROUTES = [
  { name: '홈', args: ['--route=/', '--deals'] },
  { name: '교환권', args: ['--route=/vouchers', '--deals'] },
  { name: '이용권 상세', args: ['--route=/group-buy/9000', '--deals'] },
  { name: '쇼핑', args: ['--route=/browse', '--deals'] },
  { name: '지도', args: ['--route=/map', '--deals'] },
  { name: '유어샵', args: ['--route=/u/jiwon1228'] },
  { name: '마이(셀러)', args: ['--route=/user/profile', '--stores=1'] },
  { name: '지갑', args: ['--route=/my-vouchers', '--wallet', '--auth=user'] },
  { name: '장바구니', args: ['--route=/cart', '--cart', '--auth=user'] },
  { name: '주문내역', args: ['--route=/my-orders', '--auth=user'] },
  { name: '쿠폰함', args: ['--route=/my-coupons', '--auth=user'] },
  { name: '찜', args: ['--route=/wishlist', '--auth=user'] },
  { name: '알림', args: ['--route=/notifications', '--auth=user'] },
]

const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('⏭️  duplicate-fetch: dist/client 이 없다 — **검사하지 않았다**(통과가 아니다).')
  console.log('   실행하려면: npm run build')
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { allow: {} }

/**
 * 🔴 한 줄도 못 읽으면 **실패**다. 하네스가 형식을 바꾸거나 죽었는데 빈 배열을 "중복 0" 으로
 *   읽으면 이 가드는 영원히 통과만 한다(이 레포가 반복해 당한 '헛도는 가드').
 */
function parse(stdout) {
  for (const line of String(stdout).split('\n')) {
    const i = line.indexOf('FETCH_RESULT ')
    if (i < 0) continue
    try { return JSON.parse(line.slice(i + 'FETCH_RESULT '.length)) } catch { /* 깨진 줄 */ }
  }
  return null
}

/** 계측·수집용 호출은 화면 속도와 무관하다(중복이어도 사용자가 기다리지 않는다). */
const IGNORE = new Set(['/api/funnel/track', '/api/analytics/vitals', '/api/analytics/funnel'])

const targets = ROUTES.filter((r) => !ONLY || r.name.includes(ONLY))
if (ONLY && targets.length === 0) {
  console.error(`❌ --only="${ONLY}" 에 맞는 경로가 없다 (0건 실행은 통과가 아니다)`)
  process.exit(1)
}

let bad = 0
const report = []

for (const r of targets) {
  const res = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts/visual-preview.mjs'),
    '--trace-api', `--name=dup-${r.name.replace(/[^a-z0-9가-힣]+/gi, '-')}`,
    ...r.args,
  ], { cwd: ROOT, encoding: 'utf8', timeout: 240000 })

  const row = parse(res.stdout || '')
  if (!row) {
    console.error(`❌ ${r.name}: 측정 줄(FETCH_RESULT)을 못 읽었다 — 하네스가 죽었거나 형식이 바뀌었다`)
    console.error(`   ${String(res.stderr || '').split('\n').slice(0, 3).join(' / ')}`)
    bad++
    continue
  }
  if (row.calls.length === 0) {
    console.log(`⚠️  ${r.name}: 요청 0건 — 그 경로는 **검사된 것이 아니다**(시드 플래그를 의심할 것)`)
    continue
  }

  const byPath = new Map()
  for (const c of row.calls) {
    const p = String(c.url).split('?')[0]
    if (IGNORE.has(p)) continue
    if (!byPath.has(p)) byPath.set(p, [])
    byPath.get(p).push(c)
  }
  const dupes = [...byPath.entries()].filter(([, v]) => v.length > 1)
  const allow = baseline.allow?.[r.name] ?? 0
  const mark = dupes.length > allow ? '🔴' : dupes.length ? '🟠' : '🟢'
  report.push(`${mark} ${r.name} — 요청 ${row.calls.length}건 · 중복 경로 ${dupes.length}개`)
  for (const [p, v] of dupes) {
    report.push(`      ↻ ${p} ×${v.length}  (${v.map((c) => `+${c.at}ms`).join(' ')})`)
    for (const c of v) report.push(`          ${c.url}`)
  }
  if (dupes.length > allow) bad++
}

console.log(report.join('\n'))

if (bad) {
  console.error(`\n❌ duplicate-fetch: 첫 화면이 같은 것을 두 번 받는 화면 ${bad}개`)
  console.error('   처방: 한 번 받아 **화면에서** 가르거나(홈 배너), 두 번째 요청이 필요 없게')
  console.error('         첫 응답에 그 값을 실어 보낸다(마이 `active_products`).')
  console.error(`   의도한 것이면 ${path.relative(ROOT, BASELINE)} 의 allow 에 **사유와 함께** 올린다.`)
  process.exit(1)
}
console.log('\n✅ duplicate-fetch: 첫 화면 중복 요청 0')
