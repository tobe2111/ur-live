#!/usr/bin/env node
/**
 * 🚀 cron 레인 디스패치 — **부모가 레인을 기다리지 않게** 강제 (2026-07-29 신설).
 *
 * ## 무엇을 막는가
 * ur-ads 의 부모 `scheduled()` 는 매시간 ~25개 레인을 `kick()`/`gates.*` 로 던진다. 그런데 `kick` 은
 * `await env.SELF.fetch(path)` 다 — **레인이 일을 다 끝내고 응답할 때까지 부모가 살아 있어야 한다.**
 * 레인 하나가 20초를 쓰면 목록 뒷부분은 부모 수명 안에 **디스패치조차 되지 않는다.**
 *
 * ## 왜 가드여야 하나 (라이브 실측)
 * 한 시각의 `ads:*` 하트비트를 오래된 순으로 세우니 **완벽한 계단**이 나왔다:
 *   11:00 즉시응답 레인 2개 · 10:00 4개 · 09:00 4개 · 08:00 1개 · **05:00 collect-company(6시간째)**
 * 수집이 0인 건 코드가 틀려서가 아니라 **레인이 돌지 않아서**였다. 그리고 이 실패는
 * **에러를 내지 않는다** — 하트비트를 계단으로 세워 보기 전까지 아무도 몰랐다.
 * 새 레인은 기존 `kick(...)` 줄을 복사해 만들어지므로, 룰이 아니라 **가드**여야 한다.
 *
 * ## 검사
 * `src/worker-ads/index.ts` 의 모든 디스패치 경로가 다음 중 하나여야 한다:
 *   ① `?detach=1`(또는 `&detach=1`) — 라우트가 즉시 응답하고 작업은 자기 waitUntil 로
 *   ② `kick-fast-ok` 주석(같은 줄 또는 바로 윗줄) — **즉시 응답이 이미 보장된** 레인(체인 드라이버 등)
 *   ③ `scripts/ads-kick-detach-baseline.json` 등재 — 아직 변환 안 된 기존 부채(래칫: 추가 금지)
 *
 * ## R2 — 쿼리가 붙은 경로는 **하트비트 이름을 고정**해야 한다
 * `kick` 의 기본 beat 는 경로에서 유도된다. 경로에 `?detach=1` 을 붙이면 beat 도 바뀌어 **옛 하트비트
 * 행이 영원히 stale** 로 남고 경보가 멎지 않는다(`kick` 주석이 경고하는 바로 그것).
 * ⇒ 쿼리가 있는 디스패치는 `kick(..., { beat: '<고정이름>' })` 또는 `gates.*(..., '<고정이름>')` 필수.
 * (이 규칙은 실제로 필요했다 — 이 가드를 만든 세션이 같은 커밋에서 그 실수를 냈다.)
 *
 * ## 이 가드가 **못 잡는 것**
 * - `detach=1` 을 붙였는데 **라우트가 그걸 안 보는** 경우(경로는 맞고 동작만 동기) — 문자열 검사라 못 본다.
 *   그건 `ads-detach-dispatch.test.ts` 가 헬퍼 수준에서, 라이브 하트비트가 실제 수준에서 잡는다.
 * - 부모가 죽는 다른 이유(서브리퀘스트 한도) — 그건 `check-subreq-platform-cap` 담당.
 *
 * 사용: node scripts/check-ads-kick-detach.mjs [-s]
 */
import { readFileSync, existsSync } from 'node:fs'

const STRICT = process.argv.includes('-s') || process.env.STRICT_ADS_KICK_DETACH === '1'
const SRC = 'src/worker-ads/index.ts'
const BASELINE = 'scripts/ads-kick-detach-baseline.json'

const src = readFileSync(SRC, 'utf8')
const lines = src.split('\n')
const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).paths || []) : new Set()

/** 디스패치 한 건 — `kick('/__ads/x'` · `gates.dailyAt(h, '/__ads/x'` · `gates.everyNHours(n, o, '/__ads/x'` */
const DISPATCH = /(?:kick\(|gates\.(?:dailyAt|everyNHours)\([^']*)'(\/__ads\/[^']+)'/

const offenders = []
let total = 0
lines.forEach((line, i) => {
  const m = line.match(DISPATCH)
  if (!m) return
  total++
  const path = m[1]
  if (/[?&]detach=1/.test(path)) return
  // 마커는 같은 줄 또는 **바로 윗줄 주석**(이 레포가 이유를 적는 자리) 어디에 있어도 인정한다.
  if (/kick-fast-ok/.test(line) || /kick-fast-ok/.test(lines[i - 1] || '')) return
  const bare = path.split('?')[0]
  if (baseline.has(path) || baseline.has(bare)) return
  offenders.push({ line: i + 1, path })
})

// R2: 쿼리가 붙었는데 beat 고정이 없으면 하트비트 이름이 바뀐다(옛 행이 영원히 stale).
const beatless = []
lines.forEach((line, i) => {
  const m = line.match(DISPATCH)
  if (!m || !m[1].includes('?')) return
  // 호출이 여러 줄일 수 있다 — **다음 디스패치 직전까지**(최대 15줄)를 인자 목록으로 본다.
  //   고정 폭(3줄)으로 잡았더니 beat 가 5줄 아래 있는 호출을 놓쳤다(이 가드를 만들며 실제로 겪음).
  let end = i + 1
  while (end < lines.length && end < i + 15 && !DISPATCH.test(lines[end])) end++
  const window = lines.slice(i, end).join(' ')
  if (/beat:\s*'/.test(window)) return                  // kick(..., { beat: '…' })
  // gates.dailyAt/everyNHours(..., '<이름>') — 경로(`/__ads/…`)와 구분하려고 **슬래시 없는** 문자열만 본다.
  if (/,\s*'[^'/]+'\s*\)/.test(window)) return
  beatless.push({ line: i + 1, path: m[1] })
})

// 🧪 측정 대상 0건이면 통과가 아니라 실패 — 파일 구조가 바뀌어 **가드가 헛도는** 것을 스스로 신고한다.
if (total === 0) {
  console.error(`❌ ads-kick-detach: ${SRC} 에서 디스패치를 하나도 못 찾았다 — 패턴이 깨졌다(가드가 헛돌고 있다).`)
  process.exit(1)
}

if (beatless.length) {
  console.error('⚠️  쿼리가 붙은 디스패치인데 **하트비트 이름 고정이 없다** — 옛 행이 영원히 stale 경보가 된다:')
  for (const b of beatless) console.error(`   - ${SRC}:${b.line}  ${b.path}`)
  console.error("\n   고치는 법: kick(..., { beat: '<쿼리 없는 이름>' })  또는  gates.dailyAt/everyNHours(..., '<이름>')")
  if (STRICT) { console.error('\n❌ STRICT_ADS_KICK_DETACH — 차단.'); process.exit(1) }
}

if (!offenders.length) {
  console.log(`✅ cron 레인 디스패치 — ${total}개 전부 즉시응답(detach=1) 또는 명시 예외/베이스라인${beatless.length ? ` (⚠️ beat 미고정 ${beatless.length})` : ''}.`)
  process.exit(0)
}

console.error('⚠️  부모 cron 이 이 레인들의 완료를 기다린다 — 목록 뒷부분이 디스패치조차 안 될 수 있다:')
for (const o of offenders) console.error(`   - ${SRC}:${o.line}  ${o.path}`)
console.error('\n   고치는 법: 경로에 `?detach=1`(쿼리가 이미 있으면 `&detach=1`) + 라우트를 runDetachable 로.')
console.error('   ⚠️ 하트비트 이름은 **고정**할 것(kick 의 `{ beat }` / gates 의 4·5번째 인자) —')
console.error('      경로가 바뀌면 옛 하트비트 행이 남아 stale watch 가 영원히 경보한다.')
console.error('   즉시 응답이 이미 보장된 레인이면 `kick-fast-ok` 주석(같은 줄 또는 윗줄)에 **이유를 함께**.')
if (STRICT) { console.error('\n❌ STRICT_ADS_KICK_DETACH — 차단.'); process.exit(1) }
process.exit(0)
