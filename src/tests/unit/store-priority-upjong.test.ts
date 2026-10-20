/**
 * 🎯 유어딜 4대 업종 우선 (2026-07-29 대표 "학원은 거의 안 써. 음식점·카페·미용실·숙박에 힘을 써").
 *
 *   배경 실측: 매장 풀 24,160 중 **학원 24,038(99.5%)**, 이 넷은 **0건**. 인허가 레인이 돌기 시작하면
 *   두 종류가 한 큐에 섞이는데, 정렬이 없으면 **양 많은 쪽(학원)이 보강 예산을 먹는다**.
 *
 *   ⚠️ 가장 조용한 실패 방식: 상수의 한글 업종명이 `LICENSE_UPJONG` 의 값과 **한 글자라도 다르면**
 *   우선순위가 없는 것과 같아진다(에러 없음). 그 일치를 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { PRIORITY_UPJONG, PRIORITY_UPJONG_SQL, LICENSE_UPJONG } from '@/features/marketing/api/store-prospects'

describe('우선 업종', () => {
  it('🔒 우선 업종 이름이 인허가 업종맵의 값과 정확히 일치한다(불일치 = 조용한 무효화)', () => {
    const known = new Set(Object.values(LICENSE_UPJONG))
    for (const c of PRIORITY_UPJONG) expect(known.has(c)).toBe(true)
  })

  it('유어딜이 파는 네 업종을 담는다', () => {
    expect([...PRIORITY_UPJONG]).toEqual(['일반음식점', '휴게음식점', '미용업', '숙박업'])
  })

  it('SQL 조각이 우선 업종을 0, 나머지를 1 로 준다', () => {
    expect(PRIORITY_UPJONG_SQL).toContain("'일반음식점'")
    expect(PRIORITY_UPJONG_SQL).toContain('THEN 0 ELSE 1 END')
    // 작은따옴표가 값 안에 없어야 SQL 이 깨지지 않는다(업종명은 한글뿐)
    for (const c of PRIORITY_UPJONG) expect(c).not.toContain("'")
  })

  it('학원은 우선 업종이 아니다 — 대표가 거의 안 쓴다고 확인', () => {
    expect((PRIORITY_UPJONG as readonly string[]).includes('학원')).toBe(false)
  })

  it('엔드포인트 정렬이 우선 업종을 앞으로 보낸다(수집 커서가 이 순서를 따른다)', () => {
    const eps = Object.entries(LICENSE_UPJONG).sort((a, b) => {
      const rank = (cat: string) => (PRIORITY_UPJONG as readonly string[]).indexOf(cat)
      const ra = rank(a[1]), rb = rank(b[1])
      return ra !== rb ? (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) : 0
    })
    expect(eps.slice(0, 4).map(e => e[1])).toEqual(['일반음식점', '휴게음식점', '미용업', '숙박업'])
  })
})
