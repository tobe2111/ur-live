/**
 * 💬 인스타 자동 DM — 웹훅 한 건을 처리하는 흐름(다중 계정).
 *
 *   댓글 이벤트 → 어느 계정 것인가(entry.id = 인스타 계정 ID) → 그 계정이 켜져 있나
 *     → 그 계정이 단 댓글은 아닌가 → 규칙 매칭 → 계정별 일일 상한 → 댓글 선점(UNIQUE)
 *     → DM 발송 → (선택) 공개 답글 → 기록
 *
 * 🔒 게이트 두 겹:
 *   ① 계정마다 '켜기'(enabled) — 기본 OFF
 *   ② 매장 계정은 추가로 앱 설정의 sellers_enabled — 기본 OFF(메타 앱 심사 통과 뒤 대표가 켠다).
 *      공식 계정(platform)은 ② 와 무관.
 */
import { parseCommentEvents, pickRule, renderDm, pickPublicReply, type CommentEvent } from './autodm-core'
import {
  getAppConfig, getAccountByIgUserId, listRules, claimComment, markSend, sentLast24h, updateToken, pruneOldSends,
  PLATFORM_OWNER, type AutoDmAccount,
} from './autodm-store'
import { sendPrivateReply, replyToComment, refreshLongLivedToken } from './autodm-graph'
import { expiresAtFrom } from './autodm-oauth'

export interface ProcessSummary {
  events: number
  sent: number
  failed: number
  skipped: number
}

/** 토큰이 7일 넘게 안 갱신됐으면 연장한다(장기 토큰 60일 — 그냥 두면 조용히 만료돼 DM 이 멈춘다). */
export async function maybeRefreshToken(DB: D1Database, kek: string | undefined, account: AutoDmAccount, force = false): Promise<{ refreshed: boolean; error?: string }> {
  if (!account.access_token) return { refreshed: false, error: '토큰 없음' }
  const last = account.token_refreshed_at ? Date.parse(account.token_refreshed_at.replace(' ', 'T') + 'Z') : 0
  if (!force && last && Date.now() - last < 7 * 86_400_000) return { refreshed: false }
  const r = await refreshLongLivedToken(account.access_token)
  if (!r.ok || !r.data?.access_token) return { refreshed: false, error: r.error || '갱신 응답에 토큰이 없습니다' }
  await updateToken(DB, kek, account.id, r.data.access_token, expiresAtFrom(r.data.expires_in))
  return { refreshed: true }
}

async function processForAccount(DB: D1Database, account: AutoDmAccount, events: CommentEvent[], summary: ProcessSummary): Promise<void> {
  const rules = await listRules(DB, account.id, true)
  if (!rules.length) { summary.skipped += events.length; return }
  let sentSoFar: number | null = null

  for (const ev of events) {
    // 이 계정이 단 댓글(공개 답글이 다시 웹훅으로 돌아온다 — 무한 루프 방지)
    if (ev.fromId === account.ig_user_id) { summary.skipped++; continue }

    const rule = pickRule(rules, ev)
    if (!rule) { summary.skipped++; continue } // 키워드 안 맞는 댓글은 기록하지 않는다

    const base = {
      account_id: account.id, comment_id: ev.commentId, rule_id: rule.id, media_id: ev.mediaId,
      from_id: ev.fromId, from_username: ev.fromUsername, comment_text: ev.text,
    }
    sentSoFar ??= await sentLast24h(DB, account.id)
    if (sentSoFar >= account.daily_cap) {
      await claimComment(DB, { ...base, status: 'skipped', error: `일일 상한(${account.daily_cap}) 도달` }).catch(() => false)
      summary.skipped++
      continue
    }

    const claimed = await claimComment(DB, base).catch(() => false)
    if (!claimed) { summary.skipped++; continue } // 이미 처리한 댓글(웹훅 재전송)

    const dm = await sendPrivateReply(account.access_token, account.ig_user_id as string, ev.commentId, renderDm(rule, ev.fromUsername))
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
}

/** 처리한 계정 목록도 돌려준다(호출부가 토큰 연장을 이어서 돌릴 수 있게). */
export async function processWebhookPayload(DB: D1Database, kek: string | undefined, payload: unknown): Promise<ProcessSummary & { accounts: AutoDmAccount[] }> {
  const events = parseCommentEvents(payload)
  const summary: ProcessSummary = { events: events.length, sent: 0, failed: 0, skipped: 0 }
  const touched: AutoDmAccount[] = []
  if (!events.length) return { ...summary, accounts: touched }

  const byAccount = new Map<string, CommentEvent[]>()
  for (const ev of events) byAccount.set(ev.accountId, [...(byAccount.get(ev.accountId) || []), ev])

  let sellersEnabled: boolean | null = null
  for (const [igUserId, evs] of byAccount) {
    const account = await getAccountByIgUserId(DB, kek, igUserId)
    if (!account || !account.enabled || !account.access_token) { summary.skipped += evs.length; continue }
    if (account.owner_key !== PLATFORM_OWNER) {
      sellersEnabled ??= (await getAppConfig(DB, kek)).sellers_enabled
      if (!sellersEnabled) { summary.skipped += evs.length; continue }
    }
    touched.push(account)
    await processForAccount(DB, account, evs, summary)
    // 처리방침의 보관 기간(90일) — 웹훅이 들어올 때 그 계정 것만 정리한다(실패해도 발송엔 영향 없음).
    await pruneOldSends(DB, account.id).catch(() => {})
  }
  return { ...summary, accounts: touched }
}
