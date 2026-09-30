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
/**
 * ⚠️ **variant 접두사가 붙은 것은 제외한다**(`hover:` · `dark:` · `active:` …).
 * `hover:bg-gray-900` 은 *눌렀을 때 살짝 어두워지는 것*이고, `dark:bg-gray-900` 은 다크 표면이다.
 * 둘 다 "주 버튼을 검정으로 칠했다" 가 아니다 — 2026-09-29 에 앱스토어 배지(`bg-black` +
 * `hover:bg-gray-900`)가 이 구멍으로 오탐됐다. `check-theme-consistency` 와 같은 방식이다.
 */
const BLACK_FILL = /(?<![\w:-])bg-gray-900\b(?![\w-])/
const WHITE_TEXT = /(?<![\w:-])text-white\b(?![\w-])/

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
 * 그래서 className 줄 위 **8줄** 안에 눌림의 증거가 있어야만 버튼으로 읽는다.
 *
 * 🩸 2026-09-29 — 창이 **3줄이라 선택 칩을 통째로 놓치고 있었다.** 칩은 이렇게 생겼다:
 *     <button                     ← 눌림의 증거가 여기
 *       key={...}
 *       onClick={...}
 *       aria-pressed={on}
 *       className={`... ${
 *         on
 *           ? 'bg-gray-900 text-white …'   ← 위반은 여기(6~7줄 아래)
 *   실측으로 지역 칩·PC 홈 카테고리 칩·지역 카테고리 칩·정렬 시트가 전부 이 구멍으로 샜다.
 *   8줄로 넓히고 오탐을 다시 셌다(다크 카드 오탐 0 — 카드는 `<div>` 라 눌림의 증거가 없다).
 */
const PRESSABLE = /<button|<Link\b|<a\s|onClick|role=["']button["']|htmlFor=|aria-(?:pressed|current|selected)=/
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
    const window = lines.slice(Math.max(0, i - 8), i + 1).join('\n')
    if (!PRESSABLE.test(window)) return
    hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`)
  })
}

/**
 * 🔒 래칫 — 잠금표(Toss V2 / 로딩) 파일의 잔여분.
 *
 * 🔓 **2026-09-30: 동결 해제.** 여기엔 *"색만 바꾸는 일인데도 잠금 절대 룰이 걸려 0 이 아니라
 * 동결한다"* 며 `scripts/primary-button-baseline.json` 으로 잠금표 21건을 얼려 둔 장치가 있었다
 * (2026-07-19 에 `TossPaymentWidget` 버튼을 **색만** 바꿀 때도 명시 승인 + `[UNLOCK]` 을 받았다).
 * 대표 승인("다 순서대로 이상적으로 해줘")으로 **21건을 전부 이행**해 baseline 이 0 이 됐고,
 * 그 파일과 동결 로직을 함께 지웠다 — 남겨 두면 다음 세션이 "여긴 면제 구역" 으로 읽는다.
 *
 * ⚠️ 탈출구는 없어진 게 아니라 **자리를 옮겼다**: 이제는 `${ALLOW_MARK}` 표식이다.
 * 그 남용은 주입으로 못 잡으므로(가드가 표식을 존중하도록 만들어져 있다)
 * `primary-button-color-2026-09-28.test.ts` 가 **표식 개수를 래칫으로** 묶는다.
 */

if (hits.length === 0) {
  console.log(`✅ primary-button: 소비자 ${files.length}개 파일 — 새 위반 0건.`)
  process.exit(0)
}

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
