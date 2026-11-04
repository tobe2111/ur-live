/**
 * ⌨️ 견적 요청 단계 화면 — 키보드를 열어도 입력칸이 보인다 (2026-11-04 대표 신고 스크린샷: 간판 1/12 상세 주소).
 * 원인: 소개·안내·제목이 스크롤 영역 밖이라, 키보드가 화면을 줄이면 입력칸이 든 영역만 0 에 가깝게 줄어 '다음' 버튼 뒤로 숨었다.
 * 지키는 것: ① 소개·안내·제목·입력이 **한 스크롤 영역** 안 ② 입력칸에 포커스가 가면 보이는 자리로 끌어온다.
 * ⚠️ 못 보는 것: 실제 기기 키보드 높이(그려서 볼 것).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const S = readFileSync('src/pages/life/request/Sheet.tsx', 'utf8')

describe('견적 단계 화면 — 키보드', () => {
  const start = S.indexOf('data-testid="life-step-scroll"')
  it('① 소개·안내·제목이 스크롤 영역 안에 있다', () => {
    expect(start).toBeGreaterThan(0)
    const after = S.slice(start)
    for (const k of ['frame.intro &&', 'frame.notice &&', '<h2 ', '{children}']) expect(after.indexOf(k), k).toBeGreaterThan(0)
    expect(S.slice(0, start), '스크롤 영역 밖에 소개가 남았다').not.toContain('frame.intro &&')
  })
  it('② 포커스한 입력칸을 끌어온다', () => {
    expect(S).toMatch(/onFocus=\{\(e\) => \{[^\n]*scrollIntoView\(\{ block: 'center'/)
  })
})
