/**
 * 📣 유어애즈 **발굴 리드 전용 D1 라우터** — 수집 데이터를 결제 DB에서 떼어낸다.
 *
 * ## 왜 만들었나 (2026-08-19 실측)
 *
 * `ur-ads` 는 **워커만** 분리돼 있었고 **DB 는 한 번도 분리된 적이 없다** —
 * `wrangler.toml` 과 `wrangler-ads.toml` 의 `database_id` 가 같은 uuid 였다. 그래서
 * 유어애즈가 긁어 담는 리드가 유어딜의 주문·결제와 **같은 파일**에 쌓였고, 그 파일이
 * 494 MB(무료 플랜 DB 한도 500 MB의 99%)까지 자랐다:
 *
 * ```
 * ad_influencer_leads  125.9 MB   ad_company_leads 77.7 MB   store_prospects 53.4 MB
 * 유어애즈 수집 합계    263.6 MB  = 실데이터의 92%
 * 유어딜·도매 전부       22.1 MB  = 8%          최근 7일 증가: 유어애즈 +123,368행 / 그 외 +179행
 * ```
 *
 * 한도에 닿으면 유어애즈만 멈추는 게 아니라 **주문·결제 쓰기가 같이 죽는다.**
 * 즉 유어딜은 이 문제의 원인이 아니라 인질이었다.
 *
 * ## 왜 이 방식인가 — 호출부 267곳을 손대지 않기 위해
 *
 * 깊은 함수들이 `DB: D1Database` 를 **인자로** 받으므로, 어느 핸들을 넘길지 일일이
 * 판단하면 70여 파일에서 사람이 실수하기 딱 좋다. 대신 **SQL 을 보고 자동으로 고르는
 * 얇은 라우터**를 끼운다. 이게 안전한 이유는 실측으로 확인된 사실 하나 때문이다:
 *
 * > **이사 대상 7개 테이블은 남는 테이블과 같은 쿼리에 단 한 번도 등장하지 않는다.**
 * > (전체 `src/**` SQL 문자열 스캔 결과 0건. 유일한 교차 조인 2건은 `ad_slots`↔`sellers`
 * >  인데 그건 유어딜 셀러의 광고슬롯 입찰 기능이라 **안 옮긴다**.)
 *
 * 섞이는 쿼리가 없으므로 문장 단위 라우팅은 **항상 명확**하다. 이 전제는
 * `ads-leads-db.test.ts` 가 매번 다시 검사한다 — 깨지면 빨간불이 뜬다.
 *
 * ## 🛡️ 바인딩이 없으면 아무 일도 안 일어난다
 *
 * `env.ADS_DB` 가 없으면 이 함수는 **`env.DB` 를 그대로 돌려준다**(래퍼조차 안 만든다).
 * 그래서 이 커밋만 배포하면 동작은 **오늘과 byte 단위로 같다.** 대표가 대시보드에서
 * 바인딩을 붙이는 순간부터 리드 쿼리만 새 DB로 간다.
 *
 * ⚠️ **이 파일이 못 막는 것**: 새 코드가 `adsLeadsDb()` 를 안 거치고 `env.DB` 로 리드
 *    테이블을 건드리면 바인딩 후 "테이블이 없다"로 깨진다. 그건 타입이 아니라
 *    `ads-leads-db.test.ts` 의 R1 이 잡는다.
 */

/** 새 DB로 이사하는 테이블 — **SSOT**. 마이그레이션 스크립트와 가드가 이 목록을 읽는다. */
export const ADS_LEADS_TABLES = [
  'ad_influencer_leads',   // 인플루언서 리드 (최대 — 125.9 MB / 122,558행)
  'ad_company_leads',      // 업체(대행사) 리드 (77.7 MB / 341,926행)
  'store_prospects',       // 매장 후보 — 인허가 발굴 (53.4 MB / 209,228행)
  'supply_maker_leads',    // 제조사 후보 (5.4 MB / 25,584행)
  'ad_discovery_keywords', // 인플루언서 발굴 키워드
  'ad_company_keywords',   // 업체 발굴 키워드
  // ⚠️ 리드는 아니지만 **같은 batch 에 묶여 있어** 함께 옮긴다. 안 옮기면 그 batch 가
  //    두 DB에 걸쳐 원자성을 잃는다(실측: 섞인 batch 는 이 한 건뿐이었다).
  'ad_email_suppress',
] as const

export type AdsLeadsTable = (typeof ADS_LEADS_TABLES)[number]

/**
 * ⚠️ **여기 없는 `ad_*` 는 옮기지 않는다.** 특히 `ad_slots`·`ad_bids`·`ad_accounts` 는
 * 유어딜 셀러의 광고슬롯 판매 기능이라 `sellers` 와 조인한다 — 옮기면 그 조인이 깨진다.
 */
const TABLE_RX = new RegExp(`\\b(?:${ADS_LEADS_TABLES.join('|')})\\b`)

/** 이 SQL 이 이사 대상 테이블을 건드리는가. SELECT·INSERT·UPDATE·DELETE·DDL 전부 포함. */
export function touchesAdsLeadsTable(sql: string): boolean {
  return TABLE_RX.test(sql)
}

/** 최소 D1 표면 — `@cloudflare/workers-types` 에 의존하지 않고 구조적으로만 맞춘다. */
interface D1Like {
  prepare(sql: string): unknown
  batch?(stmts: unknown[]): Promise<unknown>
  exec?(sql: string): Promise<unknown>
  dump?(): Promise<unknown>
}
interface EnvLike { DB: unknown; ADS_DB?: unknown }

/** batch() 가 원래 문장을 되찾을 수 있도록 래퍼에 심어 두는 표식. */
const RAW = Symbol.for('ur.adsLeadsDb.raw')
const SIDE = Symbol.for('ur.adsLeadsDb.side')

function wrapStatement(stmt: Record<string, unknown>, leads: boolean): unknown {
  // 프록시 대신 명시적 위임 — D1PreparedStatement 의 표면이 좁고(bind/first/all/run/raw)
  // 프록시는 `this` 바인딩이 어긋날 때 조용히 깨진다.
  const call = (name: string) => (...args: unknown[]) => (stmt[name] as (...a: unknown[]) => unknown).apply(stmt, args)
  return {
    [RAW]: stmt,
    [SIDE]: leads,
    bind: (...args: unknown[]) => wrapStatement((stmt.bind as (...a: unknown[]) => Record<string, unknown>).apply(stmt, args), leads),
    first: call('first'),
    all: call('all'),
    run: call('run'),
    raw: call('raw'),
  }
}

/**
 * 리드 테이블 쿼리는 `ADS_DB`, 나머지는 `DB` 로 보내는 핸들.
 * **`ADS_DB` 가 없으면 `env.DB` 를 그대로 반환한다**(래퍼 없음 = 현행과 동일).
 */
export function adsLeadsDb<E extends EnvLike>(env: E): E['DB'] {
  const main = env.DB as D1Like
  const ads = env.ADS_DB as D1Like | undefined
  if (!ads || typeof ads.prepare !== 'function') return main as E['DB']

  const pick = (sql: string): D1Like => (touchesAdsLeadsTable(sql) ? ads : main)

  const router = {
    prepare(sql: string) {
      const leads = touchesAdsLeadsTable(sql)
      return wrapStatement((leads ? ads : main).prepare(sql) as Record<string, unknown>, leads)
    },
    async batch(stmts: unknown[]) {
      const sides = new Set(stmts.map((s) => Boolean((s as Record<symbol, unknown>)?.[SIDE])))
      if (sides.size > 1) {
        // 두 DB에 걸친 batch 는 원자성이 없다 — 조용히 반쪽만 반영되느니 즉시 터뜨린다.
        throw new Error('[adsLeadsDb] batch 가 리드 DB와 메인 DB를 섞었다 — 쿼리를 나눠야 한다')
      }
      const target = sides.has(true) ? ads : main
      const raw = stmts.map((s) => (s as Record<symbol, unknown>)?.[RAW] ?? s)
      return (target.batch as (x: unknown[]) => Promise<unknown>)(raw)
    },
    async exec(sql: string) {
      return (pick(sql).exec as (x: string) => Promise<unknown>)(sql)
    },
    async dump() {
      return (main.dump as () => Promise<unknown>)()
    },
  }
  return router as unknown as E['DB']
}
