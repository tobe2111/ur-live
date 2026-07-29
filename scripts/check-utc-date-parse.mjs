#!/usr/bin/env node
/**
 * 🛡️ UTC-naive DB 타임스탬프의 순진한 `new Date()` 파싱 차단 (래칫)
 *
 * 배경 (2026-07-27 — 대표 "어드민 대시보드 최근 활동, 누가 결제했는지 알 수 없어" 전수조사):
 *   D1/SQLite 의 `created_at DEFAULT CURRENT_TIMESTAMP` / `datetime('now')` 는
 *   **'YYYY-MM-DD HH:MM:SS' (UTC, `Z` 접미사 없음)** 을 돌려준다.
 *   - 브라우저에서 `new Date(그 문자열)` → **로컬(KST) 로 오해석** → epoch 이 9시간 어긋남.
 *   - 워커에서 `.toLocaleString('ko-KR')` → TZ=UTC 라 **한국어 포맷의 UTC 시각**(9시간 이른 표기).
 *
 *   실제로 이 클래스가 만든 사고:
 *     · 어드민 최근 활동 시각이 뷰어 기기 TZ 에 따라 달라짐(AdminActivityFeed)
 *     · 연속 주문 감지(`Math.abs(now - orderTime) < 60000`)가 9시간 차이로 **영영 미발동**(AdminPage)
 *     · 고객 알림톡 "주문일시" 가 9시간 이르게 발송(alimtalk-auto)
 *     · 셀러 주문 날짜 필터가 경계 주문을 최대 9시간만큼 누락(SellerOrdersPage)
 *   그리고 같은 포맷터를 페이지마다 손으로 다시 짜는 중복(AdminInfluencerPoolPage 등)도 이 클래스.
 *
 * 규칙 (SSOT = `src/utils/date.ts`):
 *   [A] 어디서든 — `new Date(x.created_at).toLocale*()` 금지.
 *       → `formatKST` / `formatKSTDate` / `formatKSTTime` / `formatKSTShort` 사용.
 *       옵션 객체를 유지해야 하면 `parseUTCDate(x).toLocaleString(loc, { timeZone: 'Asia/Seoul', ... })`.
 *   [B] 클라이언트 코드(pages/components/hooks) — `new Date(x.created_at)` 자체 금지(비교/정렬 포함).
 *       브라우저 TZ 에 따라 결과가 달라진다. → `parseUTCDate(x)`.
 *       날짜 입력('YYYY-MM-DD')과의 경계 비교는 `kstDayStartMs` / `kstDayEndMs`.
 *
 * 래칫: `scripts/utc-date-baseline.json` 에 동결된 기존 위반 수보다 **늘면 차단**(줄이는 건 항상 OK).
 *   기존 잔여분을 정리했으면 `node scripts/check-utc-date-parse.mjs --rebaseline` 로 동결값 갱신.
 *
 * 예외: 같은 줄(또는 바로 윗줄) 주석에 `utc-date-ok`.
 * 기본 warn, 차단: `STRICT_UTC_DATE=1` (verify.yml / audit-gate).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE_PATH = path.join(ROOT, 'scripts', 'utc-date-baseline.json')
const STRICT = process.env.STRICT_UTC_DATE === '1'
const REBASELINE = process.argv.includes('--rebaseline')

/** DB 타임스탬프로 취급하는 컬럼명 — 전부 UTC-naive 로 저장된다. */
const TS_FIELDS = [
  'created_at', 'updated_at', 'sent_at', 'paid_at', 'approved_at', 'expires_at', 'expire_at',
  'joined_at', 'started_at', 'ended_at', 'completed_at', 'cancelled_at', 'refunded_at',
  'issued_at', 'used_at', 'delivered_at', 'shipped_at', 'verified_at', 'processed_at',
  'scheduled_at', 'published_at', 'matured_at', 'settled_at', 'requested_at', 'responded_at',
  'read_at', 'deleted_at', 'registered_at', 'last_login_at', 'settled_at',
]
const RE = new RegExp(
  String.raw`new Date\(\s*([A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\.(?:${TS_FIELDS.join('|')}))\s*\)`,
  'g',
)

/** SSOT 유틸 자신 + 테스트는 면제. */
const EXEMPT_FILES = new Set(['src/utils/date.ts'])
const EXEMPT_DIRS = ['src/tests/']
/** 규칙 B(비교/정렬까지 금지)를 적용할 클라이언트 경로. */
const CLIENT_PREFIXES = ['src/pages/', 'src/components/', 'src/hooks/']

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'archive', 'coverage'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const violations = []
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/')
  if (EXEMPT_FILES.has(rel) || EXEMPT_DIRS.some(d => rel.startsWith(d))) continue
  const src = fs.readFileSync(abs, 'utf8')
  const lines = src.split('\n')
  const isClient = CLIENT_PREFIXES.some(p => rel.startsWith(p))
  let m
  RE.lastIndex = 0
  while ((m = RE.exec(src))) {
    const lineNo = src.slice(0, m.index).split('\n').length
    const line = lines[lineNo - 1] ?? ''
    const prev = lines[lineNo - 2] ?? ''
    if (line.includes('utc-date-ok') || prev.includes('utc-date-ok')) continue
    // 규칙 A: 사람에게 보이는 포맷팅 (`.toLocale...` 이 같은 줄 또는 다음 몇 줄에 이어지는 체인)
    const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 40)
    const isFormatting = /^\s*\.toLocale/.test(tail)
    if (isFormatting) {
      violations.push({ rel, lineNo, rule: 'A', expr: m[1] })
    } else if (isClient) {
      violations.push({ rel, lineNo, rule: 'B', expr: m[1] })
    }
  }
}

const counts = {}
for (const v of violations) counts[v.rel] = (counts[v.rel] || 0) + 1

if (REBASELINE) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n')
  console.log(`✅ utc-date: baseline 갱신 — ${Object.keys(counts).length}개 파일 / ${violations.length}건 동결`)
  process.exit(0)
}

let baseline = {}
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  console.log('⚠️  utc-date: baseline 파일 없음 — --rebaseline 로 생성하세요.')
}

const regressions = []
for (const [rel, n] of Object.entries(counts)) {
  const allowed = baseline[rel] ?? 0
  if (n > allowed) regressions.push({ rel, n, allowed })
}

if (regressions.length === 0) {
  const remaining = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`✅ check-utc-date-parse: 신규 위반 0${remaining ? ` (baseline 잔여 ${remaining}건 — 점진 정리 대상)` : ''}`)
  process.exit(0)
}

console.log('')
console.log('❌ UTC-naive 타임스탬프를 `new Date()` 로 직접 파싱 (신규/증가)')
console.log('   → `src/utils/date.ts` 의 parseUTCDate / formatKST* / kstDay*Ms 사용')
console.log('')
for (const r of regressions) {
  console.log(`   ${r.rel}  (${r.allowed} → ${r.n})`)
  for (const v of violations.filter(v => v.rel === r.rel)) {
    console.log(`      ${r.rel}:${v.lineNo}  [규칙 ${v.rule}] new Date(${v.expr})`)
  }
}
console.log('')
console.log('   의도적이면 해당 줄에 `utc-date-ok` 주석. 기존 잔여분을 줄였으면 --rebaseline.')
console.log('')
process.exit(STRICT ? 1 : 0)
