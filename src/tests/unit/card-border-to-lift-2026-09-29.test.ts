import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 🎫 **카드는 테두리 0 + 들림 한 값** — 확정 디자인 시스템 규칙 ① (2026-09-29, UI 네 트랙 중 ④)
 *
 * ## 왜 가드가 필요했나
 * CLAUDE.md 는 *"새 소비자 카드는 TicketCard/shadow-lift/border-rule 로만. `border border-*` …
 * 신규 금지"* 라고 2026-09-02 에 적어 뒀는데 **강제가 없었다.** 09-29 에 재 보니 소비자 화면에
 * 테두리 친 카드가 **304건**이다. 룰만 있고 가드가 없으면 결국 놓친다 — 이 레포가 반복해 배운 것이다.
 *
 * ## ⚠️ 전수 변환을 일부러 안 했다 (그게 이 파일에서 제일 중요한 부분)
 * 304건 중 테두리가 **일하고 있는** 자리가 섞여 있다. 기계적으로 다 지우면 조용히 나빠진다:
 *
 * | 자리 | 왜 테두리가 필요한가 |
 * |---|---|
 * | 떠 있는 면(드롭다운·토스트·모달) | 페이지 위에 겹치므로 그림자만으로는 경계가 안 선다 |
 * | 선택 신호(`border-brand`·`ring-`·굵은 선) | **UI① 이 방금 세운 언어다.** 지우면 눌러도 표시가 없다 |
 * | 틴트 상자(`bg-amber-50` 류) | `shadow-lift` 는 잉크 6% 라 그 면 위에서 거의 안 보인다 |
 * | 잠금표 파일 | 색 하나를 바꿔도 대표 승인이 필요하다(CLAUDE.md 절대 룰) |
 *
 * ⇒ **흐름 속 평범한 흰 카드 65건만** 바꾸고(84 → 19, 남은 19는 위 제외 파일 안), 나머지는 래칫.
 *
 * ## 🔑 판정을 코드모드와 **한 벌**로 둔다
 * 시험이 조건을 따로 적으면 둘이 갈리고, 갈린 순간 둘 다 못 믿는다. 그래서 시험은 조건을
 * 복제하지 않고 **코드모드를 `--dry` 로 돌려** "자동으로 고칠 게 남았는가" 를 묻는다.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - 변수로 조립한 className · 템플릿 리터럴 안의 조건부 분기(정적 문자열만 본다)
 * - 인라인 `style={{ border: … }}`
 * - **테두리를 뗀 자리가 실제로 보기 좋은지** — 그건 그려서 봐야 한다.
 */

const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

/** 방향 없는 `border` + 둥근 모서리 = 카드류. `border-rule`(체계가 허락한 것)과 방향선은 뺀다. */
const CARDISH = /\bborder\b(?!-(?:b|t|l|r|x|y|0|transparent|rule|none|collapse|separate|spacing|dashed|dotted))/
const ROUND = /\brounded-(lg|xl|2xl|3xl)\b/

/** 실측 2026-09-29 (65건 변환 후). **줄이는 건 자유, 늘리는 건 차단.** */
const BASELINE = 239

describe('카드 표면 — 테두리 0 + 들림 한 값', () => {
  it('🎫 테두리 친 카드가 늘지 않는다 (래칫)', () => {
    expect(files.length, '소비자 파일이 너무 적다 — 경로가 낡았다(실측 403)').toBeGreaterThan(350)
    let n = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const cls = m[1] ?? m[2] ?? ''
        if (!CARDISH.test(cls) || !ROUND.test(cls)) continue
        const tag = ([...src.slice(0, m.index).matchAll(/<([A-Za-z][\w.]*)/g)].pop() || [])[1] ?? '?'
        // 입력·버튼의 테두리는 *조작 가능함* 의 표시라 규칙 ① 대상이 아니다.
        if (/^(input|textarea|select|button|label|form|img)$/.test(tag)) continue
        n++
      }
    }
    expect(n, '측정된 카드가 0이다 — 이 검사가 헛돌고 있다').toBeGreaterThan(50)
    expect(n, `테두리 친 카드 ${n}건 (기준 ${BASELINE}). 새 카드는 shadow-lift 로.`).toBeLessThanOrEqual(BASELINE)
  })

  it('🎫 자동으로 고칠 수 있는 카드가 남아 있지 않다 (코드모드와 한 벌)', () => {
    // 조건을 여기 복제하면 둘이 갈린다 ⇒ 코드모드 자신에게 묻는다.
    const out = execSync('node scripts/codemods/card-border-to-lift.mjs --dry', { encoding: 'utf8' })
    const m = out.match(/들림 (\d+)건/)
    expect(m, `코드모드 출력 형식이 바뀌었다 — 이 검사가 헛돌고 있다: ${out.trim()}`).toBeTruthy()
    expect(Number(m![1]), `흐름 속 흰 카드에 테두리가 ${m![1]}건 남았다. ` +
      '`node scripts/codemods/card-border-to-lift.mjs` 로 고칠 것.').toBe(0)
  })

  it('🎫 선택 신호(border-brand)는 지우지 않았다 — UI① 의 언어다', () => {
    let brand = 0
    for (const f of files) brand += (readFileSync(f, 'utf8').match(/\bborder-brand\b/g) || []).length
    // 실측 2026-09-29: 29건. 0 이 되면 코드모드가 선택 표시를 쓸어 간 것이다.
    expect(brand, '선택 상태의 브랜드 테두리가 사라졌다 — 눌러도 표시가 없어진다').toBeGreaterThanOrEqual(15)
  })
})
