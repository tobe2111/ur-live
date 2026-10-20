/**
 * 🆕 2026-07-15 어드민 소셜 홍보 — 공유 타입.
 * API: /api/admin/social/* (백엔드 features/social-media).
 */
export type SocialPlatform = 'threads' | 'instagram' | 'youtube'

export const PLATFORMS: { key: SocialPlatform; label: string; emoji: string }[] = [
  { key: 'threads', label: '스레드', emoji: '🧵' },
  { key: 'instagram', label: '인스타그램', emoji: '📸' },
  { key: 'youtube', label: '유튜브', emoji: '▶️' },
]

export interface SocialAccount {
  id: number
  platform: string
  account_ref: string | null
  display_name: string | null
  token_expires_at: string | null
  extra: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface SocialGate {
  platform: SocialPlatform
  label: string
  enabled: boolean
  mediaRequired: 'none' | 'image' | 'video'
}

export interface SocialPost {
  id: number
  platform: string
  topic_slug: string | null
  title: string | null
  body: string
  hashtags: string | null // JSON string
  media_url: string | null
  media_kind: string
  status: string // draft | approved | publishing | published | failed | archived
  external_id: string | null
  external_url: string | null
  error: string | null
  scheduled_at: string | null
  published_at: string | null
  ai_generated: number
  storyboard: string | null            // JSON — 릴스/쇼츠 스토리보드
  render_provider_job: string | null
  render_status: string | null          // none | processing | done | failed
  audience: string | null               // 🎯 2026-10-15 store | creator | consumer (NULL = 종전 손님용)
  src_tag: string | null                // 유입 태그(?src=) — 성과 퍼널 귀속
  created_at: string
  updated_at: string
}

export function parseHashtags(raw: string | null): string[] {
  if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: '초안', cls: 'bg-gray-100 text-gray-700' },
  approved: { label: '승인됨', cls: 'bg-tone-info-bg text-tone-info' },
  publishing: { label: '발행 중', cls: 'bg-tone-warn-bg text-tone-warn' },
  published: { label: '발행됨', cls: 'bg-tone-ok-bg text-tone-ok' },
  failed: { label: '실패', cls: 'bg-tone-bad-bg text-tone-bad' },
  archived: { label: '보관', cls: 'bg-gray-100 text-gray-400' },
}

/** 🎯 2026-10-15 공급 모으기 — 대상. 'auto' 는 서버가 어드민 혼합비로 고른다. */
export type SocialAudienceChoice = 'auto' | 'store' | 'creator' | 'consumer'
export const AUDIENCES: { key: SocialAudienceChoice; label: string }[] = [
  { key: 'auto', label: '자동(혼합비)' },
  { key: 'store', label: '매장 사장님' },
  { key: 'creator', label: '소개 파트너' },
  { key: 'consumer', label: '손님' },
]
export const AUDIENCE_LABEL: Record<string, string> = { store: '매장 사장님', creator: '소개 파트너', consumer: '손님' }

export interface FunnelRow {
  src: string; landings: number; signups: number; stores: number; creatorApplies: number
  post: { id: number; platform: string; audience: string | null; title: string | null; status: string; external_url: string | null } | null
}
