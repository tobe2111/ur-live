/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 추천 commission 요약/내역 + 출금 이력.
 * 기존 MyCommissionsPage 의 수동 Promise.all(2 endpoints) → 단일 useQuery 캡슐화.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { isLoggedInSync } from '@/utils/auth'

export interface Summary {
  total_pending: number
  total_granted: number
  total_withdrawn: number
}

export interface Commission {
  id: number
  order_id: number
  tier: number
  commission_amount: number
  status: string
  created_at: string
}

export interface Withdrawal {
  id: number
  total_amount: number
  commission_count: number
  status: 'pending' | 'approved' | 'rejected'
  bank_name: string
  account_number: string
  account_holder: string
  requested_at: string
  processed_at: string | null
  rejection_reason: string | null
}

export interface MyCommissionsData {
  summary: Summary
  commissions: Commission[]
  withdrawals: Withdrawal[]
}

const EMPTY: MyCommissionsData = {
  summary: { total_pending: 0, total_granted: 0, total_withdrawn: 0 },
  commissions: [],
  withdrawals: [],
}

export function useMyCommissions() {
  return useQuery<MyCommissionsData>({
    queryKey: queryKeys.myCommissions(),
    queryFn: async () => {
      const [comRes, wdRes] = await Promise.all([
        api.get('/api/referral-tree/my-commissions?page_size=20').catch(() => null),
        api.get('/api/referral-tree/withdrawals').catch(() => null),
      ])
      const data: MyCommissionsData = { ...EMPTY, commissions: [], withdrawals: [] }
      if (comRes?.data?.success) {
        data.summary = comRes.data.data.summary ?? EMPTY.summary
        data.commissions = comRes.data.data.commissions || []
      }
      if (wdRes?.data?.success) data.withdrawals = wdRes.data.data || []
      return data
    },
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
