/**
 * 📎 2026-10-18 — 서류가 빠진 사장님에게 보완 안내 (대표 "6번 하자").
 *
 * 왜: 심사 대기 매장 넷(15·18·19·20)이 전부 **대표자 이름·개업일이 비어** 국세청 진위 확인이
 * 돌지 못한 채 멈춰 있었다. 사장님은 무엇이 빠졌는지 모르고, 대표가 하나하나 연락해야 했다.
 *
 * 무엇을: 하루 1회(growth 배치) — 사업자 심사 `pending` 인 매장 중 빠진 서류가 있는 곳에
 *   · 가입 3일째 1회, 7일째(1회차에서 4일 뒤) 1회 — 그 뒤로는 안 보낸다(`docsNudgeDue`)
 *   · 셀러 대시보드 알림 1건 + 이메일(주소가 있고 메일이 설정돼 있으면) 1통
 *   · 무엇이 빠졌는지 항목으로 적고 `/seller/business-info` 로 보낸다
 * 보낸 횟수·시각은 `seller_meta`(docs_nudge_count / docs_nudge_at)에 남겨 두 번 안 간다.
 *
 * 🔒 게이트 `seller_docs_nudge_enabled` — 기본 OFF(사장님에게 나가는 메시지라 대표가 켠다).
 * 머니 경로 무접촉. 한 번에 최대 200곳.
 */
import type { Env } from '../types/env'
import { notifySeller } from '../../lib/notifications'
import { sendEmail } from '../../services/email'
import { transactionalMailReady } from '../../lib/ncp-sens-mail'
import { getSellerMeta, setSellerMeta } from '../utils/seller-meta'
import { patchBusinessNumbers } from '../utils/seller-business-number'
import {
  settingOn, missingDocs, docsNudgeDue, escHtml, DOCS_LABEL, SELLER_DOCS_NUDGE_GATE, type DocsMissing,
} from '../utils/owner-nudges'

type Row = {
  id: number; business_name: string | null; email: string | null; created_at: string | null
  business_number: string | null; representative_name: string | null
  business_start_date: string | null; business_registration_image_url: string | null
}

export const DOCS_NUDGE_LIMIT = 200
export const DOCS_LINK = 'https://urdeal.kr/seller/business-info'

/** D1 시각(`YYYY-MM-DD HH:MM:SS`, UTC) → ms. 형식이 틀리면 null. */
export function d1Ms(v: string | null | undefined): number | null {
  if (!v) return null
  const ms = Date.parse(String(v).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? '' : 'Z'))
  return Number.isFinite(ms) ? ms : null
}

export function missingLabels(m: DocsMissing): string[] {
  return (Object.keys(DOCS_LABEL) as Array<keyof DocsMissing>).filter(k => m[k]).map(k => DOCS_LABEL[k])
}

export function buildDocsNudgeHTML(storeName: string, labels: string[]): string {
  const items = labels.map(l => `<li style="padding:6px 0;font-size:15px;color:#16181c">${escHtml(l)}</li>`).join('')
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>서류 보완 안내</title></head>
<body style="margin:0;padding:24px;background:#f8f7fc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#16181c">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
<div style="font-size:20px;font-weight:700">${escHtml(storeName)} 사장님, 서류 몇 가지만 더 필요해요</div>
<p style="font-size:14px;color:#4f545a;line-height:1.6">아래 항목을 채워 주시면 사업자 확인이 끝나고 매장이 바로 열립니다.</p>
<ul style="margin:12px 0;padding-left:20px">${items}</ul>
<div style="text-align:center;margin-top:20px"><a href="${DOCS_LINK}" style="display:inline-block;padding:12px 22px;background:#1c69ef;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">서류 채우기</a></div>
<p style="font-size:12px;color:#81868c;margin-top:20px">유어딜 · 문의 urteam.corp@gmail.com</p>
</div></body></html>`
}

export async function handleSellerDocsNudge(env: Env, now: Date = new Date()): Promise<{ sent: number; emailed: number; skipped?: string }> {
  const DB = env.DB
  if (!DB) return { sent: 0, emailed: 0, skipped: 'no_db' }
  if (!(await settingOn(DB, SELLER_DOCS_NUDGE_GATE))) return { sent: 0, emailed: 0, skipped: 'gate_off' }

  const rows = (await DB.prepare(
    `SELECT id, business_name, email, created_at, business_number, representative_name,
            business_start_date, business_registration_image_url
     FROM sellers
     WHERE business_registration_status = 'pending' AND COALESCE(status, '') NOT IN ('approved','active','suspended','rejected')
     ORDER BY id ASC LIMIT ?`,
  ).bind(DOCS_NUDGE_LIMIT).all<Row>().catch(() => ({ results: [] as Row[] }))).results || []
  if (!rows.length) return { sent: 0, emailed: 0 }

  await patchBusinessNumbers(DB, rows).catch(() => rows)
  const meta = await getSellerMeta(DB, rows.map(r => r.id)).catch(() => new Map<number, Record<string, string>>())
  const mailOk = transactionalMailReady(env)
  const resendKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY || ''
  const nowMs = now.getTime()
  const DAY = 86400_000
  let sent = 0, emailed = 0

  for (const r of rows) {
    const labels = missingLabels(missingDocs(r))
    if (!labels.length) continue
    const created = d1Ms(r.created_at)
    if (created == null) continue
    const m = meta.get(r.id) || {}
    const count = Number(m.docs_nudge_count || 0) || 0
    const last = d1Ms(m.docs_nudge_at)
    const sinceLast = last == null ? null : Math.floor((nowMs - last) / DAY)
    if (!docsNudgeDue(Math.floor((nowMs - created) / DAY), count, sinceLast)) continue

    // 먼저 기록한다 — 알림·메일이 실패해도 같은 날 두 번 보내지 않는다(다음 회차 판정은 시각 기준).
    await setSellerMeta(DB, r.id, {
      docs_nudge_count: count + 1,
      docs_nudge_at: now.toISOString().slice(0, 19).replace('T', ' '),
    }).catch(() => null)

    const name = r.business_name || '사장님'
    await notifySeller(DB, r.id, 'docs_nudge', '서류 몇 가지만 더 필요해요',
      `${labels.join(' · ')} 을(를) 채우면 사업자 확인이 끝나고 매장이 열립니다.`, '/seller/business-info')
    sent++

    if (mailOk && r.email) {
      const res = await sendEmail(
        { to: String(r.email), subject: `[유어딜] ${name} 서류 보완 안내`, html: buildDocsNudgeHTML(name, labels) },
        resendKey,
        (env as Env & { RESEND_FROM?: string }).RESEND_FROM,
      ).catch(() => ({ success: false }))
      if (res && (res as { success?: boolean }).success) emailed++
    }
  }
  return { sent, emailed }
}
