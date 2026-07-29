/**
 * 🔁 동의 리드 리마인드 시퀀스 (2026-07-27 대표 승인 백로그 ⑮).
 *
 *   1차 발송(send-consented) 후 N일간 회신이 없는 **사전동의 리드**에게 짧은 리마인드를 1회만 발송.
 *   회신율을 가장 싸게 올리는 레버 — 시퀀스는 딱 1단(스팸화 방지, reminded_at 멱등).
 *
 *   ⚖️ [LEGAL] 완전 합법 범위만:
 *     · 대상 = consented_at 보유(사전 수신동의) + 이메일 발송 이력(contacted_at) — SQL 강제
 *     · 반송/스팸신고/수신거부(email_status)·회신(replied_at) 리드 제외 · 야간(KST 21~08) 발송 금지
 *     · "(광고)" 라벨 + 수신거부·전송자 정보 강제(outreach-send SSOT 헬퍼)
 *   🔌 게이트: ADS_REMINDER_ENABLED === 'true' (기본 OFF — 대표가 켜기 전 발송 0)
 */
import type { Env } from '@/worker/types/env'
import { sendEmail } from '@/services/email'
import { withAdLabel, buildCampaignBody, textToHtml, isNightKST } from './outreach-send'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureOutreachColumns } from './outreach-webhook'

const POOL = 0                 // 공용 풀(account_id=0) — 어드민 발송과 동일 스코프
const REMIND_AFTER_DAYS = 4    // 1차 발송 후 대기일
const BATCH = 30               // 회당 발송 상한(쿼터·평판 보호)

const _colDone = new WeakSet<object>()
async function ensureRemindColumn(DB: D1Database): Promise<void> {
  if (_colDone.has(DB)) return
  _colDone.add(DB)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN reminded_at TEXT').run().catch(() => null)
}

const REMIND_TEMPLATE = `{name}님, 안녕하세요. 유어애즈(UR Team)입니다.

며칠 전 보내드린 협찬 제안을 다시 한번 안내드립니다. 일정이 바쁘셔서 놓치셨을 수 있어
짧게 리마인드만 드려요 — 관심 있으시면 이 메일에 회신 주시면 바로 연결해 드립니다.

(이 리마인드는 1회만 발송되며, 회신이 없으면 더 연락드리지 않습니다.)`

export interface ReminderResult { scanned: number; sent: number; suppressed: number; failed: number; skipped_night?: boolean; disabled?: boolean }

/** 시간별 cron 진입점 — 게이트 OFF/야간/키 미설정이면 no-op. */
export async function runConsentedReminder(env: Env): Promise<ReminderResult> {
  if (env.ADS_REMINDER_ENABLED !== 'true') return { scanned: 0, sent: 0, suppressed: 0, failed: 0, disabled: true }
  if (!env.RESEND_API_KEY) return { scanned: 0, sent: 0, suppressed: 0, failed: 0, disabled: true }
  if (isNightKST(Date.now())) return { scanned: 0, sent: 0, suppressed: 0, failed: 0, skipped_night: true }
  await ensureInfluencerSchema(env.DB)
  await ensureOutreachColumns(env.DB)
  await ensureRemindColumn(env.DB)
  // ⚖️ 대상 강제: 동의 + 이메일 1차 발송(contacted, N일 경과) + 무회신 + 무리마인드 + 억제상태 아님.
  const rows = (await env.DB.prepare(`SELECT id, name, email FROM ad_influencer_leads
    WHERE account_id = ? AND consented_at IS NOT NULL AND email IS NOT NULL
      AND contact_channel = 'email' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now', ?)
      AND reminded_at IS NULL AND replied_at IS NULL
      AND (email_status IS NULL OR email_status NOT IN ('bounced','complained','opt_out'))
      AND status IN ('contacted')
    ORDER BY contacted_at ASC LIMIT ?`)
    .bind(POOL, `-${REMIND_AFTER_DAYS} days`, BATCH)
    .all<{ id: number; name: string; email: string }>().catch(() => null))?.results || []
  let sent = 0, suppressed = 0, failed = 0
  const subject = withAdLabel('협찬 제안 리마인드 — 유어애즈')
  for (const r of rows) {
    // 멱등 선점(CAS) — 동시 cron/재시도가 같은 리드에 이중 발송 못 하게 발송 전 마킹.
    const claim = await env.DB.prepare("UPDATE ad_influencer_leads SET reminded_at = datetime('now') WHERE id = ? AND account_id = ? AND reminded_at IS NULL")
      .bind(r.id, POOL).run().catch(() => null)
    if (claim?.meta?.changes !== 1) continue
    const body = buildCampaignBody(REMIND_TEMPLATE, r.name) // {name} 치환 + 수신거부·전송자정보 강제
    const res = await sendEmail({ to: r.email, subject, html: textToHtml(body) }, env.RESEND_API_KEY, env.RESEND_FROM, env.DB)
      .catch(() => ({ success: false as const, error: 'throw' }))
    if (res.success) sent++
    else if ((res as { error?: string }).error === 'suppressed') suppressed++
    else failed++ // 실패해도 reminded_at 유지 — 시퀀스는 1회 시도가 원칙(재시도 폭주 방지)
  }
  return { scanned: rows.length, sent, suppressed, failed }
}
