/**
 * 📈 2026-07-07 (대표 "지금처럼 생성하면서 머신러닝으로 학습하면 안돼?"): 데모 리뷰 생성 파라미터
 *   **자동 튜닝 루프(골격)**. 신경망 훈련이 아니라 — 실제 유저 리뷰(is_generated=0)의 통계(길이/이모지
 *   분포)를 매시간 집계해 데모 생성 비중을 **그 분포로 자동 수렴**시키는 통계 피드백 루프.
 *   비용 0·API 0·GPU 0. 실제 리뷰가 쌓일수록 데모가 "우리 플랫폼 실제 리뷰"를 닮아감.
 *   (블로그 태그-조회수 닫힌 루프와 동일 철학. 표본 부족(초기)엔 손튜닝 기본값 유지 = 무해.)
 *
 * TODO(확장): 실제 리뷰에서 자주 쓰는 **표현/어휘 추출** → 문장 풀 편입(개인정보·욕설·중복 필터 후).
 *   현재 골격은 안전한 집계 신호(길이·이모지 비중)만 학습 — 개인 리뷰 원문 복사 없음.
 */
import type { Env } from '../types/env'

export interface ReviewTuning {
  /** 짧은 한마디 비중(0..1) */
  shortPct: number
  /** 긴 정성후기 비중(0..1) — 나머지는 중간 */
  longPct: number
  /** 이모지 포함 비중(0..1) */
  emojiPct: number
  source: 'default' | 'learned'
  sampleSize: number
}

// 손튜닝 기본값(현행) — 실제 리뷰 표본이 충분해지기 전까지 사용.
export const DEFAULT_TUNING: ReviewTuning = { shortPct: 0.25, longPct: 0.22, emojiPct: 0.23, source: 'default', sampleSize: 0 }

const MIN_SAMPLE = 30            // 이보다 적으면 통계 신뢰 불가 → 기본값 유지
const SETTINGS_KEY = 'review_gen_stats'
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const EMOJI_RE = /\p{Extended_Pictographic}/u

// isolate 수명 동안 1회만 로드(cron/요청 isolate 는 짧아 stale 무해 — 통계는 천천히 변함).
const _cache = new WeakMap<object, ReviewTuning>()

/** 학습된 튜닝 로드(캐시). 표본 부족/미설정/에러 시 DEFAULT. 순수 읽기(부작용 X). */
export async function getReviewGenTuning(env: Env): Promise<ReviewTuning> {
  const k = env as unknown as object
  const cached = _cache.get(k)
  if (cached) return cached
  let out = DEFAULT_TUNING
  try {
    const row = await env.DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
      .bind(SETTINGS_KEY).first<{ value: string }>()
    if (row?.value) {
      const s = JSON.parse(row.value) as Partial<ReviewTuning>
      if (typeof s.sampleSize === 'number' && s.sampleSize >= MIN_SAMPLE) {
        out = {
          shortPct: clamp(Number(s.shortPct) || DEFAULT_TUNING.shortPct, 0.1, 0.5),
          longPct: clamp(Number(s.longPct) || DEFAULT_TUNING.longPct, 0.1, 0.45),
          emojiPct: clamp(Number(s.emojiPct) || DEFAULT_TUNING.emojiPct, 0.03, 0.5),
          source: 'learned',
          sampleSize: s.sampleSize,
        }
      }
    }
  } catch { /* 미설정/파싱 실패 → 기본값 */ }
  _cache.set(k, out)
  return out
}

/**
 * 실제 유저 리뷰(is_generated=0) 통계 → platform_settings('review_gen_stats') 갱신.
 * cron 이 주기 호출. 표본<MIN 이면 source='default' 로 기록(적용 안 됨) — 데이터 쌓이는 상황만 관측.
 */
export async function updateReviewGenStats(env: Env): Promise<ReviewTuning> {
  const DB = env.DB
  const rows = await DB.prepare(
    `SELECT content FROM product_reviews
      WHERE COALESCE(is_generated,0) = 0 AND content IS NOT NULL AND LENGTH(TRIM(content)) > 0
      ORDER BY created_at DESC LIMIT 2000`,
  ).all<{ content: string }>().catch(() => ({ results: [] as { content: string }[] }))
  const list = rows.results || []
  const n = list.length
  if (n === 0) return DEFAULT_TUNING

  let shortC = 0, longC = 0, emojiC = 0
  for (const r of list) {
    const c = (r.content || '').trim()
    const len = [...c].length  // code-point 길이(한글/이모지 안전)
    if (len > 0 && len < 15) shortC++
    else if (len > 45) longC++
    if (EMOJI_RE.test(c)) emojiC++
  }
  const learned = n >= MIN_SAMPLE
  const tuning: ReviewTuning = {
    shortPct: clamp(shortC / n, 0.1, 0.5),
    longPct: clamp(longC / n, 0.1, 0.45),
    emojiPct: clamp(emojiC / n, 0.03, 0.5),
    source: learned ? 'learned' : 'default',
    sampleSize: n,
  }
  try {
    const val = JSON.stringify(tuning)
    const upd = await DB.prepare("UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = ?")
      .bind(val, SETTINGS_KEY).run()
    if (!upd.meta.changes) {
      await DB.prepare("INSERT INTO platform_settings (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))")
        .bind(SETTINGS_KEY, val, '데모 리뷰 생성 자동튜닝(실제 리뷰 통계)').run().catch(() => { /* 경쟁 삽입 무해 */ })
    }
    _cache.delete(env as unknown as object)  // 다음 로드 시 새 값 반영
  } catch { /* best-effort — 실패해도 생성은 기본값으로 정상 동작 */ }
  return tuning
}
