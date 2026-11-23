/**
 * 🧾 **매장 수수료 채널 점검** (2026-11-23 대표 *"1,2 해주고"* — 2026-11-16 실측의 재발 방지)
 *
 * 2026-11-16 에 매장 7곳의 저장된 채널이 실제와 어긋나 있었다 — 뽀야네 하우스(외부 에이전시)가 데려온 23·24·29 가
 * 직접(10%)으로, 대표가 직접 넣은 14 가 중개(5%)로. **대표에게 물어보기 전까지 아무 신호가 없었다.**
 * 채널은 요율을 정하는 값인데 "누가 데려왔나" 와 대조하는 곳이 없었다.
 *
 * 여기는 **알리기만 한다** — 값을 자동으로 바꾸지 않는다(요율 변경은 대표 판단, `/admin/store-channel`).
 * 매일 아침 어드민 다이제스트(`cron/ops-daily-digest.ts`)와 어드민 매장 카드가 이 판정을 같이 쓴다.
 *
 * 규칙(2026-11-16 대표 확정): 사장님 직접 가입·유어팀 영입 = 10%(유어팀은 매장별 5% 선택 가능) · 다른 에이전시 영입 = 5%.
 *   ① 외부 에이전시가 맡았는데 직접(10%)        → 어긋남
 *   ② 중개(5%)인데 데려온 곳이 아무도 없음       → 어긋남(떼어 줄 사람이 없는데 5%)
 *   ③ 판매 중인데 채널 미지정                    → 어긋남(종전 경로로 떨어진다)
 *   유어팀이 일부러 5% 로 고른 매장(중개 + 유어팀 에이전시/계정)은 **정상**이다.
 *
 * ⚠️ 못 보는 것: 에이전시 연결 없이 말로만 데려온 매장(기록이 없다) · 실제 정산 요율(결제가 있어야 안다).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { PLATFORM_OPERATOR_AGENCY_IDS, PLATFORM_OPERATOR_USER_IDS } from './ledger-commission-policy'

export interface StoreChannelRow {
  sellerId: number
  name: string
  channel: string | null
  /** active 로 맡은 에이전시 */
  agencies: Array<{ id: number; name: string }>
  brokerUserId: number | null
  liveProducts: number
}

export type ChannelMismatch = 'external_agency_direct' | 'brokered_no_recruiter' | 'live_unset'

/** 한 매장 판정 — 순수 함수(시험이 직접 돌린다). null = 정상. */
export function channelMismatch(r: StoreChannelRow): ChannelMismatch | null {
  const external = r.agencies.filter((a) => !PLATFORM_OPERATOR_AGENCY_IDS.includes(a.id))
  const hasBroker = r.brokerUserId != null && r.brokerUserId > 0
  if (r.channel === 'direct') return external.length > 0 ? 'external_agency_direct' : null
  if (r.channel === 'brokered') return r.agencies.length === 0 && !hasBroker ? 'brokered_no_recruiter' : null
  return r.liveProducts > 0 ? 'live_unset' : null
}

/** 누가 데려왔나 — 사람이 읽는 한 줄(어드민 카드). */
export function recruiterLabel(r: StoreChannelRow): string {
  const parts = r.agencies.map((a) => (PLATFORM_OPERATOR_AGENCY_IDS.includes(a.id) ? `${a.name}(유어팀 직영)` : `${a.name}(에이전시)`))
  if (r.brokerUserId != null && r.brokerUserId > 0) {
    parts.push(PLATFORM_OPERATOR_USER_IDS.includes(r.brokerUserId) ? '대표 계정' : `중개사 #${r.brokerUserId}`)
  }
  return parts.length > 0 ? parts.join(' · ') : '기록 없음(사장님 직접 가입)'
}

const MISMATCH_TEXT: Record<ChannelMismatch, string> = {
  external_agency_direct: '에이전시가 데려왔는데 직접(10%)',
  brokered_no_recruiter: '중개(5%)인데 데려온 곳 기록 없음',
  live_unset: '판매 중인데 수수료 채널 미지정',
}
export const mismatchText = (m: ChannelMismatch): string => MISMATCH_TEXT[m]

/** 다이제스트 줄 — 어긋난 매장이 없으면 빈 배열(조용히). */
export function storeChannelWarnings(rows: StoreChannelRow[]): string[] {
  const bad = rows.map((r) => ({ r, m: channelMismatch(r) })).filter((x): x is { r: StoreChannelRow; m: ChannelMismatch } => x.m != null)
  if (bad.length === 0) return []
  const head = `🧾 수수료 채널 어긋남 ${bad.length}곳 — /admin/merchant-commissions 에서 확인(자동으로 바꾸지 않음)`
  return [head, ...bad.slice(0, 5).map(({ r, m }) => `   · #${r.sellerId} ${r.name}: ${MISMATCH_TEXT[m]}`)]
}

interface RawRow { id: number; name: string | null; channel: string | null; broker: string | null; agencies: string | null; live: number }

function toRow(x: RawRow): StoreChannelRow {
  const agencies = String(x.agencies ?? '').split('|').filter(Boolean).map((s) => {
    const i = s.indexOf(':')
    return { id: Number(s.slice(0, i)), name: s.slice(i + 1) }
  }).filter((a) => Number.isFinite(a.id) && a.id > 0)
  const broker = Number(x.broker)
  return {
    sellerId: Number(x.id), name: String(x.name ?? `매장 ${x.id}`),
    channel: x.channel === 'direct' || x.channel === 'brokered' ? x.channel : null,
    agencies, brokerUserId: Number.isFinite(broker) && broker > 0 ? broker : null, liveProducts: Number(x.live) || 0,
  }
}

const ROW_SQL = `
  SELECT s.id, COALESCE(NULLIF(s.business_name, ''), s.name) AS name,
         (SELECT value FROM seller_meta m WHERE m.seller_id = s.id AND m.key = 'store_channel' LIMIT 1) AS channel,
         (SELECT value FROM seller_meta m WHERE m.seller_id = s.id AND m.key = 'broker_user_id' LIMIT 1) AS broker,
         (SELECT GROUP_CONCAT(l.agency_id || ':' || a.name, '|') FROM agency_store_links l JOIN agency_accounts a ON a.id = l.agency_id
           WHERE l.seller_id = s.id AND l.status = 'active') AS agencies,
         (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.is_active = 1) AS live
    FROM sellers s`

/** 점검 대상 = 채널이 찍혔거나, 에이전시가 맡았거나, 판매 중인 승인 매장. 조회 실패는 빈 배열(다이제스트를 막지 않는다). */
export async function loadStoreChannelRows(DB: D1Database): Promise<StoreChannelRow[]> {
  const r = await DB.prepare(
    `SELECT * FROM (${ROW_SQL} WHERE s.status IN ('approved', 'active')) t
      WHERE t.channel IS NOT NULL OR t.agencies IS NOT NULL OR t.live > 0 LIMIT 500`,
  ).all<RawRow>().catch(() => ({ results: [] as RawRow[] }))
  return (r.results ?? []).map(toRow)
}

export async function loadStoreChannelRow(DB: D1Database, sellerId: number): Promise<StoreChannelRow | null> {
  const x = await DB.prepare(`${ROW_SQL} WHERE s.id = ?`).bind(sellerId).first<RawRow>().catch(() => null)
  return x ? toRow(x) : null
}
