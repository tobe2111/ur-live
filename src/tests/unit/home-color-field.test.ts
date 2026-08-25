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
 * ## 색면 ≠ 잉크
 * 이전엔 색면과 제목·가격 잉크가 **둘 다 #1A2C42** 라 같은 것처럼 보였다. 이제 다르다 —
 * 잉크는 딥네이비로 남고 색면만 무채색(차콜)이다. 그러니 `--ink` 를 색면에 쓰지 말 것.
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

  it('색면이 잉크(--ink)와 같은 값이 아니다', () => {
    const s = read(CSS)
    const field = s.match(/--home-field:\s*(#[0-9A-Fa-f]{6})/)![1].toUpperCase()
    const ink = s.match(/--ink:\s*(#[0-9A-Fa-f]{6})/)![1].toUpperCase()
    // 같아도 화면이 깨지진 않지만, 같으면 "색면을 골랐다"는 결정이 사라진 것이다.
    expect(field, '색면이 잉크와 같은 값으로 되돌아갔다').not.toBe(ink)
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
    for (const f of [HERO, PC]) {
      const s = code(read(f))
      expect(s, `${f}: 색면에 #1A2C42 리터럴이 남아 있다`).not.toMatch(/bg-\[#1A2C42\]/)
      expect(s, `${f}: 스크림에 rgba(26,44,66) 리터럴이 남아 있다`).not.toMatch(/rgba\(26,\s*44,\s*66/)
    }
  })
})
