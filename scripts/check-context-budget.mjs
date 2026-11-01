#!/usr/bin/env node
/**
 * 🧠 세션 컨텍스트 예산 가드 — 2026-11-01 신설 (대표 지시 *"더이상은 발생하지 않도록 규칙을
 * 가장 이상적이고 현명하게 짜줘"*).
 *
 * ## 왜 필요한가 (실제 사고 — 추측 아님)
 * 대표 신고 *"계속 클로드 코드 세션들에서 금방 prompt is too long 이라고 되는데"* ·
 * *"클로드 코드 크레딧을 너무 빨리 소비해"*. 하루에 **세 자리**가 같은 병이었다:
 *
 *   CLAUDE.md                      589,461자 ≈ 30만 토큰   ← 세션 용량(20만)의 **151%**
 *   docs/CURRENT_WORK.md           485,550자 ≈ 24.4만 토큰
 *   docs/handoff/INDEX.local.md     53,291자 ≈ 2.4만 토큰   ← 세션이 매번 만들어 읽는 목차
 *
 * 첫 번째는 **대화를 한 마디도 안 했는데 세션이 시작하는 순간 이미 한도를 넘겼다.**
 * 그리고 그 비용은 *매 요청마다* 다시 든다 — 토큰은 요청마다 전체 컨텍스트를 다시 세므로,
 * 도구를 40번 쓰는 세션이면 30만 × 40 이 입력으로 청구된다. 거기에 **CLAUDE.md 가 바뀌면
 * 프롬프트 캐시가 깨져 전액 재청구**되는데, 이 레포는 세션마다 그 파일에 기록을 쌓았다
 * ⇒ *기록을 남기는 관행 자체가 매번 캐시를 무효화*하고 있었다.
 *
 * ## 🔴 진짜 원인은 "규칙이 없었다" 가 아니다 — **강제가 없었다**
 * `CLAUDE.md` 는 이미 `## 📚 문서 분할 (CLAUDE.md 는 활성 룰만)` 절을 갖고 있었고
 * *"사고 후일담 / 긴 표는 docs/ 로 분리"* 라고 적어 뒀다. **그 규칙이 지켜지지 않았다.**
 * 그리고 가드 144개 중 **세션 컨텍스트 비용을 보는 것은 0개**였다 —
 * `check-file-size.mjs` 는 `src/**.ts(x)` 만 보므로 `.md` 는 **무제한으로 자랄 수 있었다**
 * (실측: 그 가드를 돌리면 "대상 없음"). 이 레포의 철학 그대로다:
 * **사람 의지가 아니라 기계가 막아야 재발이 0 이다.**
 *
 * ## 설계 — 왜 래칫이 아니라 하드 상한인가
 * 이 레포의 `check-file-size` 는 *래칫*(현재값 동결, 줄이는 건 자유)이다. 그 방식은
 * **"조금씩 늘리기"를 허용**하는데, CLAUDE.md 는 정확히 그렇게 30만이 됐다(한 줄씩 284번).
 * ⇒ 컨텍스트 비용은 **절대 상한**으로 묶는다. 넘으면 *분리*하라는 뜻이고, 상한을 올리는 것은
 * 그 자체로 "매 세션 비용을 늘린다" 는 결정이라 **근거와 함께 사람이 해야 한다**.
 *
 * ## 지뢰 규칙 — 큰 파일을 금지하지 않는다
 * `docs/locks/loading-audit-log.md`(18만 토큰) 같은 파일은 **일부러 크다**(이력은 값지다).
 * 금지하는 대신 **"통째로 읽지 말고 grep 하라" 는 경고 머리말을 강제**한다. 세션이 그걸 통째로
 * 읽으면 그 세션이 그 자리에서 끝나기 때문이다. 큰 파일은 괜찮고, **경고 없는** 큰 파일이 지뢰다.
 *
 * ## 토큰 추정
 * 정확한 토크나이저가 없으므로 근사한다: 한글 1.0 토큰/자 + 그 외 0.3 토큰/자.
 * 실제 Claude 토크나이저보다 **과대추정**(=보수적)이다. 절대값이 아니라 **비율과 추세**로 쓸 것.
 *
 * 우회: `context-budget-ok` 주석(파일 앞 8줄) · 차단 모드 `STRICT_CONTEXT_BUDGET=1` 또는 `-s`
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_CONTEXT_BUDGET === '1' || process.argv.includes('-s')

/** 한글 1.0 + 그 외 0.3 토큰/자 (과대추정 = 보수적). */
function tokensOf(text) {
  let ko = 0
  for (const ch of text) if (ch >= '가' && ch <= '힣') ko++
  return Math.round(ko * 1.0 + (text.length - ko) * 0.3)
}
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const exempt = (p) => {
  const t = read(p)
  return t != null && t.split('\n').slice(0, 8).some((l) => l.includes('context-budget-ok'))
}

/**
 * 예산표. **숫자마다 근거가 있다** — 근거 없는 숫자는 다음 세션이 올린다.
 * `why` 는 사람이 읽는 것이고, 올리려면 그 문장이 여전히 참인지 먼저 따져야 한다.
 */
const BUDGETS = [
  {
    label: 'CLAUDE.md (매 요청 반복 — 가장 비싸다)',
    files: ['CLAUDE.md'],
    limit: 80_000,
    why: '매 요청에 다시 실리고, 바뀌면 캐시까지 깨진다. 창(20만)의 40% 선. 2026-11-01 실측 5.9만.',
  },
  {
    label: 'docs/CURRENT_WORK.md (안내 전용)',
    files: ['docs/CURRENT_WORK.md'],
    limit: 5_000,
    why: '기록은 docs/handoff/ 와 archive/ 로 간다. 이 파일은 "어디를 보라" 만 말한다. 실측 0.8천.',
  },
  {
    label: 'docs/handoff/INDEX.local.md (세션이 매번 만들어 읽는 목차)',
    files: ['docs/handoff/INDEX.local.md'],
    limit: 4_000,
    why: '생성기 기본이 최근 40건. 전체가 필요하면 --all(사람이 볼 때). 실측 1.7천.',
  },
  {
    label: '.claude/agents/*.md 합계 (서브에이전트 호출 시)',
    dir: '.claude/agents',
    limit: 12_000,
    why: '역할 정의는 짧아야 한다 — 길면 그 역할로 도는 모든 세션이 매번 낸다. 실측 7.2천.',
  },
  {
    label: '최근 인계 5건 합계 (새 세션 첫 액션)',
    recentHandoff: 5,
    limit: 25_000,
    why: 'CLAUDE.md 가 "최근 1~3건 열기" 를 첫 액션으로 지시한다. 한 건이 5만 토큰이면 그게 비용이 된다. 실측 1.1만.',
  },
]

/**
 * 🧭 2026-11-01 추가 — **"새 세션이 먼저 읽어라" 고 지시받은 문서**도 예산 대상이다.
 *
 * 첫 판은 `CLAUDE.md`·`CURRENT_WORK.md`·목차·역할정의·최근인계만 봤다. 그런데 `CLAUDE.md` 가
 * *"새 세션은 이 문서로 전체 구조를 먼저 잡는다"* 로 지시하는 `urdeal-platform-model.md` 가
 * **30,584 토큰**이었다 — 거의 모든 세션이 읽는데 **예산 밖**이었다(대표 질문 *"이제 다
 * 개선한거야?"* 에 답하려 재서 발견했다). 세션이 자동으로 읽는 것만 세고 *지시받아* 읽는 것을
 * 빼면, 같은 비용이 다른 파일로 옮겨 가며 자란다.
 *
 * ⚠️ 상한이 느슨하다(4만) — 이 문서들은 **구조 설명**이라 audit log 처럼 통째로 뺄 수 없다.
 * 목적은 "줄여라" 가 아니라 **"이력을 구조 문서에 쌓지 마라"** 다(그게 CLAUDE.md 가 30만이 된
 * 메커니즘이다). 넘으면 이력·로그 성격의 절을 먼저 분리할 것.
 */
const DIRECTED_READS = [
  'docs/design/urdeal-platform-model.md',
  'docs/design/ai-team-operating-model.md',
  'docs/DEV_IMPLEMENTATION_PLAYBOOK.md',
  'docs/ERROR_DEBUGGING_PLAYBOOK.md',
  'docs/KNOWN_ERRORS.md',
  'docs/FEATURE_STATUS.md',
]
const DIRECTED_LIMIT = 40_000

/** 이 크기를 넘는 문서는 "통째로 읽지 말 것" 경고가 있어야 한다. */
const LANDMINE_TOKENS = 120_000
const LANDMINE_HINTS = ['통째로 읽지 말', '통째로 읽지 않', 'grep']

function recentHandoffFiles(n) {
  const dir = 'docs/handoff'
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    // 🩸 **날짜 접두사만 센다.** 첫 판은 `.md` 전부를 세어 목차 사이드카
    //   `INDEX.local.md` 가 섞였다 — 역순 정렬에서 'I' 가 숫자보다 앞이라 **항상 상위 5건에
    //   들어왔다**. 그러면 ① 인계 예산이 목차 때문에 부풀고 ② 목차는 자기 예산이 따로 있으니
    //   **이중 계산**이다. 같은 함정을 사람도 밟았다(2026-11-01 측정에서 인계 5건을
    //   11,338 → 32,555 토큰으로 잘못 읽었다). 이 시험이 그걸 잡았다.
    .filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f) && f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, n)
    .map((f) => join(dir, f))
}

function allDocs() {
  const out = []
  const walk = (d) => {
    if (!existsSync(d)) return
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) out.push(p)
    }
  }
  walk('docs')
  for (const f of readdirSync('.')) if (f.endsWith('.md')) out.push(f)
  return out
}

const violations = []
// ⚠️ 이름이 `checked` 인 것은 취향이 아니다 — `check-guard-selfcheck` 가 "측정 0 = 실패"
//   선언을 **정해진 어휘**(`length|size|count|total|scanned|checked|files|targets|entries|rows`)로만
//   인정한다. 처음 `measured` 로 썼더니 **선언이 있는데도 미선언으로 잡혀** push 가 막혔다
//   (그 가드 자신이 주석에 적어 둔 알려진 한계다). 바꾸려면 그 어휘 안에서 고를 것.
let checked = 0

// ── ① 예산 ─────────────────────────────────────────────────────────
for (const b of BUDGETS) {
  const files = b.dir
    ? (existsSync(b.dir) ? readdirSync(b.dir).filter((f) => f.endsWith('.md')).map((f) => join(b.dir, f)) : [])
    : b.recentHandoff
      ? recentHandoffFiles(b.recentHandoff)
      : b.files
  const present = files.filter((f) => existsSync(f))
  // 생성물(사이드카)은 없을 수 있다 — 그건 위반이 아니다.
  if (!present.length) continue
  if (present.every(exempt)) continue
  checked += present.length
  const total = present.reduce((s, f) => s + tokensOf(readFileSync(f, 'utf8')), 0)
  const pct = Math.round((total / b.limit) * 100)
  const line = `${b.label}: ${total.toLocaleString()} / ${b.limit.toLocaleString()} 토큰 (${pct}%)`
  if (total > b.limit) {
    violations.push({ line, why: b.why, files: present })
  } else if (pct >= 85) {
    console.log(`⚠️  ${line} — 상한에 가깝다. 지금 분리할 것.`)
  }
}

// ── ①-2 "먼저 읽어라" 고 지시받은 문서 ─────────────────────────────
for (const f of DIRECTED_READS) {
  if (!existsSync(f) || exempt(f)) continue
  checked++
  const tk = tokensOf(readFileSync(f, 'utf8'))
  const pct = Math.round((tk / DIRECTED_LIMIT) * 100)
  const line = `${f}: ${tk.toLocaleString()} / ${DIRECTED_LIMIT.toLocaleString()} 토큰 (${pct}%)`
  if (tk > DIRECTED_LIMIT) {
    violations.push({
      line,
      why: 'CLAUDE.md 가 "새 세션이 먼저 읽어라" 고 지시하는 문서 — 거의 모든 세션이 이 비용을 낸다. 이력·로그 성격의 절을 분리할 것.',
      files: [f],
    })
  } else if (pct >= 85) {
    console.log(`⚠️  ${line} — 상한에 가깝다. 이력·로그 절을 먼저 분리할 것.`)
  }
}

// ── ② 지뢰: 경고 없는 거대 문서 ────────────────────────────────────
const landmines = []
for (const f of allDocs()) {
  const t = readFileSync(f, 'utf8')
  const tk = tokensOf(t)
  if (tk <= LANDMINE_TOKENS) continue
  checked++
  if (exempt(f)) continue
  const head = t.split('\n').slice(0, 30).join('\n')
  if (!LANDMINE_HINTS.some((h) => head.includes(h))) landmines.push({ f, tk })
}

// ── ③ 측정 대상 0건은 통과가 아니라 실패 ──────────────────────────
//    (이 레포가 반복해 당한 "헛도는 가드" 클래스 — 경로가 낡아 조용히 비는 것을 막는다.)
if (checked < 5) {
  console.error(`❌ context-budget: 측정 대상이 ${checked}건뿐이다 — 경로가 낡아 가드가 헛돌고 있다.`)
  process.exit(1)
}

if (!violations.length && !landmines.length) {
  console.log(`✅ context-budget: 세션 컨텍스트 예산 통과 (측정 ${checked}건).`)
  process.exit(0)
}

console.log('')
console.log('🧠 세션 컨텍스트 예산 초과 — 이게 `prompt is too long` 과 크레딧 과소비의 원인이다:')
for (const v of violations) {
  console.log(`\n  ❌ ${v.line}`)
  console.log(`     왜 이 상한인가: ${v.why}`)
  console.log(`     파일: ${v.files.join(', ')}`)
}
for (const m of landmines) {
  console.log(`\n  ❌ 경고 없는 거대 문서: ${m.f} (${m.tk.toLocaleString()} 토큰)`)
  console.log(`     ${LANDMINE_TOKENS.toLocaleString()} 토큰을 넘는 문서는 머리말 30줄 안에`)
  console.log(`     "통째로 읽지 말 것" + grep 안내를 둘 것 — 세션이 통째로 읽으면 그 세션이 끝난다.`)
}
console.log('')
console.log('👉 처방은 삭제가 아니라 **분리**다(기록은 값지다):')
console.log('   · 변경 이력 → docs/locks/*.md  · 가드 표 → docs/GUARD_RAILS.md')
console.log('   · 세션 인계 → docs/handoff/<날짜>-<슬러그>.md  · 옛 기록 → docs/handoff/archive/')
console.log('   원래 자리에는 "그 파일을 grep 하라" 는 한 줄만 남긴다. 상세: CLAUDE.md "📚 문서 분할".')
console.log('')
if (STRICT) process.exit(1)
console.log('(warn 모드 — 차단은 STRICT_CONTEXT_BUDGET=1)')
