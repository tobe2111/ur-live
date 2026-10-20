/**
 * Unit Tests — useToast.ts.
 *
 * 2026-05-20: `toast.success(msg, { duration })` 시그니처 영구 도입 (TS2554 사고 후).
 * AdminLiveMonitorPage 등이 사용하는 패턴.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToast, toast } from '@/hooks/useToast'

describe('useToast options', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToast.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('success() 기본 ttl=3500', () => {
    toast.success('hi')
    expect(useToast.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(3499)
    expect(useToast.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(useToast.getState().toasts).toHaveLength(0)
  })

  it('success(msg, { duration }) 로 ttl override', () => {
    toast.success('long', { duration: 10_000 })
    vi.advanceTimersByTime(5_000)
    expect(useToast.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(5_001)
    expect(useToast.getState().toasts).toHaveLength(0)
  })

  it('error() / info() 도 옵션 지원', () => {
    toast.error('err', { duration: 8_000 })
    toast.info('inf', { duration: 6_000 })
    expect(useToast.getState().toasts).toHaveLength(2)
    vi.advanceTimersByTime(6_001)
    expect(useToast.getState().toasts).toHaveLength(1)  // err 만 남음
    vi.advanceTimersByTime(2_000)
    expect(useToast.getState().toasts).toHaveLength(0)
  })

  it('duration <= 0 는 fallback ttl 사용', () => {
    toast.info('zero', { duration: 0 })
    vi.advanceTimersByTime(3_499)
    expect(useToast.getState().toasts).toHaveLength(1)  // 기본 3500ms 까지 남아있음
    vi.advanceTimersByTime(2)
    expect(useToast.getState().toasts).toHaveLength(0)
  })

  it('duplicate dedupe — 1500ms 내 동일 메시지 무시', () => {
    toast.success('same')
    toast.success('same')
    toast.success('same')
    expect(useToast.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1_600)
    toast.success('same')
    expect(useToast.getState().toasts).toHaveLength(2)
  })
})
