/**
 * 🗺️ 2026-07-02 (대표 "카카오맵 리뷰 게이미피케이션 — 추천대로 진행") — 동네 리뷰어 점수/레벨 SSOT.
 *
 * 설계: docs/design/kakao-review-gamification.md
 *  - 유저가 카카오맵 후기를 쓰고 매장/운영팀이 확인(승인)하면 리뷰 점수가 쌓이고 레벨이 오른다.
 *  - 레벨은 전용 이용권(product_supply_meta.min_review_level) 구매 자격을 연다.
 *  - 점수 적립은 kakao_review_submissions 의 승인 트랜지션(CAS submitted→paid 승자)에서만 호출
 *    → 멱등은 호출측 CAS + UNIQUE(voucher_id) 가 보장 (머니 룰 #1 claim-before-credit 과 동일 구조).
 *  - 잔액류 컬럼은 원자 증감만 (check-balance-absolute-write 준수).
 *
 * 운영 조정 (platform_settings):
 *  - review_score_per_approval : 승인 1건당 점수 (default 10)
 *  - review_level_thresholds   : 레벨별 필요 승인 건수 JSON (default {"2":3,"3":10,"4":25,"5":50})
 */

import { swallow } from './swallow'

export const REVIEW_LEVEL_MAX = 5
/** 사용자-가시 레벨 라벨 (명칭 SSOT 준수 — 사람 지칭 금지어 없음). */
export const REVIEW_LEVEL_LABELS: Record<number, string> = {
  1: '새싹',
  2: '단골',
  3: '열혈 리뷰어',
  4: '동네 전문가',
  5: '동네 앰버서더',
}

const DEFAULT_THRESHOLDS: Record<number, number> = { 2: 3, 3: 10, 4: 25, 5: 50 }
const DEFAULT_SCORE_PER_APPROVAL = 10

const _ensured = new WeakSet<object>()
export async function ensureReviewScoreTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_review_scores (
      user_id TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 0,
      approved_count INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT (datetime('now'))
    )`).run()
  } catch { /* exists */ }
}

export async function getReviewLevelConfig(DB: D1Database): Promise<{ thresholds: Record<number, number>; scorePerApproval: number }> {
  let thresholds = DEFAULT_THRESHOLDS
  let scorePerApproval = DEFAULT_SCORE_PER_APPROVAL
  try {
    const rows = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('review_level_thresholds', 'review_score_per_approval')"
    ).all<{ key: string; value: string }>()
    for (const r of rows?.results || []) {
      if (r.key === 'review_score_per_approval') {
        const n = Number(r.value)
        if (Number.isFinite(n) && n >= 0) scorePerApproval = Math.floor(n)
      } else if (r.key === 'review_level_thresholds') {
        const parsed = JSON.parse(r.value) as Record<string, unknown>
        const out: Record<number, number> = {}
        for (const [lv, cnt] of Object.entries(parsed)) {
          const l = Number(lv); const n = Number(cnt)
          if (Number.isInteger(l) && l >= 2 && l <= REVIEW_LEVEL_MAX && Number.isFinite(n) && n > 0) out[l] = Math.floor(n)
        }
        if (Object.keys(out).length) thresholds = out
      }
    }
  } catch { /* 설정 없음/파싱 실패 → 기본값 */ }
  return { thresholds, scorePerApproval }
}

/** 승인 건수 → 레벨 (임계값을 만족하는 최고 레벨, 최소 1). */
export function computeReviewLevel(approvedCount: number, thresholds: Record<number, number>): number {
  let level = 1
  for (let lv = 2; lv <= REVIEW_LEVEL_MAX; lv++) {
    const need = thresholds[lv]
    if (need != null && approvedCount >= need) level = lv
  }
  return level
}

/**
 * 승인 1건 점수 적립 + 레벨 재산정. **반드시 승인 CAS 승자 경로에서만 호출** (멱등은 호출측 책임).
 * 레벨업 시 user_notifications 알림까지 처리 (fail-soft — 실패해도 승인 자체는 유효).
 */
export async function creditReviewScoreOnApproval(
  DB: D1Database,
  userId: string,
): Promise<{ level: number; leveledUp: boolean; approvedCount: number }> {
  await ensureReviewScoreTable(DB)
  const { thresholds, scorePerApproval } = await getReviewLevelConfig(DB)
  // 원자 증감 (절대값 write 금지)
  await DB.prepare(`
    INSERT INTO user_review_scores (user_id, score, approved_count, level, updated_at)
    VALUES (?, ?, 1, 1, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      score = score + excluded.score,
      approved_count = approved_count + 1,
      updated_at = datetime('now')
  `).bind(userId, scorePerApproval).run()

  const row = await DB.prepare(
    'SELECT approved_count, level FROM user_review_scores WHERE user_id = ?'
  ).bind(userId).first<{ approved_count: number; level: number }>()
  const approvedCount = Number(row?.approved_count ?? 1)
  const newLevel = computeReviewLevel(approvedCount, thresholds)
  let leveledUp = false
  if (newLevel > Number(row?.level ?? 1)) {
    // CAS — 동시 승인 2건이 같은 레벨업을 이중 알림하지 않게 level < ? 조건
    const up = await DB.prepare(
      'UPDATE user_review_scores SET level = ?, updated_at = datetime(\'now\') WHERE user_id = ? AND level < ?'
    ).bind(newLevel, userId, newLevel).run().catch(() => null)
    leveledUp = Number(up?.meta?.changes ?? 0) > 0
    if (leveledUp) {
      const label = REVIEW_LEVEL_LABELS[newLevel] || `Lv.${newLevel}`
      const { notifyUser } = await import('../../lib/notifications')
      await notifyUser(
        DB, userId, 'review_level_up',
        `🏅 동네 리뷰어 Lv.${newLevel} 달성!`,
        `'${label}' 레벨이 되었어요. 레벨 전용 이용권 구매 자격이 열립니다.`,
        '/my-vouchers',
      ).catch(swallow('review-level:notify'))
    }
  }
  return { level: Math.max(newLevel, Number(row?.level ?? 1)), leveledUp, approvedCount }
}

/** 유저 현재 레벨 1값 조회 (게이트용 — 실패 시 1). */
export async function getUserReviewLevelValue(DB: D1Database, userId: string): Promise<number> {
  try {
    await ensureReviewScoreTable(DB)
    const row = await DB.prepare('SELECT level FROM user_review_scores WHERE user_id = ?')
      .bind(userId).first<{ level: number }>()
    const lv = Number(row?.level ?? 1)
    return Number.isFinite(lv) && lv >= 1 ? lv : 1
  } catch {
    return 1
  }
}

/** 마이 레벨 요약 (프로필/제출 모달 표시용). */
export async function getUserReviewLevelSummary(DB: D1Database, userId: string): Promise<{
  level: number; label: string; score: number; approved_count: number;
  next_level: number | null; next_threshold: number | null; remaining: number | null;
}> {
  await ensureReviewScoreTable(DB)
  const { thresholds } = await getReviewLevelConfig(DB)
  const row = await DB.prepare(
    'SELECT score, approved_count, level FROM user_review_scores WHERE user_id = ?'
  ).bind(userId).first<{ score: number; approved_count: number; level: number }>().catch(() => null)
  const approved = Number(row?.approved_count ?? 0)
  const level = Math.max(Number(row?.level ?? 1), computeReviewLevel(approved, thresholds))
  let nextLevel: number | null = null
  let nextThreshold: number | null = null
  for (let lv = level + 1; lv <= REVIEW_LEVEL_MAX; lv++) {
    if (thresholds[lv] != null) { nextLevel = lv; nextThreshold = thresholds[lv]; break }
  }
  return {
    level,
    label: REVIEW_LEVEL_LABELS[level] || `Lv.${level}`,
    score: Number(row?.score ?? 0),
    approved_count: approved,
    next_level: nextLevel,
    next_threshold: nextThreshold,
    remaining: nextThreshold != null ? Math.max(0, nextThreshold - approved) : null,
  }
}
