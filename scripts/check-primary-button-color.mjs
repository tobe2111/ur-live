#!/usr/bin/env node
/**
 * 🔵 2026-09-28: 소비자 **주 행동 버튼**을 손으로 검정으로 칠하는 것 차단.
 *
 * ## 무엇이 문제였나 (실측)
 *
 * 2026-09-02 에 대표가 코레일톡 체계를 확정하면서 주 버튼을 **잉크 #16181C → 브랜드 블루
 * #1C69EF** 로 정했고(`docs/design/ticket-completion-reference-2026-09.md` §주 버튼),
 * `.ur-btn-primary` 클래스까지 만들어 *"페이지는 뜻만 고른다"* 고 못 박았다.
 * 그런데 2026-09-28 에 재 보니 소비자 화면 **80곳(48파일)** 이 아직
 * `bg-gray-900 dark:bg-white text-white dark:text-gray-900` 을 손으로 적고 있었다.
 *
 * 그래서 **똑같은 역할의 버튼이 화면마다 다른 색**이었다 — "다시 시도"가 마이에선 파랑,
 * 숙소 목록에선 검정. 홈의 "교환권 보러가기"도 검정, 마이의 "이용권 사용처리"는 파랑.
 * 빌드는 초록이고 화면도 안 깨져서 **아무도 신고하지 않는다.** 대표가 두 번 지적한
 * *"디자인, ui 모두 별로야 · 대기업수준이 필요해"* 의 실체 중 하나가 이것이다.
 *
 * ## 무엇을 보나
 *
 * 소비자 표면(`src/pages` · `src/components`)에서 검정 채움 + 흰 글자(다크에서 반전)를
 * **한 className 안에** 손으로 적은 자리. 대안은 둘 다 이미 있다:
 *   · `ur-btn` 을 쓰는 자리  → `ur-btn-primary` (뜻 클래스, 현재 344곳)
 *   · 그 외                  → `bg-brand text-white` (현재 265곳)
 *
 * ## 무엇을 안 보나 (의도적)
 *
 *   · **대시보드·도매·유어애즈**(`admin`/`seller`/`agency`/`wholesale`/`supplier`/`marketing`)
 *     — 서비스가 다르고 팔레트도 다르다(서비스 분리 룰).
 *   · **검정 *글자*·검정 테두리** — 이 가드는 *채움*만 본다. 잉크 글자는 규칙 ⑤(나머지는 회색)라 정상.
 *   · **`bg-gray-900` 단독** — 카드 바탕·스크림·배지에 쓰이는 정상 용법이다. 흰 글자와
 *     **같이** 있을 때만 "버튼"으로 읽는다.
 *   · 테스트·스토리.
 *
 * ## 이 가드가 못 잡는 것
 *
 *   · 변수로 조립한 클래스(`const c = 'bg-gray-' + n`) — 문자열이 한 줄에 안 나타난다.
 *   · 인라인 `style={{ background: '#16181C' }}` — 같은 사고를 다른 표기로 낼 수 있다.
 *   · **파랑이 맞는 자리인지**는 안 본다. 파괴적 행동(삭제·탈퇴)까지 파랑으로 칠하는 것은
 *     이 가드가 통과시킨다 — 그건 사람이 본다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_PRIMARY_BUTTON=1 또는 `-s`.
 * 의도적 예외: 그 줄에 `primary-button-ok` 주석.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_PRIMARY_BUTTON === '1' || process.argv.includes('-s')
const ALLOW_MARK = 'primary-button-ok'

const ROOTS = ['src/pages', 'src/components']
const EXT = /\.tsx$/
/** 소비자가 아닌 표면 — 서비스가 다르면 팔레트도 다르다. */
const OTHER_SERVICE = /(admin|seller|agency|wholesale|supplier|marketing|debug)/i
const EXEMPT_PATH = /(\/tests?\/|\.test\.tsx?$|\.spec\.tsx?$|\.stories\.tsx?$)/

/**
 * 검정 *채움* + 흰 글자가 한 className 안에 있는 모양.
 * ⚠️ `bg-gray-900` 단독은 안 잡는다 — 카드 바탕·스크림의 정상 용법이다.
 *    흰 글자를 달고 있어야 "누르는 것" 으로 읽힌다.
 */
const BLACK_FILL = /\bbg-gray-900\b(?![\w-])/
const WHITE_TEXT = /\btext-white\b(?![\w-])/

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, out)
    else if (EXT.test(p)) out.push(p)
  }
  return out
}

const all = ROOTS.flatMap((r) => walk(r))
const files = all.filter((f) => !OTHER_SERVICE.test(f) && !EXEMPT_PATH.test(f))

// "측정 0 = 통과 아님" — 경로가 낡아 훑을 게 없어진 것을 초록으로 넘기지 않는다.
if (files.length < 200) {
  console.error(`❌ primary-button: 소비자 tsx 가 ${files.length}개뿐이다 — ROOTS 가 낡았다(통과 아님).`)
  process.exit(1)
}

/**
 * **누를 수 있는가**를 판정한다. 검정 채움 + 흰 글자만으로는 부족하다 —
 * 다크 *카드*(`<div className="bg-gray-900 rounded-2xl p-5 text-white">`)와 다크 *섹션*이
 * 같은 모양이고, 그건 규칙 위반이 아니라 정상이다(첫 판에서 144건 중 상당수가 그것이었다).
 * 그래서 className 줄 위 3줄 안에 눌림의 증거가 있어야만 버튼으로 읽는다.
 */
const PRESSABLE = /<button|<Link\b|<a\s|onClick|role=["']button["']|htmlFor=/
/** 주석 줄은 코드가 아니다(`CartPage` 의 설명 주석이 첫 판에서 잡혔다). */
const COMMENT = /^\s*(\/\/|\/\*|\*|\{\/\*)/

const hits = []
for (const f of files) {
  let src
  try { src = readFileSync(f, 'utf8') } catch { continue }
  if (!BLACK_FILL.test(src)) continue
  const lines = src.split('\n')
  lines.forEach((l, i) => {
    if (l.includes(ALLOW_MARK) || COMMENT.test(l)) return
    if (!BLACK_FILL.test(l) || !WHITE_TEXT.test(l)) return
    const window = lines.slice(Math.max(0, i - 3), i + 1).join('\n')
    if (!PRESSABLE.test(window)) return
    hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`)
  })
}

/**
 * 🔒 래칫 — 잠금표(Toss V2 / 로딩) 파일의 잔여분.
 *
 * 색만 바꾸는 일인데도 CLAUDE.md 의 *"사용자 명시 허가 없이 변경/제거 금지"* 절대 룰이 걸린다
 * (2026-07-19 에 `TossPaymentWidget` 버튼을 **색만** 바꿀 때도 명시 승인 + `[UNLOCK]` 을 받았다).
 * 그래서 0 이 아니라 **동결**한다 — 늘면 빨간불, 줄이는 건 자유.
 * 대표 승인이 나오면 0 으로 내리고 baseline 파일을 지운다.
 */
const BASELINE_PATH = 'scripts/primary-button-baseline.json'
let baseline = {}
try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files || {} } catch { baseline = {} }

if (process.argv.includes('--rebaseline')) {
  const counts = {}
  for (const h of hits) {
    const f = h.split(':')[0]
    counts[f] = (counts[f] || 0) + 1
  }
  const prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  prev.files = Object.fromEntries(Object.entries(counts).sort())
  writeFileSync(BASELINE_PATH, JSON.stringify(prev, null, 2) + '\n')
  console.log(`✅ primary-button: baseline 갱신 — ${hits.length}건.`)
  process.exit(0)
}

/** 동결값 이내인 파일의 건은 통과시키고, 넘친 만큼만 남긴다. */
const overflow = []
const seen = {}
for (const h of hits) {
  const f = h.split(':')[0]
  seen[f] = (seen[f] || 0) + 1
  if (seen[f] > (baseline[f] || 0)) overflow.push(h)
}
/** 동결해 둔 파일이 이미 깨끗해졌으면 baseline 을 내리라고 알린다(낡은 지도 방지). */
const stale = Object.keys(baseline).filter((f) => !seen[f])

if (overflow.length === 0 && stale.length === 0) {
  const frozen = Object.values(baseline).reduce((a, b) => a + b, 0)
  console.log(`✅ primary-button: 소비자 ${files.length}개 파일 — 새 위반 0건`
    + (frozen ? ` (잠금표 잔여 ${frozen}건 동결 — 대표 승인 대기).` : '.'))
  process.exit(0)
}

if (overflow.length === 0 && stale.length > 0) {
  const say0 = STRICT ? console.error : console.warn
  say0(`${STRICT ? '❌' : '⚠️'} primary-button: 동결해 둔 파일이 이미 깨끗하다 — baseline 이 낡았다: ${stale.join(', ')}`)
  say0('   `node scripts/check-primary-button-color.mjs --rebaseline` 로 내릴 것.')
  process.exit(STRICT ? 1 : 0)
}

hits.length = 0
hits.push(...overflow)

const say = STRICT ? console.error : console.warn
say(`${STRICT ? '❌' : '⚠️'} primary-button: 소비자 주 버튼을 손으로 검정으로 칠한 곳 ${hits.length}건`)
for (const h of hits) say(`   ${h}`)
say(`
  주 버튼은 2026-09-02 에 **브랜드 블루 #1C69EF** 로 확정됐다
  (docs/design/ticket-completion-reference-2026-09.md — "주 버튼 ur-btn-primary : 잉크 → 브랜드 블루").
  같은 역할의 버튼이 화면마다 색이 다르면 **빌드는 초록인데 제품이 덜 만든 것처럼 보인다.**
    · \`ur-btn\` 을 쓰는 자리 → \`ur-btn-primary\`
    · 그 외                  → \`bg-brand text-white\`
  검정이 정말 맞는 자리라면(사진 위 스크림 등) 그 줄에 '${ALLOW_MARK}' 주석.`)
process.exit(STRICT ? 1 : 0)
