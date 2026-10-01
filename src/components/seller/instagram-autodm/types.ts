/** 💬 인스타 자동 DM — 서버 응답 모양(어드민·셀러 공용). 백엔드: features/instagram-autodm/api/autodm.routes.ts */

/** 계정 하나의 상태 — `${base}/status`. 공식 계정·매장 계정 같은 모양. */
export interface AutoDmStatus {
  /** 유어딜 쪽 앱 설정(앱 ID·시크릿)이 됐나 — 안 됐으면 연결 버튼이 동작하지 않는다 */
  available: boolean
  /** 매장 계정 전체 스위치(공식 계정은 항상 true). false 면 켜도 발송 0 */
  sellers_enabled: boolean
  /** 켤 수 없는 이유(가게 승인 전 등) */
  enable_block: string | null
  connected: boolean
  username: string | null
  enabled: boolean
  daily_cap: number
  cap_max: number
  token_expires_at: string | null
  token_refresh_error: string | null
  active_rules: number
  stats: { sent24h: number; failed24h: number; sentTotal: number }
}

/** 어드민 — 메타 앱 설정. */
export interface AutoDmAppConfig {
  app_id: string | null
  has_app_secret: boolean
  sellers_enabled: boolean
  verify_token: string
  webhook_url: string
  redirect_uri: string
  deauthorize_url: string
  data_deletion_url: string
  encryption_key_set: boolean
}

export interface SellerAccountRow {
  id: number
  seller_id: number | null
  store_name: string | null
  username: string | null
  enabled: number
  daily_cap: number
  sent24h: number
  failed24h: number
}

export interface AutoDmRule {
  id: number
  name: string | null
  keywords: string
  match_mode: 'contains' | 'exact'
  media_id: string | null
  dm_text: string
  link_url: string | null
  public_reply: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export interface AutoDmSend {
  id: number
  comment_id: string
  rule_id: number | null
  media_id: string | null
  from_username: string | null
  comment_text: string | null
  status: 'claimed' | 'sent' | 'failed' | 'skipped'
  error: string | null
  public_reply_status: string | null
  created_at: string
  sent_at: string | null
}

export interface IgMedia {
  id: string
  caption?: string
  permalink?: string
  thumbnail_url?: string
  media_url?: string
  media_type?: string
  timestamp?: string
}

export function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err?.response?.data?.error || fallback
}
