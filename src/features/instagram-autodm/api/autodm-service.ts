/**
 * 💬 인스타 자동 DM — 웹훅 한 건을 처리하는 흐름.
 *
 *   댓글 이벤트 → (우리 계정인가 · 내가 단 댓글은 아닌가) → 규칙 매칭
 *     → 일일 상한 → 댓글 선점(UNIQUE) → DM 발송 → (선택) 공개 답글 → 기록
 *
 * 🔒 게이트: 어드민의 '자동 DM 켜기'(ig_autodm_account.enabled) — 기본 OFF.
 *    꺼져 있으면 웹훅은 받되 아무것도 보내지 않는다.
 */
import { parseCommentEvents, pickRule, renderDm, pickPublicReply } from './autodm-core'
import { getAccount, listRules, claimComment, markSend, sentLast24h, updateToken, type AutoDmAccount } from './autodm-store'
import { sendPrivateReply, replyToComment, refreshLongLivedToken } from './autodm-graph'

export interface ProcessSummary {
  events: number
  sent: number
  failed: number
  skipped: number
  reason?: string
}

/** 토큰이 7일 넘게 안 갱신됐으면 연장한다(장기 토큰 60일 — 그냥 두면 조용히 만료돼 DM 이 멈춘다). */
export async function maybeRefreshToken(DB: D1Database, kek: string | undefined, account: AutoDmAccount, force = false): Promise<{ refreshed: boolean; error?: string }> {
  if (!account.access_token) return { refreshed: false, error: '토큰 없음' }
  const last = account.token_refreshed_at ? Date.parse(account.token_refreshed_at.replace(' ', 'T') + 'Z') : 0
  if (!force && last && Date.now() - last < 7 * 86_400_000) return { refreshed: false }
  const r = await refreshLongLivedToken(account.access_token)
  if (!r.ok || !r.data?.access_token) return { refreshed: false, error: r.error || '갱신 응답에 토큰이 없습니다' }
  const expiresAt = r.data.expires_in
    ? new Date(Date.now() + r.data.expires_in * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null
  await updateToken(DB, kek, r.data.access_token, expiresAt)
  return { refreshed: true }
}

export async function processWebhookPayload(DB: D1Database, kek: string | undefined, payload: unknown): Promise<ProcessSummary> {
  const events = parseCommentEvents(payload)
  const summary: ProcessSummary = { events: events.length, sent: 0, failed: 0, skipped: 0 }
  if (!events.length) return summary

  const account = await getAccount(DB, kek)
  if (!account?.enabled) return { ...summary, reason: 'disabled' }
  if (!account.access_token || !account.ig_user_id) return { ...summary, reason: 'not_connected' }

  const rules = await listRules(DB, true)
  if (!rules.length) return { ...summary, reason: 'no_rules' }

  let sentSoFar: number | null = null

  for (const ev of events) {
    // 다른 계정의 이벤트(앱에 여러 계정이 붙은 경우) · 우리 계정이 단 댓글(공개 답글이 다시 웹훅으로 돌아온다 — 무한 루프 방지)
    if (ev.accountId !== account.ig_user_id || ev.fromId === account.ig_user_id) { summary.skipped++; continue }

    const rule = pickRule(rules, ev)
    if (!rule) { summary.skipped++; continue } // 키워드 안 맞는 댓글은 기록하지 않는다(일반 댓글까지 쌓을 이유 없음)

    sentSoFar ??= await sentLast24h(DB)
    if (sentSoFar >= account.daily_cap) {
      await claimComment(DB, {
        comment_id: ev.commentId, rule_id: rule.id, media_id: ev.mediaId, from_id: ev.fromId,
        from_username: ev.fromUsername, comment_text: ev.text, status: 'skipped', error: `일일 상한(${account.daily_cap}) 도달`,
      }).catch(() => false)
      summary.skipped++
      continue
    }

    const claimed = await claimComment(DB, {
      comment_id: ev.commentId, rule_id: rule.id, media_id: ev.mediaId, from_id: ev.fromId,
      from_username: ev.fromUsername, comment_text: ev.text,
    }).catch(() => false)
    if (!claimed) { summary.skipped++; continue } // 이미 처리한 댓글(웹훅 재전송)

    const dm = await sendPrivateReply(account.access_token, account.ig_user_id, ev.commentId, renderDm(rule, ev.fromUsername))
    let publicStatus: string | null = null
    if (dm.ok) {
      const reply = pickPublicReply(rule.public_reply, ev.fromUsername)
      if (reply) {
        const pr = await replyToComment(account.access_token, ev.commentId, reply)
        publicStatus = pr.ok ? 'sent' : `failed: ${pr.error}`.slice(0, 200)
      }
      summary.sent++
      sentSoFar++
    } else {
      summary.failed++
    }
    await markSend(DB, ev.commentId, dm.ok ? 'sent' : 'failed', dm.ok ? null : (dm.error || null), publicStatus).catch(() => null)
  }

  return summary
}
