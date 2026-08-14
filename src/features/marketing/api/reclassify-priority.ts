/**
 * 🎯 **재검사 우선순위 — 추측이 많은 소스부터** (2026-08-09 대표 승인 "1번 해줘").
 *
 * ## 왜 필요했나 (라이브 실측)
 * 재검사는 id 오름차순 크롤 하나뿐이었다. 그런데 처리량이 **회차당 250행 · 시간당 1회**
 * (`stopped_by=deadline`)이고 풀은 **229,456건**이라 **한 바퀴에 38일**이다. 즉 규칙을 아무리 잘
 * 고쳐도 실효까지 한 달 이상 걸린다 — 그리고 그 사실이 어디에도 안 보였다.
 * 더 나쁜 건 위치였다: 커서가 id 55,380 인데 오염된 webkr 1,092건은 **전부 그보다 뒤**
 * (69,053~471,880). 대표가 신고한 진흥원 행은 id 401,793 — 사실상 그 38일을 거의 다 기다려야 했다.
 *
 * ## 무엇이 근거인가
 * 풀의 96%는 등록부 소스(`REGISTRY_CATEGORY_SOURCES` — 정부 신고 업태)라 **규칙을 바꿔도 판정이
 * 거의 안 바뀐다.** 반대로 판정이 흔들리는 것은 텍스트로 **추측한** 소스뿐이고, 그게 전체의 4% 다.
 * ⇒ 재검사는 그 4% 부터 본다. `webkr` 이 첫 티어인 이유는 **이름 자체를 페이지 제목에서 추측**하기
 * 때문이다(다른 소스는 최소한 상호를 API 가 준다) — 오분류가 구조적으로 가장 많다.
 *
 * ⚠️ 티어가 비면 다음 티어로, 전부 비면 **기존 전체 크롤로 폴백**한다. 우선순위는 크롤을
 * 대체하는 게 아니라 **앞에 끼워 넣는 것**이다(등록부 행도 결국 다 재검사된다).
 * ⚠️ 처리량은 안 건드린다 — 250행/회차 천장은 그대로고 **무엇을 먼저 쓸지**만 바꾼다.
 */

/** 우선순위 티어 — 앞일수록 먼저. 등록부 소스는 넣지 말 것(96%가 앞줄을 채워 우선순위가 무의미해진다). */
export const RECLASSIFY_PRIORITY_TIERS: readonly (readonly string[])[] = [['webkr'], ['local']]
/** 우선순위 진행 상태(티어 + 커서) — 전체 크롤 커서와 **따로** 둔다(섞으면 한쪽이 조용히 건너뛴다). */
export const RECLASSIFY_PRIO_STATE = 'ads_company_reclassify_prio'
/**
 * 재검사 대상 행의 SELECT 컬럼 — 우선순위 패스와 전체 크롤이 **같은 것을 읽어야** 한다(두 벌이면 갈라진다).
 *
 * 🔬 `lead_type`·`classify_confidence`·`classified_v` 는 **판정 변화율 계측**용이다(2026-08-14).
 *   이 셋이 없으면 "다시 도장 찍은 행 수"는 세어도 **"판정이 실제로 달라진 행 수"는 못 센다** —
 *   그 둘의 차이가 재분류 랩을 좁혀도 되는지(38일 → 2일)를 가르는 유일한 근거다.
 */
export const RECLASSIFY_COLS = 'id, company_name, description, website, category, subcategory, tier, source, source_keyword, status, memo, phone, email, contact_source, lead_type, classify_confidence, classified_v'

export type ReclassifyRow = {
  id: number; company_name: string; description: string | null; website: string | null
  category: string | null; subcategory: string | null; tier: number | null
  source: string; source_keyword: string | null; status: string; memo: string | null
  phone: string | null; email: string | null; contact_source: string | null
  lead_type: string | null; classify_confidence: string | null; classified_v: number | null
}

/**
 * 저장된 우선순위 상태를 읽는다. 깨진 값은 처음부터 — 재검사는 멱등이라 손해가 없다.
 *
 * 🩸 **규칙 버전이 바뀌면 커서를 리셋한다** (2026-08-11 라이브에서 실제로 물렸다).
 *   08-10 판정 때 webkr 잔량이 **981 에서 한 건도 안 줄어** 있었다. 레인은 정상이었다
 *   (`ok=true`, 47분 전 실행) — `phase=prio:local` 이었다. 즉 **커서가 webkr 을 이미 지나쳐
 *   다음 티어로 넘어간 뒤에 규칙 버전이 8로 올라갔고**, 그 981건은 다시 대상이 됐는데
 *   커서가 지나간 자리라 **한 바퀴(38일)를 돌기 전엔 안 본다.**
 *
 *   ⇒ 버전 bump 의 의미는 *"전부 다시 봐라"* 다. 그러면 **우선순위 큐도 처음부터 다시 서야 한다.**
 *   안 그러면 우선순위가 "첫 배포 때 한 번만" 듣는 장치가 된다 — 규칙은 앞으로도 계속 바뀐다.
 */
export async function readPrioState(DB: D1Database, rulesVersion?: number): Promise<{ tier: number; cursor: number }> {
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(RECLASSIFY_PRIO_STATE).first<{ value: string }>().catch(() => null)
  try {
    const p = raw?.value ? JSON.parse(raw.value) as { tier?: number; cursor?: number; v?: number } : null
    if (p) {
      // 버전이 다르면(=규칙이 바뀌었으면) 앞줄부터 다시. 미기록(구 상태)도 다른 것으로 친다.
      if (rulesVersion != null && Number(p.v) !== rulesVersion) return { tier: 0, cursor: 0 }
      return { tier: Number(p.tier) || 0, cursor: Number(p.cursor) || 0 }
    }
  } catch { /* 깨진 값은 처음부터 */ }
  return { tier: 0, cursor: 0 }
}

/** ⚠️ `rulesVersion` 을 함께 적는다 — 안 적으면 위 리셋 판정이 영원히 "다르다"가 되어 커서가 안 전진한다. */
export const writePrioState = (DB: D1Database, tier: number, cursor: number, rulesVersion?: number): Promise<unknown> =>
  DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(RECLASSIFY_PRIO_STATE, JSON.stringify({ tier, cursor, v: rulesVersion })).run().catch(() => null)

/**
 * 우선순위 티어에서 다음 배치를 고른다. 비어 있으면 다음 티어로 넘어가고, 전부 비면 `null`
 * (= 호출부가 전체 크롤로 폴백). 반환된 `tier` 는 커서를 저장할 때 그대로 쓴다.
 */
export async function pickPriorityBatch(
  DB: D1Database, limit: number, rulesVersion: number,
): Promise<{ rows: ReclassifyRow[]; phase: string; tier: number } | null> {
  let { tier, cursor } = await readPrioState(DB, rulesVersion)
  while (tier < RECLASSIFY_PRIORITY_TIERS.length) {
    const srcs = RECLASSIFY_PRIORITY_TIERS[tier]
    const got = (await DB.prepare(
      `SELECT ${RECLASSIFY_COLS} FROM ad_company_leads
        WHERE source IN (${srcs.map(() => '?').join(',')}) AND id > ? AND merged_into IS NULL
          AND (classified_v IS NULL OR classified_v < ?) ORDER BY id ASC LIMIT ?`)
      .bind(...srcs, cursor, rulesVersion, limit).all<ReclassifyRow>().catch(() => null))?.results || []
    if (got.length) return { rows: got, phase: `prio:${srcs.join('+')}`, tier }
    tier += 1; cursor = 0 // 이 티어는 비었다 — 다음 티어로(전부 비면 전체 크롤)
  }
  return null
}

/** 전체 크롤 배치 — 우선순위가 다 비었을 때만. **기존 동작 그대로**(id 오름차순 + 자기 커서). */
export async function pickCrawlBatch(
  DB: D1Database, limit: number, rulesVersion: number, cursorKey: string,
): Promise<{ rows: ReclassifyRow[]; cursor: number }> {
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(cursorKey).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(raw?.value || '0', 10)
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const rows = (await DB.prepare(
    `SELECT ${RECLASSIFY_COLS} FROM ad_company_leads
      WHERE id > ? AND merged_into IS NULL AND (classified_v IS NULL OR classified_v < ?) ORDER BY id ASC LIMIT ?`)
    .bind(cursor, rulesVersion, limit).all<ReclassifyRow>().catch(() => null))?.results || []
  return { rows, cursor }
}
