/**
 * ✍ 발송 큐 상위 리드 **초안 미리 채우기 레인** (2026-07-29 신설 — 라이브 실측 기반).
 *
 *   ## 왜 (추측 아님 — 라이브 숫자)
 *   `send-queue` 실측: **발송 가능 22,533명**(youtube 6,326 · naver_blog 16,105) 인데 접촉은 **0명**이고,
 *   큐 상위 표본 10명은 **전원 초안 없음**(score 100/99, 이메일 채널, 카테고리 명확 — 즉 대상 품질 문제 아님).
 *   지금 워크플로는 [큐 열기 → 10명 선택 → 생성 클릭 → AI 대기 → 검토 → 발송]이라 사람이 **매 10명마다
 *   AI 를 기다린다**. 수집·보강을 아무리 빠르게 해도 이 대기가 남으면 접촉 수는 안 늘어난다
 *   (9차 인계의 결론 "병목이 사람의 발송 시간으로 옮겨갔다" 를 코드로 받는 것).
 *
 *   ⇒ 사람이 큐를 열기 **전에** 상위 구간 초안을 채워 둔다. 열면 바로 검토·발송.
 *
 *   ## 안전장치 (이 레인은 돈을 쓴다 — Claude API)
 *     ① **게이트 기본 OFF**(`ADS_OUTREACH_PREFILL_ENABLED='true'` 여야 동작) — 블로그 AI 초안
 *        (`BLOG_AI_DRAFTS_ENABLED`)과 같은 하우스 패턴. 안 켜면 토큰 소모 0.
 *     ② **버퍼 상한**(`bufferTarget`, 기본 100) — 22,533명 전량 생성은 **구조적으로 불가**. 이미 준비된
 *        초안이 상한에 닿으면 그 즉시 종료한다. "사람보다 조금 앞서가기"가 목적이지 전량 생성이 아니다.
 *     ③ **회당 1배치**(`OUTREACH_BATCH_MAX`=10) — 한 인보케이션에 AI 호출 1회.
 *     ④ **빈 초안만**(`onlyWithoutDraft`) — 사람이 손본 초안을 덮지 않는다.
 *
 *   ⚖️ [LEGAL] **생성만 한다. 발송 없음.** 기존 `/outreach-drafts` 엔드포인트가 이미 확립한 경계와 동일하며
 *   (정보통신망법 — 콜드 리드 자동발송 경로 없음), 이 레인은 그 *생성*을 미리 해둘 뿐 사람의 검토·발송
 *   단계를 건너뛰지 않는다.
 *   ⚠️ 서비스 분리: `ad_influencer_leads` + `platform_settings` 만 접촉(소비자/도매 무관).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { generateOutreachDrafts, OUTREACH_BATCH_MAX, type OutreachLeadInput } from './influencer-outreach'
import { buildSendQueueWhere, SEND_QUEUE_ORDER_BY } from './outreach-queue'
import { POOL_ACCOUNT_ID } from './influencer-auto-collect'

const STATS_KEY = 'ads_outreach_prefill_last'

export interface PrefillSnapshot {
  last_run: string
  /** 이번 실행에서 새로 만든 초안 수. */
  generated: number
  /** 현재 준비된(초안 보유) 발송대기 리드 수 — 사람보다 얼마나 앞서 있는지. */
  ready: number
  /** 버퍼 상한 — ready 가 여기 닿으면 생성을 멈춘다. */
  buffer_target: number
  /** 초안이 아직 없는 발송대기 리드 수(남은 백로그). */
  pending: number
  skipped?: string
  error?: string
}

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

/**
 * 준비/대기 카운트 — `ready` 는 버퍼 판정용, `pending` 은 백로그 가시화용.
 * 둘 다 발송 큐와 **같은 술어**(SSOT)를 쓴다 — 다른 기준으로 세면 "준비됐다"가 화면과 어긋난다.
 */
export async function countPrefillState(DB: D1Database): Promise<{ ready: number; pending: number }> {
  const all = buildSendQueueWhere(POOL_ACCOUNT_ID)
  const nodraft = buildSendQueueWhere(POOL_ACCOUNT_ID, undefined, { onlyWithoutDraft: true })
  const [total, pendingRow] = await Promise.all([
    DB.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${all.where}`).bind(...all.binds).first<{ n: number }>().catch(() => null),
    DB.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${nodraft.where}`).bind(...nodraft.binds).first<{ n: number }>().catch(() => null),
  ])
  const t = total?.n ?? 0
  const pending = pendingRow?.n ?? 0
  return { ready: Math.max(0, t - pending), pending }
}

/** 버퍼 목표 — env 로 조정(10~1000). 기본 100 ≈ 사람이 며칠 쓸 분량. */
export function resolveBufferTarget(raw: string | undefined): number {
  return Math.min(1000, Math.max(10, parseInt(raw || '', 10) || 100))
}

export async function runOutreachDraftPrefill(env: Env): Promise<PrefillSnapshot> {
  const DB = env.DB
  const bufferTarget = resolveBufferTarget((env as unknown as { ADS_OUTREACH_PREFILL_BUFFER?: string }).ADS_OUTREACH_PREFILL_BUFFER)
  const persist = async (s: PrefillSnapshot) => {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  }
  const { ready, pending } = await countPrefillState(DB)
  const base: PrefillSnapshot = { last_run: nowStamp(), generated: 0, ready, buffer_target: bufferTarget, pending }

  if (!env.ANTHROPIC_API_KEY) {
    const s = { ...base, skipped: 'NOT_CONFIGURED: ANTHROPIC_API_KEY 미설정' }; await persist(s); return s
  }
  // ② 버퍼가 찼으면 아무것도 안 한다 — 사람이 소비해서 ready 가 줄어야 다시 채운다(전량 생성 방지).
  if (ready >= bufferTarget) {
    const s = { ...base, skipped: `버퍼 충족(${ready}/${bufferTarget}) — 사람이 소비하면 다시 채운다` }
    await persist(s); return s
  }
  if (!pending) { const s = { ...base, skipped: '초안 없는 발송대기 리드 0' }; await persist(s); return s }

  // ④ 빈 초안만, ③ 회당 1배치 — 사람이 실제로 먼저 만나는 상단부터(같은 ORDER BY).
  const { where, binds } = buildSendQueueWhere(POOL_ACCOUNT_ID, undefined, { onlyWithoutDraft: true })
  const rows = (await DB.prepare(`SELECT id, name, platform, subscriber_count, category, source_keyword, description
      FROM ad_influencer_leads WHERE ${where} ORDER BY ${SEND_QUEUE_ORDER_BY} LIMIT ?`)
    .bind(...binds, Math.min(OUTREACH_BATCH_MAX, bufferTarget - ready))
    .all<OutreachLeadInput>().catch(() => null))?.results || []
  if (!rows.length) { const s = { ...base, skipped: '선정 0건' }; await persist(s); return s }

  const r = await generateOutreachDrafts(env.ANTHROPIC_API_KEY, rows)
  if (!r.ok || !r.drafts) {
    // 💥 원문 릴레이 — 삼키면 "왜 초안이 안 쌓이지"를 라이브에서 규명할 길이 없다(보강 레인과 같은 이유).
    const s = { ...base, error: String(r.error || '생성 실패').slice(0, 200) }; await persist(s); return s
  }
  const stamp = nowStamp()
  await DB.batch(Array.from(r.drafts.entries()).map(([id, d]) =>
    DB.prepare('UPDATE ad_influencer_leads SET outreach_draft = ? WHERE id = ? AND account_id = ?')
      .bind(JSON.stringify({ ...d, generated_at: stamp }), id, POOL_ACCOUNT_ID))).catch(() => null)

  const s: PrefillSnapshot = { ...base, last_run: stamp, generated: r.drafts.size, ready: ready + r.drafts.size, pending: Math.max(0, pending - r.drafts.size) }
  await persist(s)
  return s
}
