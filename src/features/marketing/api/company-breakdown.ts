/**
 * 📊 **파트너 풀 분해 집계** — 총계로는 안 보이는 두 가지 (2026-08-03 분리).
 *
 * ## ① 두 사업의 "지금 보낼 수 있는 명단"
 * 대표 확정(2026-08-03): **온라인판매 = 페이백 사업 · 대행사 = 제휴 사업.**
 * 총계 17만은 이 판단에 아무 도움이 안 된다 — 화면 맨 위엔 **오늘 쓸 수 있는 수**만 있어야 한다.
 * 실측: 온라인판매 18,155건 중 이메일 18,088(99.6%) / 대행사 1,989건 중 이메일 111(5.6%).
 * ⚠️ `active = 1` 만 센다 — 보류(연락처 없어 제외된 것)는 명단이 아니다.
 *
 * ## ② 최신화 내역(최근 14일 유입)
 * **총계는 며칠 멈춰도 안 변한다** — 멈춤이 안 보이는 지표다. 날짜별로 봐야 보인다.
 * ⚠️ **KST 경계**(`+9 hours`)로 센다. UTC 로 자르면 한국의 '오늘'이 09:00 에 시작한다 —
 * 이 레포가 반복해 당한 9시간 오차이고 `check-utc-date-parse` 가 지키는 클래스다.
 *
 * ## ⚠️ 분리 이유
 * `company-discovery.ts` 가 파일크기 래칫(600줄)에 닿았다. `[SKIP_SIZE]` 로 우회하는 대신
 * **집계만 자기완결로** 빼냈다 — 호출부는 한 줄이 된다.
 */

/** 하루치 유입 — `d` 는 **KST 날짜 문자열**이다(클라는 표시만 할 것, 다시 파싱하면 오차가 되살아난다). */
export interface CompanyDayInflow { d: string; n: number; reachable: number }
/** 두 사업의 즉시 발송 가능 명단 수. 총계가 아니라 이 둘이 화면 맨 위에 온다. */
export interface CompanySegments { payback_ready: number; agency_ready: number }

export async function companyBreakdown(DB: D1Database): Promise<{ seg: CompanySegments; byDay: CompanyDayInflow[] }> {
  const s = await DB.prepare(`SELECT
      SUM(CASE WHEN category = '온라인판매' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS payback_ready,
      SUM(CASE WHEN category = '대행사' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')) THEN 1 ELSE 0 END) AS agency_ready
    FROM ad_company_leads WHERE merged_into IS NULL AND active = 1`).first<Record<string, number>>().catch(() => null)
  const byDay = (await DB.prepare(`SELECT DATE(collected_at,'+9 hours') AS d, COUNT(*) AS n,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS reachable
    FROM ad_company_leads WHERE merged_into IS NULL AND collected_at >= datetime('now','-14 days')
    GROUP BY d ORDER BY d DESC LIMIT 14`).all<CompanyDayInflow>().catch(() => null))?.results || []
  return {
    seg: { payback_ready: Number(s?.payback_ready) || 0, agency_ready: Number(s?.agency_ready) || 0 },
    byDay,
  }
}
