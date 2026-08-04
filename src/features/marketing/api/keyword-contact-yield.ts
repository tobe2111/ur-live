/**
 * 📮 **키워드 자동 조율 — "연락처가 나오는 키워드에 몫을 준다"** (2026-08-04, 대표 지시
 *   *"저수율 키워드 수집을 자동으로 조율되게끔. 영구적으로."*).
 *
 * ## 기존 자동 조율이 못 보던 축
 * 이미 두 개가 있었다. 둘 다 **수집 단계**만 본다:
 *   · `barren_streak` — "아무도 **못 찾았다**"
 *   · `yieldPenalty`  — "많이 찾았는데 **안 남았다**"(중복/고갈)
 * 그런데 이 DB 의 목적은 행이 아니라 **제안을 보낼 수 있는 리드**다. 그래서 세 번째 축이 빠져 있었다:
 *   · **"잘 찾고 잘 남았는데, 재 보니 연락처가 없다."**
 *
 * ## 실측 (2026-08-04, D1 전수)
 * ```
 *   측정완료 네이버 블로그 17,586행 → 이메일 4,704 = 기저 26.7%
 *   최상  블로그수익화 68.1% · 독서 추천 46.7% · 캘리그라피 45.1%
 *   최하  방배동 맛집  0.0%(표본 46) · 금천 맛집 5.9% · 관악 네일 12.3%
 *   저수율(<15%) 16개 : 측정 1,878 → 이메일 192 (10.2%)   ← 측정의 10.7%를 먹고 산출은 4.1%
 *   고수율(>=35%) 61개: 측정 3,599 → 이메일 1,744 (48.5%)
 * ```
 * n≈175 에서 표준편차 3.4pp 이므로 양 끝은 **6σ 밖** — 우연이 아니다.
 *
 * ⚠️ **일반화 규칙은 없다.** "지역+업종이 저조하다"는 눈으로 본 패턴은 전수로 **반증**됐다
 *   (지역 포함 25.7% vs 미포함 27.2% · "맛집" 25.5%). 그래서 카테고리 규칙이 아니라
 *   **키워드별 관측값**으로만 판정한다. 새 키워드는 표본이 쌓이기 전엔 절대 벌하지 않는다.
 *
 * ## 왜 '은퇴'가 아니라 '몫 축소'인가
 * 저수율의 원인을 우리는 **구분할 수 없다**: ① 키워드가 나쁘다 ② 그 주제 블로거가 원래 연락처를 안 건다
 * ③ 우리 추출기가 그 형식을 못 읽는다. ③이면 추출기를 고치는 순간 되살아나야 한다.
 * 그래서 **완전 배제 대신 `CONTACT_PROBE_EVERY` 회차마다 한 번은 통과**시킨다 —
 * 억제 중에도 증거가 계속 갱신되므로 **판정이 스스로 뒤집힐 수 있다.** 가드 없는 영구 배제는
 * 이 레포가 반복해 만난 *"되돌릴 수 없는 자동화"* 이고, 그건 자동 조율이 아니라 사고다.
 */

/** 이만큼 **측정**된 뒤에야 연락처 수율을 신뢰한다. 미만이면 판정 자체를 안 한다(탐색 보호). */
export const CONTACT_EVIDENCE_MIN = 40
/** 기저 26.7% 대비 확실히 낮은 선. 이 위는 손대지 않는다. */
export const CONTACT_OK_RATE = 0.15
/** 억제돼도 이 주기마다 한 회차는 통과 — 증거 갱신 + 가역성. */
export const CONTACT_PROBE_EVERY = 5

export interface ContactYieldRow {
  /** 이 키워드로 수집된 행 중 **측정이 끝난** 수(정비 레인이 갱신). */
  measured_total?: number | null
  /** 그중 이메일을 얻은 수. */
  email_total?: number | null
}

/**
 * 이 키워드가 "재 봤더니 연락처가 안 나오는" 부류인가.
 * ⚠️ 표본이 모자라면 **무조건 false** — 갓 만든 키워드를 0%로 낙인찍으면 탐색이 죽는다.
 */
export function isLowContactYield(k: ContactYieldRow): boolean {
  const m = Math.max(0, k.measured_total || 0)
  if (m < CONTACT_EVIDENCE_MIN) return false
  return (Math.max(0, k.email_total || 0) / m) < CONTACT_OK_RATE
}

/**
 * 순환 풀에서 저수율 키워드를 **솎아낸다**(제거가 아니라 그 회차 건너뛰기).
 *
 * ⚠️ 두 가지 안전장치가 **둘 다** 필요하다:
 *   · 탐침 회차(`roundIndex % CONTACT_PROBE_EVERY === 0`)엔 전부 통과 — 증거가 갱신돼야 판정이 뒤집힌다.
 *   · 전부 저조해서 풀이 비면 **억제하지 않는다** — 빈 풀은 그 축을 통째로 멈춘다(고쳐야 할 건 키워드지
 *     수집이 아니다). 이 레포는 같은 클래스의 사고를 이미 겪었다(집중 축 커서 동결 → 커버리지 붕괴).
 */
export function suppressLowContactYield<T extends ContactYieldRow>(pool: T[], roundIndex: number): T[] {
  if (!pool.length) return pool
  if (roundIndex % CONTACT_PROBE_EVERY === 0) return pool
  const kept = pool.filter(k => !isLowContactYield(k))
  return kept.length ? kept : pool
}

/** 점수 기반 선택(YT)용 감점. 순환 풀(네이버/일반)은 위 `suppressLowContactYield` 가 담당. */
export const CONTACT_PENALTY_MAX = 50
export function contactPenalty(k: ContactYieldRow): number {
  const m = Math.max(0, k.measured_total || 0)
  if (m < CONTACT_EVIDENCE_MIN) return 0
  const rate = Math.max(0, k.email_total || 0) / m
  if (rate >= CONTACT_OK_RATE) return 0
  return Math.round(((CONTACT_OK_RATE - rate) / CONTACT_OK_RATE) * CONTACT_PENALTY_MAX)
}

interface D1Like {
  prepare(sql: string): {
    bind(...v: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
    all<T = unknown>(): Promise<{ results?: T[] }>
  }
  batch(stmts: unknown[]): Promise<unknown>
}

export interface ContactYieldRefreshResult {
  scanned: number
  updated: number
  cursor: number
  wrapped: boolean
  error?: string
}

/**
 * 📊 키워드별 `measured_total`/`email_total` 갱신 — **슬라이스 + 커서**.
 *
 * 전량(활성 399개)을 한 회차에 재계산하면 D1 왕복과 CPU 를 크게 먹는다. 정비 슬롯은 여러 단계가
 * 나눠 쓰는 자리라, 여기서만 다 쓰면 다른 단계가 굶는다(이 레포가 이미 겪은 클래스).
 * ⇒ 한 회차 `limit` 개씩 돌고 커서를 남긴다. 한 바퀴는 며칠 걸려도 되는 값이다 —
 *   수율은 하루 만에 뒤집히는 종류가 아니다.
 *
 * ⚠️ **집계는 한 쿼리로** 한다(키워드마다 SELECT 하면 슬라이스 크기만큼 왕복이 늘어난다).
 */
export async function refreshKeywordContactYield(
  DB: D1Like,
  opts: { limit?: number; cursor?: number } = {},
): Promise<ContactYieldRefreshResult> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 60))
  const cursor = Math.max(0, opts.cursor || 0)
  const out: ContactYieldRefreshResult = { scanned: 0, updated: 0, cursor, wrapped: false }
  try {
    const kws = await DB.prepare(
      'SELECT id, keyword FROM ad_discovery_keywords WHERE active = 1 AND id > ? ORDER BY id ASC LIMIT ?',
    ).bind(cursor, limit).all<{ id: number; keyword: string }>()
    let rows = kws?.results || []
    if (!rows.length && cursor > 0) {
      // 🔁 한 바퀴 끝 — 처음으로 되감는다. (되감지 않으면 커서가 끝에 붙어 **영구히 0건**이 된다.)
      const first = await DB.prepare(
        'SELECT id, keyword FROM ad_discovery_keywords WHERE active = 1 ORDER BY id ASC LIMIT ?',
      ).bind(limit).all<{ id: number; keyword: string }>()
      rows = first?.results || []
      out.wrapped = true
    }
    out.scanned = rows.length
    if (!rows.length) return { ...out, cursor: 0 }

    const names = rows.map(r => r.keyword)
    const ph = names.map(() => '?').join(',')
    const agg = await DB.prepare(
      `SELECT source_keyword AS k, COUNT(*) AS m,
              SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS e
         FROM ad_influencer_leads
        WHERE account_id = 0 AND perf_checked_at IS NOT NULL AND source_keyword IN (${ph})
        GROUP BY source_keyword`,
    ).bind(...names).all<{ k: string; m: number; e: number }>()
    const byKw = new Map<string, { m: number; e: number }>()
    for (const r of agg?.results || []) byKw.set(r.k, { m: Number(r.m) || 0, e: Number(r.e) || 0 })

    const stmts = rows.map(r => {
      const v = byKw.get(r.keyword) || { m: 0, e: 0 }
      return DB.prepare('UPDATE ad_discovery_keywords SET measured_total = ?, email_total = ? WHERE id = ?')
        .bind(v.m, v.e, r.id)
    })
    await DB.batch(stmts)
    out.updated = stmts.length
    out.cursor = rows[rows.length - 1]!.id
    return out
  } catch (e) {
    // 🧯 fail-soft — 조율 갱신이 실패해도 수집/정비가 멈추면 안 된다. 대신 **사유를 남긴다**
    //   (조용히 0건이면 "큐가 빔"과 구분이 안 된다 — 이 레포가 반복해 만난 함정).
    return { ...out, error: (e as Error)?.message || 'fail' }
  }
}

/**
 * 🎯 **3분할 순환 풀 구성** — `influencer-auto-collect.ts` 에서 추출(2026-08-04, 600줄 래칫).
 *
 * 규칙(이동 전과 동일):
 *   · 집중 축(`FOCUS_CATEGORIES`)을 **가장 먼저** 뗀다 — 우선/일반보다 앞이다.
 *   · 남은 것 중 `PRIORITY_CATEGORIES` 가 우선 풀, 나머지가 일반 풀.
 *   · **세 풀은 서로 배타여야 한다** — 겹치면 같은 키워드가 한 배치에 두 번 들어간다.
 *
 * 여기에 연락처 수율 솎아내기를 얹는다. ⚠️ **풀 구성 직후·커서 사용 전**이어야 한다 —
 * 커서는 풀 길이 기준이라, 솎아내기를 커서 뒤로 미루면 같은 인덱스가 다른 키워드를 가리킨다.
 */
export function buildRotationPools<T extends ContactYieldRow & { category: string | null }>(
  kws: T[], roundIndex: number,
  cats: { focus: readonly string[]; priority: readonly string[] },
): { focusPool: T[]; priPool: T[]; genPool: T[] } {
  const inFocus = (k: { category: string | null }) => !!k.category && cats.focus.includes(k.category)
  const inPri = (k: { category: string | null }) => !!k.category && cats.priority.includes(k.category)
  const trim = (p: T[]) => suppressLowContactYield(p, roundIndex)
  return {
    focusPool: trim(kws.filter(inFocus)),
    priPool: trim(kws.filter(k => !inFocus(k) && inPri(k))),
    genPool: trim(kws.filter(k => !inFocus(k) && !inPri(k))),
  }
}

/** 커서 저장 키 — ⚠️ `influencer-auto-collect.ts` 의 `SETTING_KEYS` 에도 넣어야 값이 읽힌다. */
export const CONTACT_YIELD_CURSOR_KEY = 'ads_kw_contact_yield_cursor'

/**
 * 🔁 **탐침 회차에만** 수율을 갱신한다 — 억제를 푸는 회차와 같은 주기라, *증거를 새로 얻는 회차*와
 *   *증거를 반영하는 회차*가 짝을 이룬다. 비용은 ~3 서브리퀘스트 / 5회차 ≈ 라운드당 0.6.
 *
 * ⚠️ 정비 레인에 슬롯을 새로 만들지 **않은** 이유: 그 배정표는 *12가 24의 약수*라는 근거로 짜여
 *   각 단계가 하루 정확히 2회 돈다(`MAINT_SCHEDULE` 주석). 13번째를 끼우면 그 계약이 깨진다.
 */
export async function maybeRefreshContactYield(
  DB: D1Like, roundIndex: number, rawCursor?: string | null,
): Promise<ContactYieldRefreshResult | undefined> {
  if (roundIndex % CONTACT_PROBE_EVERY !== 0) return undefined
  const cursor = Math.max(0, parseInt(String(rawCursor ?? ''), 10) || 0)
  return refreshKeywordContactYield(DB, { cursor })
}
