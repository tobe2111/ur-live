/**
 * 🚀 "오늘 보낼 N명" 발송 큐 로더 — 서버(`/influencer-pool/send-queue`)가 골라준 리드만 받아온다.
 *
 *   왜 별도 훅인가: 발송 모드의 기존 진입로는 **현재 필터/선택**이라, 대표가 매번 "누구부터?"를
 *   손으로 정해야 했다. 라이브 실측(2026-07-29)에서 풀 37,937명 대비 실제 접촉이 1건이었던
 *   병목이 정확히 이 지점이다 — 도구가 없어서가 아니라 **시작점을 만드는 부담** 때문이었다.
 *   서버가 "지금 열 수 있고 · 아직 접촉 안 했고 · 점수 높은" 순으로 잘라주면 클릭 한 번으로 시작된다.
 *
 *   ⚖️ [LEGAL] 목록만 가져온다. 발송은 기존과 동일하게 사람이 한 건씩 열어 직접 한다(자동발송 아님).
 */
import { useCallback, useState } from 'react'
import api from '@/lib/api'

/** 서버 send-queue 가 돌려주는 리드(발송 모드가 요구하는 최소 필드 + 표시용). */
export interface SendQueueLead {
  id: number
  platform: string
  name: string
  url: string
  email: string | null
  instagram: string | null
  status: string
  outreach_draft?: string | null
  lead_score?: number | null
  subscriber_count?: number
  category?: string | null
  email_status?: string | null
}

export interface SendQueueState {
  leads: SendQueueLead[]
  /** 조건을 만족하는 **전체** 남은 인원 — 오늘 20명을 소진해도 뒤가 얼마나 남았는지. */
  remaining: number
  loading: boolean
  error: string | null
}

const EMPTY: SendQueueState = { leads: [], remaining: 0, loading: false, error: null }

export function useSendQueue() {
  const [state, setState] = useState<SendQueueState>(EMPTY)

  /** 큐를 채운다. 성공 시 leads.length > 0 이면 호출부가 발송 모드를 연다. */
  const load = useCallback(async (limit = 20): Promise<SendQueueLead[]> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const r = await api.get<{ success: boolean; leads?: SendQueueLead[]; remaining?: number }>(
        `/api/admin/ads/influencer-pool/send-queue?limit=${limit}`,
      )
      const leads = r.data?.leads || []
      setState({ leads, remaining: r.data?.remaining ?? leads.length, loading: false, error: null })
      return leads
    } catch {
      // 🛡️ 실패를 빈 목록으로 위장하지 않는다 — "오늘 보낼 사람 0명"과 "조회 실패"는 다음 행동이 다르다.
      setState({ ...EMPTY, error: '발송 큐를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
      return []
    }
  }, [])

  const reset = useCallback(() => setState(EMPTY), [])
  return { ...state, load, reset }
}
