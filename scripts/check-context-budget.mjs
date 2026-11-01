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
 * 🧭 **CLAUDE.md 가 언급하는 문서는 전부 예산 대상이다 — 손으로 적은 목록이 아니다.**
 *
 * 첫 판은 `DIRECTED_READS` 라는 **손으로 쓴 6줄**이었다. 그게 왜 위험한가: 내일 어떤 세션이
 * CLAUDE.md 에 *"이건 먼저 읽어라"* 한 줄을 더하면 그 문서는 **예산 밖에서 자란다.** 실제로
 * 그렇게 숨어 있었다 — `urdeal-platform-model.md` 가 **30,584 토큰**인데 거의 모든 세션이
 * 읽고 있었고, 대표 질문(*"이제 다 개선한거야?"*)에 답하려 재 보고서야 발견했다.
 * ⇒ **목록을 사람이 관리하면 반드시 낡는다.** 그래서 CLAUDE.md 를 파싱해 **자동으로** 뽑는다.
 *
 * 두 등급이다(둘 다 자동 판정):
 *   - **A 먼저 읽어라** — 그 경로가 적힌 줄(과 앞 줄)에 `먼저 읽/먼저 스캔/필수 참조 …` 가 있다.
 *     세션이 **통째로** 읽으라고 지시받은 문서라 **하드 상한 4만**이고, grep 머리말로 면제되지 않는다.
 *   - **B 그 외 언급** — 4만을 넘으면 **"통째로 읽지 말고 grep 하라" 머리말이 있어야** 한다.
 *     큰 것 자체는 죄가 아니다(이력은 값지다). **경고 없는** 큰 것이 지뢰다.
 *
 * ⚠️ **이 가드가 못 보는 것**: A 판정은 낱말 매칭이라 *"이 문서로 전체를 파악할 것"* 처럼
 * 다르게 쓰면 B 로 떨어진다. **그래도 0 으로는 안 떨어진다** — B 가 받아서 머리말을 요구한다
 * (약해지되 사라지지 않게 설계했다). A 로 올리고 싶으면 CLAUDE.md 의 그 문장에 `먼저 읽`
 * 같은 표현을 쓰면 되고, 그게 사람에게도 더 분명하다.
 */
const DIRECTED_KEYWORDS = [
  '먼저 읽', '먼저 스캔', '먼저 열', '먼저 볼', '먼저 확인', '먼저 판별',
  '필수 참조', '먼저 잡는다',
]
/** BUDGETS 가 이미 자기 상한으로 재는 파일 — 여기서 또 세면 이중 계산이다. */
const BUDGETED = new Set(['CLAUDE.md', 'docs/CURRENT_WORK.md', 'docs/handoff/INDEX.local.md'])

function directedDocs() {
  const src = read('CLAUDE.md')
  if (src == null) return []
  const lines = src.split('\n')
  const found = new Map() // path -> tierA(boolean)
  for (let i = 0; i < lines.length; i++) {
    // `docs/...md` 또는 루트 대문자 문서(TECHNICAL_DEBT.md 등)
    for (const m of lines[i].matchAll(/(?:docs\/[A-Za-z0-9_\-./]*|[A-Z][A-Za-z_]*)\.md/g)) {
      const p = m[0]
      if (BUDGETED.has(p) || !existsSync(p)) continue
      const win = (i ? lines[i - 1] : '') + ' ' + lines[i]
      const tierA = DIRECTED_KEYWORDS.some((k) => win.includes(k))
      found.set(p, (found.get(p) || false) || tierA)
    }
  }
  return [...found].map(([file, tierA]) => ({ file, tierA }))
}
const DIRECTED_LIMIT = 40_000

/** 이 크기를 넘는 문서는 "통째로 읽지 말 것" 경고가 있어야 한다. */
const LANDMINE_TOKENS = 120_000
const LANDMINE_HINTS = ['통째로 읽지 말', '통째로 읽지 않', 'grep']

/**
 * 🧊 **잠금 변경 기록은 동결 파일 + 기록마다 파일 하나** — 2026-11-01 (대표 *"모든 세션에서 배포하는
 * 과정이 순탄하지가 않아 … 왜 이러는거지?"* → *"응 ②도 진행해줘"*).
 *
 * ## 왜 (실측 — 추측 아님)
 * 같은 PR 이 하루에 **두 번** 같은 자리에서 충돌했다: 로딩 잠금 기록의 **맨 위 줄**. 규칙이
 * *"새 기록은 그 파일 맨 위에 추가한다"* 였으므로 잠금 파일을 건드리는 **모든 세션이 같은 줄을
 * 고친다** — 내용상 무관한 작업끼리도 반드시 충돌하고, 풀어서 다시 올리면 Verify(전수면 1시간+)가
 * 처음부터 돈다. 최근 Verify 100회 중 **36회가 취소**(새 커밋에 밀려 버려짐)였다.
 * 이건 2026-07-29 `CURRENT_WORK.md` 가 겪은 것과 **똑같은 병**이고, 그때 처방(세션마다 파일 하나)이
 * 효과를 냈다. 기록을 CLAUDE.md 에서 별도 파일로 옮긴 것만으로는 **충돌 자리가 이사 갔을 뿐**이다.
 *
 * ## 규칙
 *   - 옛 큰 파일은 **동결**: 항목 수가 정확히 `entries` 여야 한다. 늘면 = 누가 맨 위에 또 적었다,
 *     줄면 = 이력을 지웠다(이력은 값지다). **둘 다 실패**다 — 그래서 이 숫자를 올리는 것으로는
 *     못 빠져나간다(올리면 실제 파일과 안 맞아 빨간불).
 *   - 새 기록은 `dir/<YYYY-MM-DD>-<슬러그>.md` **한 건당 한 파일**. 이름이 다르면 두 세션이
 *     같은 날 기록해도 **같은 줄을 만질 일이 없다.**
 *
 * ⚠️ **왜 별도 가드가 아니라 여기인가**: 새 가드를 `verify.yml` 에 등록하면 그 파일이
 * `ALWAYS_FULL`(guard-mutations-scope.mjs)이라 **주입 전수(5천 건, 1시간+)가 돈다.** 배포를
 * 쉽게 하자는 일이 배포를 무겁게 만들면 안 된다. 그리고 같은 계열(세션이 읽는 문서의 구조)이다.
 */
const FROZEN_LOGS = [
  { file: 'docs/locks/loading-audit-log.md', entries: 239, dir: 'docs/locks/loading', tag: '[UNLOCK_LOADING] / [LOADING_ADDITIVE]' },
  { file: 'docs/locks/toss-v2-audit-log.md', entries: 48, dir: 'docs/locks/toss', tag: '[UNLOCK]' },
]
const LOG_ENTRY_RE = /^- 20\d\d-\d\d-\d\d /
const LOG_FILE_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/

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

// ── ①-2 CLAUDE.md 가 언급하는 문서 (자동 추출) ─────────────────────
const directed = directedDocs()
for (const { file: f, tierA } of directed) {
  if (exempt(f)) continue
  checked++
  const t = readFileSync(f, 'utf8')
  const tk = tokensOf(t)
  if (tk <= DIRECTED_LIMIT) {
    const pct = Math.round((tk / DIRECTED_LIMIT) * 100)
    if (tierA && pct >= 85) {
      console.log(`⚠️  ${f}: ${tk.toLocaleString()} / ${DIRECTED_LIMIT.toLocaleString()} 토큰 (${pct}%) — 이력·로그 절을 먼저 분리할 것.`)
    }
    continue
  }
  const line = `${f}: ${tk.toLocaleString()} / ${DIRECTED_LIMIT.toLocaleString()} 토큰`
  if (tierA) {
    violations.push({
      line: `${line} — CLAUDE.md 가 "먼저 읽어라" 고 지시하는 문서`,
      why: '거의 모든 세션이 이 비용을 낸다. grep 머리말로 면제되지 않는다 — 통째로 읽으라고 지시한 문서이기 때문이다. 이력·로그 성격의 절을 분리할 것.',
      files: [f],
    })
    continue
  }
  // B 등급 — 커도 되지만 경고 머리말이 있어야 한다.
  const head = t.split('\n').slice(0, 30).join('\n')
  if (!LANDMINE_HINTS.some((h) => head.includes(h))) {
    violations.push({
      line: `${line} — CLAUDE.md 가 언급하는데 "통째로 읽지 말 것" 머리말이 없다`,
      why: '세션이 이 문서를 열 수 있고, 통째로 읽으면 창의 20%+ 를 한 번에 쓴다. 크기를 줄이라는 게 아니라 머리말 30줄 안에 grep 안내를 두라는 것이다.',
      files: [f],
    })
  }
}

// ── ①-3 잠금 변경 기록: 동결 + 기록마다 파일 하나 ───────────────────
for (const f of FROZEN_LOGS) {
  // 합성 트리(시험)에는 없을 수 있다 — 실제 레포에 있는지는 시험이 따로 고정한다.
  if (!existsSync(f.file)) continue
  checked++
  const n = readFileSync(f.file, 'utf8').split('\n').filter((l) => LOG_ENTRY_RE.test(l)).length
  if (n !== f.entries) {
    const grew = n > f.entries
    violations.push({
      line: `${f.file}: 항목 ${n}건 (동결값 ${f.entries}건) — ${grew ? '누가 맨 위에 또 적었다' : '이력이 지워졌다'}`,
      why: grew
        ? `이 파일은 동결됐다. 모든 세션이 맨 위 같은 줄에 적어 머지마다 충돌했다(Verify 가 처음부터 다시 돈다). ` +
          `새 ${f.tag} 기록은 ${f.dir}/<날짜>-<슬러그>.md 파일 하나로 쓸 것 — 이 줄을 그 파일로 옮기면 된다.`
        : '옛 기록은 왜 지금 그 모양인지·이미 기각한 처방이 담긴 이력이다. 지우지 말 것. 동결값을 내리는 것으로 통과시키지 말 것.',
      files: [f.file],
    })
  }
  if (existsSync(f.dir)) {
    for (const e of readdirSync(f.dir)) {
      if (e === 'README.md') continue
      checked++
      if (!LOG_FILE_RE.test(e)) {
        violations.push({
          line: `${f.dir}/${e}: 이름이 <YYYY-MM-DD>-<슬러그>.md 가 아니다`,
          why: '날짜 접두사가 있어야 정렬이 곧 최신순이고, 슬러그가 있어야 같은 날 두 세션이 같은 파일을 만지지 않는다.',
          files: [`${f.dir}/${e}`],
        })
      }
    }
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
//    🔑 여기서 바로 exit 하지 않는다 — 그러면 **진짜 위반이 있어도 그 출력이 가려진다**
//       (실측: CLAUDE.md 상한 초과 트리에서 자기점검 메시지만 뜨고 "왜 이 상한인가" 가 사라졌다).
//       자기점검과 위반은 **둘 다** 보여야 한다.
const selfcheck = []
if (checked < 5) {
  selfcheck.push(`측정 대상이 ${checked}건뿐이다 — 경로가 낡아 가드가 헛돌고 있다.`)
}
// 🩸 CLAUDE.md 에서 뽑은 문서가 소수면 **추출 정규식이 깨진** 것이다. 같은 클래스의 침묵이지만
//    원인이 달라 메시지를 가른다 — 원인을 구분 못 하는 메시지는 그 자체가 결함이다
//    (CLAUDE.md 개발 룰 3-1).
if (directed.length < 20) {
  selfcheck.push(
    `CLAUDE.md 에서 뽑은 문서가 ${directed.length}건뿐이다 — 추출 정규식이 깨졌다(헛도는 가드).`,
  )
}
for (const m of selfcheck) console.error(`❌ context-budget: ${m}`)

if (!violations.length && !landmines.length && !selfcheck.length) {
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
if (STRICT || selfcheck.length) process.exit(1)
console.log('(warn 모드 — 차단은 STRICT_CONTEXT_BUDGET=1)')
