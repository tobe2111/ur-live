/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 클라이언트 API SSOT.
 * /api/curator/* 엔드포인트의 단일 fetch wrapper.
 *
 * 기존 affiliate_ref 헤더 시스템 (lib/api.ts:210) 와 통합:
 *   - 모든 호출에 X-Affiliate-Ref 자동 첨부
 *   - 핀 redirect → ProductDetailPage 가 localStorage.affiliate_ref 저장 (기존 흐름)
 */

import api from '@/lib/api'

export interface CuratorPin {
  id: number
  product_id: number
  position: number
  note: string | null
  click_count: number
  product_name: string
  image_url: string | null
  thumbnail: string | null
  price: number
  original_price: number | null
  category: string
  deal_only?: number
  is_active: number
  commission_rate: number
  dominant_color?: string | null
}

export interface CuratorProfile {
  id: number
  handle: string
  name: string
  bio: string | null
  profile_image: string | null
  banner_url?: string | null
  headline?: string | null // 🎨 2026-06-18 마퀴(흐르는 헤드라인)
  accent?: string | null // 🎨 2026-06-19 마퀴 액센트 색 (#RRGGBB)
  theme: 'dark' | 'light' | string
  // 🎨 2026-06-16 링크샵 시안: 크리에이터 SNS 링크.
  youtube_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
}

export interface CuratorPageResponse {
  success: boolean
  curator: CuratorProfile
  pins: CuratorPin[]
  // 🛡️ 2026-05-25: linked seller — 있으면 셀러 공개페이지로 navigate (풍부 UI)
  linked_seller?: { id: number; username: string; name: string } | null
  error?: string
}

export interface PinStats {
  id: number
  product_id: number
  lifetime_clicks: number
  clicks: number
  purchases: number
  earnings: number
}

export interface DashboardStats {
  month_earnings: number
  // ⏳ 2026-06-15: 적립 예정(holding) — T+7 확정 대기분. month_earnings 는 확정분만.
  pending_earnings?: number
  clicks_30d: number
  // 2026-06-15: 순클릭(ip+ua+일자 dedup) + 전환율(구매/순클릭 %).
  unique_clicks_30d?: number
  conversion_rate_30d?: number
  purchases_30d: number
  top_pins: Array<{ id: number; product_id: number; click_count: number; product_name: string; thumbnail: string | null; image_url: string | null }>
  earnings_daily_30d: Array<{ date: string; amount: number }>
  // 🛡️ 2026-05-31: 원천별 수익 내역 (어느 상품/주문에서 적립됐는지). status: holding=적립예정.
  recent_earnings?: Array<{ id: number; product_id: number; product_name: string | null; commission: number; order_amount: number; created_at: string; status?: string }>
}

export const curatorApi = {
  async getPage(handle: string): Promise<CuratorPageResponse> {
    const res = await api.get(`/api/curator/${encodeURIComponent(handle)}`)
    return res.data
  },

  async checkHandle(handle: string): Promise<{ available: boolean; reason?: string; message?: string }> {
    const res = await api.get(`/api/curator/handle/check?q=${encodeURIComponent(handle)}`)
    return res.data
  },

  async addPin(productId: number, note?: string): Promise<{
    success: boolean
    pin?: { id: number; user_id: number; product_id: number; position: number; note: string | null }
    handle?: string
    handle_just_created?: boolean
    error?: string
    code?: string
  }> {
    const res = await api.post('/api/curator/me/pins', { product_id: productId, note })
    return res.data
  },

  async removePin(pinId: number): Promise<{ success: boolean; error?: string }> {
    const res = await api.delete(`/api/curator/me/pins/${pinId}`)
    return res.data
  },

  async reorderPins(pinIds: number[]): Promise<{ success: boolean; count: number }> {
    const res = await api.patch('/api/curator/me/pins/reorder', { pin_ids: pinIds })
    return res.data
  },

  async updatePinNote(pinId: number, note: string): Promise<{ success: boolean }> {
    const res = await api.patch(`/api/curator/me/pins/${pinId}`, { note })
    return res.data
  },

  async updateHandle(handle: string): Promise<{ success: boolean; handle?: string; error?: string; code?: string }> {
    const res = await api.patch('/api/curator/me/handle', { handle })
    return res.data
  },

  async getDashboard(): Promise<{ success: boolean; stats: DashboardStats }> {
    const res = await api.get('/api/curator/me/dashboard')
    return res.data
  },

  async getPinStats(range = 7): Promise<{ success: boolean; range: number; stats: PinStats[] }> {
    const res = await api.get(`/api/curator/me/pins/stats?range=${range}`)
    return res.data
  },

  async getRecommendations(limit = 20): Promise<{
    success: boolean
    recommendations: Array<{ id: number; name: string; price: number; original_price: number | null; category: string; image_url: string | null; thumbnail: string | null; commission_rate: number; sold_count: number }>
  }> {
    const res = await api.get(`/api/curator/recommendations?limit=${limit}`)
    return res.data
  },

  // ── Phase 4: 출금 ──
  async getWithdrawalInfo(): Promise<{
    success: boolean
    lifetime_earnings: number
    total_withdrawn: number
    available: number
    min_withdrawal: number
    withholding_rate: number
    history: Array<{ id: number; amount: number; withholding_tax: number; net_amount: number; bank_name: string; status: string; requested_at: string }>
    seller_upgrade: { threshold: number; eligible: boolean; offered: boolean }
    // 🛡️ 2026-05-25 신모델: 정산 모드 분기
    payout_mode: 'cash' | 'deal'
    is_business_seller: boolean
    deal_balance: number
  }> {
    const res = await api.get('/api/curator/me/withdrawal')
    return res.data
  },
  async requestWithdrawal(input: { amount: number; bank_name: string; bank_account: string; account_holder: string }) {
    const res = await api.post('/api/curator/me/withdrawal', input)
    return res.data as { success: boolean; withdrawal?: { id: number; amount: number; net_amount: number; status: string }; error?: string; available?: number }
  },
  async acknowledgeUpgradeOffer() {
    const res = await api.post('/api/curator/me/seller-upgrade-acknowledge', {})
    return res.data
  },
  async getBusiness(): Promise<{ success: boolean; data: {
    business_number?: string | null; business_name?: string | null;
    business_status?: string; tax_type?: string | null;
    bank_name?: string | null; bank_account?: string | null; account_holder?: string | null;
    is_store_seller?: boolean;
  } }> {
    const res = await api.get('/api/curator/me/business')
    return res.data
  },
  async registerBusiness(input: {
    business_number: string; business_name: string; representative: string;
    start_date?: string; tax_type?: 'business_income' | 'other_income';
    bank_name: string; bank_account: string; account_holder: string;
  }): Promise<{ success: boolean; data?: { business_status: string }; message?: string; error?: string; code?: string }> {
    const res = await api.post('/api/curator/me/business', input)
    return res.data
  },
  async getIntroducedStores(): Promise<{ success: boolean; total_commission: number; stores: Array<{
    id: number; business_name: string | null; status: string | null;
    introduced_at: string | null; referral_bonus_until: string | null;
    total_orders: number; total_sales: number;
  }> }> {
    const res = await api.get('/api/curator/me/introduced-stores')
    return res.data
  },
  async createProxyProduct(input: {
    merchant_seller_id: number; name: string; description?: string;
    price: number; stock?: number; category?: string; image_url?: string;
  }): Promise<{ success: boolean; product_id?: number; message?: string; error?: string; code?: string }> {
    const res = await api.post('/api/curator/me/proxy-product', input)
    return res.data
  },
}
