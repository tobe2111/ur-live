/**
 * 🚫 2026-11-25 리드 병합 때 **보내지 말아야 할 이유**를 그룹 전체에서 모은다 (유어애즈 · 인플루언서 DB).
 *
 * 야간 병합(`mergeDuplicatePool`)은 같은 사람의 행들을 대표 1건으로 합치고 나머지를 지운다. 종전엔 이메일·핸들·동의 같은
 * 정보는 대표로 옮겼지만 **수신거부(`opted_out`) · 반송/신고(`email_status`) · 발송 이력(`campaign_sent_at`) ·
 * 내보낸 이력(`exported_at`) · 브랜드 표시(`is_brand`)** 는 옮기지 않았다. 지워지는 행에만 있던 표시는 사라졌고,
 * 그 주소는 다시 "보낼 수 있는 리드" 가 됐다(정보통신망법 수신거부 의무).
 *
 * 규칙: 하나라도 거부면 거부 · 가장 나쁜 메일 상태를 남긴다 · 발송은 가장 최근(쿨다운이 그 날짜를 본다) ·
 * 내보내기는 가장 이른 것(한 번 내보낸 주소는 "새 리드" 가 아니다) · 하나라도 브랜드면 브랜드.
 * 순수 함수 — 시험이 직접 잰다(`ads-suppression-2026-11-25.test.ts`).
 */
export interface SuppressionRow {
  opted_out?: number | null
  email_status?: string | null
  campaign_sent_at?: string | null
  exported_at?: string | null
  is_brand?: number | null
}

/** 덮이면 안 되는 메일 상태 — 앞의 것일수록 강하다. */
export const STICKY_EMAIL_STATUSES = ['opt_out', 'complained', 'bounced'] as const

export function mergedSuppression(rows: SuppressionRow[]): {
  optedOut: number; emailStatus: string | null; campaignSentAt: string | null; exportedAt: string | null; isBrand: number
} {
  const sticky = STICKY_EMAIL_STATUSES.find((s) => rows.some((r) => r.email_status === s))
  const dates = (k: 'campaign_sent_at' | 'exported_at') => rows.map((r) => r[k]).filter((v): v is string => !!v).sort()
  const sent = dates('campaign_sent_at')
  return {
    optedOut: rows.some((r) => Number(r.opted_out) === 1) || sticky === 'opt_out' ? 1 : 0,
    emailStatus: sticky ?? rows[0]?.email_status ?? rows.find((r) => r.email_status)?.email_status ?? null,
    campaignSentAt: sent.length ? sent[sent.length - 1] : null,
    exportedAt: dates('exported_at')[0] ?? null,
    isBrand: rows.some((r) => Number(r.is_brand) === 1) ? 1 : 0,
  }
}

const _ensured = new WeakSet<object>()
/**
 * 병합이 읽는 다섯 칸을 보장한다(인스턴스당 한 번). 라이브 표에는 이미 있다 — 칸이 없는 환경에서 병합의 SELECT 가
 * 실패해 `.catch(() => null)` 로 **조용히 아무것도 안 합치는** 상태가 되지 않게 하려는 것이다.
 */
export async function ensureSuppressionColumns(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  for (const col of ['opted_out INTEGER NOT NULL DEFAULT 0', 'email_status TEXT', 'campaign_sent_at TEXT', 'exported_at TEXT', 'is_brand INTEGER NOT NULL DEFAULT 0']) {
    await DB.prepare(`ALTER TABLE ad_influencer_leads ADD COLUMN ${col}`).run().catch(() => null) // 이미 있으면 실패 — 정상
  }
}
