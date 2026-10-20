#!/usr/bin/env node
/**
 * 🚦 **레인이 예산을 우회하지 못하게 한다** (인플루언서·B2B 공통).
 *
 * ## 배경 (2026-08-02 실측)
 * ur-ads 의 `scheduled()` 에는 레인을 띄우는 길이 **두 가지**다:
 *
 * | 방식 | CPU 를 누가 내나 | 예산 분산 대상 |
 * |---|---|---|
 * | `kick(path, …)` → `SELF.fetch` | **자식 인보케이션**(자기 예산) | ✅ `dispatchPendingLanes` 가 센다 |
 * | 생 `ctx.waitUntil(async () => { await import(…); await run(env) })` | **부모**(직접 태운다) | ❌ 안 세고 못 미룬다 |
 *
 * 즉 생 `waitUntil` 레인은 **부모 CPU 를 직접 먹으면서 예산에는 안 잡힌다.** 그래서 예산을
 * 아무리 정교하게 나눠도 그 몫이 조용히 새어 나간다.
 *
 * 실제로 이 클래스는 이미 두 번 아팠다:
 * - `sheets-sync` 가 생 `waitUntil` 이라 **관측 밖**이었다(#882 이전, 3시간 멈춰도 침묵 경보 미발동).
 *   그리고 이 레인의 스냅샷이 라이브에서 `Worker exceeded CPU time limit` 원문을 **처음** 보여줬다.
 * - `daily-batch` 는 18:00 UTC 에 예산 밖에서 돈다 — 그 시각은 `collect-commerce`(짝수시)와
 *   겹치는 무거운 회차다.
 *
 * ⚠️ **이건 인플루언서 전용 문제가 아니다.** 레인 34개 중 **29개가 B2B**(업체/파트너풀/공공데이터)이고,
 * 2026-08-02 01:00 KST 에 CPU 한도로 죽은 3개(`collect-commerce`·`collect-neis`·`collect-nps`)는
 * **전부 B2B** 였다. 두 도메인이 같은 부모 예산을 나눠 쓴다.
 *
 * ## 무엇을 하는가 — **래칫**
 * `scheduled()` 본문의 생 `ctx.waitUntil` 안에서 쓰는 **동적 import 경로**를 키로 뽑아,
 * 베이스라인에 없는 **새 우회가 생기면 실패**시킨다(줄 번호가 아니라 모듈 경로라 코드가 움직여도 안정).
 * 기존분을 줄이는 것은 언제나 통과한다(줄이면 `--rebaseline`).
 *
 * ⚠️ **못 막는 것**: 이미 베이스라인에 있는 레인이 *무거워지는* 것. 그건 문자열로 판정 불가다
 *   — 라이브 하트비트(최장 성공 ms ↔ 최소 실패 ms 경계)로만 보인다.
 *
 * 예외: `dispatch-bypass-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const REBASE = process.argv.includes('--rebaseline')
const SRC = path.join(ROOT, 'src/worker-ads/index.ts')
const BASE = path.join(ROOT, 'scripts/ads-dispatch-bypass-baseline.json')

if (!fs.existsSync(SRC)) {
  console.error(`❌ dispatch-bypass: ${SRC} 없음 — 코드가 옮겨갔다(통과가 아니라 실패).`)
  process.exit(1)
}
const src = fs.readFileSync(SRC, 'utf8')

// `scheduled(` 이후만 본다 — 라우트 핸들러의 waitUntil 은 부모 cron 과 무관하다.
const at = src.indexOf('async function scheduled(')
const body = at >= 0 ? src.slice(at) : src
if (at < 0) {
  console.error('❌ dispatch-bypass: `async function scheduled(` 를 못 찾았다 — 스케줄러 진입점이 바뀌었다(통과가 아니라 실패).')
  process.exit(1)
}

/**
 * 생 waitUntil 블록에서 동적 import 경로를 뽑는다.
 * `ctx.waitUntil(` 부터 균형 괄호까지 잘라 그 안의 `import('…')` 를 모은다.
 */
function bypassKeys(text) {
  const keys = new Set()
  const NEEDLE = 'ctx.waitUntil('
  let i = 0
  while ((i = text.indexOf(NEEDLE, i)) !== -1) {
    let depth = 0, j = i + NEEDLE.length - 1
    for (; j < text.length; j++) {
      if (text[j] === '(') depth++
      else if (text[j] === ')') { depth--; if (depth === 0) break }
    }
    const block = text.slice(i, j + 1)
    // 면제 주석은 **블록 안**뿐 아니라 **바로 위 줄**에도 쓸 수 있어야 한다 —
    // 이 레포의 다른 가드들이 전부 "코드 위 주석" 관례이고, 처음엔 안쪽만 봐서 면제가 안 먹었다.
    const before = text.slice(Math.max(0, i - 240), i)
    i = j + 1
    if (block.includes('dispatch-bypass-ok') || before.includes('dispatch-bypass-ok')) continue
    // `kick` 경유분은 dispatchPendingLanes 안에 있으므로 여기 안 잡힌다.
    // 하트비트/등록 같은 순수 관측 waitUntil 은 import 가 없거나 관측 모듈뿐 — 아래서 걸러진다.
    for (const m of block.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const p = m[1]
      if (/cron-heartbeat|lane-cadence|beat-batch/.test(p)) continue // 관측 인프라(작업 아님)
      keys.add(p)
    }
  }
  return [...keys].sort()
}

const found = bypassKeys(body)
if (found.length === 0) {
  console.error('❌ dispatch-bypass: 우회를 하나도 못 찾았다 — 파서가 깨졌을 가능성(측정 0 = 실패).')
  process.exit(1)
}

if (REBASE) {
  fs.writeFileSync(BASE, JSON.stringify({ _why: '예산을 우회하는 생 waitUntil 레인(모듈 경로). 늘리지 말 것 — scripts/check-ads-dispatch-bypass.mjs 참조', lanes: found }, null, 2) + '\n')
  console.log(`✅ dispatch-bypass: 베이스라인 갱신 (${found.length}건)`)
  process.exit(0)
}

let baseline = []
try { baseline = JSON.parse(fs.readFileSync(BASE, 'utf8')).lanes || [] } catch { /* 최초 실행 */ }
const added = found.filter(k => !baseline.includes(k))
const removed = baseline.filter(k => !found.includes(k))

if (added.length) {
  console.error(`\n❌ dispatch-bypass: 예산을 우회하는 레인이 ${added.length}건 새로 생겼다\n`)
  for (const k of added) console.error(`   + ${k}`)
  console.error(`
   생 \`ctx.waitUntil(async () => { await import(…); await run(env) })\` 는 **부모 CPU 를 직접 태우면서
   예산 분산에는 안 잡힌다** — 예산을 아무리 나눠도 그 몫이 조용히 새어 나간다.
   조치: \`kick('/__ads/<이름>', fallback, { gap })\` 로 띄워라(SELF.fetch = 자식 예산 + 하트비트 + 미룰 수 있음).
        라우트가 없으면 \`/__ads/<이름>\` 을 먼저 추가한다.
   정말 부모에서 인라인으로 돌아야 한다면 그 블록에 \`dispatch-bypass-ok\` 주석 + 이유를 남길 것.
`)
  process.exit(STRICT ? 1 : 0)
}
if (removed.length) console.log(`   (줄었다: ${removed.join(', ')} — \`--rebaseline\` 로 동결값 갱신 권장)`)
console.log(`✅ dispatch-bypass: 예산 우회 ${found.length}건 (동결값 ${baseline.length} 이하 — 신규 0)`)
