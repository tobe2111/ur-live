/**
 * 📮 인플루언서 제안 이메일 파이프라인 — **스팸이 되지 않게 보내는 것**이 이 모듈의 존재 이유.
 *   설계 SSOT: docs/design/seller-dashboard-v2.md §4.2 (2026-08-22 대표 "스팸 걱정 — 코딩으로 해결")
 *
 * ## 스팸 방어 7겹 (전부 코드로 강제)
 *  1. **드립 발송** — 한꺼번에 안 보낸다. cron 이 5분마다 소량(tick당 ≤10)씩만.
 *  2. **일일 캡** — platform_settings.outreach_daily_email_cap (기본 30/일, 워밍업 후 어드민이 상향).
 *     새 도메인이 갑자기 수백 통을 쏘면 그 자체가 스팸 신호다.
 *  3. **서프레션 3중 확인** — 리드 opted_out · ad_email_suppress(유어애즈) · email_suppressions(반송/신고
 *     webhook 이 채움). sendEmail 자체도 마지막에 한 번 더 거른다.
 *  4. **쿨다운** — 같은 주소로 30일 내 재발송 금지 (큐 이력 기준). 반복 수신이 신고를 만든다.
 *  5. **원클릭 수신거부** — List-Unsubscribe + List-Unsubscribe-Post 헤더(RFC 8058) + 본문 링크.
 *     Gmail/야후는 2024년부터 대량 발송자에게 이걸 **요구**한다. 누르면 즉시 3중 서프레션 등록.
 *  6. **법 준수 표기** — 제목 "(광고)" + 본문에 발신자 정보/수신거부 안내 (정보통신망법 §50 —
 *     영리목적 광고성 이메일은 opt-out 방식 허용이되 표기·수신거부 수단이 의무. 위반 과태료).
 *  7. **개인화** — 리드 이름/핸들·매장·이용권을 본문에 치환. 동일 본문 대량 복제가 스팸 필터의 1신호.
 *
 * ⚠️ 코드 밖(대표 확인 필요): Resend 대시보드에서 발신 도메인 SPF/DKIM/DMARC 인증 상태.
 *    인증 안 된 도메인은 위 7겹을 다 해도 스팸함으로 간다.
 */
import { sendEmail } from '../../../services/email'
import { adsLeadsDb } from '../../../shared/ads/leads-db'
import type { Env } from '../../../worker/types/env'

const PER_TICK = 10          // 서브리퀘스트 예산(무료 ~50) + 드립 원칙
const SEND_DELAY_MS = 300
const DEFAULT_DAILY_CAP = 30 // 워밍업 기본 — platform_settings.outreach_daily_email_cap 로 조정
const COOLDOWN_DAYS = 30
// 발신 기본값 — ⚠️ 2026-08-23 DNS 실측: Resend 인증이 완료된 도메인은 ur-team.com 뿐이다
// (send.ur-team.com SPF/MX + resend._domainkey.ur-team.com DKIM 실재 · urdeal.kr 은 레코드 0).
// onboarding@resend.dev(공용) 폴백은 스팸함 직행이라 제안 메일에는 쓰지 않는다.
const DEFAULT_FROM = '유어딜 <noreply@ur-team.com>'

let _ensured = false
export async function ensureOutreachEmailTables(DB: D1Database) {
  if (_ensured) return
  _ensured = true
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS outreach_email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outreach_id INTEGER NOT NULL,
      invite_id INTEGER,
      lead_id INTEGER,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      unsubscribe_token TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')),
      sent_at DATETIME,
      UNIQUE(outreach_id, lead_id)
    )`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_email_status ON outreach_email_queue(status, created_at)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_email_addr ON outreach_email_queue(email, sent_at)`).run()
  } catch { /* fail-soft */ }
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** 제안 이메일 본문 — 개인화 + 법 준수 푸터 + 수신거부 링크. */
function buildOutreachHtml(p: {
  leadName: string; sellerName: string; productName: string | null
  commissionPct: number; support: string; message: string; acceptUrl: string; unsubUrl: string
}): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html lang="ko"><body style="margin:0;background:#f6f6f7;font-family:'Apple SD Gothic Neo',Pretendard,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid #eee">
      <p style="font-size:13px;color:#888;margin:0 0 16px">유어딜(urdeal.kr) 협업 제안</p>
      <h1 style="font-size:20px;color:#111;margin:0 0 8px">${esc(p.leadName)}님, ${esc(p.sellerName)}에서 협업을 제안했어요</h1>
      ${p.productName ? `<p style="font-size:14px;color:#444;margin:0 0 4px">제안 이용권: <strong>${esc(p.productName)}</strong></p>` : ''}
      <p style="font-size:14px;color:#444;margin:0 0 16px">판매 커미션 <strong>${p.commissionPct}%</strong> · 상품 ${p.support === 'free' ? '무상 제공' : '유상'}</p>
      <div style="background:#fafafa;border-radius:10px;padding:16px;font-size:13.5px;color:#333;white-space:pre-wrap;margin:0 0 20px">${esc(p.message)}</div>
      <a href="${p.acceptUrl}" style="display:block;text-align:center;background:#E0526B;color:#fff;text-decoration:none;border-radius:12px;padding:14px;font-weight:700;font-size:15px">제안 확인하고 수락하기</a>
      <p style="font-size:12px;color:#999;margin:16px 0 0">수락하면 카카오 로그인 후 전용 홍보 링크가 바로 발급됩니다. 이용권이 사용될 때마다 커미션이 적립돼요.</p>
    </div>
    <p style="font-size:11px;color:#aaa;margin:20px 4px 0;line-height:1.6">
      본 메일은 공개된 채널 정보를 바탕으로 비즈니스 협업을 제안드리기 위해 발송되었습니다.<br/>
      발신: 유어딜(리스터코퍼레이션) · <a href="https://urdeal.kr/about" style="color:#aaa">urdeal.kr</a><br/>
      더 이상 제안을 받고 싶지 않으시면 <a href="${p.unsubUrl}" style="color:#888;text-decoration:underline">수신거부</a>를 눌러주세요. 즉시 처리되며 다시 보내지 않습니다.
    </p>
  </div></body></html>`
}

/**
 * 제안 1건의 발송 큐 적재 — 서프레션·쿨다운·유효성 필터를 **적재 시점에** 통과한 것만 들어간다.
 * @returns { queued, skipped } — skipped 사유별 카운트(어드민 화면 표시용)
 */
export async function enqueueOutreachEmails(env: Env, outreachId: number): Promise<{ queued: number; skipped: Record<string, number> }> {
  const db = adsLeadsDb(env)
  await ensureOutreachEmailTables(db)
  const skipped: Record<string, number> = { no_email: 0, opted_out: 0, suppressed: 0, cooldown: 0, dup: 0 }

  const req = await db.prepare(
    `SELECT o.id, o.seller_id, o.product_id, o.commission_pct, o.product_support, o.message,
            s.business_name AS seller_name, p.name AS product_name
       FROM influencer_outreach_requests o
       LEFT JOIN sellers s ON s.id = o.seller_id
       LEFT JOIN products p ON p.id = o.product_id
      WHERE o.id = ? LIMIT 1`
  ).bind(outreachId).first<{ id: number; seller_id: number; product_id: number | null; commission_pct: number; product_support: string; message: string; seller_name: string | null; product_name: string | null }>()
  if (!req) return { queued: 0, skipped }

  const invites = await db.prepare(
    `SELECT id, lead_id, token FROM influencer_offer_invites WHERE outreach_id = ? AND status = 'pending'`
  ).bind(outreachId).all<{ id: number; lead_id: number; token: string }>().catch(() => ({ results: [] as never[] }))
  const inviteRows = invites.results || []
  if (!inviteRows.length) return { queued: 0, skipped }

  const leadIds = inviteRows.map((r) => Number(r.lead_id)).filter((n) => n > 0).slice(0, 50)
  if (!leadIds.length) return { queued: 0, skipped }
  const ph = leadIds.map(() => '?').join(',')
  const leadRows = await db.prepare(
    `SELECT id, name, handle, email, COALESCE(opted_out, 0) AS opted_out FROM ad_influencer_leads WHERE id IN (${ph})`
  ).bind(...leadIds).all<{ id: number; name: string | null; handle: string | null; email: string | null; opted_out: number }>().catch(() => ({ results: [] as never[] }))
  const leadById = new Map((leadRows.results || []).map((l) => [Number(l.id), l]))

  let queued = 0
  for (const inv of inviteRows) {
    const lead = leadById.get(Number(inv.lead_id))
    const email = (lead?.email || '').trim().toLowerCase()
    if (!lead || !EMAIL_RX.test(email)) { skipped.no_email++; continue }
    if (Number(lead.opted_out) === 1) { skipped.opted_out++; continue }
    // 서프레션 (유어애즈 + 메인 양쪽)
    const sup1 = await db.prepare('SELECT 1 FROM ad_email_suppress WHERE email = ? LIMIT 1').bind(email).first().catch(() => null)
    const sup2 = await db.prepare('SELECT 1 FROM email_suppressions WHERE email = ? LIMIT 1').bind(email).first().catch(() => null)
    if (sup1 || sup2) { skipped.suppressed++; continue }
    // 쿨다운 — 최근 30일 내 이 주소로 발송한 이력
    const recent = await db.prepare(
      `SELECT 1 FROM outreach_email_queue WHERE email = ? AND sent_at IS NOT NULL AND sent_at > datetime('now', '-${COOLDOWN_DAYS} days') LIMIT 1`
    ).bind(email).first().catch(() => null)
    if (recent) { skipped.cooldown++; continue }

    const acceptUrl = `https://urdeal.kr/i/offer/${inv.token}`
    const unsubUrl = `https://urdeal.kr/api/influencer-offers/unsubscribe/${inv.token}`
    // 정보통신망법 §50: 사전 동의 없는 영리목적 이메일은 "(광고)" 표기 의무
    const subject = `(광고) [유어딜] ${req.seller_name || '매장'} 협업 제안 — 판매 커미션 ${req.commission_pct}%`
    const html = buildOutreachHtml({
      leadName: lead.name || lead.handle || '크리에이터', sellerName: req.seller_name || '유어딜 입점 매장',
      productName: req.product_name, commissionPct: Number(req.commission_pct) || 0,
      support: req.product_support, message: req.message || '', acceptUrl, unsubUrl,
    })
    const ins = await db.prepare(
      `INSERT OR IGNORE INTO outreach_email_queue (outreach_id, invite_id, lead_id, email, subject, html, unsubscribe_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(outreachId, inv.id, inv.lead_id, email, subject, html, inv.token).run().catch(() => null)
    if (ins?.meta?.changes) queued++
    else skipped.dup++
  }
  return { queued, skipped }
}

/**
 * cron drainer — 5분 tick. 일일 캡 안에서 소량씩 발송 (CAS 선점 → 이중발송 구조적 0).
 */
export async function drainOutreachEmails(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return
  const db = adsLeadsDb(env)
  await ensureOutreachEmailTables(db)

  // 일일 캡 (워밍업) — 오늘 이미 보낸 수
  let cap = DEFAULT_DAILY_CAP
  try {
    const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'outreach_daily_email_cap'").first<{ value: string }>()
    const v = Number(row?.value)
    if (Number.isFinite(v) && v >= 0) cap = v
  } catch { /* default */ }
  const today = await db.prepare(
    "SELECT COUNT(*) AS n FROM outreach_email_queue WHERE sent_at > datetime('now', 'start of day')"
  ).first<{ n: number }>().catch(() => null)
  const remaining = Math.max(0, cap - Number(today?.n || 0))
  if (remaining <= 0) return

  const batch = await db.prepare(
    `SELECT id, email, subject, html, unsubscribe_token FROM outreach_email_queue
      WHERE status = 'pending' ORDER BY created_at LIMIT ?`
  ).bind(Math.min(PER_TICK, remaining)).all<{ id: number; email: string; subject: string; html: string; unsubscribe_token: string | null }>().catch(() => ({ results: [] as never[] }))

  for (const row of batch.results || []) {
    // 💸 머니 룰 #1 스타일 CAS 선점 — cron 중복 tick 이 같은 메일을 두 번 못 보낸다
    const claim = await db.prepare(
      `UPDATE outreach_email_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'pending'`
    ).bind(row.id).run().catch(() => null)
    if (!claim?.meta?.changes) continue

    const unsubUrl = `https://urdeal.kr/api/influencer-offers/unsubscribe/${row.unsubscribe_token || ''}`
    const r = await sendEmail(
      {
        to: row.email, subject: row.subject, html: row.html,
        headers: {
          // RFC 8058 원클릭 수신거부 — Gmail/야후 대량발송 요건
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
      env.RESEND_API_KEY, env.RESEND_FROM || DEFAULT_FROM, db,
    ).catch(() => ({ success: false as const, error: 'exception' }))
    if (!r.success) {
      // 실패 표시 (재시도 안 함 — 중복 방지 우선, bulk-email-drain 과 동일 원칙)
      await db.prepare("UPDATE outreach_email_queue SET status = 'failed' WHERE id = ?").bind(row.id).run().catch(() => null)
    }
    await new Promise((res) => setTimeout(res, SEND_DELAY_MS))
  }
}
