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
  created_at: string
  updated_at: string
}

export function parseHashtags(raw: string | null): string[] {
  if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: '초안', cls: 'bg-gray-100 text-gray-700' },
  approved: { label: '승인됨', cls: 'bg-blue-100 text-blue-700' },
  publishing: { label: '발행 중', cls: 'bg-amber-100 text-amber-700' },
  published: { label: '발행됨', cls: 'bg-green-100 text-green-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  archived: { label: '보관', cls: 'bg-gray-100 text-gray-400' },
}
