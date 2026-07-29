/**
 * 📮 이메일 재검증 스윕 — 기존 저장 이메일의 도메인 실존(MX/NXDOMAIN) 재확인 (2026-07-27, 대표 "재검증 붙여줘").
 *   MX 검증 도입 **이전**에 저장된 이메일 + 통신판매 등록 이메일(수집 시 미검증)을 소급 검사 —
 *   도메인이 소멸(NXDOMAIN)한 주소만 NULL 처리(반송 확정 배제). 유명 메일도메인(naver/gmail…)은 조회 생략.
 *   판정은 보수적: NXDOMAIN 만 삭제(MX 부재는 A 레코드 수신 가능이라 유지) — 멀쩡한 이메일 오삭제 방지.
 *
 *   대상: ad_company_leads + store_prospects. 커서 순환(소진 시 처음부터 — 신규 유입분도 주기 재검).
 *   회사 리드는 이메일 삭제 후 전화도 없으면 active=0(연락처 필수 정책). 매장은 email 만 정리(active=영업상태).
 *   크론 일 1회(hourUTC=17=KST 02) + 수동 버튼. fail-open(DoH 장애 시 삭제 안 함).
 */
import type { Env } from '@/worker/types/env'
import type { FetchBudget } from './influencer-discovery'
import { domainAcceptsMail, isKnownMailDomain } from './contact-enrich'
import { ensureCompanySchema } from './company-discovery'
import { ensureProspectSchema } from './store-prospects'

export interface MxSweepStats { last_run: string; checked: number; removed: number; cursor_c: number; cursor_s: number; total_removed: number; note?: string }
const STATS_KEY = 'ads_mxsweep_stats'
const CURSOR_C = 'ads_mxsweep_cursor_c' // ad_company_leads id 커서
const CURSOR_S = 'ads_mxsweep_cursor_s' // store_prospects id 커서

export async function sweepEmailMx(env: Env): Promise<MxSweepStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  await ensureProspectSchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: MxSweepStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as MxSweepStats : null } catch { prev = null }
  const readCursor = async (k: string): Promise<number> => {
    const r = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    const n = parseInt(r?.value || '0', 10); return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const writeCursor = async (k: string, v: number) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(k, String(v)).run().catch(() => null) }

  // DoH 예산(커스텀 도메인만 소모 — 유명 도메인은 무료 통과). 행 상한과 별개.
  const budget: FetchBudget = { left: Math.max(20, parseInt(env.ADS_ENRICH_BUDGET || '', 10) || 80) }
  let checked = 0, removed = 0

  // ── ① 회사 리드 — 이메일 보유 행 커서 순회 ──
  let cursorC = await readCursor(CURSOR_C)
  {
    const rows = (await DB.prepare("SELECT id, email, phone FROM ad_company_leads WHERE email IS NOT NULL AND email != '' AND merged_into IS NULL AND id > ? ORDER BY id ASC LIMIT 150")
      .bind(cursorC).all<{ id: number; email: string; phone: string | null }>().catch(() => null))?.results || []
    if (!rows.length) cursorC = 0 // 소진 → 다음 실행에 처음부터(신규분 재검 순환)
    for (const r of rows) {
      if (!isKnownMailDomain(r.email) && budget.left <= 0) break // 미검사 행에서 멈춤(커서 안 넘김 — 다음 턴에 재개)
      checked++
      const alive = await domainAcceptsMail(r.email, budget)
      if (!alive) {
        const u = await DB.prepare("UPDATE ad_company_leads SET email = NULL, active = CASE WHEN phone IS NULL OR phone = '' THEN 0 ELSE active END WHERE id = ? AND email = ?")
          .bind(r.id, r.email).run().catch(() => null)
        if (((u as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) removed++
      }
      cursorC = r.id
    }
    await writeCursor(CURSOR_C, cursorC)
  }

  // ── ② 매장 후보 — email 만 정리(active 는 영업상태라 무접촉) ──
  let cursorS = await readCursor(CURSOR_S)
  {
    const rows = (await DB.prepare("SELECT id, email FROM store_prospects WHERE email IS NOT NULL AND email != '' AND id > ? ORDER BY id ASC LIMIT 150")
      .bind(cursorS).all<{ id: number; email: string }>().catch(() => null))?.results || []
    if (!rows.length) cursorS = 0
    for (const r of rows) {
      if (!isKnownMailDomain(r.email) && budget.left <= 0) break
      checked++
      const alive = await domainAcceptsMail(r.email, budget)
      if (!alive) {
        const u = await DB.prepare('UPDATE store_prospects SET email = NULL WHERE id = ? AND email = ?').bind(r.id, r.email).run().catch(() => null)
        if (((u as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) removed++
      }
      cursorS = r.id
    }
    await writeCursor(CURSOR_S, cursorS)
  }

  const s: MxSweepStats = { last_run: stamp, checked, removed, cursor_c: cursorC, cursor_s: cursorS, total_removed: (prev?.total_removed || 0) + removed }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  return s
}
