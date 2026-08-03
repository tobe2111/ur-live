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
import { envSubreqCap, envLaneBudget, envPlanValue } from './collect-budget'

export interface MxSweepStats { last_run: string; checked: number; removed: number; cursor_c: number; cursor_s: number; total_removed: number; note?: string; stopped_by?: string; first_block?: string }
const STATS_KEY = 'ads_mxsweep_stats'
const CURSOR_C = 'ads_mxsweep_cursor_c' // ad_company_leads id 커서
const CURSOR_S = 'ads_mxsweep_cursor_s' // store_prospects id 커서
const BLOCK_ORDER = 'ads_mxsweep_block_order' // 블록 선후 회전(아래 주석)

/**
 * ⏱️ **회차 벽시계 마감선** (2026-08-03 — 대표 승인 "다른 고비용 레인도 같은 방식으로")
 *
 * 이 레인은 실측 **12.5초**를 썼다. 예산은 DoH 요청 수만 세는데, 행은 **블록당 150개씩 300개**를
 * 순회한다 — 유명 도메인은 예산을 안 쓰고 통과하므로 **예산이 다 남아도 시간은 계속 흐른다.**
 * 즉 여기서도 비용의 척도가 요청 수가 아니라 시간인데, 시간을 재는 것이 없었다.
 *
 * ## ⚠️ 마감선만 넣으면 **두 번째 블록이 굶는다**
 *
 * 블록 ①(회사 리드) → ②(매장 후보) 순서가 **고정**이라, ①에서 마감선에 걸리면 ②는 매 회차
 * 한 번도 안 돈다 → `cursorS` 가 영원히 안 움직인다. `notice-scan` 의 키워드에서 겪은 것과
 * 같은 구조적 기아다(그쪽은 회전 커서로 풀었다).
 *
 * ⇒ **블록 선후를 회차마다 뒤집는다.** 두 회차면 양쪽이 반드시 선두를 한 번씩 받는다.
 *   행 커서(`CURSOR_C`/`CURSOR_S`)는 이미 있으므로 블록 *안*의 진행은 원래대로 이어진다.
 */
const RUN_DEADLINE_MS = 10_000
const RUN_DEADLINE_MS_PAID = 24_000

export async function sweepEmailMx(env: Env): Promise<MxSweepStats> {
  const DB = env.DB
  // 스키마 DDL 실비를 예산에서 뺀다(2026-07-29) — 안 빼면 우리 계수와 플랫폼 계수가 갈라진다.
  const schemaSpent = (await ensureCompanySchema(DB)) + (await ensureProspectSchema(DB))
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
  // 🧱 플랫폼 천장(2026-07-29) — env 값이 얼마든 인보케이션 한도를 넘을 수 없다. 넘으면 후반 fetch 가
  //   조용히 전멸하고(잡히는 예외 없이) 그 사실이 어디에도 안 남는다. collect-budget.ts 주석(기본 60·근거) 참조.
  const budget: FetchBudget = { left: Math.max(1, Math.min(envSubreqCap(env), Math.max(20, envLaneBudget(env.ADS_ENRICH_BUDGET, 80, env))) - schemaSpent) }
  let checked = 0, removed = 0
  const startedAt = Date.now()
  const runDeadlineMs = envPlanValue(undefined, RUN_DEADLINE_MS, RUN_DEADLINE_MS_PAID, env)
  let stoppedBy: string | undefined
  const outOfTime = () => Date.now() - startedAt > runDeadlineMs

  let cursorC = await readCursor(CURSOR_C)
  let cursorS = await readCursor(CURSOR_S)

  // ── ① 회사 리드 — 이메일 보유 행 커서 순회 ──
  const runCompany = async () => {
    const rows = (await DB.prepare("SELECT id, email, phone FROM ad_company_leads WHERE email IS NOT NULL AND email != '' AND merged_into IS NULL AND id > ? ORDER BY id ASC LIMIT 150")
      .bind(cursorC).all<{ id: number; email: string; phone: string | null }>().catch(() => null))?.results || []
    if (!rows.length) cursorC = 0 // 소진 → 다음 실행에 처음부터(신규분 재검 순환)
    for (const r of rows) {
      if (!isKnownMailDomain(r.email) && budget.left <= 0) { stoppedBy = 'budget'; break } // 미검사 행에서 멈춤(커서 안 넘김 — 다음 턴에 재개)
      if (outOfTime()) { stoppedBy = 'deadline'; break }
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
  const runProspects = async () => {
    const rows = (await DB.prepare("SELECT id, email FROM store_prospects WHERE email IS NOT NULL AND email != '' AND id > ? ORDER BY id ASC LIMIT 150")
      .bind(cursorS).all<{ id: number; email: string }>().catch(() => null))?.results || []
    if (!rows.length) cursorS = 0
    for (const r of rows) {
      if (!isKnownMailDomain(r.email) && budget.left <= 0) { stoppedBy = 'budget'; break }
      if (outOfTime()) { stoppedBy = 'deadline'; break }
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

  // 🔄 블록 선후 회전 — 고정 순서면 마감선에 걸릴 때 뒤 블록이 매 회차 굶는다(위 주석).
  const firstIsCompany = (await readCursor(BLOCK_ORDER)) % 2 === 0
  if (firstIsCompany) { await runCompany(); await runProspects() }
  else { await runProspects(); await runCompany() }
  await writeCursor(BLOCK_ORDER, firstIsCompany ? 1 : 0)

  const s: MxSweepStats = {
    last_run: stamp, checked, removed, cursor_c: cursorC, cursor_s: cursorS,
    total_removed: (prev?.total_removed || 0) + removed,
    // 📟 왜 멈췄는지 + 이번에 누가 선두였는지 — 없으면 "적게 검사했다"가 고장인지 마감선인지 모른다.
    stopped_by: stoppedBy, first_block: firstIsCompany ? 'company' : 'prospects',
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  return s
}
