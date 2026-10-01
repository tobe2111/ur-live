import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * 🔵 2026-09-28 — 소비자 **주 행동 버튼**의 색.
 *
 * ## 무엇이 문제였나 (실측)
 *
 * 2026-09-02 에 대표가 코레일톡 체계를 확정하며 주 버튼을 **잉크 #16181C → 브랜드 블루 #1C69EF**
 * 로 정했고(`docs/design/ticket-completion-reference-2026-09.md`), `.ur-btn-primary` 클래스까지
 * 만들면서 *"페이지는 뜻만 고른다"* 고 못 박았다. 그런데 2026-09-28 에 재 보니 소비자 화면
 * **224곳**이 여전히 `bg-gray-900 … text-white` 를 손으로 적고 있었다.
 *
 * 그래서 **똑같은 역할의 버튼이 화면마다 색이 달랐다** — "다시 시도"가 마이에선 파랑,
 * 숙소 목록에선 검정. 홈의 "교환권 보러가기"는 검정, 마이의 "이용권 사용처리"는 파랑.
 * 빌드는 초록이고 화면도 안 깨져서 **아무도 신고하지 않는다.** 대표가 두 번 지적한
 * *"디자인, ui 모두 별로야 · 대기업수준이 필요해"* 의 실체 중 하나가 이것이다.
 *
 * ## 이 시험이 못 보는 것
 *
 *   · **파랑이 맞는 자리인지**는 안 본다. 파괴적 행동(삭제·탈퇴)까지 파랑으로 칠하면 통과한다.
 *   · 변수로 조립한 클래스 · 인라인 `style` 로 같은 사고를 내는 것.
 *   · 실제 렌더 색은 안 잰다(이 환경은 브라우저 CONNECT 가 막혀 있다) — CI 의 contrast
 *     워크플로가 실제 렌더로 다시 잰다.
 */

const GUARD = 'scripts/check-primary-button-color.mjs'
const BASELINE = 'scripts/primary-button-baseline.json'

function runGuard(): number {
  try {
    execFileSync('node', [GUARD, '-s'], { stdio: 'pipe' })
    return 0
  } catch (e) {
    return (e as { status?: number }).status ?? 1
  }
}

/**
 * 가드 소스에서 정규식 **리터럴을 꺼내 실제로 돌려 본다.**
 *
 * 🩸 왜 이 헬퍼가 생겼나 (2026-10-01): 아래 단언이 가드의 정규식을 **원문으로 베껴** 갖고 있었다.
 *   그래서 검정의 종류를 늘리는(=가드를 **강화**하는) 커밋에 빨간불이 났다. 지키려던 것은
 *   글자가 아니라 **행동**이므로, 리터럴을 꺼내 입력을 넣어 본다 — 앵커가 다시는 안 낡는다.
 */
function regexLiteral(src: string, name: string): RegExp {
  const m = src.match(new RegExp(`^const ${name} = (/.*/)([a-z]*)$`, 'm'))
  expect(m, `${name} 정규식 리터럴을 못 찾았다 — 이 검사가 헛돌고 있다`).toBeTruthy()
  return new RegExp(m![1].slice(1, -1), m![2])
}

describe('주 버튼은 브랜드 블루다 (검정 손색 차단)', () => {
  it('현재 코드는 통과한다 — 잠기지 않은 소비자 표면에 검정 주버튼 0건', () => {
    expect(runGuard()).toBe(0)
  })



  it('가드가 실패할 수 있다 — 검정 주버튼을 심으면 빨간불', () => {
    // 합성 위반을 임시 파일이 아니라 **가드 자신의 판정 함수**로 확인할 수는 없으므로
    // (가드는 파일시스템을 훑는다), 여기서는 가드 소스가 판정에 필요한 세 조각을
    // 실제로 갖고 있는지 본다. 진짜 주입은 `scripts/mutations/primary-button-color.mjs` 가 한다.
    const src = readFileSync(GUARD, 'utf8')
    expect(src).toMatch(/BLACK_FILL\s*=\s*\//)
    expect(src).toMatch(/WHITE_TEXT\s*=\s*\//)
    expect(src).toMatch(/PRESSABLE\s*=\s*\//)
    // "측정 0 = 통과 아님" — 경로가 낡아 훑을 게 없어진 것을 초록으로 넘기지 않는다.
    expect(src).toMatch(/files\.length\s*<\s*200/)
    /**
     * 🩸 2026-09-29 — **눌림 판정 창이 3줄이라 선택 칩을 통째로 놓치고 있었다.**
     * 칩은 `<button` → `key` → `onClick` → `aria-pressed` → `className={\`…` → `on` → `? '…'` 라
     * 위반이 6~7줄 아래에 있다. 실측으로 검정 칩 다섯이 이 구멍으로 샜다(지역·PC홈·지역카테고리·
     * 숙소카테고리·정렬시트). 8줄로 넓히자 주소 저장·공용 모달 버튼까지 더 드러났다.
     * ⇒ **값을 잠근다** — 좁히면 같은 것이 다시 샌다.
     */
    const win = src.match(/lines\.slice\(Math\.max\(0, i - (\d+)\)/)
    expect(win, '눌림 판정 창을 못 찾았다 — 이 검사가 헛돌고 있다').toBeTruthy()
    expect(Number(win![1]), '창이 좁아졌다 — 칩의 위반은 6~7줄 아래에 있다').toBeGreaterThanOrEqual(8)
    /**
     * 🩸 2026-10-01 — 여기는 원래 `toMatch(/\(\?<!\[\\w:-\]\)bg-gray-900/)` 였다. 즉 가드의 정규식이
     * *"lookbehind 바로 뒤에 `bg-gray-900` 이 붙어 있는 모양"* 이기를 요구했다. 그래서 검정의
     * **종류를 늘리는**(=가드를 강화하는) 커밋에 빨간불이 났다 — `bg-black`·hex 검정을 교대로
     * 넣자 그 사이에 `(?:` 가 끼었기 때문이다. 지키려던 것은 글자가 아니라 **행동**이다.
     * ⇒ 리터럴을 꺼내 실제로 돌려 본다(variant 제외 · 투명도 제외 · 검정은 전부 잡기).
     */
    const blackFill = regexLiteral(src, 'BLACK_FILL')
    expect(blackFill.test('bg-gray-900'), '검정 토큰을 못 잡는다').toBe(true)
    expect(blackFill.test('bg-black'), 'bg-black 을 못 잡는다').toBe(true)
    // 🕳️ 2026-10-01 실측: 로그인·가입의 주 버튼이 `bg-[#111]` 이라 **토큰 이름만 보던 가드를 통과**했다.
    //    가입 화면을 렌더해 보고서야 드러났다 — 이름이 아니라 **색**을 봐야 한다.
    expect(blackFill.test('bg-[#111]'), 'hex 검정을 못 잡는다 — 로그인·가입 버튼이 이 구멍으로 샜다').toBe(true)
    // variant 접두사(`hover:`·`dark:`)는 제외한다 — 앱스토어 배지가 이 구멍으로 오탐됐다.
    expect(blackFill.test('dark:bg-gray-900'), 'variant 접두사를 제외하지 않는다').toBe(false)
    expect(blackFill.test('hover:bg-gray-900'), 'variant 접두사를 제외하지 않는다').toBe(false)
    // 투명도가 붙은 검정은 **정의상 스크림**이다(사진 위 화살표·`+N` 오버레이가 전부 이 모양) —
    // 넓히자마자 오탐 3건이 여기서 났다. 주 버튼은 반투명하지 않다.
    expect(blackFill.test('bg-black/45'), '스크림을 주 버튼으로 오탐한다').toBe(false)
    expect(blackFill.test('bg-gray-900/40'), '스크림을 주 버튼으로 오탐한다').toBe(false)
  })

  it('브랜드 블루 쪽이 이제 다수다 — 이행이 실제로 됐는가', () => {
    // 이행 전: 검정 224 vs 블루 409. 2026-09-30 잠금표 21건까지 이행해 검정 주버튼은 0 이다.
    const out = execFileSync('bash', ['-c',
      `grep -rn "bg-brand text-white\\|ur-btn-primary" src/pages src/components --include=*.tsx | wc -l`,
    ], { encoding: 'utf8' })
    expect(Number(out.trim())).toBeGreaterThan(400)
  })

  it('🚪 예외 표식이 면제의 문이 되지 않는다 — 개수가 늘지 않는다', () => {
    /**
     * 🩸 2026-09-30: `primary-button-ok` 를 진짜 주 버튼에 달면 가드는 **표식을 존중해 통과시킨다** —
     * 주입으로 그 남용을 잡을 방법이 없다(가드가 스스로 예외를 인정하도록 만들어져 있다).
     * 그래서 막는 방법은 하나다: **표식의 개수를 래칫으로 묶는 것.**
     *
     * 지금 **둘**이고 둘 다 버튼이 아니다:
     *   `ProductDetailPage` — 클릭 가능한 다크 정보 패널(카드). 파랗게 칠하면 진짜 CTA 와 같은 색의 큰 면이 둘이 된다.
     *   `ImageUpload`       — 사진 위 스크림 배지. 가드 머리말이 말한 "카드 바탕·스크림의 정상 용법" 그 자체다.
     *   `KakaoShareButton`  — **X(구 트위터) 공유 버튼**(2026-10-01 추가). 검정은 X 의 *플랫폼 브랜드색*이고
     *                         바로 옆 형제가 LINE `#00B900` 이다. 블루로 칠하면 **어느 서비스로 공유되는지
     *                         알 수 없게 된다** — 우리 주 버튼이 아니라 남의 로고다.
     * 늘려야 할 진짜 예외가 생기면 **이 숫자를 올리면서 왜인지 여기 적는다.**
     *
     * 🗑️ 이 시험이 종전의 *"잠금표 잔여분은 동결돼 있다"* 를 대체한다 — 2026-09-30 에 그 21건을
     * 전부 이행해 `primary-button-baseline.json` 자체가 없어졌고, 탈출구가 baseline 에서 표식으로 옮겨졌다.
     */
    const out = execFileSync('bash', ['-c',
      `grep -rn "primary-button-ok" src/pages src/components --include=*.tsx | wc -l`,
    ], { encoding: 'utf8' })
    expect(Number(out.trim()), '예외 표식이 늘었다 — 왜 필요한지 이 시험에 적고 숫자를 올릴 것').toBeLessThanOrEqual(3)
  })
})
