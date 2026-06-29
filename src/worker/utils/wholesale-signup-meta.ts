/**
 * 🏭 2026-06-29 (대표 요청): 도매 가입 메타 — 가입 시 입력받는 취급 카테고리 + 판매/유통 채널.
 *
 *   판매사(distributor): categories(취급 카테고리) + channel(현재 주력 판매채널)
 *   제조사(supplier):    categories(공급 카테고리) + channel(희망 유통채널)
 *
 *   sellers/suppliers god-table 증식 차단(컬럼 예산 — CLAUDE.md) 위해 본체 ALTER 대신
 *   전용 사이드테이블에 (member_type, member_id) 키로 저장. 어드민 승인화면 등에서 조회.
 *   value 는 TEXT — categories 는 JSON 배열 문자열, channel 은 자유 텍스트(cap).
 */
import { swallow } from './swallow'

const _ensured = new WeakSet<object>()

// 도매 카테고리 화이트리스트 (wholesale-theme.WHOLESALE_CATEGORIES 와 동일 — 'all' 제외).
const ALLOWED_CATEGORIES = ['food', 'living', 'health'] as const

export async function ensureWholesaleSignupMeta(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_signup_meta (
    member_type TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    categories TEXT,
    channel TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (member_type, member_id)
  )`).run().catch(swallow('wholesale-signup-meta:ensure'))
}

/** 입력 정제: categories 는 화이트리스트만, channel 은 200자 cap. */
export function sanitizeSignupMeta(rawCategories: unknown, rawChannel: unknown): { categories: string[]; channel: string } {
  const arr = Array.isArray(rawCategories) ? rawCategories : []
  const categories = arr
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((x): x is typeof ALLOWED_CATEGORIES[number] => (ALLOWED_CATEGORIES as readonly string[]).includes(x))
  // 중복 제거
  const uniq = [...new Set(categories)]
  const channel = String(rawChannel || '').trim().slice(0, 200)
  return { categories: uniq, channel }
}

/** member_type: 'distributor' | 'supplier'. 빈 값(카테고리 0 + 채널 빈)이면 저장 생략. fail-soft. */
export async function setWholesaleSignupMeta(
  DB: D1Database,
  memberType: 'distributor' | 'supplier',
  memberId: number,
  rawCategories: unknown,
  rawChannel: unknown,
): Promise<void> {
  if (!memberId || !Number.isFinite(memberId)) return
  const { categories, channel } = sanitizeSignupMeta(rawCategories, rawChannel)
  if (categories.length === 0 && !channel) return // 입력 없음 — 저장 생략
  await ensureWholesaleSignupMeta(DB)
  await DB.prepare(
    `INSERT INTO wholesale_signup_meta (member_type, member_id, categories, channel)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(member_type, member_id) DO UPDATE SET categories = excluded.categories, channel = excluded.channel`,
  ).bind(memberType, memberId, JSON.stringify(categories), channel).run().catch(swallow('wholesale-signup-meta:set'))
}

/** 조회 — 어드민 승인화면 등. 없으면 빈 값. */
export async function getWholesaleSignupMeta(
  DB: D1Database,
  memberType: 'distributor' | 'supplier',
  memberId: number,
): Promise<{ categories: string[]; channel: string }> {
  try {
    await ensureWholesaleSignupMeta(DB)
    const row = await DB.prepare('SELECT categories, channel FROM wholesale_signup_meta WHERE member_type = ? AND member_id = ?')
      .bind(memberType, memberId).first<{ categories: string | null; channel: string | null }>()
    if (!row) return { categories: [], channel: '' }
    let categories: string[] = []
    try { const p = JSON.parse(row.categories || '[]'); if (Array.isArray(p)) categories = p.map((x) => String(x)) } catch { /* noop */ }
    return { categories, channel: row.channel || '' }
  } catch {
    return { categories: [], channel: '' }
  }
}
