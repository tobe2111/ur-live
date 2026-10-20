/**
 * 🙋 소개자 공개 프로필 — "나는 소개 활동을 합니다"를 켜는 곳 (2026-08-27)
 *
 * ## 왜 이게 없어서 딜이 0건이었나
 *
 * 매장이 인플루언서에게 딜을 제안하려면 상대의 **유어딜 유저 ID** 를 알아야 하는데,
 * 제안 화면이 그걸 **손으로 타이핑**하게 돼 있었다(`placeholder: 'user_12345'`).
 * 사장님이 남의 계정 ID 를 알 방법이 없으니 현실에서는 못 쓰는 화면이었다.
 *
 * 그렇다고 `users` 전체를 셀러 검색에 열 수는 없다 — 가입자 전원을 사업자에게 노출하는 것이고,
 * 이 레포의 개인정보 룰(셀러 전화·이메일 비공개)과도 어긋난다. 실적 랭킹도 답이 아니다:
 * 실적이 있어야 뜨는데 딜이 0건이라 **모수가 0** 이다(닭-달걀).
 *
 * ⇒ 빠진 건 검색 기능이 아니라 **모수**다. 유저가 스스로 켜는 공개 프로필이 있어야
 *   매장이 찾을 사람이 생긴다. 이 파일이 그 모수를 만든다.
 *
 * ## 공개 범위 — 최소한만
 * 셀러에게 보이는 것: 핸들 · 표시명 · 채널 링크 · 팔로워 규모 · 카테고리/지역 · 한 줄 소개.
 * **절대 안 보내는 것: 이메일 · 전화번호 · 실명.** 매장과 연락은 딜 제안(플랫폼 안)으로만 한다 —
 * 연락처를 노출하면 그 순간 플랫폼 밖 거래와 콜드 연락의 통로가 된다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 채널 한 줄. `followers` 는 본인 신고값 — 검증하지 않는다(그래서 정렬 기준으로만 쓴다). */
export interface ProfileChannel {
  kind: 'instagram' | 'youtube' | 'blog' | 'tiktok' | 'other'
  url: string
  followers?: number | null
}

export interface InfluencerProfile {
  user_id: string
  is_open: 0 | 1
  intro: string | null
  channels: ProfileChannel[]
  categories: string[]
  regions: string[]
  updated_at?: string | null
}

export const CHANNEL_KINDS: readonly ProfileChannel['kind'][] =
  ['instagram', 'youtube', 'blog', 'tiktok', 'other'] as const

let _ensured = false
export async function ensureInfluencerProfileTable(DB: D1Database): Promise<void> {
  if (_ensured) return
  _ensured = true
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS influencer_profiles (
         user_id TEXT PRIMARY KEY,
         is_open INTEGER NOT NULL DEFAULT 0,
         intro TEXT,
         channels TEXT,
         categories TEXT,
         regions TEXT,
         created_at DATETIME DEFAULT (datetime('now')),
         updated_at DATETIME DEFAULT (datetime('now'))
       )`
    ).run()
    // 셀러 검색은 항상 `is_open = 1` 로 시작한다 — 부분 인덱스로 공개분만 스캔.
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_influencer_profiles_open
         ON influencer_profiles(is_open) WHERE is_open = 1`
    ).run()
  } catch { /* best-effort — repair-schema 가 정본 */ }
}

/** JSON 컬럼 파서 — 저장이 깨졌어도 화면이 죽지 않게 항상 배열을 준다. */
export function parseJsonList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export function parseChannels(raw: unknown): ProfileChannel[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.flatMap((c: unknown) => {
      if (!c || typeof c !== 'object') return []
      const o = c as Record<string, unknown>
      const kind = String(o.kind || '') as ProfileChannel['kind']
      const url = String(o.url || '').trim()
      if (!CHANNEL_KINDS.includes(kind) || !url) return []
      const f = Number(o.followers)
      return [{ kind, url, followers: Number.isFinite(f) && f >= 0 ? Math.floor(f) : null }]
    })
  } catch { return [] }
}

/**
 * 저장 전 정규화 — 사용자 입력을 그대로 넣지 않는다.
 * ⚠️ `url` 은 **http(s) 만** 통과시킨다. `javascript:` 를 넣어 두면 셀러 화면에서 그 링크를
 *    누르는 순간 스크립트가 된다(저장형 XSS). 화면에서 막는 것으로는 부족하다 — 저장 시점에 건다.
 */
export function sanitizeChannels(input: unknown, max = 5): ProfileChannel[] {
  const parsed = Array.isArray(input) ? input : []
  const out: ProfileChannel[] = []
  for (const c of parsed) {
    if (out.length >= max) break
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const kind = String(o.kind || '') as ProfileChannel['kind']
    if (!CHANNEL_KINDS.includes(kind)) continue
    const url = String(o.url ?? '').trim().slice(0, 300)
    if (!/^https?:\/\//i.test(url)) continue
    const f = Number(o.followers)
    out.push({ kind, url, followers: Number.isFinite(f) && f >= 0 ? Math.min(Math.floor(f), 1_000_000_000) : null })
  }
  return out
}

export function sanitizeList(input: unknown, allowed: readonly string[], max = 6): string[] {
  const arr = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  for (const v of arr) {
    if (seen.size >= max) break
    const s = String(v ?? '')
    if (allowed.includes(s)) seen.add(s)
  }
  return [...seen]
}

export function rowToProfile(row: Record<string, unknown> | null | undefined): InfluencerProfile | null {
  if (!row) return null
  return {
    user_id: String(row.user_id ?? ''),
    is_open: Number(row.is_open ?? 0) === 1 ? 1 : 0,
    intro: (row.intro as string) ?? null,
    channels: parseChannels(row.channels),
    categories: parseJsonList(row.categories),
    regions: parseJsonList(row.regions),
    updated_at: (row.updated_at as string) ?? null,
  }
}

/** 채널 중 가장 큰 팔로워 수 — 검색 정렬용(본인 신고값이라 "규모 감"으로만 쓴다). */
export function maxFollowers(channels: ProfileChannel[]): number {
  return channels.reduce((m, c) => Math.max(m, Number(c.followers ?? 0)), 0)
}
