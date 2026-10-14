/**
 * 홈 띠 배너 제목은 어드민이 적은 줄바꿈에서만 끊긴다 (2026-10-15 대표 *"그렇게 해줘"* — 지역 배너 문구).
 *
 * 폭이 끊으면 "바다 보고 한 끼, 부산 / 합리적으로" 처럼 구 가운데서 잘린다(라이브 실측).
 * 교환권 배너(SINGLE_CARD_CLS)는 2026-10-14 에 같은 처방을 받았고, 홈 띠만 빠져 있었다.
 */
import { describe, it, expect } from 'vitest'
import { STRIP_CLS } from '@/shared/home-strip-banners'

describe('홈 띠 배너 제목 줄바꿈', () => {
  it('제목의 줄바꿈을 지킨다 (whitespace-pre-line)', () => {
    expect(STRIP_CLS.title.split(/\s+/)).toContain('whitespace-pre-line')
  })
  it('단어 가운데서 자르지 않는다 (keep-all)', () => {
    expect(STRIP_CLS.title.split(/\s+/)).toContain('[word-break:keep-all]')
  })
  it('두 줄을 넘지 않는다', () => {
    expect(STRIP_CLS.title.split(/\s+/)).toContain('line-clamp-2')
  })
})
