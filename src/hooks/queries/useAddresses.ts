/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 배송지 목록 (CRUD: mutation 후 refetch).
 * 기존 AddressManagementPage 의 수동 useState+useEffect+loadAddresses() → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export type EntryMethod = 'free' | 'password' | 'intercom' | 'pickup_box'

export interface ShippingAddress {
  id: number
  user_id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
  label?: string | null
  delivery_note?: string | null
  entry_code?: string | null
  entry_method?: EntryMethod | null
  created_at: string
  updated_at: string
}

const CACHE_KEY = 'shipping-addresses'

export function useAddresses() {
  return useQuery<ShippingAddress[]>({
    queryKey: queryKeys.addresses(),
    queryFn: () =>
      api
        .get('/api/shipping-addresses')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as ShippingAddress[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<ShippingAddress[]>(CACHE_KEY, [])),
    initialData: () => readCache<ShippingAddress[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
