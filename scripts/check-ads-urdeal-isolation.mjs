#!/usr/bin/env node
/**
 * 🧱 **유어애즈가 유어딜에 피해를 못 주게 하는 경계** (2026-08-27 대표 지시
 *   *"유어애즈 때문에 유어딜이 부정적인 영향을 받는 일이 없도록 해"*).
 *
 * ## 왜 문서가 아니라 가드인가
 * 이 경계는 **이미 한 번 무너진 적이 있다.** 유어애즈가 긁어 담은 리드가 유어딜의 주문·결제와
 * 같은 D1 파일에 쌓여 **494 MB / 한도 500 MB (99%)** 까지 갔고, 그 상태의 의미는 이랬다:
 *
 * > 한도에 닿으면 유어애즈만 멈추는 게 아니라 **주문·결제 쓰기가 같이 죽는다.**
 * > 유어딜은 원인이 아니라 인질이었다. (`src/shared/ads/leads-db.ts` 헤더)
 *
 * 2026-08-19 에 리드 테이블 7개를 별도 DB로 옮겨 그 사고는 막았지만, **경계를 지키는 장치는
 * 없었다** — 다음 세션이 무심코 유어딜 DB에 유어애즈 테이블을 하나 더 만들거나, 유어애즈 작업을
 * 유어딜 워커 cron 에 얹어도 아무도 모른다. 이 레포가 반복해 만난 *"룰만 있고 강제가 없으면
 * 결국 놓친다"* 를 여기서 만들지 않는다.
 *
 * ## 실측 (2026-08-27 — 이 가드가 동결하는 기준선)
 * ```
 * 유어딜 업무 테이블(orders·products·sellers…) 쓰기   0곳    ← R1 이 0 을 지킨다
 * 유어딜 DB 안에 남은 유어애즈 테이블                34개 / 565행  ← R2 가 래칫
 * 유어딜 워커 cron 에 붙은 유어애즈 작업              1건(outreach-email-drain, 실측 0ms) ← R3 가 래칫
 * ```
 *
 * ## ⚠️ 이 가드가 **못** 막는 것
 * - 동결된 것이 *무거워지는* 것(테이블 행이 늘거나 cron 작업이 느려지는 것) — 문자열로는 판정 불가.
 *   그건 D1 analytics 의 `rowsWritten` 과 `cron_hb:` 하트비트로만 보인다.
 * - 런타임 경로(`adsLeadsDb` 라우팅). 그건 `ads-leads-db.test.ts` 의 R1~R4 가 본다 — 짝이다.
 *
 * 예외: 해당 줄 또는 바로 윗줄에 `ads-isolation-ok` 주석.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const STRICT = process.argv.includes('-s') || process.env.STRICT_ADS_ISOLATION === '1'
const BASELINE = 'scripts/ads-urdeal-shared-tables.json'

/** 유어애즈 코드가 사는 곳. 여기 밖의 코드는 이 가드의 대상이 아니다. */
const ADS_DIRS = ['src/features/marketing/api', 'src/worker-ads']

/**
 * 🏦 유어딜의 **업무** 테이블 — 유어애즈가 여기에 쓰면 그건 quota 문제가 아니라 **데이터 사고**다.
 * ⚠️ 읽기는 막지 않는다: 광고슬롯 입찰이 `sellers` 를 읽는 것처럼 정당한 교차가 있다.
 */
const URDEAL_TABLES = [
  'orders', 'order_items', 'products', 'sellers', 'users', 'payments', 'carts', 'cart_items',
  'product_reviews', 'notifications', 'vouchers', 'voucher_orders', 'group_buy_vouchers',
  'point_transactions', 'ledger_entries', 'payouts', 'stay_bookings', 'coupons', 'wishlists',
]

const problems = []
const walk = (dir) => {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out = []
  for (const e of readdirSync(abs)) {
    const p = join(abs, e)
    if (statSync(p).isDirectory()) out.push(...walk(join(dir, e)))
    else if (/\.(ts|tsx|mjs)$/.test(e) && !/\.test\./.test(e)) out.push(join(dir, e))
  }
  return out
}
const files = ADS_DIRS.flatMap(walk)

// 🔴 측정 대상이 0 이면 **통과가 아니라 실패**다. 경로가 낡아 조용히 비는 것을 막는다.
if (files.length === 0) {
  console.error('❌ ads-isolation: 유어애즈 소스를 한 파일도 못 찾았다 — ADS_DIRS 가 낡았다(검사가 헛돌고 있다).')
  process.exit(1)
}

const exempt = (src, idx) => {
  const lines = src.slice(0, idx).split('\n')
  const cur = src.split('\n')[lines.length - 1] || ''
  const prev = lines[lines.length - 2] || ''
  return /ads-isolation-ok/.test(cur) || /ads-isolation-ok/.test(prev)
}

// ── R1 · 유어애즈가 유어딜 업무 테이블에 쓰지 않는다
const WRITE_RX = new RegExp(
  String.raw`(?:INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT)\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(${URDEAL_TABLES.join('|')})\b`,
  'gi',
)
let r1Scanned = 0
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8')
  r1Scanned++
  for (const m of src.matchAll(WRITE_RX)) {
    if (exempt(src, m.index)) continue
    const line = src.slice(0, m.index).split('\n').length
    problems.push(`R1 ${f}:${line} — 유어애즈가 유어딜 업무 테이블 '${m[1]}' 에 쓴다: ${m[0]}`)
  }
}

// ── R2 · 유어딜 DB 에 유어애즈 테이블을 새로 만들지 않는다 (래칫)
const leadsSrc = readFileSync(join(ROOT, 'src/shared/ads/leads-db.ts'), 'utf8')
const movedTables = [...leadsSrc.matchAll(/^\s*'([a-z_]+)',/gm)].map((m) => m[1])
if (movedTables.length === 0) {
  console.error('❌ ads-isolation: ADS_LEADS_TABLES 를 못 읽었다 — R2 가 헛돈다.')
  process.exit(1)
}
const baseline = existsSync(join(ROOT, BASELINE))
  ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'))
  : { tables: [], lanes: [] }
const allowed = new Set([...movedTables, ...(baseline.tables || [])])
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8')
  for (const m of src.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_]+)/gi)) {
    // `platform_settings` 는 유어딜의 공용 설정 테이블이지 유어애즈 테이블이 아니다 —
    //   R2(=새 유어애즈 테이블 유입)의 대상이 아니다. 유어애즈가 여기에 남기는 부기의 *양*은
    //   문자열로 못 재고 D1 `rowsWritten` 으로만 보인다(헤더의 "못 막는 것" 참조).
    if (m[1] === 'platform_settings' || allowed.has(m[1]) || exempt(src, m.index)) continue
    const line = src.slice(0, m.index).split('\n').length
    problems.push(
      `R2 ${f}:${line} — 새 유어애즈 테이블 '${m[1]}' 이 유어딜 DB 에 생긴다.\n` +
      `        → 리드성이면 leads-db.ts 의 ADS_LEADS_TABLES 에, 아니면 ${BASELINE} 에 근거와 함께 등록할 것.`,
    )
  }
}

// ── R3 · 유어애즈 작업을 유어딜 워커(ur-live) cron 에 새로 얹지 않는다 (래칫)
const SCHED = 'src/worker/scheduled.ts'
const schedSrc = readFileSync(join(ROOT, SCHED), 'utf8')
const adsImports = [...schedSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'[^']*features\/marketing\/[^']*'/g)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()))
  .filter(Boolean)
const knownLanes = new Set(baseline.lanes || [])
// ⚠️ 이름 붙이기를 **`safeCron` 쪽에서** 시작한다. 반대로 하면(함수명에서 뒤로 스캔) 한 줄에
//   `safeCron('a', …); safeCron('b', …)` 가 나란히 있을 때 **앞 것의 이름을 뒤 함수에 붙인다**
//   — 실제로 이 파일에서 `bulk-email-drain`(유어딜 작업)이 유어애즈 것으로 잘못 잡혔다.
const CRON_SPANS = (() => {
  const ms = [...schedSrc.matchAll(/safeCron\(\s*'([^']+)'/g)]
  // 각 safeCron 의 '몸통' = 자기 시작점 ~ **다음 safeCron 시작점**. 200자 같은 고정 창을 쓰면
  //   한 줄에 둘이 나란히 있을 때 뒤 함수까지 삼켜 앞 이름을 붙인다(실측으로 그렇게 틀렸다).
  return ms.map((m, i) => ({ name: m[1], body: schedSrc.slice(m.index, ms[i + 1]?.index ?? m.index + 400) }))
})()
const laneOf = (fn) => CRON_SPANS.find((s2) => new RegExp(String.raw`\b${fn}\b`).test(s2.body))?.name ?? fn
for (const fn of adsImports) {
  const lane = laneOf(fn)
  if (knownLanes.has(lane)) continue
  problems.push(
    `R3 ${SCHED} — 유어애즈 작업 '${lane}' 이 유어딜 워커 cron 에서 돈다(유어딜 워커의 CPU·서브리퀘스트를 쓴다).\n` +
    `        → ur-ads 레인으로 옮기거나, 의도적이면 ${BASELINE} 의 lanes 에 근거와 함께 등록할 것.`,
  )
}
// 🔴 R3 도 "아무것도 안 봤는데 초록"이 되면 안 된다 — scheduled.ts 가 통째로 바뀌었을 때를 잡는다.
if (!/safeCron\(/.test(schedSrc)) {
  console.error(`❌ ads-isolation: ${SCHED} 에 safeCron 이 없다 — R3 가 헛돈다(파일 구조가 바뀌었다).`)
  process.exit(1)
}

if (problems.length) {
  console.error('⚠️  유어애즈 → 유어딜 경계 위반:')
  for (const p of problems) console.error(`   - ${p}`)
  console.error('\n   배경: 유어애즈 리드가 유어딜 DB를 99% 채워 주문·결제가 같이 죽을 뻔한 적이 있다.')
  console.error('   예외는 해당 줄/윗줄에 `ads-isolation-ok` 주석.')
  if (STRICT) { console.error('\n❌ STRICT_ADS_ISOLATION — 차단.'); process.exit(1) }
  console.error('\n(warn-only — 차단하려면 STRICT_ADS_ISOLATION=1)')
  process.exit(0)
}
console.log(`✅ 유어애즈↔유어딜 경계 — 업무테이블 쓰기 0 · 공유테이블 ${allowed.size - movedTables.length}개 동결 · 유어딜 cron 의 유어애즈 작업 ${knownLanes.size}건 동결 (${r1Scanned}파일 검사)`)
