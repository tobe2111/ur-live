import { describe, it, expect } from 'vitest'
import { describeFetchFailure } from '@/features/marketing/api/search-fetch'
import { isSubrequestLimitError } from '@/features/marketing/api/collect-budget'

/**
 * 🔎 2026-07-29 — 검색 fetch 실패를 "(네트워크)" 한 문장으로 뭉개던 것의 회귀 방지.
 *   라이브에서 `run.diag.naver` 가 매 회차 같은 문구를 기록했는데, 같은 회차 유튜브 쪽 원문이
 *   `Too many subrequests…` 였다 — 원인이 다를 수도, 같을 수도 있는데 **구분이 불가능**했다.
 */
describe('describeFetchFailure — 실패 원인을 분류해서 남긴다', () => {
  it('타임아웃을 네트워크와 구분한다 (AbortSignal.timeout → TimeoutError)', () => {
    const msg = describeFetchFailure(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }), '블로그 검색 호출')
    expect(msg).toContain('타임아웃')
    expect(msg).toContain('블로그 검색 호출')
  })

  it('🚧 서브리퀘스트 한도 원문을 보존한다 — 상위 레인의 예산 자가교정이 이 문구로 동작한다', () => {
    const raw = 'Too many subrequests by single Worker invocation.'
    const msg = describeFetchFailure(new Error(raw), '블로그 검색 호출')
    // 뭉개면 nextSubreqCap 이 예산을 못 낮춘다 — 그래서 판별 헬퍼가 여전히 인식해야 한다(불변식).
    expect(isSubrequestLimitError(msg)).toBe(true)
  })

  it('일반 실패는 에러 이름을 남긴다(원문 없으면 계열을 명시)', () => {
    expect(describeFetchFailure(new TypeError('fetch failed'), '카페 검색 호출')).toContain('TypeError')
    expect(describeFetchFailure(null, '티스토리 검색 호출')).toContain('DNS/연결')
  })

  it('레이블이 항상 앞에 붙어 어느 API 가 실패했는지 알 수 있다', () => {
    for (const label of ['블로그 검색 호출', '카페 검색 호출', '티스토리 검색 호출']) {
      expect(describeFetchFailure(new Error('x'), label).startsWith(label)).toBe(true)
    }
  })

  it('메시지 길이를 제한한다 — 스탬프(300자)를 한 줄이 잡아먹지 않게', () => {
    const msg = describeFetchFailure(new Error('y'.repeat(5000)), '블로그 검색 호출')
    expect(msg.length).toBeLessThan(220)
  })
})
