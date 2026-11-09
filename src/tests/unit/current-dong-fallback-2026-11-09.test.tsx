/**
 * 🧭 홈 맨 위 동네 이름이 앱이 화면을 넘겨받을 때 '내 주변' 으로 깜빡이지 않는다 (2026-11-09 폰 흉내 실측).
 *   캐시가 빗나가면(좌표가 110m 격자를 넘으면) 조회가 올 때까지 마지막 확정 이름(쿠키 `ur_loc_n`)을 임시로 쓴다.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) } }))
import { useCurrentDong } from '@/hooks/useCurrentDong'

beforeEach(() => {
  localStorage.clear()
  document.cookie = 'ur_loc_n=; max-age=0; path=/'
})

describe('useCurrentDong 임시 이름', () => {
  it('캐시가 없으면 쿠키의 마지막 이름을 바로 쓴다', () => {
    document.cookie = `ur_loc_n=${encodeURIComponent('회현동')}; path=/`
    const seen: (string | undefined)[] = []
    const { result } = renderHook(() => { const v = useCurrentDong({ lat: 37.5612, lng: 126.9801 }); seen.push(v?.dong); return v })
    expect(seen[0], '첫 프레임부터 이름이 있어야 한다(앱이 화면을 넘겨받는 그 프레임)').toBe('회현동')
    expect(result.current?.dong).toBe('회현동')
  })
  it('쿠키도 없으면 null(호출부가 내 주변)', () => {
    const { result } = renderHook(() => useCurrentDong({ lat: 37.5612, lng: 126.9801 }))
    expect(result.current).toBeNull()
  })
  it('캐시가 있으면 캐시가 이긴다', () => {
    document.cookie = `ur_loc_n=${encodeURIComponent('회현동')}; path=/`
    localStorage.setItem('ur_dong_v1:37.561,126.980', JSON.stringify({ dong: '명동', city: '서울' }))
    const { result } = renderHook(() => useCurrentDong({ lat: 37.5612, lng: 126.9801 }))
    expect(result.current?.dong).toBe('명동')
  })
})
