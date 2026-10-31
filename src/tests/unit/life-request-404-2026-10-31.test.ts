/**
 * 🏠 없는 업종 견적 주소(`/life/request/zzzz`)는 404 다 (2026-10-31).
 *
 * 서치콘솔이 그 모양을 soft-404 로 잡았다 — 화면은 "없는 카테고리예요" 인데 서버는 200 + index 였다.
 * 🔴 반대 방향이 더 비싸다: 실재 업종 전부가 계속 "아는 경로" 여야 한다(아니면 색인이 빠진다).
 * ⚠️ 못 보는 것: 워커 배선(`unknownPath` → 404)은 `unknown-path-404-2026-10-12.test.ts` 가 본다.
 */
import { describe, it, expect } from 'vitest'
import { isKnownAppPath } from '@/shared/seo/known-routes'
import { HOME_SERVICE_CATEGORIES } from '@/shared/home-service-categories'

describe('/life/request/:category 판정', () => {
  it('실재 업종은 전부 통과(0개면 통과가 아니라 실패)', () => {
    expect(HOME_SERVICE_CATEGORIES.length).toBeGreaterThan(3)
    for (const c of HOME_SERVICE_CATEGORIES) expect(isKnownAppPath(`/life/request/${c.key}`), c.key).toBe(true)
  })
  it.each(['/life/request/zzzz', '/life/request/MOVING', '/life/request/constructor'])('%s → 모르는 경로', (p) => {
    expect(isKnownAppPath(p)).toBe(false)
  })
  it('형제 경로는 건드리지 않는다', () => {
    expect(isKnownAppPath('/life')).toBe(true)
    expect(isKnownAppPath('/life/requests')).toBe(true)
    expect(isKnownAppPath('/life/requests/123')).toBe(true)
  })
})
