/**
 * 🧭 2026-10-31 (대표 "메인에서 지역을 선택하고 이용권을 클릭하고 상세페이지를 보고 뒤로가기를 하면 지역 선택하기 전 메인페이지가 나오네"):
 * 홈이 다시 열릴 때 옛 측위가 고른 지역을 이겼다. 마지막에 고른 쪽을 따른다.
 * ⚠️ 못 보는 것: 실제 브라우저의 뒤로가기(스크롤 위치 복원은 별개).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { homeStartLoc, readHomeRegion } from '@/pages/pc-home/PcHomeLocationBar'
import { rememberLoc, markHomePick } from '@/shared/utils/cached-loc'
import { readCode } from '../helpers/source-text'

beforeEach(() => localStorage.clear())

describe('홈 시작 위치', () => {
  it('측위를 잡은 뒤 지역을 고르면 → 지역이 이긴다(측위 안 씀)', () => {
    rememberLoc({ lat: 37.2, lng: 127.1 })
    localStorage.setItem('ur_home_region_v1', JSON.stringify({ regionKey: 'busan' }))
    markHomePick('region')
    expect(homeStartLoc()).toBeNull()
    expect(readHomeRegion().regionKey).toBe('busan')
  })
  it('지역을 고른 뒤 다시 측위를 잡으면 → 측위가 이긴다', () => {
    localStorage.setItem('ur_home_region_v1', JSON.stringify({ regionKey: 'busan' }))
    markHomePick('region')
    rememberLoc({ lat: 37.2, lng: 127.1 })
    expect(homeStartLoc()).toEqual({ lat: 37.2, lng: 127.1 })
  })
  it('종전 사용자(기록 없음)는 종전대로 측위 우선', () => {
    localStorage.setItem('ur_last_loc_v1', JSON.stringify({ lat: 1, lng: 2 }))
    localStorage.setItem('ur_home_region_v1', JSON.stringify({ regionKey: 'busan' }))
    expect(homeStartLoc()).toEqual({ lat: 1, lng: 2 })
  })
  it('두 홈이 시작 판정을 이 함수로 한다', () => {
    for (const f of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const s = readCode(f)
      expect(s, f).not.toMatch(/readCachedLoc\(\)/)
      expect(s, f).toMatch(/homeStartLoc\(\) \? \{\} : readHomeRegion\(\)/)
    }
  })
})
