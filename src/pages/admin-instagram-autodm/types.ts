/** 💬 인스타 자동 DM 어드민 — 서버 응답 모양. 백엔드: features/instagram-autodm/api/autodm.routes.ts */

export interface AutoDmStatus {
  connected: boolean
  username: string | null
  ig_user_id: string | null
  has_app_secret: boolean
  enabled: boolean
  daily_cap: number
  token_expires_at: string | null
  token_refreshed_at: string | null
  token_refresh_error: string | null
  encryption_key_set: boolean
  verify_token: string
  webhook_url: string
  active_rules: number
  stats: { sent24h: number; failed24h: number; sentTotal: number }
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
