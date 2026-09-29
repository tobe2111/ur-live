import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/**
 * 🔵 **선택 상태는 브랜드 면 하나다** (2026-09-29 — 대표 *"Ui 부분에서 더 개선할 수 있는건?"* → 전부 승인)
 *
 * ## 무엇이 문제였나 (실측)
 * 2026-09-02 에 대표가 칩의 선택 상태를 **브랜드 블루 면**으로 확정했는데(지도 B안 · 교환권 칩),
 * 09-29 에 재 보니 같은 일(하나 고르기)을 하는 자리가 **네 문법**으로 갈려 있었다:
 *
 * | 무엇 | 어디 | 그때 |
 * |---|---|---|
 * | 필터 칩(알약) | 지역 · PC 홈 카테고리 · 지역 카테고리 · 숙소 카테고리 | **검정 면** |
 * | 선택 행(시트·드롭다운) | 지도 정렬 시트 · 동네딜 정렬 · PC 지역 목록 | 검정 1 · 회색 2 |
 * | 선택 카드/행 | 배송지 · 지도 목록 행 | 회색 면 + **검정 링** |
 * | 토글 스위치 | 마이 알림·테마 | 검정 면 |
 *
 * 빌드는 초록이고 화면도 안 깨져서 **아무도 신고하지 않는다.** 대표가 두 번 지적한
 * *"디자인·ui 가 별로다"* 의 실체 중 하나가 이것이다.
 *
 * ## 🩸 그리고 이걸 찾다가 **내 가드의 눈먼 자리**를 발견했다
 * `check-primary-button-color` 는 눌림의 증거를 className 줄 **위 3줄**에서만 찾았는데, 칩은
 * `<button` → `key` → `onClick` → `aria-pressed` → `className={\`…` → `on` → `? '…'` 라
 * 위반이 **6~7줄 아래**에 있다. 그래서 검정 칩 다섯 개가 통째로 새고 있었다.
 * 창을 8줄로 넓히고 variant 접두사(`hover:`·`dark:`)를 제외하자, 숨어 있던 위반이 더 드러났다
 * (숙소 카테고리 칩 · 주소 저장 버튼 · 공용 모달 확인 버튼).
 *
 * ## 이 시험이 보는 것
 * `aria-pressed` / `aria-current` / `aria-selected` 를 단 요소의 **선택 분기**가 면·테두리·링을
 * 칠한다면 그것은 **브랜드**여야 한다. aria 를 다는 것 자체가 *"이건 선택 상태다"* 라는 선언이라,
 * 이보다 정확한 신호가 없다(클래스 이름으로 칩을 알아내려던 첫 판은 배너 도트·hover 까지 잡았다).
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - **aria 를 안 단 칩.** 그건 접근성 결함이기도 한데 여기서는 안 보인다(다음 기회에 함께).
 * - 브랜드 *면* 인지 *글자* 인지는 안 가른다 — 내용이 있는 카드는 면을 칠하면 글자가 죽어서
 *   링 + 연한 tint 가 맞다. 둘 다 통과시키고, 어느 쪽이 맞는지는 사람이 본다.
 * - 실제 렌더 색. jsdom 엔 레이아웃도 CSS 캐스케이드도 없다 — `dark-contrast` 워크플로가 잰다.
 */

const files = execSync("git ls-files 'src/pages/**/*.tsx' 'src/components/**/*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  .filter((f) => !/\/tests?\//.test(f))

/** 선택 분기가 칠하는 것 — 면 · 테두리 · 링 */
const PAINTS = /\b(?:bg|border|ring|text)-(?!transparent\b)[a-z[]/
/** 브랜드로 칠했는가(면·테두리·링·글자 · CSS 변수 토큰 포함) */
const BRAND = /\b(?:bg|border|ring|text)-brand|var\(--brand|var\(--gbd-cta/

/**
 * 🚪 문서화된 예외 — **다른 축**이라 브랜드 면이 오히려 틀린 자리.
 * ⚠️ 새로 추가할 때는 *왜 다른 축인지* 를 값으로 적을 것. "지금 파랗지 않아서" 는 이유가 아니다.
 */
const EXCEPT: Record<string, string> = {
  'src/components/main/DesktopTopNav.tsx':
    '내비 활성 = **잉크 글자 + 로즈 점 하나**(2026-09-01 대표 확정 "PR A"). 면을 물들이던 것을 '
    + '일부러 걷어낸 자리라, 브랜드 면으로 되돌리면 그 결정이 무효가 된다. 탭·칩과 다른 축이다.',
  'src/pages/product-detail/PurchasePicker.tsx':
    '잡힌 분기는 선택이 아니라 **품절(비활성)** 이다 — `cursor-not-allowed` 회색이 맞다.',
  'src/pages/wishlist/WishlistParts.tsx':
    '분기가 색이 아니라 **표시 여부**(`hidden lg:inline-flex`)다.',
}

type Hit = { file: string; line: number; sel: string }

function scan(): { hits: Hit[]; checked: number } {
  const hits: Hit[] = []
  let checked = 0
  for (const f of files) {
    let raw: string
    try { raw = readFileSync(f, 'utf8') } catch { continue }
    const lines = stripComments(raw).split('\n')
    lines.forEach((l, i) => {
      if (!/aria-(pressed|current|selected)=/.test(l)) return
      checked++
      // 이 요소의 className 블록 — aria 줄 앞뒤로 넉넉히 본다(칩은 삼항이 아래에 있다).
      const win = lines.slice(Math.max(0, i - 4), i + 12).join('\n')
      const m = win.match(/\?\s*\n?\s*'([^']{10,})'/)
      if (!m) return
      const sel = m[1]
      if (!PAINTS.test(sel)) return      // 굵기·정렬만 바뀌는 분기는 색 문제가 아니다
      if (BRAND.test(sel)) return        // 규칙대로
      if (EXCEPT[f]) return
      hits.push({ file: f, line: i + 1, sel: sel.slice(0, 90) })
    })
  }
  return { hits, checked }
}

describe('선택 상태는 브랜드 하나 (칩 · 탭 · 시트 · 토글)', () => {
  const { hits, checked } = scan()

  it('🔵 aria 로 선언된 선택 분기가 전부 브랜드로 칠해져 있다', () => {
    const msg = hits.map((h) => `${h.file}:${h.line}  ${h.sel}`).join('\n')
    expect(hits, `선택 상태를 브랜드가 아닌 색으로 칠한 곳:\n${msg}`).toEqual([])
  })

  it('🔴 이 시험이 헛돌지 않는다 — 실제로 선택 요소를 훑었다', () => {
    // 경로·정규식이 낡아 대상이 0개가 되면 위 검사는 영원히 통과한다(이 레포가 반복해 당한 클래스).
    expect(checked, `aria 선택 요소를 ${checked}개밖에 못 찾았다 — 훑는 범위가 낡았다`).toBeGreaterThan(10)
    expect(files.length, '소비자 파일이 너무 적다 — 경로가 낡았다').toBeGreaterThan(200)
  })

  it('🚪 예외는 **이유가 값으로** 적혀 있다 (파일 이름만 적어 두면 면제가 된다)', () => {
    for (const [f, why] of Object.entries(EXCEPT)) {
      expect(why.length, `${f} 예외에 이유가 없다`).toBeGreaterThan(30)
      expect(files, `${f} 예외가 가리키는 파일이 없다 — 낡은 예외`).toContain(f)
    }
  })

  it('🚫 **빈 화면 안내**가 중단된 기능을 가리키지 않는다 (라이브커머스)', () => {
    /**
     * 2026-09-29 실측: 주문내역 빈 화면이 *"라이브에서 마음에 드는 상품을 구매해보세요"*,
     * 쿠폰함 빈 화면이 *"라이브 방송·이벤트 참여로…"* 였다. 라이브커머스는 영구 중단인데
     * **아무것도 없는 화면이 없는 기능을 하라고 시키고 있었다** — 빈 화면은 다음 행동을 알려주는
     * 자리라 거짓이면 그냥 막다른 길이다.
     * 🔴 코드가 아니라 **로케일 값이 화면을 이긴다**(CLAUDE.md 가 명시한 함정) — 여기서 로케일을 본다.
     *
     * ⚠️ 범위는 **빈 화면 안내(`empty*`)로 좁혔다.** 같은 날 실측에서 ko 로케일에 라이브 문구가
     *   **16곳** 나왔고(소개 히어로 · 친구 초대 공유 문구 · 온보딩 첫 문장 · 딜 사용처 …),
     *   그건 문구 하나짜리 일이 아니라 *무엇으로 바꿀 것인가* 라는 제품 판단이 필요해
     *   이 PR 에서 조용히 16×6 을 고치지 않고 대표에게 따로 보고했다.
     *   ⇒ 그 결정이 나면 이 검사의 범위를 넓힐 것.
     */
    const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))
    const walk = (o: unknown, path: string[] = []): string[] => {
      if (typeof o === 'string') {
        const key = path[path.length - 1] ?? ''
        return /^empty/i.test(key) && /라이브(에서|커머스|\s*방송)/.test(o) ? [`${path.join('.')}: ${o}`] : []
      }
      if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => walk(v, [...path, k]))
      return []
    }
    const live = walk(ko)
    expect(live, `빈 화면 안내가 중단된 기능을 가리킨다:\n${live.join('\n')}`).toEqual([])
    // 0건이 "키를 못 찾아서" 가 아님을 확인한다 — empty* 키 자체는 많아야 한다.
    const emptyKeys = walk(ko, []).length + JSON.stringify(ko).match(/"empty[A-Za-z]*":/g)!.length
    expect(emptyKeys, 'empty* 키를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(20)
  })
})
