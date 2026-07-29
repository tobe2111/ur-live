#!/usr/bin/env node
/**
 * 🧮 유어애즈 수집 레인 격리 가드 (2026-07-29 신설 — 실사고 후)
 *
 * 지키는 불변식 — **ads cron 의 수집·스윕 레인은 자기 인보케이션에서 돈다.**
 *
 * 배경(라이브 실측): `localdata`(인허가)와 `nara`(조달업체) 레인이 **6~9회 실행 동안 단 한 건도 저장하지
 *   못했다**(`total_saved: 0`). 진단 원문은 `⛔ 요청한도 도달` — data.go.kr 한도가 아니라 **Cloudflare 의
 *   인보케이션당 서브리퀘스트 한도**(무료 플랜 실효 ~50)였다.
 *
 *   원인은 레인 코드가 아니라 **호출 방식**이었다. 정상 작동하던 레인(storeinfo 12,549건 · commerce 105,733건 ·
 *   company 10,506건)은 전부 `kick()`(SELF = 새 인보케이션 = 새 예산) 경유였고, `total_saved: 0` 인 레인은
 *   전부 **인라인 `ctx.waitUntil`** 이었다 — 즉 매시간 한 인보케이션에 여러 레인이 얹혀 예산을 다퉜다.
 *   백필 레인은 혼자 최대 192 fetch(2일 × 16업종 × 6페이지)를 **매시간** 쏟아부으며 같은 인보케이션의
 *   다른 작업(구글시트 미러 등)까지 굶겼다.
 *
 *   ⚠️ 특히 고약한 점: 라우트(`/__ads/collect-localdata` 등)는 **이미 만들어져 있었다**(수동 버튼용).
 *   cron 만 그걸 안 쓰고 인라인으로 돌았다. 즉 "레인을 추가할 때 kick 을 빠뜨린다"가 실제 실패 양식이다.
 *
 * 검사: `src/worker-ads/index.ts` 의 scheduled 핸들러 안에서, 수집·스윕 러너 모듈(`*collect*` / `*sweep*`)을
 *   import 하는 `ctx.waitUntil` 블록은 **`kick(` 이거나 자체 `SELF.fetch`** 여야 한다(둘 다 새 인보케이션).
 *
 * 예외가 정말 필요하면(예: 외부 요청이 없는 D1 전용 잡) 해당 블록에 `ads-lane-ok` 주석.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'

const FILE = 'src/worker-ads/index.ts'
const ALLOW_MARK = 'ads-lane-ok'
/** 수집·스윕 러너로 간주하는 모듈 경로 패턴 — 이들은 외부 API 를 대량 호출한다. */
// ⚠️ 2026-07-29 `enrich` 추가 — 인플루언서 보강 레인이 이 검사 **밖**에 있었다(경로에 collect/sweep 이
//   없어서). 그 블록은 kick 을 안 써서 **하트비트조차 없었다** — "무음 정지 근절"(CLAUDE.md) 대상에서
//   조용히 빠져 있었던 것이다. 보강도 수집과 똑같이 독립 인보케이션에서 돌아야 하는 레인이다.
const RUNNER_RE = /await import\('([^']*(?:collect|sweep|enrich)[^']*)'\)/i

let fail = 0
const err = (m) => { console.error(`   ❌ ${m}`); fail++ }

if (!existsSync(FILE)) {
  console.log('⏭️  worker-ads/index.ts 없음 — 검사 생략')
  process.exit(0)
}

const src = readFileSync(FILE, 'utf8')

// scheduled 핸들러 범위만 본다(app.post 라우트 핸들러는 이미 자기 인보케이션이다).
const schedIdx = src.search(/(?:async )?function scheduled\s*\(|async scheduled\s*\(/)
if (schedIdx < 0) {
  console.log('⏭️  scheduled 핸들러 없음 — 검사 생략')
  process.exit(0)
}

/** 여는 괄호에서 시작해 균형 잡힌 닫는 위치를 찾는다(문자열/주석은 무시 — 이 파일 형식에서 충분). */
function balancedEnd(text, start) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) return i }
  }
  return text.length
}

const sched = src.slice(schedIdx)
const lineOf = (offsetInSched) => src.slice(0, schedIdx + offsetInSched).split('\n').length

let checked = 0
let cursor = 0
while (true) {
  const at = sched.indexOf('ctx.waitUntil(', cursor)
  if (at < 0) break
  const end = balancedEnd(sched, at + 'ctx.waitUntil'.length)
  const block = sched.slice(at, end + 1)
  cursor = end + 1

  const m = block.match(RUNNER_RE)
  if (!m) continue
  checked++
  if (block.includes(ALLOW_MARK)) continue
  // 새 인보케이션에서 도는가 — kick() 위임이거나 블록이 스스로 SELF 를 부른다.
  const isolated = /\bkick\s*\(/.test(block) || /SELF\??\.fetch/.test(block)
  if (!isolated) {
    err(`${FILE}:${lineOf(at)} — 수집·스윕 레인(${m[1]})이 인라인 ctx.waitUntil 로 돕니다.\n`
      + `      한 인보케이션의 서브리퀘스트 예산을 다른 레인과 다퉈 조용히 0건이 됩니다(2026-07-29 실사고).\n`
      + `      → worker-ads 의 '/__ads/...' 라우트를 kick() 으로 부르세요(라우트는 대개 이미 있습니다).`)
  }
}

// kick 이 가리키는 경로가 실제로 존재하는지 — 오타 하나면 그 레인이 조용히 사라진다(fallback 은 로컬 전용).
// ⚠️ 목록을 손으로 유지하지 않는다 — index.ts 가 600줄 래칫에 닿을 때마다 라우트가 새 모듈로 빠지는데
//   (public-data 2026-07-28 · influencer 2026-07-29), 그때마다 여기 추가하는 걸 잊으면 **가드가 멀쩡한
//   라우트를 '없다'고 오탐**한다(실제로 났다). `src/worker-ads/*.routes.ts` 를 전부 훑는다.
const routeFiles = [
  'src/worker-ads/index.ts',
  ...(existsSync('src/worker-ads') ? readdirSync('src/worker-ads').filter(f => f.endsWith('.routes.ts')).map(f => `src/worker-ads/${f}`) : []),
].filter(existsSync)
const routes = new Set()
for (const f of routeFiles) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\.post\('(\/__ads\/[^'?]+)'/g)) routes.add(m[1])
}
for (const m of src.matchAll(/kick\(\s*[`']([^`'?]+)/g)) {
  const path = m[1]
  if (!path.startsWith('/__ads/')) continue
  if (!routes.has(path)) {
    err(`${FILE} — kick('${path}') 의 라우트가 없습니다. SELF fetch 가 404 로 조용히 실패합니다.`)
  }
}

if (fail) {
  console.error(`\n❌ 유어애즈 레인 격리 위반 ${fail}건`)
  process.exit(1)
}
console.log(`✅ 유어애즈 레인 격리 OK (수집·스윕 waitUntil 블록 ${checked}개 · kick 경로 전부 존재)`)
