#!/usr/bin/env node
/**
 * 🚦 상태를 **중화되는 색조**로 구분하지 않는다 (2026-09-03 신설)
 *
 * ■ 왜 만들었나 — 라이브에서 상태 배지가 전부 같은 회색이었다
 *   `tailwind.config.js` 는 2026-06-19 대표 지시("아예 흑백, 기능 빨강만 유지")로 장식 색조를
 *   전부 잉크 스케일로 중화한다(`pink/rose/amber/emerald/blue/…` = MONO). 소비자 화면에서는 의도다.
 *   그런데 대시보드의 **상태 배지**가 바로 그 색조로 상태를 구분하고 있었다.
 *   라이브 CSS 실측(2026-09-03):
 *
 *     .bg-rose-50    → rgb(248 247 252)   ==   .bg-emerald-50    → rgb(248 247 252)
 *     .text-rose-700 → rgb(61 60 58)      ==   .text-emerald-700 → rgb(61 60 58)
 *
 *   즉 `반려` 와 `승인` 이 **픽셀 단위로 같았다.** 에러도 안 나고 색이 있는 것처럼 보여서
 *   몇 달간 아무도 몰랐다 — 이 레포가 반복해 겪은 "조용한 부재".
 *
 * ■ 규칙
 *   상태 라벨 표(`{ label|t: '반려', cls|c|color|bg: '…' }`)에서 색을 고를 때는
 *   `tone-*`(index.css `--tone-*`) 또는 `red`(중화 제외 = 대표가 유지하라고 한 기능 빨강)만 쓴다.
 *
 * ■ 이 가드가 **못** 하는 것
 *   - 상태표가 아닌 곳의 장식색(그건 흑백이 의도다).
 *   - tone 을 **잘못** 고른 경우(반려에 ok 를 주는 것) — 의미는 사람이 안다.
 *   - 인라인으로 흩어진 배지(표 형태만 본다). 그건 눈으로 봐야 한다.
 *
 * 래칫: `scripts/status-tone-baseline.json`. 줄이면 `--rebaseline`.
 * 예외: 같은 줄 또는 파일 상단에 `status-tone-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const BASELINE = path.join(ROOT, 'scripts/status-tone-baseline.json')
const STRICT = process.env.STRICT_STATUS_TONE === '1' || process.argv.includes('-s')

/** 중화되는(=MONO 로 리맵되는) 색조. `red` 만 살아남으므로 제외한다. */
const NEUTRALIZED = 'pink|rose|fuchsia|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple'

/** 상태 라벨 표로 보이는 줄: 라벨 키(label/t/text)와 색 키(cls/c/color/bg)가 한 객체에 있다. */
const STATUS_LINE = new RegExp(
  `\\{[^{}]*\\b(?:label|t|text)\\s*:[^{}]*\\b(?:cls|c|color|bg|className)\\s*:[^{}]*\\}`,
  'g',
)
const HUE = new RegExp(`\\b(?:bg|text|border|ring)-(?:${NEUTRALIZED})-\\d{2,3}\\b`)

const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts'", { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean)

// ⚠️ 대상이 0이면 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
if (files.length < 200) {
  console.error(`❌ status-tone: 소스를 ${files.length}개밖에 못 찾았다 — 스캔이 무의미해졌다.`)
  process.exit(1)
}

/* 양성/음성 대조 — 매칭이 죽으면 여기서 걸린다(0건 초록이 가장 위험한 실패다). */
{
  const bad = `const S = { rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' } }`
  const ok = `const S = { rejected: { t: '반려', c: 'bg-tone-bad-bg text-tone-bad' }, x: { label: 'x', cls: 'bg-red-50 text-red-700' } }`
  const hits = (s) => (s.match(STATUS_LINE) || []).filter((m) => HUE.test(m)).length
  if (hits(bad) !== 1) { console.error('❌ status-tone: 양성 대조 실패 — 명백한 위반을 못 찾는다.'); process.exit(1) }
  if (hits(ok) !== 0) { console.error('❌ status-tone: 음성 대조 실패 — tone/red 를 위반으로 센다(오탐).'); process.exit(1) }
}

const found = []
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf-8')
  if (src.includes('status-tone-ok')) continue
  const n = (src.match(STATUS_LINE) || []).filter((m) => HUE.test(m)).length
  if (n) found.push(`${f}:${n}`)
}

const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf-8')) : { entries: [] }
if (process.argv.includes('--rebaseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    _: '상태를 중화되는 색조로 구분하는 자리. 0 이 목표다 — 늘리지 말 것.',
    entries: [...found].sort(),
  }, null, 2) + '\n')
  console.log(`✅ status-tone: baseline 재설정 — ${found.length}파일`)
  process.exit(0)
}

const known = new Map((prev.entries || []).map((e) => {
  const i = e.lastIndexOf(':')
  return [e.slice(0, i), Number(e.slice(i + 1))]
}))
const worse = found.filter((e) => {
  const i = e.lastIndexOf(':')
  const [f, n] = [e.slice(0, i), Number(e.slice(i + 1))]
  return n > (known.get(f) ?? 0)
})

if (worse.length) {
  console.error(`\n❌ status-tone: 상태를 회색으로 만드는 색조 ${worse.length}건 — 화면에서 상태가 안 읽힌다.\n`)
  for (const x of worse) console.error(`   • ${x}`)
  console.error(`
   고치는 법: 그 표의 색을 \`bg-tone-{ok|warn|bad|info}-bg text-tone-{...}\` 로.
     의미로 고를 것 — ok(완료·승인) · warn(대기·검수) · bad(반려·실패·연체) · info(진행중·발송).
   컴포넌트가 필요하면 \`@/components/ui/status-pill\` 의 \`StatusPill\`/\`TONE_PILL\`.
`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`✅ status-tone: 새 위반 0건 (남은 ${found.length}파일 — baseline)${found.length ? ' · 줄이면 --rebaseline' : ''}`)
