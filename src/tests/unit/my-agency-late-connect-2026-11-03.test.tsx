/**
 * 🐢 2026-11-03 대표 *"마이페이지도 확인해주고 이제 전체적으로 가장 이상적인 형태인거야?"*
 *
 * 실사용 CLS 원인(11-02 폰 마이): `div.ur-content-medium.lg:px-4 | y657→0 h70→0 | t1376` — 화면이 뜬 뒤(1.4초)
 * `MyAgencyZone` 의 카카오 자동 연결이 성공하면 에이전시 구역·머리 버튼·폰 '나 | 에이전시' 탭(에이전시 기본)이 한꺼번에 생겨
 * 보던 '나' 화면이 통째로 사라졌다.
 * 지키는 것: ① 화면이 뜬 뒤 켜짐은 이번 화면에 반영 안 함 ② 꺼짐(로그아웃·만료)은 즉시 ③ 처음부터 켜져 있으면 그대로
 *   ④ 자동 연결 성공은 이번 화면에서 구역을 안 끼워 넣는다.
 * ⚠️ 못 보는 것: 실제 자동 연결 왕복(라이브) · 다음 방문에 탭이 처음부터 뜨는지(새 마운트라 ③ 이 그것이다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useAgencyPresence } from '@/pages/user-profile/useAgencyPresence'
import { AGENCY_TOKEN_KEY_MIRROR, announceAgencyPresence } from '@/lib/agency-presence'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe('마이 — 에이전시가 늦게 켜져도 보던 화면을 안 바꾼다', () => {
  it('① 처음엔 꺼져 있다가 화면이 뜬 뒤 켜지면 이번 화면은 꺼진 채', () => {
    const { result } = renderHook(() => useAgencyPresence())
    expect(result.current.on).toBe(false)
    act(() => { localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 't'); announceAgencyPresence() })
    expect(result.current.on).toBe(false)
  })
  it('② 켜진 채 시작해 로그아웃하면 즉시 꺼지고, 같은 화면에서 다시 켜지면 켜진다', () => {
    localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 't')
    const { result } = renderHook(() => useAgencyPresence())
    expect(result.current.on).toBe(true)
    act(() => { localStorage.removeItem(AGENCY_TOKEN_KEY_MIRROR); announceAgencyPresence() })
    expect(result.current.on).toBe(false)
    act(() => { localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 't'); announceAgencyPresence() })
    expect(result.current.on).toBe(true)
  })
  it('③ 다음 화면(새 마운트)은 처음부터 켜져 있다', () => {
    localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 't')
    expect(renderHook(() => useAgencyPresence()).result.current.on).toBe(true)
  })
  it('④ 자동 연결 성공은 이번 화면에서 구역을 안 끼워 넣는다', () => {
    const src = readFileSync('src/pages/user-profile/MyAgencyZone.tsx', 'utf8')
    expect(src).toMatch(/\.then\(\(ok\) => \{ if \(ok\) \{ setLateConnected\(true\); setOn\(true\) \} \}\)/)
    expect(src).toMatch(/if \(!on \|\| lateConnected\) return null/)
  })
})
