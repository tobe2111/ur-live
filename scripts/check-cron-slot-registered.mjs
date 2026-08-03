#!/usr/bin/env node
/**
 * ⏰ "cron 을 달았는데 그 슬롯이 등록돼 있지 않다" 차단 (2026-08-03 신설)
 *
 * ## 실제로 있었던 일
 *
 * 숙박 데모 72개가 **추첨 배지 없이** 소비자에게 89,000원짜리 진짜 숙박권으로 보이고 있었다.
 * 그 자가치유 백필을 `demo-fcfs-renew` 에 넣고 배포한 뒤 라이브를 보니 **아무것도 안 바뀌었다.**
 *
 * 원인: 그 cron 이 `if (cron === '0 * * * *')` 블록 안에 있는데, **`wrangler.toml` 의 crons 배열엔
 * 그 표현식이 없다**(3단계 보류 — 도매 예치금 자동 환불 규모 미측정이라 의도적으로 안 켰다).
 * 즉 그 블록은 **한 번도 발화한 적이 없다.** 하트비트 실측으로 확인했다 — 시간당 슬롯 하트비트
 * 32건이 **전부 `ads:*`**(별도 워커)였고 메인 워커 것은 **0건**이었다.
 *
 * **에러가 없다.** 배포는 초록불이고, 코드는 멀쩡히 있고, 리뷰에도 안 걸린다.
 * 이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스다.
 *
 * ## 기존 가드가 왜 못 잡았나
 *
 * `check-cron-heartbeat.mjs` 는 **"safeCron 으로 감쌌는가"** 를 본다. 감싸긴 했다 — 다만
 * 그 감싼 것이 **안 불릴 뿐**이다. 관측 배선과 발화 여부는 다른 층이다.
 *
 * ## 룰 (래칫)
 *
 * `wrangler.toml` crons 에 없는 슬롯의 cron 은 **죽은 cron**이다.
 * 지금 죽어 있는 것들은 `scripts/cron-dead-slot-baseline.json` 에 동결한다(의도적 보류분).
 * - 🔴 baseline 에 없는 **새** 이름이 죽은 슬롯에 들어오면 위반 — 그게 이 사고다.
 * - ✅ 죽은 목록에서 **빠지는** 것(= 살아 있는 슬롯으로 이사)은 통과. `--rebaseline` 로 갱신.
 *
 * ## 이 가드가 못 보는 것
 *
 * - **ur-ads 워커**(`wrangler-ads.toml` · `src/worker-ads/`)는 대상이 아니다. 자기 crons 를 따로 갖고
 *   실제로 매시간 발화한다(하트비트 32건). 필요해지면 같은 방식으로 확장할 것.
 * - **CF 대시보드에서 직접 건 cron** 은 레포가 볼 수 없다. `wrangler.toml` 이 SSOT 라는 전제다.
 * - 슬롯이 등록돼 있어도 **핸들러가 조기 return** 하면 여전히 안 돈다 — 그건 하트비트가 본다.
 *
 * 동작: 기본 warn. 차단: `-s` 또는 `STRICT_CRON_SLOT=1`. 갱신: `--rebaseline`.
 */
import fs from 'node:fs'
import path from 'node:path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_CRON_SLOT === '1'
const REBASELINE = process.argv.includes('--rebaseline')
const ROOT = process.cwd()

const WRANGLER = path.join(ROOT, 'wrangler.toml')
const SCHEDULED = path.join(ROOT, 'src/worker/scheduled.ts')
const BASELINE = path.join(ROOT, 'scripts/cron-dead-slot-baseline.json')

for (const f of [WRANGLER, SCHEDULED]) {
  if (!fs.existsSync(f)) {
    // 경로가 낡으면 **통과가 아니라 실패** — 조용히 사라지는 가드를 만들지 않는다.
    console.error(`❌ cron-slot: ${path.relative(ROOT, f)} 가 없다 — 경로가 낡았다(통과 아님).`)
    process.exit(1)
  }
}

/** wrangler.toml 의 `crons = [...]` — 주석(#)으로 죽여 둔 후보는 등록이 아니다. */
function registeredSlots(toml) {
  const live = toml.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n')
  const m = live.match(/crons\s*=\s*\[([^\]]*)\]/)
  if (!m) return null
  return new Set([...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1].trim()))
}

/** `if (cron === 'X') { … safeCron('name', …) … }` 블록을 중괄호 깊이로 잘라 읽는다. */
function slotBlocks(src) {
  const lines = src.split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/if\s*\(\s*cron\s*===\s*['"]([^'"]+)['"]\s*\)/)
    if (!m) continue
    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length
      if (j > i && depth <= 0) { end = j; break }
    }
    const body = lines.slice(i, end + 1).join('\n')
    const names = [...body.matchAll(/safeCron\(\s*['"]([^'"]+)['"]/g)].map((x) => x[1])
    blocks.push({ slot: m[1], line: i + 1, names })
  }
  return blocks
}

const slots = registeredSlots(fs.readFileSync(WRANGLER, 'utf8'))
if (!slots || slots.size === 0) {
  console.error('❌ cron-slot: wrangler.toml 에서 crons 배열을 못 읽었다 — 형식이 바뀌었다(통과 아님).')
  process.exit(1)
}

const blocks = slotBlocks(fs.readFileSync(SCHEDULED, 'utf8'))
// 🔍 측정 0 = 통과가 아니라 실패. 파서가 헛돌면 이 가드는 아무것도 안 보면서 초록이 된다.
if (blocks.length === 0) {
  console.error('❌ cron-slot: scheduled.ts 에서 `if (cron === ...)` 블록을 하나도 못 읽었다(통과 아님).')
  process.exit(1)
}

const dead = []
for (const b of blocks) {
  if (slots.has(b.slot)) continue
  for (const n of b.names) dead.push({ name: n, slot: b.slot, line: b.line })
}

if (REBASELINE) {
  const out = { _note: '이 슬롯들은 wrangler.toml crons 에 없어 발화하지 않는다(의도적 보류). 새 항목 추가는 check-cron-slot-registered.mjs 가 막는다.', dead: dead.map((d) => d.name).sort() }
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n')
  console.log(`✅ cron-slot: baseline 갱신 — 죽은 cron ${out.dead.length}개 동결.`)
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).dead || [])
  : new Set()

const added = dead.filter((d) => !baseline.has(d.name))
const revived = [...baseline].filter((n) => !dead.some((d) => d.name === n))

if (revived.length) {
  console.log(`ℹ️  cron-slot: 죽은 슬롯에서 빠진 cron ${revived.length}개 — ${revived.join(', ')}`)
  console.log('   (살아 있는 슬롯으로 옮겼다면 `node scripts/check-cron-slot-registered.mjs --rebaseline`)')
}

if (added.length === 0) {
  console.log(`✅ cron-slot: 새로 죽은 cron 0 (등록 슬롯 ${slots.size}개 · 블록 ${blocks.length}개 · 동결된 죽은 cron ${baseline.size}개).`)
  process.exit(0)
}

console.error(STRICT ? '❌ 발화하지 않는 슬롯에 cron 추가' : '⚠️  발화하지 않는 슬롯에 cron 추가 (warn)')
for (const d of added) {
  console.error(`   - ${d.name} → 슬롯 '${d.slot}' (scheduled.ts:${d.line}) 은 wrangler.toml crons 에 없다`)
}
console.error('')
console.error(`   등록된 슬롯: ${[...slots].join(' · ')}`)
console.error('   이 상태로 배포하면 **에러 없이 한 번도 안 돈다.** 살아 있는 슬롯으로 옮기거나,')
console.error('   그 슬롯을 wrangler.toml 에 등록할 것(보류 사유가 있다면 대표 판단).')
process.exit(STRICT ? 1 : 0)
