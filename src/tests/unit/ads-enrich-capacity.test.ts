import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shouldFallbackToFront, FALLBACK_MIN_BUDGET } from '@/features/marketing/api/enrich-capacity'

const LANE = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-enrich-lane.ts'), 'utf8')
/** 주석을 걷어낸 본문 — 배선은 **코드**에 있어야 한다(주석에만 남아도 통과하는 함정 차단). */
const CODE = LANE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * ♻️ **여력 자동배치** (2026-08-12 대표 *"자동으로 알아서 소진하게끔 해줘"*).
 *
 * 측정 샤드 1~3번은 블로그 전용이라, 블로그 백로그가 마르면 **예산이 남는데 아무 일도 안 한다.**
 * 라이브(08-12 20:35)가 그 직전이었다: 블로그 1,423(2시간 뒤 0) · 유튜브 667 미측정 ·
 * 측정 능력이 유입의 3.5배. 사람이 그때 설정을 바꿔 주지 않으면 능력의 3분의 2가 논다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 폴백이 **실제로 유튜브를 얼마나 더 재는지**(쿼터·시계는 코드 밖 사실).
 *   그건 라이브 스냅샷의 `fell_back` + `yt_rows` 로 판정한다.
 */
describe('♻️ shouldFallbackToFront — 트랙이 마르면 여력을 넘긴다', () => {
  it('🔒 고를 행이 0 이고 예산이 남으면 갈아탄다', () => {
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: 20 })).toBe(true)
  })

  it('🔒 할 일이 있었으면 절대 안 갈아탄다 — 바쁜 트랙을 뺏으면 안 된다', () => {
    expect(shouldFallbackToFront({ selected: 12, budgetLeft: 40 })).toBe(false)
    expect(shouldFallbackToFront({ selected: 1, budgetLeft: 40 })).toBe(false)
  })

  /**
   * 🔴 **이게 이 함수의 핵심 구분이다.** `measured === 0` 으로 판단하면 "큐가 빔"과
   * "예산·시계가 먼저 끊김"을 못 가려, **가장 바쁠 때 트랙을 갈아타 버린다.**
   * `selected` 는 그 구분을 지키도록 `influencer-performance.ts` 가 명시적으로 유지하는 값이다.
   */
  it('🔒 예산이 바닥이면 안 갈아탄다 — 갈아타 봐야 한 행도 못 끝내고 다음 회차 몫만 태운다', () => {
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: 0 })).toBe(false)
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: FALLBACK_MIN_BUDGET - 1 })).toBe(false)
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: FALLBACK_MIN_BUDGET })).toBe(true)
  })

  it('🔒 트랙이 아예 안 돌았으면(무판정) 갈아타지 않는다', () => {
    expect(shouldFallbackToFront({ selected: undefined, budgetLeft: 40 })).toBe(false)
    expect(shouldFallbackToFront({ selected: Number.NaN, budgetLeft: 40 })).toBe(false)
  })

  it('🐛 이상값에 안 무너진다', () => {
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: Number.NaN })).toBe(false)
    expect(shouldFallbackToFront({ selected: 0, budgetLeft: -5 })).toBe(false)
  })

  it('🔌 배선 — naverOnly 샤드가 실제로 폴백을 부른다', () => {
    expect(CODE).toMatch(/shouldFallbackToFront\(\{\s*selected: naver\?\.selected,\s*budgetLeft: budget\.left\s*\}\)/)
    // ⚠️ 폴백 대상은 **링크인바이오뿐**이다 — YT 를 부르면 샤드 수만큼 쿼터가 곱해진다.
    expect(CODE).toMatch(/fellBack = true\s*\n\s*try \{ bio = await enrichPoolFromLinkInBio\(/)
    // 발동 사실이 밖에서 보여야 한다 — 안 보이면 "말랐는데 놀고 있었다"를 다음 세션이 또 못 본다.
    expect(CODE).toMatch(/fellBack = true/)
    expect(CODE).toMatch(/fell_back: true/)
  })
})
