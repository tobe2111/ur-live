/**
 * 🎛️ **수집 업종을 화면에서 켜고 끈다** — 파트너(업체) 풀 (2026-08-02 대표 "페이지에서 직접 설정").
 *
 * ## 왜 키워드가 아니라 업종인가 (라이브 실측)
 * ```
 *   ad_company_keywords  4,546개  ↔  업종 32개
 *   간판·광고물 제작 1,172 · 창고형 공동구매 705 · 종합광고기획 470 · …
 * ```
 * 키워드는 **(지역 235 × 업종)의 곱**이다. 개별 키워드를 나열하면 "카페를 그만 캐라"가 235번의
 * 클릭이 된다 — 인플루언서 화면이 이미 같은 이유로 렉 수리를 겪었다(칩 수백~1,000개).
 * 사람이 실제로 내리는 결정의 단위는 **업종**이고, 지역은 그 업종의 커버 범위일 뿐이다.
 * ⇒ 집계도 토글도 업종 단위. 32줄이면 전체가 한 화면에 들어온다.
 *
 * ## 이 파일이 하는 일은 **기존 스위치를 노출하는 것뿐**이다
 * 수집 회전은 이미 `WHERE active = 1` 로 돈다(`company-collect.ts`). 즉 끄는 기능은 **원래 있었고**
 * 누를 데가 없었을 뿐이다 — 이 레포가 반복해 만난 "기능이 없는 게 아니라 보이지 않는" 클래스.
 * 새 메커니즘을 만들지 않는다. 새로 만들면 수집 경로와 갈라진다.
 *
 * ⚠️ 커서는 활성 집합에 대한 OFFSET 이다. 업종을 끄면 집합이 줄어 커서가 가리키는 자리가 바뀌지만,
 *   `rotationWindow` 가 total 로 모듈로를 돌리므로 **건너뜀 없이 이어진다**(위치만 점프).
 */
import { ensureCompanyKeywords } from './company-collect'

/** 업종 키 — 세부업종 우선, 없으면 카테고리, 둘 다 없으면 미분류. 집계와 토글이 **같은 식**을 써야
 *  화면에서 본 줄과 실제로 꺼지는 행이 어긋나지 않는다(두 벌로 두면 반드시 갈라진다). */
export const TRADE_EXPR = "COALESCE(NULLIF(subcategory,''), NULLIF(category,''), '(미분류)')"

export interface CompanyTradeRow {
  trade: string
  category: string | null
  tier: number | null
  kw: number          // 이 업종이 커버하는 키워드(=지역) 수
  active_kw: number   // 그중 켜져 있는 수
  found: number       // 누적 발굴
  saved: number       // 누적 저장(=실제 값)
  last_run_at: string | null
}

/** 업종별 집계 — 수확 많은 순. 어느 업종이 값을 만드는지가 한눈에 보여야 끌 결정을 할 수 있다. */
export async function listCompanyTrades(DB: D1Database): Promise<CompanyTradeRow[]> {
  await ensureCompanyKeywords(DB)
  const r = await DB.prepare(
    `SELECT ${TRADE_EXPR} AS trade,
            MAX(COALESCE(category, '')) AS category,
            MIN(tier) AS tier,
            COUNT(*) AS kw,
            SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_kw,
            SUM(COALESCE(found_total, 0)) AS found,
            SUM(COALESCE(saved_total, 0)) AS saved,
            MAX(last_run_at) AS last_run_at
       FROM ad_company_keywords
      GROUP BY 1
      ORDER BY saved DESC, kw DESC`,
  ).all<CompanyTradeRow>().catch(() => null)
  return (r?.results || []).map(t => ({ ...t, category: t.category || null }))
}

export type TradeToggleResult = { ok: true; changed: number } | { ok: false; error: string }

/**
 * 업종 일괄 on/off.
 *
 * 🛡️ **마지막 활성 업종은 끄지 못한다.** 전부 끄면 회전 쿼리가 0행을 받아 수집이 **에러 없이** 멈춘다
 *   — 그리고 하트비트는 초록으로 남는다(레인은 정상 실행되고 할 일이 없을 뿐이다). 이 레포가
 *   하루에 세 번 만난 "침묵이 성공처럼 보인다" 가 여기서도 성립한다. 실수 한 번에 그 상태가 되지
 *   않도록 서버가 막고, **왜 막았는지를 응답으로 말한다**(조용히 무시하면 더 나쁘다).
 */
export async function setCompanyTradeActive(DB: D1Database, trade: string, active: boolean): Promise<TradeToggleResult> {
  const t = (trade || '').trim()
  if (!t || t.length > 60) return { ok: false, error: 'INVALID_TRADE' }
  await ensureCompanyKeywords(DB)

  if (!active) {
    const row = await DB.prepare(
      `SELECT COUNT(DISTINCT ${TRADE_EXPR}) AS n FROM ad_company_keywords WHERE active = 1`,
    ).first<{ n: number }>().catch(() => null)
    const activeTrades = Number(row?.n) || 0
    const self = await DB.prepare(
      `SELECT COUNT(*) AS n FROM ad_company_keywords WHERE active = 1 AND ${TRADE_EXPR} = ?`,
    ).bind(t).first<{ n: number }>().catch(() => null)
    // 이 업종이 켜져 있고, 켜진 업종이 이것 하나뿐이면 거부.
    if ((Number(self?.n) || 0) > 0 && activeTrades <= 1) return { ok: false, error: 'LAST_ACTIVE_TRADE' }
  }

  const r = await DB.prepare(
    `UPDATE ad_company_keywords SET active = ? WHERE ${TRADE_EXPR} = ?`,
  ).bind(active ? 1 : 0, t).run().catch(() => null)
  const changed = Number(r?.meta?.changes) || 0
  if (!changed) return { ok: false, error: 'TRADE_NOT_FOUND' }
  return { ok: true, changed }
}
