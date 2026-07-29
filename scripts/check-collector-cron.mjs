#!/usr/bin/env node
/**
 * ⏰ 수집·스윕 러너에 **스케줄이 없는 것** 차단 — 2026-07-28 (같은 사고 두 번).
 *
 *   ① `runMakerCollect` — 어드민 수동 버튼에만 연결돼 있고 크론이 어디에도 없어서 제조사 풀이
 *      수동 실행분 85건에 고착했다. 게이트(`SUPPLY_MAKER_COLLECT_ENABLED`)는 배지 표시에만 쓰여
 *      **"켜도 아무 일이 없는"** 상태였다.
 *   ② `matchRegistryEmails` — 외부 API 0·D1 전용이라 매시간 돌아도 공짜인데 **스케줄이 아예 없었다**.
 *      대표가 버튼을 누른 날에만 돌았다.
 *
 *   둘 다 코드는 정상이었고 테스트도 통과했다. 빠진 건 **"언제 도는가"** 하나였고, 그건 어떤 가드도
 *   보지 않던 자리였다. 자동수집은 **영구적으로 도는 것**이 요구사항이다(대표 지시).
 *
 *   판정: 수집/스윕 진입점 이름이 ur-ads 의 `scheduled()` 블록 안에 등장해야 한다
 *   (직접 호출이든, 그 블록이 kick 하는 `/__ads/*` 라우트를 통해서든).
 *   의도적 예외(수동 전용 도구 등)는 함수 위에 `no-cron-ok` 주석.
 *
 *   우회: commit 메시지 `[SKIP_COLLECTOR_CRON]` · 차단: STRICT_COLLECTOR_CRON=1
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SCAN_DIRS = ['src/features/marketing/api', 'src/features/supply/api']
const WORKER = 'src/worker-ads/index.ts'
const ROUTE_FILES = ['src/worker-ads/index.ts', 'src/worker-ads/public-data.routes.ts']
const strict = process.env.STRICT_COLLECTOR_CRON === '1'

/** 진입점으로 볼 이름들 — 레인 하나를 통째로 도는 함수. 보조 헬퍼(enrichNaverActivity 등)는 대상 아님. */
const ENTRY = /^(run[A-Za-z]*(Collect|Sweep|Enrich)|sweep[A-Z]\w*|match\w*Emails)$/

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p)
  }
  return out
}

if (!existsSync(WORKER)) {
  console.log('⏭️  check-collector-cron: ur-ads 워커 없음 — 스킵.')
  process.exit(0)
}
const workerSrc = readFileSync(WORKER, 'utf8')
const si = workerSrc.indexOf('scheduled(')
const sched = si >= 0 ? workerSrc.slice(si) : ''
if (!sched) {
  console.log('⚠️  check-collector-cron: scheduled() 블록을 못 찾음 — 가드가 헛돌지 않도록 실패로 본다.')
  process.exit(strict ? 1 : 0)
}

// /__ads/<route> → 그 라우트가 호출하는 러너 이름들
const routeCalls = {}
for (const f of ROUTE_FILES) {
  if (!existsSync(f)) continue
  const s = readFileSync(f, 'utf8')
  const marks = [...s.matchAll(/post\(\s*'(\/__ads\/[a-z0-9-]+)'/g)]
  marks.forEach((m, i) => {
    const body = s.slice(m.index, marks[i + 1]?.index ?? Math.min(s.length, m.index + 1200))
    for (const fn of body.match(/\b(run[A-Z]\w+|sweep[A-Z]\w+|enrich[A-Z]\w+|match\w*Emails|reclassify\w+)\b/g) || []) {
      (routeCalls[fn] ||= new Set()).add(m[1])
    }
  })
}

const problems = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/export async function (\w+)/g)) {
      const fn = m[1]
      if (!ENTRY.test(fn)) continue
      if (/no-cron-ok/.test(src.slice(Math.max(0, m.index - 500), m.index))) continue
      // ⚠️ 부분문자열 매칭 금지 — `matchRegistryEmailsX` 가 `matchRegistryEmails` 를 통과시켜
      //   가드가 헛돌던 것을 되돌려-검증에서 잡았다. 이름·경로 모두 경계 매칭.
      const word = (hay, needle) => new RegExp(`(?<![\\w-])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(hay)
      if (word(sched, fn)) continue
      if ([...(routeCalls[fn] || [])].some(r => word(sched, r))) continue
      const line = src.slice(0, m.index).split('\n').length
      problems.push(`${file}:${line} — ${fn}() 에 스케줄이 없다(수동 버튼으로만 도는 레인)`)
    }
  }
}

if (!problems.length) {
  console.log('✅ 수집·스윕 러너 전부 스케줄에 물려 있음.')
  process.exit(0)
}
console.log(`${strict ? '❌' : '⚠️'}  스케줄 없는 수집·스윕 러너 ${problems.length}건:`)
for (const p of problems) console.log('   - ' + p)
console.log('\n   고치는 법: ur-ads `scheduled()` 에 kick 추가(매시간 틱 하나에 시각/요일로 분기).')
console.log('   수동 전용이 의도면 함수 위에 `no-cron-ok` 주석 + 왜 수동인지 한 줄.')
process.exit(strict ? 1 : 0)
