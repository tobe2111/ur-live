/**
 * 🆕 2026-07-01 유어애즈 — 키워드 기회 발굴기 (Opportunity Finder).
 *
 *   이미 보유한 데이터만 교차: 연관키워드(RelKwdStat — 검색량·경쟁도) × 내가 이미 가진 키워드
 *   (자동입찰 규칙 + 저장 키워드 + [연결 시] 광고그룹 등록 키워드) → **"검색량 높고 경쟁 낮은데
 *   내가 안 물고 있는"** 키워드를 점수순으로 제시. 읽기 전용 — 등록은 기존 키워드 추가(write,
 *   KW_ADD_MAX 캡) 버튼을 사용자가 직접 누름.
 *
 *   점수(순수 함수 scoreOpportunities — 단위테스트 잠금):
 *     score = monthlyTotal × compWeight(낮음 1.0 / 중간 0.55 / 높음 0.25)
 *     — 검색량이 커도 경쟁 '높음'이면 소액 광고주에겐 기회가 아님(CPC 폭등).
 *     제외: 이미 보유(공백무시 비교) · 검색량 < MIN_VOLUME(노이즈).
 */
import type { Env } from '@/worker/types/env'
import type { RelatedKeyword } from './searchad-client'
import { relatedKeywords, listKeywords, searchAdCredsFrom } from './searchad-client'
import { loadSearchAdConnection } from './searchad-connection'

const MIN_VOLUME = 100 // 월 검색량 하한(미만은 기회로 안 침)
const TOP_N = 20

export interface Opportunity {
  keyword: string
  monthlyTotal: number
  compIdx: string
  monthlyAvgClick: number
  score: number
  reason: string // 사람용 한 줄 근거
}

/** 비교용 정규화 — 공백 제거 + 소문자(네이버 키워드는 공백무시 동일 취급). */
export const normKw = (s: string): string => s.replace(/\s+/g, '').toLowerCase()

const COMP_WEIGHT: Record<string, number> = { 낮음: 1.0, 중간: 0.55, 높음: 0.25 }

/** 순수 스코어러 — 후보(연관키워드) × 보유 집합 → 기회 목록(점수 내림차순 topN). */
export function scoreOpportunities(candidates: RelatedKeyword[], ownedTexts: Iterable<string>, topN = TOP_N): Opportunity[] {
  const owned = new Set<string>()
  for (const t of ownedTexts) { const n = normKw(String(t || '')); if (n) owned.add(n) }
  const out: Opportunity[] = []
  const seen = new Set<string>()
  for (const k of candidates) {
    const n = normKw(k.keyword)
    if (!n || seen.has(n) || owned.has(n)) continue
    seen.add(n)
    const vol = Number(k.monthlyTotal) || 0
    if (vol < MIN_VOLUME) continue
    const w = COMP_WEIGHT[k.compIdx] ?? 0.55
    const score = Math.round(vol * w)
    out.push({
      keyword: k.keyword, monthlyTotal: vol, compIdx: k.compIdx || '중간',
      monthlyAvgClick: Number(k.monthlyAvgClick) || 0, score,
      reason: `월 ${vol.toLocaleString()}회 검색 · 경쟁 ${k.compIdx || '중간'} · 미등록`,
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, topN)
}

/** 보유 키워드 수집 — 자동입찰 규칙 + 저장 키워드(DB) + [adgroupId 지정 시] 그룹 등록 키워드(live). 전부 fail-soft. */
export async function collectOwnedKeywords(env: Env, accountId: number, adgroupId?: string): Promise<string[]> {
  const owned: string[] = []
  const rules = await env.DB.prepare('SELECT keyword_text FROM ad_autobid_rules WHERE seller_id = ? AND keyword_text IS NOT NULL LIMIT 500')
    .bind(accountId).all<{ keyword_text: string }>().catch(() => null)
  for (const r of rules?.results || []) owned.push(r.keyword_text)
  const saved = await env.DB.prepare('SELECT keyword FROM ad_saved_keywords WHERE account_id = ? LIMIT 500')
    .bind(accountId).all<{ keyword: string }>().catch(() => null)
  for (const r of saved?.results || []) owned.push(r.keyword)
  if (adgroupId) {
    const creds = await loadSearchAdConnection(env.DB, accountId, env.DATA_ENCRYPTION_KEY).catch(() => null)
    if (creds) {
      const live = await listKeywords(creds, adgroupId).catch(() => null)
      for (const k of live?.keywords || []) owned.push(k.keyword)
    }
  }
  return owned
}

/** 오케스트레이터 — seed 연관키워드 조회 → 보유 제외 → 점수화. */
export async function findKeywordOpportunities(env: Env, accountId: number, seed: string, adgroupId?: string): Promise<{ ok: boolean; items?: Opportunity[]; error?: string }> {
  const s = seed.trim().slice(0, 40)
  if (!s) return { ok: false, error: '기준 키워드를 입력해주세요' }
  const creds = (await loadSearchAdConnection(env.DB, accountId, env.DATA_ENCRYPTION_KEY).catch(() => null)) || searchAdCredsFrom(env)
  if (!creds) return { ok: false, error: 'NOT_CONFIGURED' }
  const rel = await relatedKeywords(creds, [s])
  if (!rel.ok) return { ok: false, error: rel.error || '연관키워드 조회 실패' }
  const owned = await collectOwnedKeywords(env, accountId, adgroupId)
  owned.push(s) // seed 자신도 제외
  return { ok: true, items: scoreOpportunities(rel.results || [], owned) }
}
