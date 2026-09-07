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

/**
 * 📅 **일자별 유입만** 남았다 (2026-08-31 재작성).
 *
 * 예전엔 이 함수가 세그먼트 집계(전수 스캔 1회)도 함께 했는데, 그건 `company-stats-cube.ts` 의
 * 한 번 스캔에 흡수됐다(같은 행을 또 훑을 이유가 없다). 일자별은 **최근 14일 범위 조회**라
 * 성격이 다르다 — 큐브에 넣으면 축이 날짜 수만큼 늘어난다.
 *
 * ⚠️ 이 쿼리는 `collected_at` 인덱스가 있어야 범위만 읽는다(없으면 전수 스캔 + 정렬 —
 *   라이브 실측 461,191행). 인덱스는 `company-ddl-indexes.ts` ⑤.
 */
export async function companyInflowByDay(DB: D1Database): Promise<{ byDay: CompanyDayInflow[]; todayKst: string }> {
  const byDay = (await DB.prepare(`SELECT DATE(collected_at,'+9 hours') AS d, COUNT(*) AS n,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS reachable
    FROM ad_company_leads WHERE merged_into IS NULL AND collected_at >= datetime('now','-14 days')
    GROUP BY d ORDER BY d DESC LIMIT 14`).all<CompanyDayInflow>().catch(() => null))?.results || []
  // 🕐 오늘(KST)이 **어느 날짜인지는 서버가 정한다** — 화면은 이 날짜의 막대를 '진행 중'으로 표시하고
  //   추세 계산에서 뺀다. 클라가 `new Date()` 로 오늘을 구하면 브라우저 TZ 에 따라 9시간 어긋나
  //   멀쩡한 날이 '폭락'으로 읽힌다(이 파일 위의 KST 경계 주석과 같은 클래스).
  const t = await DB.prepare("SELECT DATE('now','+9 hours') AS d").first<{ d: string }>().catch(() => null)
  return { byDay, todayKst: String(t?.d || '') }
}


/**
 * 📅 **오늘(KST) 유입만** — 화면이 매 요청 실시간으로 덮어쓰는 값.
 *
 * 분포 표는 1시간 캐시로 충분하지만 이 숫자만은 낡으면 안 된다("수집이 살아 있나"를 보는 자리라,
 * 낡으면 멀쩡히 도는데 멈춘 것처럼 보인다). `collected_at` 인덱스 덕에 오늘치만 읽는다 —
 * 라이브 실측 **7,234행**(전체 다시 세기 929,284행의 0.8%).
 *
 * ⚠️ 경계는 서버가 정한다(`DATE('now','+9 hours')`) — 클라가 `new Date()` 로 오늘을 구하면
 *   브라우저 TZ 에 따라 9시간 어긋나 멀쩡한 날이 '폭락'으로 읽힌다(이 파일 위 주석과 같은 클래스).
 * ⚠️ 실패는 `null` — 0 으로 적으면 "오늘 한 건도 안 들어왔다"는 **거짓말**이 된다.
 */
export async function todayInflow(DB: D1Database): Promise<CompanyDayInflow | null> {
  const r = await DB.prepare(`SELECT DATE('now','+9 hours') AS d, COUNT(*) AS n,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS reachable
    FROM ad_company_leads
   WHERE merged_into IS NULL AND collected_at >= datetime('now','-1 days')
     AND DATE(collected_at,'+9 hours') = DATE('now','+9 hours')`).first<CompanyDayInflow>().catch(() => null)
  if (!r || !r.d) return null
  return { d: String(r.d), n: Number(r.n) || 0, reachable: Number(r.reachable) || 0 }
}
