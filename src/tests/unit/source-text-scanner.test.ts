/**
 * 🔬 **주석 제거기(가드들의 눈)가 실제로 주석을 지우는가** — 2026-09-13.
 *
 * ## 왜 이 테스트가 생겼나
 * 이 레포의 텍스트 가드 수십 개가 `stripComments` 를 통해 소스를 본다. 그 눈이 멀면
 * **주석에만 남은 이름이 배선으로 오인**되거나 그 반대가 되는데, **에러가 안 난다** — 초록불이다.
 *
 * 2026-08-27 에 자체 정규식을 스캐너로 갈아 끼우며 이 문제를 고쳤다고 적어 뒀는데,
 * 그 스캐너에 **JSX 구멍**이 있었다(2026-09-13 실측):
 *
 * | 파일 | 종전 제거량 | 고친 뒤 |
 * |---|---|---|
 * | `RegisterPage.tsx` | **141자** / 15,428 | 475자 |
 * | `CuratorPage.tsx` | 5,456자 | **9,636자** |
 * | `RestaurantMapPage.tsx` | 9,259자 | **13,461자** |
 *
 * 원인은 `</div>` 였다. `<` 다음의 `/` 를 **정규식 리터럴 시작**으로 읽어 다음 `/` 까지 통째로
 * 삼켰고, 그 안의 주석이 전부 살아남았다. `.tsx` 는 전부 이 구멍에 걸려 있었다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 스캐너가 *과하게* 지우는 경우 중 문법적으로 정당한 희귀 코드
 *   (`a < /re/.source` 같은 것). 이 레포엔 없어서 그 대가로 JSX 정확도를 택했다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

describe('🔬 JSX 를 정규식으로 오인하지 않는다', () => {
  it('닫는 태그 뒤의 주석이 살아남지 않는다 (`</div>` 함정)', () => {
    const src = [
      'export function A() {',
      '  return (',
      '    <div>',
      '      <span>x</span>',
      '      {/* SECRET_COMMENT */}',
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    expect(stripComments(src)).not.toContain('SECRET_COMMENT')
  })

  it('닫는 태그가 여러 번 나와도 그 뒤 주석까지 계속 지운다', () => {
    const src = '<a></a>\n// L1\n<b></b>\n/* B1 */\n<c></c>\n// L2\n'
    const out = stripComments(src)
    for (const w of ['L1', 'B1', 'L2']) expect(out).not.toContain(w)
  })

  /**
   * 🩸 방어가 **둘**이라 픽스처를 잘못 고르면 주입이 통과한다(실제로 그랬다).
   *   ① `prev !== '<'`(닫는 태그) ② "그 줄에서 안 닫히면 정규식 아님". 대부분의 JSX 는 둘 다에
   *   걸려서, 하나를 빼도 다른 하나가 구해 준다 — 그러면 그 하나가 죽어도 아무도 모른다.
   *   아래 두 케이스는 **각각 하나만** 발동하도록 고른 것이다.
   */
  it('①만 지킨다: 같은 줄에 닫는 태그와 JSX 주석이 붙어 있다', () => {
    // `</div>` 의 `/` 뒤에 같은 줄에서 `*/` 의 `/` 가 있으므로 "한 줄" 안전판은 못 막는다.
    const src = '<div>x</div>{/* SECRET_INLINE */}\n'
    expect(stripComments(src)).not.toContain('SECRET_INLINE')
  })

  it('②만 지킨다: 자기닫기 태그(`{x} />`)의 슬래시', () => {
    // prev 가 `}` 라 닫는 태그 규칙에 안 걸린다. 그 줄에 닫는 `/` 가 없어야 안전판이 발동한다.
    const src = '<Foo bar={x} />\n// SECRET_SELFCLOSE\n<Bar baz={y} />\n'
    expect(stripComments(src)).not.toContain('SECRET_SELFCLOSE')
  })
})

describe('🔬 JSX 본문의 아포스트로피를 문자열로 오인하지 않는다', () => {
  it("don't 뒤의 주석이 살아남지 않는다", () => {
    const src = "<p>don't</p>\n// SECRET_LINE\n<p>ok</p>\n"
    expect(stripComments(src)).not.toContain('SECRET_LINE')
  })

  it('진짜 문자열 안의 주석 표시는 그대로 둔다 (덜 지우는 쪽이 안전)', () => {
    const src = "const u = 'https://x.test/a' // tail\nconst v = '/* not a comment */'\n"
    const out = stripComments(src)
    expect(out).toContain('https://x.test/a')
    expect(out).toContain('/* not a comment */')
    expect(out).not.toContain('tail')
  })

  it('여러 줄 템플릿 리터럴은 그대로 살린다', () => {
    const src = 'const t = `line1\n// not-a-comment\nline2`\n'
    expect(stripComments(src)).toContain('// not-a-comment')
  })
})

describe('🔬 진짜 정규식은 여전히 보호한다', () => {
  it('정규식 안의 슬래시·문자클래스가 코드로 새지 않는다', () => {
    const src = "const re = /['\"]\\/\\*/g\n// SECRET\n"
    const out = stripComments(src)
    expect(out).toContain("/['\"]\\/\\*/g")
    expect(out).not.toContain('SECRET')
  })
})

describe('🔬 실제 파일에서 실제로 지운다 (합성 픽스처만 보면 또 놓친다)', () => {
  /**
   * 🔴 이 하한은 **비율이 아니라 회귀 감지**용이다 — `</div>` 구멍이 다시 열리면 이 값들이
   *   한 자릿수 퍼센트로 무너진다(RegisterPage 는 0.9% 였다).
   */
  const CASES: [string, number][] = [
    ['src/pages/CuratorPage.tsx', 25],
    ['src/pages/RestaurantMapPage.tsx', 20],
    ['src/worker/index.ts', 30],
  ]
  for (const [p, minPct] of CASES) {
    it(`${p.split('/').pop()} 에서 주석을 ${minPct}% 이상 걷어낸다`, () => {
      const raw = readFileSync(p, 'utf-8')
      expect(raw.length, `${p} 가 비었다 — 경로가 낡았다(통과가 아니라 실패)`).toBeGreaterThan(5000)
      const pct = ((raw.length - stripComments(raw).length) / raw.length) * 100
      expect(pct).toBeGreaterThan(minPct)
    })
  }

  it('.tsx 소스에서 JSX 주석 블록이 남지 않는다', () => {
    const raw = readFileSync('src/pages/RegisterPage.tsx', 'utf-8')
    expect(raw).toContain('{/*')            // 픽스처 전제 — 이 파일엔 JSX 주석이 있다
    expect(stripComments(raw)).not.toContain('{/*')
  })
})
