import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/**
 * 🚦 **상태와 할인은 색이 있어야 한다** (2026-09-29 — 대표 *"Ui 부분에서 더 개선할 수 있는건?"*)
 *
 * ## 무엇이 문제였나 (실측)
 * `tailwind.config.js` 는 2026-06-19 대표 지시("아예 흑백, 기능 빨강만 유지")로 장식 색조 16개를
 * **전부 잉크 스케일로 중화**한다. 소비자 화면에서는 의도다. 그런데 그 중화가 **의미까지** 먹었다:
 *
 * ```
 * rose-600 = emerald-600 = amber-600 = blue-600 = green-600 = #55534F   (실측, tailwind.config.js)
 * rose-50  = emerald-50  = amber-50  = blue-50  = green-50  = #F8F7FC
 * ```
 *
 * 그래서 이런 것들이 **픽셀 단위로 같았다**:
 * - 마이 주문내역: `취소/환불` · `구매완료` · `배송중` · `상품준비중` (넷 다 같은 회색)
 * - 주문 상세: 같은 주문을 열면 네 상태 중 셋이 구별 안 됨
 * - 제조사 정산: `정산 대기` · `출금 가능` · `지급 완료(누적)` — **돈 상태 셋이 같은 회색**
 * - 할 일 카드의 `danger`/`info`/`success` tone — **이름만 tone 이고 색이 없었다**
 *
 * ## 🩸 그리고 이걸 막으라고 만든 가드가 **소비자 화면을 한 건도 못 보고 있었다**
 * `check-status-tone`(2026-09-03)의 판정이 `\{[^{}]*label…[^{}]*cls…\}` 였는데, CLAUDE.md 가
 * **모든 UI 문자열에 `t(키, { defaultValue })` 를 강제**하므로 소비자 상태표는 라벨 안에 중괄호가
 * 항상 있다 ⇒ 거기서 매칭이 끊긴다. `entries: []` 라 **초록불로 0건**이 떠 있었다.
 * 중괄호 균형 파싱으로 바꾸자 즉시 7파일 16건이 드러났다.
 *
 * ## 이 시험이 보는 것
 * 1. 가드 자신이 i18n 형태를 본다(그 눈먼 자리가 다시 안 생긴다).
 * 2. 할인율·할인금액은 `text-sale`(SSOT) 로 칠한다 — `red-500` 은 다크 값이 없고
 *    `rose-*` 는 중화돼 회색이다.
 * 3. tone 토큰 넷이 실제로 존재한다(클래스만 쓰고 토큰이 없으면 투명해진다).
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - tone 을 **잘못 고른 것**(반려에 ok) — 의미는 사람이 안다.
 * - 삼항 사슬로 흩어진 상태 배지(`a ? 'bg-x' : b ? 'bg-y' : …`). 객체 표만 기계가 본다.
 * - 실제 렌더 대비 — `dark-contrast` 워크플로가 잰다.
 */

const files = execSync(
  // 🕳️ git pathspec 의 `**` 는 `FNM_PATHNAME` 이라 **디렉터리를 최소 하나 요구한다** —
  //    `src/pages/*.tsx` 만 쓰면 최상위 파일 734개가 조용히 검사 밖이다(2026-09-29 실측).
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
)
  .trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

describe('상태·할인 색이 중화에 먹히지 않는다', () => {
  it('🚦 판정이 **i18n 상태표를 실제로 잡는다** (문자열이 아니라 동작을 잰다)', async () => {
    /**
     * 🩸 첫 판은 가드 파일을 **문자열로** 읽어 `violations(i18n) !== 1` 이 있는지 봤다.
     *   그런데 그 줄을 `… !== 1 && false` 로 바꾸면 **문자열은 그대로 남고 행동만 죽는다**
     *   ⇒ 주입이 헛돌았다. 그래서 판정을 순수 모듈로 떼어내고 여기서 **직접 돌린다**.
     */
    const { violations, FIXTURES, objectLiterals } = await import('../../../scripts/lib/status-table-scan.mjs')

    // 가드 자신의 대조 픽스처를 같은 함수로 재현한다 — 하나라도 어긋나면 판정이 죽은 것이다.
    for (const [name, { src, expect: want }] of Object.entries(FIXTURES) as [string, { src: string; expect: number }][]) {
      expect(violations(src), `대조 픽스처 '${name}' 가 어긋난다 — 판정이 죽었다`).toBe(want)
    }
    /**
     * ⚠️ 위 루프는 픽스처가 **무엇이든** 그대로 돌리므로, 픽스처 자신이 약해지는 것은 못 본다
     *   (2026-09-29: i18n 픽스처를 하드코딩 형태로 바꿔도 결과가 1 이라 초록이었다).
     *   ⇒ i18n 픽스처는 **라벨 안에 중첩 중괄호를 갖고 있어야** 한다 — 그게 이 픽스처의 존재 이유다.
     */
    const i18nSrc = (FIXTURES as Record<string, { src: string }>).i18n.src
    expect(i18nSrc, 'i18n 픽스처에 `t(…, { … })` 중첩이 없다 — 눈먼 자리를 재현하지 못한다')
      .toMatch(/\b(?:label|t|text)\s*:\s*t\([^)]*\{/)

    // 중괄호가 몇 겹이어도 통과해야 한다(i18n 은 두 겹, 옵션까지 붙으면 세 겹이 된다).
    expect(violations(`const S={a:{label:t('k',{d:{x:1}}),cls:'text-amber-600'}}`), '중첩 3겹을 못 본다').toBe(1)
    // 균형 파싱 자체가 살아 있는지 — 중첩 객체를 통째로 한 덩어리로 뽑는다.
    expect(objectLiterals('{a:{b:1}}'), '균형 파싱이 중첩을 안 감싼다').toContain('{a:{b:1}}')

    /**
     * 🧪 그리고 가드는 **시험 파일을 훑지 않아야** 한다 — 이 파일 안의 대조 픽스처가
     *   문자열로 들어 있어서, 안 거르면 가드가 **자기 자신을 위반으로 신고**한다
     *   (2026-09-29 에 실제로 pre-push 가 그걸로 빨간불을 냈다). 시험은 화면이 아니다.
     */
    // 그리고 가드가 그 모듈을 실제로 쓰고 있어야 한다(배선이 끊기면 위 전부가 공허하다).
    const g = readFileSync('scripts/check-status-tone.mjs', 'utf8')
    expect(g, '가드가 판정 모듈을 안 쓴다').toMatch(/from '\.\/lib\/status-table-scan\.mjs'/)
    expect(g, '가드가 픽스처를 안 돌린다').toContain('Object.entries(FIXTURES)')
    expect(g, '가드가 시험 파일까지 훑는다 — 자기 픽스처를 위반으로 신고하게 된다')
      .toMatch(/\.filter\(\(f\) => !\/\^src\\\/tests\?\\\/\/\.test\(f\)\)/)
  })

  it('🔴 할인 숫자는 `text-sale` 로 칠한다 (raw red / 중화되는 rose 금지)', () => {
    const hits: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'))
      src.split('\n').forEach((l, i) => {
        // 같은 줄에 "할인" 뜻(%, discount, 할인)과 raw red/rose 글자색이 함께 있으면 드리프트다.
        if (!/text-(?:red|rose)-\d{3}/.test(l)) return
        if (!/(?:discount|Discount|할인)/.test(l)) return
        hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 100)}`)
      })
    }
    expect(hits, `할인을 SSOT 아닌 빨강으로 칠했다 (→ text-sale):\n${hits.join('\n')}`).toEqual([])
  })

  it('🎨 tone 토큰 넷이 실제로 정의돼 있다 (클래스만 있고 값이 없으면 투명해진다)', () => {
    const css = readFileSync('src/index.css', 'utf8')
    const tw = readFileSync('tailwind.config.js', 'utf8')
    for (const k of ['ok', 'warn', 'bad', 'info']) {
      expect(css, `--tone-${k} 없음`).toContain(`--tone-${k}:`)
      expect(css, `--tone-${k}-bg 없음`).toContain(`--tone-${k}-bg:`)
      expect(tw, `tailwind 에 tone.${k} 없음`).toContain(`${k}: { DEFAULT: 'var(--tone-${k})'`)
    }
    expect(css, '--sale 토큰 없음').toContain('--sale:')
  })

  it('🚦 매장 스캔 결과는 **성공·실패가 둘 다** 색을 갖는다 (삼항이라 스크립트 가드가 못 본다)', () => {
    /**
     * 사용 처리는 **되돌릴 수 없는 동작**이다. 그런데 성공이 `emerald`(→회색)이고 실패만 `red` 라
     * 매장 화면에서 한쪽만 읽혔다. 이 쌍은 상태표가 아니라 삼항으로 흩어져 있어
     * `check-status-tone` 의 사정권 밖이다 ⇒ 여기서 파일을 직접 본다.
     */
    const src = stripComments(readFileSync('src/components/voucher/VoucherScanner.tsx', 'utf8'))
    const NEU = /\b(?:bg|text|border|ring)-(?:emerald|green|amber|rose|blue|yellow|lime|teal|cyan|sky|indigo|violet|purple|pink|fuchsia|orange)-\d{2,3}\b/
    const leaks = src.split('\n')
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => NEU.test(l))
      .map(({ l, i }) => `${i + 1}: ${l.trim().slice(0, 90)}`)
    expect(leaks, `스캔 화면에 중화되는 색조가 남았다:\n${leaks.join('\n')}`).toEqual([])
    // 그리고 성공·실패가 **둘 다** tone 으로 칠해져 있어야 한다(한쪽만 고치면 짝이 갈린다).
    expect(src, '성공 tone 이 없다').toMatch(/tone-ok/)
    expect(src, '실패 tone 이 없다').toMatch(/tone-bad/)
  })

  it('🔴 이 시험이 헛돌지 않는다 — 소비자 파일을 실제로 훑었다', () => {
    expect(files.length, '소비자 파일이 너무 적다 — 경로가 낡았다(실측 403, 최상위 glob 이 빠지면 252로 떨어진다)').toBeGreaterThan(350)
    // 실제로 `text-sale` 을 쓰는 곳이 있어야 한다(전부 지워졌으면 위 검사가 공허하다).
    const used = files.filter((f) => /\btext-sale\b/.test(readFileSync(f, 'utf8'))).length
    expect(used, 'text-sale 을 쓰는 화면이 없다 — SSOT 가 죽었다').toBeGreaterThan(5)
  })
})
