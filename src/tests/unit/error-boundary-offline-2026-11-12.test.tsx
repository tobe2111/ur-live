/**
 * 📵 오프라인 청크 실패 — 오류 경계가 "새 버전이 배포됐어요" 대신 연결 안내를 보여 준다 (2026-11-12)
 *
 * 라이브 실측(#2340 배포 뒤, 오프라인 홈): 빈 화면은 사라졌지만 "화면을 업데이트하고 있어요 · 새 버전이 배포되어…" 가 떴다.
 * 오프라인 실패는 배포 탓이 아니고, 그 화면의 "지금 새로고침" 버튼은 오프라인에서 브라우저 오류 화면으로 간다.
 * 지키는 것: 오프라인이면 ① 연결 안내 문구 ② 새로고침 버튼 없음. 온라인이면 종전 화면.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ErrorBoundary, { OFFLINE_COPY } from '@/components/ErrorBoundary'

vi.mock('@/utils/chunk-error', async (orig) => ({ ...(await orig<typeof import('@/utils/chunk-error')>()), recoverFromChunkError: () => true }))

function Boom(): JSX.Element { throw new Error('Failed to fetch dynamically imported module: https://urdeal.kr/assets/x.js') }

describe('📵 오류 경계 오프라인 안내', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it('오프라인: 연결 안내 · 새로고침 버튼 없음', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText(OFFLINE_COPY.title)).toBeTruthy()
    expect(screen.queryByText('지금 새로고침')).toBeNull()
    expect(screen.queryByText(/새 버전이 배포/)).toBeNull()
  })
  it('온라인: 종전 업데이트 안내', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('화면을 업데이트하고 있어요')).toBeTruthy()
    expect(screen.getByText('지금 새로고침')).toBeTruthy()
  })
})
