/**
 * 🎓 신청자 온보딩 자동화 (2026-07-27 — 지키지 못하던 약속 해소).
 *
 *   접수 확인 메일(outreach-send welcomeEmail)이 **"검토 후 2~3일 내 온보딩 안내를 드리겠습니다"** 라고
 *   약속하는데 그 안내를 보내는 코드가 없었다 → 사람이 수동으로 안 하면 신청자는 영영 연락을 못 받고
 *   첫인상이 "답 없는 곳"이 된다. 신청 다음날 자동으로 실제 시작 안내를 보낸다.
 *
 *   ⚖️ 대상 = **본인이 신청한 사람**(source='inbound' + consented_at) — 신청 행위에 대한 후속 안내라 적법.
 *      야간(KST 21~08) 미발송 · 반송/스팸신고/수신거부 제외 · onboarded_at CAS 로 1인 1회 보장.
 *   🔌 기본 ON(약속 이행이 목적). 끄려면 ADS_ONBOARDING_DISABLED='true'.
 *
 *   본문은 /creators 의 실제 3단계(가입 → 딜 선택 → 링크 공유)와 수익 구조를 그대로 반영 —
 *   페이지가 바뀌면 이 문구도 같이 고칠 것(허위 안내 방지).
 */
import type { Env } from '@/worker/types/env'
import { sendEmail } from '@/services/email'
import { textToHtml, isNightKST, withOptOut, withSenderInfo } from './outreach-send'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureOutreachColumns } from './outreach-webhook'

const POOL = 0
const DELAY_HOURS = 20 // 신청 후 대기(익일 도착 — 약속한 '2~3일 내'보다 빠르게)
const BATCH = 40

const _colDone = new WeakSet<object>()
async function ensureOnboardColumn(DB: D1Database): Promise<void> {
  if (_colDone.has(DB)) return
  _colDone.add(DB)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN onboarded_at TEXT').run().catch(() => null)
}

/** 온보딩 안내 본문 — /creators 의 실제 절차와 1:1(수익률 등 변동 수치는 페이지 링크로 위임). */
export function onboardingEmail(name: string): { subject: string; body: string } {
  const body = withSenderInfo(withOptOut(
`안녕하세요, ${name}님. 유어딜 제휴 담당자입니다.

신청해주신 제휴 크리에이터, 바로 시작하실 수 있게 안내드립니다.

■ 시작은 3단계
1) 가입 — 카카오 로그인 1분이면 내 링크샵이 자동으로 생깁니다.
   https://urdeal.kr/login
2) 딜 선택 — 동네 맛집·뷰티·숙소 딜 중 소개하고 싶은 것을 내 링크샵에 담습니다.
   https://urdeal.kr/group-buy
3) 링크 공유 — 인스타·블로그·카톡에 내 링크샵 주소 하나만 올리면 끝입니다.

■ 수익 구조
· 내 링크로 판매될 때마다 판매액의 소개비가 적립됩니다(소개비율은 딜마다 표시 — 고르기 전에 확인 가능).
· 손님이 환불하면 적립도 자동 회수됩니다(원장 기준, 투명).
· 적립금은 정산 계좌로 출금하실 수 있습니다(사업소득 원천징수 후 지급).

자세한 내용은 https://urdeal.kr/creators 에서 확인하실 수 있습니다.
매장 협찬 매칭 제안도 조건이 맞을 때 따로 보내드리겠습니다.

궁금한 점은 이 메일에 그대로 회신 주세요.`))
  return { subject: `[유어딜] ${name}님, 크리에이터 시작 안내드립니다`, body }
}

export interface OnboardingResult { scanned: number; sent: number; failed: number; skipped_night?: boolean; disabled?: boolean }

/** 시간별 cron 진입점 — 킬스위치/야간/미설정이면 no-op. */
export async function runInboundOnboarding(env: Env): Promise<OnboardingResult> {
  if ((env as unknown as { ADS_ONBOARDING_DISABLED?: string }).ADS_ONBOARDING_DISABLED === 'true') return { scanned: 0, sent: 0, failed: 0, disabled: true }
  if (!env.RESEND_API_KEY) return { scanned: 0, sent: 0, failed: 0, disabled: true }
  if (isNightKST(Date.now())) return { scanned: 0, sent: 0, failed: 0, skipped_night: true }
  await ensureInfluencerSchema(env.DB)
  await ensureOutreachColumns(env.DB)
  await ensureOnboardColumn(env.DB)
  const rows = (await env.DB.prepare(`SELECT id, name, email FROM ad_influencer_leads
    WHERE account_id = ? AND source = 'inbound' AND consented_at IS NOT NULL AND email IS NOT NULL
      AND onboarded_at IS NULL AND consented_at <= datetime('now', ?)
      AND (email_status IS NULL OR email_status NOT IN ('bounced','complained','opt_out'))
    ORDER BY consented_at ASC LIMIT ?`)
    .bind(POOL, `-${DELAY_HOURS} hours`, BATCH)
    .all<{ id: number; name: string; email: string }>().catch(() => null))?.results || []
  let sent = 0, failed = 0
  for (const r of rows) {
    // 발송 전 선점(CAS) — 동시 cron/재시도에도 1인 1회.
    const claim = await env.DB.prepare("UPDATE ad_influencer_leads SET onboarded_at = datetime('now') WHERE id = ? AND account_id = ? AND onboarded_at IS NULL")
      .bind(r.id, POOL).run().catch(() => null)
    if (claim?.meta?.changes !== 1) continue
    const m = onboardingEmail(r.name)
    const res = await sendEmail({ to: r.email, subject: m.subject, html: textToHtml(m.body) }, env.RESEND_API_KEY, env.RESEND_FROM, env.DB)
      .catch(() => ({ success: false as const }))
    if (res.success) sent++; else failed++ // 실패해도 재시도 안 함(중복 안내 방지 — 수동 팔로업이 안전)
  }
  return { scanned: rows.length, sent, failed }
}
