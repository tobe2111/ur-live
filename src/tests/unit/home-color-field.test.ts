/**
 * 🎨 홈 색면은 한 곳에서 나온다 (2026-08-23 — 대표 시안 확정 "차콜 블랙으로 가자")
 *
 * ## 무엇을 지키나
 * 그루폰식 홈은 **어두운 색면 위에 흰 패널**을 얹는 구조다. 그 색면은 두 군데서 그려진다:
 *   · `PcHomePage`      — 페이지 전체 바탕
 *   · `HomeHeroDefault` — 히어로 블록(+ 좌측 스크림 · 하단 페이드 · 칩 hover 글자색)
 * 두 값이 **다르면 이음매가 그대로 보인다.** 예전엔 양쪽에 hex 를 따로 적어 뒀는데,
 * 그건 "한쪽만 고치면 조용히 어긋나는" 배치다 — 같은 날 배너 규격 안내에서 실제로 겪은 클래스다.
 * ⇒ `--home-field` / `--home-field-rgb` 하나에서 나오게 하고, 리터럴 재유입을 여기서 막는다.
 *
 * ## 색면 ≠ 잉크 (값이 같아도 역할은 다르다)
 * 처음(2026-08-23)엔 색면만 차콜로 옮기고 잉크는 딥네이비(#1A2C42)로 뒀다.
 * 2026-08-30 대표가 "완전 검정이면 좋겠어" 해서 **잉크도 #16181C 로** 왔다 — 지금은 값이 같다.
 * ⚠️ 그렇다고 한쪽을 다른 쪽으로 대체하지 말 것. 역할이 다르고(색면 vs 글자), 한쪽만 바꾸는
 *   날이 오면 `--ink` 를 색면에 쓴 자리가 조용히 따라 움직인다. 그래서 아래 규칙은 그대로다:
 *   색면은 `--home-field`, 글자는 `--ink`/gray 스케일.
 *
 * 이 테스트가 **못 막는 것**: 실제 렌더 색. CSS 변수 해석은 브라우저 몫이라, 값을 바꾸면
 *   화면으로 한 번 봐야 한다(특히 사진 페이드 경계).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석 제거 — 설명 주석이 판정을 통과/실패시키는 함정(이 레포에서 반복해 겪었다). */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')

const CSS = 'src/index.css'
const HERO = 'src/components/home/HomeHeroDefault.tsx'
const PC = 'src/pages/pc-home/PcHomePage.tsx'

describe('색면 토큰이 정의돼 있다', () => {
  it('--home-field 와 --home-field-rgb 가 :root 에 있다', () => {
    const s = read(CSS)
    expect(s, '--home-field 가 없다 — 색면이 다시 리터럴로 흩어진다').toMatch(/--home-field:\s*#[0-9A-Fa-f]{6}/)
    expect(s, '--home-field-rgb 가 없다 — 스크림이 알파를 못 얹는다').toMatch(/--home-field-rgb:\s*\d+\s+\d+\s+\d+/)
  })

  it('hex 와 rgb 표기가 같은 색이다 (둘이 갈리면 스크림만 다른 색이 된다)', () => {
    const s = read(CSS)
    const hex = s.match(/--home-field:\s*#([0-9A-Fa-f]{6})/)![1]
    const rgb = s.match(/--home-field-rgb:\s*(\d+)\s+(\d+)\s+(\d+)/)!.slice(1, 4).map(Number)
    const fromHex = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    expect(rgb, `#${hex} 와 rgb(${rgb.join(' ')}) 가 다른 색이다`).toEqual(fromHex)
  })

  it('색면이 잉크를 참조하지 않는다 — 값이 같아도 토큰은 따로다', () => {
    // 2026-08-23 엔 "색면 ≠ 잉크"(값이 달라야 한다)를 지켰다. 2026-08-30 대표가 잉크도 검정으로
    // 가면서 **값은 같아졌다** — 그래서 그 규칙은 여기서 폐기한다(값 동일 = 정상).
    // 대신 남는 규칙: 색면은 `var(--ink)` 를 **참조하면 안 된다**. 참조로 묶으면 다음에 잉크만
    // 바꾸는 날 색면이 말없이 따라 움직이고, 그건 화면 절반이 바뀌는 사고다.
    const s = read(CSS)
    const decl = s.match(/--home-field:\s*([^;]+);/)![1].trim()
    expect(decl, `--home-field 가 다른 토큰을 참조한다: ${decl}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

describe('두 색면이 같은 토큰을 읽는다', () => {
  it('히어로 색면 · 스크림 · 하단 페이드가 전부 토큰이다', () => {
    const s = code(read(HERO))
    expect(s, '히어로 배경이 토큰이 아니다').toMatch(/bg-\[var\(--home-field\)\]/)
    expect(s, '좌측 스크림이 리터럴 rgba 로 되돌아갔다').toMatch(/rgb\(var\(--home-field-rgb\)/)
    expect(s, '하단 페이드가 토큰이 아니다').toMatch(/linear-gradient\(180deg, transparent, var\(--home-field\)\)/)
  })

  it('PC 홈 페이지 색면도 같은 토큰이다', () => {
    expect(code(read(PC)), '페이지 색면이 히어로와 갈렸다 — 이음매가 보인다').toMatch(
      /bg-\[var\(--home-field\)\]/,
    )
  })

  it('색면 자리에 hex 리터럴이 되살아나지 않았다', () => {
    // 🔑 금지할 값을 **여기 적지 않는다** — index.css 의 현재 토큰 값을 읽어서 그 리터럴만 막는다.
    //    예전엔 hex 를 테스트에 박아 뒀는데, 2026-08-30 잉크 검정 전환처럼 값이 바뀌면 테스트가
    //    **옛 값을 지키는 낡은 지도**가 된다(그때 실제로 이 줄이 옛 네이비를 가리키고 있었다).
    const css = read(CSS)
    const hex = css.match(/--home-field:\s*(#[0-9A-Fa-f]{6})/)?.[1]
    const rgb = css.match(/--home-field-rgb:\s*(\d+)\s+(\d+)\s+(\d+)/)
    expect(hex, '--home-field 를 못 읽었다').toBeTruthy()
    expect(rgb, '--home-field-rgb 를 못 읽었다').toBeTruthy()
    const hexRe = new RegExp(`bg-\\[${hex!.replace('#', '#')}\\]`, 'i')
    const rgbRe = new RegExp(`rgba?\\(\\s*${rgb![1]}\\s*,\\s*${rgb![2]}\\s*,\\s*${rgb![3]}`)
    for (const f of [HERO, PC]) {
      const src = code(read(f))
      expect(src, `${f}: 색면에 ${hex} 리터럴이 남아 있다`).not.toMatch(hexRe)
      expect(src, `${f}: 스크림에 rgb(${rgb![1]},${rgb![2]},${rgb![3]}) 리터럴이 남아 있다`).not.toMatch(rgbRe)
    }
  })
})

describe('폼 컨트롤 기본 글자색도 잉크를 따른다', () => {
  it('index.css 의 input/textarea/select 폴백이 옛 네이비 gray-900 이 아니다', () => {
    // 🩸 실제로 났던 일(2026-08-31 배포 후 라이브 실측): 잉크를 검정(#16181C)으로 옮겼는데
    //   index.css 의 폼 컨트롤 **전역 폴백**만 옛 Tailwind gray-900(rgb 17 24 39 — 남색기가
    //   있다)으로 남아 있었다. 마크업 클래스는 `text-gray-900` 이라 리매핑을 따르는 것처럼
    //   보이는데, 전역 규칙이 그 위에 얹혀 **PC 상단 검색창 글자만 남색**이었다.
    //   ⇒ 색 토큰을 옮길 때 클래스만 보면 놓친다. 전역 CSS 폴백도 같이 봐야 한다.
    const css = read(CSS)
    const ink = css.match(/--ink:\s*(#[0-9A-Fa-f]{6})/)?.[1]
    expect(ink, '--ink 를 못 읽었다 — 셀렉터가 낡았다').toBeTruthy()

    // 줄머리(라이트 전역) 규칙만 — 들여쓴 미디어쿼리판과 `.dark` 접두는 대상이 아니다.
    const block = css.match(/^input:not\(\[type='checkbox'\]\)[\s\S]*?\}/m)?.[0]
    expect(block, '폼 컨트롤 전역 폴백 블록을 못 찾았다 — 셀렉터가 낡았다').toBeTruthy()
    // ⚠️ 주석을 빼고 본다. 안 그러면 **결함을 설명하려고 쓴 주석의 옛 hex** 가 위반으로 잡힌다
    //    (작성 중 실제로 걸렸다 — 이 레포가 반복해 겪은 "주석이 판정을 흔든다" 클래스).
    const decl = code(block!)
    expect(decl, '폼 폴백이 옛 gray-900(남색기)으로 되돌아갔다').not.toMatch(/17\s+24\s+39|#111827/i)
    expect(decl.toUpperCase(), `폼 폴백이 --ink(${ink}) 와 다르다`).toContain(ink!.toUpperCase())
  })
})
