/**
 * 🧾 간이지급명세서(거주자의 사업소득) — 매월 제출용 집계 (2026-11-25)
 *
 * 개인 인플루언서(`influencer_withholding_log`)·개인 에이전시(`agency_share_payouts` 중 원천징수분)에게 지급하며 3.3% 를 뗀 달의
 * 다음 달 말일까지 홈택스에 낸다. 소득자 성명·주민등록번호는 `payee-tax-id.ts`(암호화 저장)에서 읽는다.
 * 3.3% = 소득세 3% + 지방소득세 0.3% → 기록된 합계를 1.1 로 나눠 소득세/지방소득세로 가른다.
 *
 * ⚠️ 홈택스 전자제출 파일 형식으로 바꾸지는 않았다(사람이 읽는 집계표) — 세무사·홈택스 양식에 옮긴다.
 * 읽기 전용. 주민번호 원문이 담기므로 호출부는 2FA·감사 로그 뒤에서만 부른다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { loadTaxIdsForStatement, type PayeeKind } from './payee-tax-id'

export interface StatementRow { kind: PayeeKind; payeeId: string; gross: number; incomeTax: number; localTax: number; withholding: number; net: number; name: string | null; rrn: string | null }

/** 순수 — 원천징수 합계 → 소득세·지방소득세. */
export function splitWithholding(total: number): { incomeTax: number; localTax: number } {
  const t = Math.max(0, Math.round(Number(total) || 0))
  const incomeTax = Math.round(t / 1.1)
  return { incomeTax, localTax: t - incomeTax }
}

/** 지급월(KST 'YYYY-MM')의 개인 소득자별 합계 — 주민번호는 `withIds` 가 true 일 때만 복호화해 싣는다. */
export async function computeSimplifiedStatement(DB: D1Database, kek: string | undefined, month: string, withIds: boolean): Promise<StatementRow[]> {
  const [y, m] = month.split('-').map(Number)
  const inf = await DB.prepare(`
    SELECT influencer_id AS pid, SUM(gross_amount) AS gross, SUM(withholding_amount) AS wh, SUM(net_amount) AS net
      FROM influencer_withholding_log WHERE payout_year = ? AND payout_month = ? AND withholding_amount > 0 GROUP BY influencer_id`,
  ).bind(y, m).all<{ pid: string; gross: number; wh: number; net: number }>().catch(() => ({ results: [] as Array<{ pid: string; gross: number; wh: number; net: number }> }))
  const ag = await DB.prepare(`
    SELECT CAST(agency_id AS TEXT) AS pid, SUM(gross_amount) AS gross, SUM(withholding_amount) AS wh, SUM(net_amount) AS net
      FROM agency_share_payouts WHERE status = 'paid' AND withholding_amount > 0
       AND strftime('%Y-%m', datetime(paid_at, '+9 hours')) = ? GROUP BY agency_id`,
  ).bind(month).all<{ pid: string; gross: number; wh: number; net: number }>().catch(() => ({ results: [] as Array<{ pid: string; gross: number; wh: number; net: number }> }))
  const rows: StatementRow[] = [
    ...(inf.results || []).map((r) => ({ kind: 'influencer' as const, r })),
    ...(ag.results || []).map((r) => ({ kind: 'agency' as const, r })),
  ].map(({ kind, r }) => ({
    kind, payeeId: String(r.pid), gross: Math.round(Number(r.gross) || 0), withholding: Math.round(Number(r.wh) || 0),
    net: Math.round(Number(r.net) || 0), ...splitWithholding(r.wh), name: null, rrn: null,
  }))
  // 등록 여부(가린 값 말고 존재만)는 언제나, 원문은 withIds 일 때만.
  const ids = await loadTaxIdsForStatement(DB, withIds ? kek : undefined, rows.map((r) => ({ kind: r.kind, id: r.payeeId })))
  for (const r of rows) {
    const t = ids.get(`${r.kind}:${r.payeeId}`)
    if (t) { r.name = t.name; r.rrn = withIds ? t.rrn : (t ? '등록됨' : null) }
  }
  return rows
}

/** 순수 — CSV(수식 인젝션 방어). */
export function simplifiedStatementCsv(month: string, rows: StatementRow[]): string {
  const cell = (v: unknown): string => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return `"${s.replace(/"/g, '""')}"`
  }
  const [y, m] = month.split('-').map(Number)
  const due = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10) // 다음 달 말일
  const header = ['지급연월', '구분', '소득자 성명', '주민등록번호', '지급액', '소득세(3%)', '지방소득세(0.3%)', '원천징수 합계', '실지급액']
  const body = rows.map((r) => [month, r.kind === 'agency' ? '에이전시(개인)' : '인플루언서(개인)', r.name || `(미등록 #${r.payeeId})`, r.rrn || '(미등록)',
    r.gross, r.incomeTax, r.localTax, r.withholding, r.net])
  const foot = [['', '', '', `제출 기한 ${due} (간이지급명세서 — 거주자의 사업소득, 지급월 다음 달 말일)`, '', '', '', '', '']]
  return '﻿' + [header, ...body, ...foot].map((r) => r.map(cell).join(',')).join('\r\n')
}
