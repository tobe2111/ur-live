#!/usr/bin/env node
/**
 * ⏰ `wrangler.toml` 의 cron 표현식을 **Cloudflare 문법**으로 검증한다.
 *
 * ## 왜 (2026-08-02 실측 — 몇 달간 조용했던 사고)
 * 주간 D1 백업이 `0 20 * * 0` 로 선언돼 있었다. 표준 crontab 에서는 0=일요일이라 맞는 표현인데,
 * **Cloudflare 는 day-of-week 를 1-7 또는 MON-SUN 으로만 받는다 — 0 은 범위 밖**이다(code 10100).
 *
 * 그리고 스케줄 등록은 **원자적 전체 교체**다: 배열에 하나라도 거부되는 항목이 있으면
 * **나머지도 전부 반영되지 않는다.** 즉 이 한 줄이 배열 전체를 무효화했고,
 * 백업 cron 은 **등록조차 된 적이 없다**(하트비트 0 · R2 객체 0 · 재해복구 0).
 *
 * 에러는 배포 로그 깊숙한 곳에만 있었고 워크플로가 그걸 삼켜 "성공"으로 보고했다.
 * ⇒ 커밋 시점에 잡는 게 유일하게 확실한 자리다.
 *
 * ## 검사
 *   R1 필드 5개 · R2 각 필드 범위(특히 **DOW 0 금지**) · R3 배열 비어 있지 않음
 *   R4 중복 없음(같은 표현식 두 번 = 한 번은 무의미)
 *   R5 🔴 **계정 전체 트리거 수 ≤ 5**(Workers Free) — 아래 참조
 *
 * ## R5 는 ①을 고치고 나서야 드러난 두 번째 벽 (2026-08-02 실측)
 * `0`→`SUN` 으로 문법을 고쳐 실제 배포했더니 **다른 에러**가 나왔다:
 *   "This account has reached the Workers Free limit of **5 cron triggers per account**" (code 10072)
 * 이 계정은 이미 정확히 5개였다 — ur-live 3 + ur-live-cleanup-cron 1 + ur-ads 1.
 * 6번째를 넣으면 PUT 이 통째로 거부되고 **그 뒤 모든 worker-deploy 가 이 단계에서 실패**해
 * cron 코드 배포가 전면 정지한다. 즉 한 레포의 한 파일만 봐서는 못 막는다 —
 * **wrangler*.toml 전부를 합산**해야 한다.
 *
 * ⚠️ 이 가드가 **못 하는 것**: 표현식이 문법적으로 맞아도 **CF 에 실제 등록됐는지**는 모른다.
 *    그건 `worker-deploy` 로그의 `schedule:` 목록만이 답이다(배포 후 확인).
 *    또한 배열에서 항목을 **빼는** 실수(= 삭제)도 못 막는다 — 사람이 로그와 대조해야 한다.
 *
 * 예외: 해당 줄에 `cron-syntax-ok` 주석. 기본 warn, 차단: `STRICT_CRON_SYNTAX=1`.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STRICT = process.env.STRICT_CRON_SYNTAX === '1'
const FILE = path.join(ROOT, 'wrangler.toml')
/** Workers Free 플랜의 **계정당** cron 트리거 한도. 유료 전환 시 1,000. */
const ACCOUNT_CRON_LIMIT = Number(process.env.CF_CRON_LIMIT || 5)

const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** 필드 하나를 검사한다. @returns 오류 메시지 또는 null */
function checkField(raw, { name, min, max, names = [] }) {
  // `*`, `*/n`, `a-b`, `a,b,c`, `a-b/n` 조합을 쉼표로 쪼개 각각 본다.
  for (const part of String(raw).split(',')) {
    if (part === '*') continue
    const [range, step] = part.split('/')
    if (step !== undefined && !/^\d+$/.test(step)) return `${name}: 스텝 '${step}' 이 숫자가 아니다`
    if (range === '*') continue
    for (const v of range.split('-')) {
      const up = v.toUpperCase()
      if (names.includes(up)) continue           // 이름 표기(SUN·JAN…)는 허용
      if (!/^\d+$/.test(v)) return `${name}: '${v}' 는 숫자도 허용 이름도 아니다`
      const n = Number(v)
      if (n < min || n > max) {
        const hint = name === 'day-of-week'
          ? ` — Cloudflare 는 1-7 또는 ${DOW_NAMES.join('/')} 만 받는다(0 은 범위 밖). 일요일은 'SUN'.`
          : ''
        return `${name}: ${n} 이 범위(${min}-${max}) 밖${hint}`
      }
    }
  }
  return null
}

const SPEC = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MON_NAMES },
  // 🔑 여기가 사고 지점 — 표준 crontab 과 달리 0 이 없다.
  { name: 'day-of-week', min: 1, max: 7, names: DOW_NAMES },
]

if (!fs.existsSync(FILE)) {
  console.error('❌ cron-syntax: wrangler.toml 이 없다 — 경로가 낡았다.')
  process.exit(1)
}
const src = fs.readFileSync(FILE, 'utf8')
const line = src.split('\n').find((l) => /^\s*crons\s*=/.test(l))
if (!line) {
  console.error('❌ cron-syntax: crons 배열을 못 찾았다 — 검사가 헛돌고 있다.')
  process.exit(1)
}
if (line.includes('cron-syntax-ok')) {
  console.log('✅ cron-syntax: 예외 주석(cron-syntax-ok) — 검사 생략')
  process.exit(0)
}

const exprs = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1])
// 측정 0 이면 통과가 아니라 실패 — 이 레포가 반복해 겪은 '가드가 헛도는' 실패 모드.
if (exprs.length === 0) {
  console.error('❌ cron-syntax: crons 배열이 비었다 — 배포하면 모든 스케줄이 삭제된다.')
  process.exit(1)
}

const problems = []
for (const e of exprs) {
  const f = e.trim().split(/\s+/)
  if (f.length !== 5) { problems.push(`"${e}" — 필드가 ${f.length}개(5개여야 한다)`); continue }
  f.forEach((v, i) => {
    const err = checkField(v, SPEC[i])
    if (err) problems.push(`"${e}" — ${err}`)
  })
}
const dup = exprs.filter((e, i) => exprs.indexOf(e) !== i)
for (const d of new Set(dup)) problems.push(`"${d}" — 중복 선언(한 번은 무의미)`)

// R5: 계정 전체 합산 — 한 파일만 보면 절대 못 잡는다(위 주석의 code 10072).
const perFile = []
for (const f of fs.readdirSync(ROOT)) {
  if (!/^wrangler.*\.toml$/.test(f)) continue
  const line2 = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').find((l) => /^\s*crons\s*=/.test(l))
  if (!line2) continue
  perFile.push({ f, n: [...line2.matchAll(/"([^"]+)"/g)].length })
}
const total = perFile.reduce((a, b) => a + b.n, 0)
if (total > ACCOUNT_CRON_LIMIT) {
  problems.push(
    `계정 전체 트리거 ${total}개 > 무료 한도 ${ACCOUNT_CRON_LIMIT} — ` +
    perFile.map((p) => `${p.f}:${p.n}`).join(' + ') +
    ' · 초과하면 스케줄 PUT 이 통째로 거부되고 이후 모든 worker-deploy 가 실패한다(code 10072)',
  )
}

if (problems.length === 0) {
  console.log(`✅ cron-syntax: ${exprs.length}개 표현식 문법 통과 · 계정 합산 ${total}/${ACCOUNT_CRON_LIMIT}`)
  process.exit(0)
}

console.log('⚠️  Cloudflare 가 거부할 cron 표현식:')
for (const p of problems) console.log(`   - ${p}`)
console.log('\n   ⚠️ 스케줄 등록은 **원자적 전체 교체**다 — 하나가 거부되면 나머지도 반영되지 않는다.')
console.log('   배포 후 worker-deploy 로그의 `schedule:` 목록으로 실제 등록분을 확인할 것.')
console.log('   의도적이면 그 줄에 `cron-syntax-ok` 주석.')
if (STRICT) { console.error('\n❌ STRICT_CRON_SYNTAX — 차단.'); process.exit(1) }
