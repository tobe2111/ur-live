/**
 * 🛡️ 2026-05-25 (migration 0280): 호스팅 API client SSOT.
 */

import api from '@/lib/api'

export interface HostingCatalogItem {
  id: number
  name: string
  price: number
  original_price: number | null
  category: string
  image_url: string | null
  thumbnail: string | null
  group_buy_target: number | null
  group_buy_current: number | null
  group_buy_status: string | null
  restaurant_name: string | null
  my_host_id: number | null
}

export interface HostSession {
  id: number
  product_id: number
  invite_code: string
  target_quantity: number
  current_quantity: number
  status: string
  deadline_at: string | null
  note: string | null
  total_earnings: number
  created_at: string
  product_name?: string
  image_url?: string | null
  thumbnail?: string | null
  price?: number
  category?: string
}

export interface HostingSummary {
  total: number
  active: number
  achieved: number
  total_earnings: number
}

export interface InviteView {
  id: number
  product_id: number
  host_user_id: number
  invite_code: string
  target_quantity: number
  current_quantity: number
  status: string
  deadline_at: string | null
  note: string | null
  product_name: string
  image_url: string | null
  thumbnail: string | null
  price: number
  original_price: number | null
  category: string
  host_handle: string | null
  host_name: string
  host_profile: string | null
}

export const hostingApi = {
  async catalog(category?: string): Promise<{ success: boolean; catalog: HostingCatalogItem[] }> {
    const params = category ? `?category=${encodeURIComponent(category)}` : ''
    const res = await api.get(`/api/hosting/catalog${params}`)
    return res.data
  },
  async startHosting(productId: number, opts?: { target_quantity?: number; note?: string; deadline_at?: string }) {
    const res = await api.post('/api/hosting/me', { product_id: productId, ...opts })
    return res.data as {
      success: boolean
      host?: { id: number; invite_code: string; target_quantity: number; deadline_at: string }
      invite_url?: string
      error?: string
      code?: string
    }
  },
  async listMy(): Promise<{ success: boolean; hosts: HostSession[]; summary: HostingSummary }> {
    const res = await api.get('/api/hosting/me')
    return res.data
  },
  async detail(id: number) {
    const res = await api.get(`/api/hosting/me/${id}`)
    return res.data as { success: boolean; host: HostSession; participants: Array<{ id: number; user_id: number; quantity: number; earnings: number; joined_at: string; user_name: string; profile_image: string | null; handle: string | null }> }
  },
  async cancel(id: number) {
    const res = await api.patch(`/api/hosting/me/${id}/cancel`, {})
    return res.data
  },
  async viewInvite(code: string): Promise<{ success: boolean; host: InviteView; error?: string }> {
    const res = await api.get(`/api/hosting/g/${encodeURIComponent(code)}`)
    return res.data
  },
}
