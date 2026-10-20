/**
 * 💬 2026-10-01 인스타 댓글 → 자동 DM (유어딜 자체 홍보 계정용) — 순수 로직.
 *
 * "댓글에 OOO 라고 적어주세요, 링크 DM 보내드려요" 자동화.
 * 메타 공식 기능 **Private Reply**(댓글 단 사람에게 그 댓글을 근거로 DM 1통)를 쓴다 —
 * 스크래핑·비공식 API 없음.
 *
 * 이 파일은 DB·네트워크를 만지지 않는다(테스트가 그대로 돈다).
 *   - 웹훅 서명 검증(X-Hub-Signature-256)
 *   - 웹훅 본문 → 댓글 이벤트 목록
 *   - 댓글 → 규칙 매칭
 *   - 메시지 조립
 */

export interface AutoDmRule {
  id: number
  /** 쉼표 구분 키워드. 하나라도 맞으면 발동. */
  keywords: string
  /** 'contains'(댓글 안에 포함) | 'exact'(댓글 전체가 키워드) */
  match_mode: 'contains' | 'exact'
  /** null 이면 모든 게시물. 특정 게시물 ID 면 그 게시물 댓글에만. */
  media_id: string | null
  /** DM 본문. {username} 치환. */
  dm_text: string
  /** (선택) DM 끝에 붙일 링크 */
  link_url: string | null
  /** (선택) 댓글 공개 답글. 줄바꿈으로 여러 개 넣으면 무작위로 하나 — 같은 문장 반복은 스팸 판정을 부른다. */
  public_reply: string | null
  is_active: number
}

export interface CommentEvent {
  /** 웹훅 entry.id = 우리 인스타 프로페셔널 계정 ID */
  accountId: string
  commentId: string
  mediaId: string | null
  fromId: string | null
  fromUsername: string | null
  text: string
  parentId: string | null
}

// ── 서명 검증 ─────────────────────────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 길이가 같은 두 문자열을 시간차 없이 비교. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * 메타 웹훅 서명 검증. 헤더 `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256(앱 시크릿, 원문 본문).
 * 시크릿이 없거나 헤더가 없으면 **거절**한다(검증 못 한 요청을 믿지 않는다).
 */
export async function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string | null | undefined): Promise<boolean> {
  if (!appSecret || !header) return false
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim())
  if (!m) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return safeEqual(toHex(sig), m[1].toLowerCase())
}

// ── 웹훅 본문 파싱 ────────────────────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)

/**
 * 웹훅 본문에서 댓글 이벤트만 뽑는다. 모양이 다른 필드(멘션·메시지 등)는 조용히 건너뛴다.
 * `live_comments`(라이브 댓글)도 같은 모양이라 함께 받는다.
 */
export function parseCommentEvents(payload: unknown): CommentEvent[] {
  const out: CommentEvent[] = []
  const p = payload as { object?: string; entry?: unknown[] }
  if (!p || p.object !== 'instagram' || !Array.isArray(p.entry)) return out
  for (const e of p.entry) {
    const entry = e as { id?: unknown; changes?: unknown[] }
    const accountId = str(entry?.id)
    if (!accountId || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes) {
      const change = ch as { field?: string; value?: Record<string, unknown> }
      if (change?.field !== 'comments' && change?.field !== 'live_comments') continue
      const v = change.value || {}
      const commentId = str(v.id)
      if (!commentId) continue
      const from = (v.from || {}) as Record<string, unknown>
      const media = (v.media || {}) as Record<string, unknown>
      out.push({
        accountId,
        commentId,
        mediaId: str(media.id),
        fromId: str(from.id),
        fromUsername: str(from.username),
        text: typeof v.text === 'string' ? v.text : '',
        parentId: str(v.parent_id),
      })
    }
  }
  return out
}

// ── 키워드 매칭 ───────────────────────────────────────────────────

/** 비교용 정규화: 소문자 · 공백/구두점/이모지 제거. "링크 주세요!!" → "링크주세요" */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '')
}

export function splitKeywords(raw: string): string[] {
  return raw.split(/[,\n]/).map(k => normalizeForMatch(k)).filter(Boolean)
}

export function ruleMatches(rule: AutoDmRule, ev: Pick<CommentEvent, 'text' | 'mediaId'>): boolean {
  if (!rule.is_active) return false
  if (rule.media_id && rule.media_id !== ev.mediaId) return false
  const text = normalizeForMatch(ev.text)
  if (!text) return false
  const kws = splitKeywords(rule.keywords)
  if (rule.match_mode === 'exact') return kws.some(k => text === k)
  return kws.some(k => text.includes(k))
}

/**
 * 맞는 규칙 하나를 고른다 — **특정 게시물 규칙이 전체 규칙보다 먼저**, 같은 급이면 id 순.
 * 한 댓글에 DM 은 한 통뿐이므로(메타 규칙) 규칙도 하나만 고른다.
 */
export function pickRule(rules: AutoDmRule[], ev: Pick<CommentEvent, 'text' | 'mediaId'>): AutoDmRule | null {
  const sorted = [...rules].sort((a, b) => (a.media_id ? 0 : 1) - (b.media_id ? 0 : 1) || a.id - b.id)
  return sorted.find(r => ruleMatches(r, ev)) || null
}

// ── 메시지 조립 ───────────────────────────────────────────────────

/** 인스타 DM 본문 상한(1000자) — 넘으면 메타가 거절한다. */
export const DM_MAX_CHARS = 1000

export function renderDm(rule: Pick<AutoDmRule, 'dm_text' | 'link_url'>, username: string | null): string {
  const name = username ? `@${username}` : ''
  let body = rule.dm_text.replace(/\{username\}/g, name).trim()
  const link = (rule.link_url || '').trim()
  if (link && !body.includes(link)) body = `${body}\n\n${link}`
  return body.slice(0, DM_MAX_CHARS)
}

/** 공개 답글 후보 중 하나. 후보가 없으면 null(답글 안 함). */
export function pickPublicReply(raw: string | null, username: string | null, rand: () => number = Math.random): string | null {
  const options = (raw || '').split('\n').map(s => s.trim()).filter(Boolean)
  if (!options.length) return null
  const chosen = options[Math.min(options.length - 1, Math.floor(rand() * options.length))]
  return chosen.replace(/\{username\}/g, username ? `@${username}` : '').trim() || null
}

/** 링크는 http(s) 만 받는다(javascript: 등 차단). 빈 값은 허용(링크 없는 DM). */
export function isSafeLink(url: string | null | undefined): boolean {
  if (!url) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
