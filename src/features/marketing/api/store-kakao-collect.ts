/**
 * 🏪 매장 후보 발굴 — 카카오 로컬 **키워드 검색** (2026-07-28 무인매장 / 2026-08-02 유어딜 우선업종 확장).
 *
 *   왜 인허가(LOCALDATA)가 아니라 카카오인가:
 *     ① 무인 아이스크림 할인점·무인판매점은 인허가 업종 분류가 갈린다(식품소분·즉석판매제조가공·자동판매기…).
 *        어느 엔드포인트에 들어있는지 **확인할 방법이 이 환경에 없다**(apis.data.go.kr CONNECT 차단).
 *        추측으로 슬러그를 넣는 건 개발 룰 #1 위반이다.
 *     ② 인허가 레인은 **살아있지 않다** — 2026-08-02 실측 `API: HTTP 500` · `total_saved: 0`.
 *        대표의 data.go.kr 확인 대기 중이고, 그때까지 매장 풀은 이 레인 말고 채울 길이 없다.
 *     ③ **카카오 로컬은 이미 검증된 경로**다 — 같은 API(`/v2/local/search/keyword.json`)를 연락처 보강이
 *        매일 쓰고 있고, 응답에 **전화번호가 들어있다**(네이버 지역검색은 전화가 빈값이다).
 *        라이브 실측(08-02): 파트너 풀에서 `source='local'` 은 전체의 3% 인데 **전화의 80%** 를 만든다.
 *
 *   구조: (지역 235 × 업태) 키워드를 **블록별 커서**로 회전 순회 → 카카오 키워드 검색 → `store_prospects` upsert.
 *   복합키는 `opn_svc_id='kakao_place'` + `opn_sf_team_code=지역` + `mgt_no=카카오 place id` (인허가 행과 충돌 0).
 *
 *   ⚠️ 허위 0 — 카카오가 준 값(상호/주소/전화)만 저장한다. 추정하지 않는다.
 *   ⚠️ 서브리퀘스트: 학습 상한(`store_kakao` 레인 키) 안에서만. D1 쓰기도 같은 지갑에서 지불한다.
 *   게이트 `ADS_STORE_KAKAO_ENABLED`(기본 OFF).
 */
import type { Env } from '@/worker/types/env'
import { S2_REGIONS, REGION_GROUPS, rotationWindow } from './company-keyword-grid'
import { regionFromAddress } from './company-collect'
import { saveProspects, type StoreProspect } from './store-prospects'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, envSubreqCap } from './collect-budget'
import { ensureStoreTrades, loadActiveStoreTrades, bumpStoreTradeStats, getStoreConfig } from './store-trades'

/** 무인매장 업태 — 대표 요청분(2026-07-28). 카테고리는 `store_prospects.category` 표시값이 된다. */
export const UNMANNED_TRADES: Array<{ kw: string; category: string }> = [
  { kw: '무인 아이스크림 할인점', category: '무인아이스크림' },
  { kw: '아이스크림 할인점', category: '무인아이스크림' },
  { kw: '무인판매점', category: '무인판매점' },
  { kw: '무인점포', category: '무인판매점' },
]

/**
 * 🎯 유어딜이 **실제로 이용권을 파는** 업종 (2026-08-02 — 대표 07-29 지시 "음식점, 카페, 미용실, 숙박에 힘을 써").
 *
 *   왜 지금 넣나: 08-02 실측에서 `store_prospects` 45,458건 중 **학원이 44,348(97.6%)** 이고 이 네 업종은
 *   **정확히 0건**이었다. 채워야 할 인허가 레인이 HTTP 500 으로 죽어 있으니 카카오가 유일한 길이다.
 *
 *   ⚠️ `category` 값은 `store-prospects.ts` 의 `PRIORITY_UPJONG`(=`LICENSE_UPJONG` 의 한글 값)과
 *   **글자까지 일치**해야 한다. 다르면 우선순위 SQL(`PRIORITY_UPJONG_SQL`)에 안 걸려 **조용히 0 순위**가 되고,
 *   어드민 업종 필터에서도 별개 항목으로 갈린다. (그 함정은 store-prospects.ts 주석이 이미 경고한 것이다.)
 */
export const VOUCHER_TRADES: Array<{ kw: string; category: string }> = [
  { kw: '음식점', category: '일반음식점' },
  { kw: '한식', category: '일반음식점' },
  { kw: '고깃집', category: '일반음식점' },
  { kw: '치킨', category: '일반음식점' },
  { kw: '술집', category: '일반음식점' },
  { kw: '카페', category: '휴게음식점' },
  { kw: '베이커리', category: '휴게음식점' },
  { kw: '디저트', category: '휴게음식점' },
  { kw: '미용실', category: '미용업' },
  { kw: '네일샵', category: '미용업' },
  { kw: '피부관리', category: '미용업' },
  { kw: '왁싱', category: '미용업' },
  { kw: '모텔', category: '숙박업' },
  { kw: '펜션', category: '숙박업' },
  { kw: '게스트하우스', category: '숙박업' },
]

const STATS_KEY = 'ads_store_kakao_stats'
const CURSOR_KEY = 'ads_store_kakao_cursor'          // 무인 블록 — 기존 값의 의미가 그대로 유지된다
const CURSOR_KEY_VOUCHER = 'ads_store_kakao_cursor_v' // 우선업종 블록 — 신규(0부터)

/**
 * ⏱️ 회차 마감선 — 커서 저장이 루프 **뒤**에 있다. 여기서 죽으면 커서가 안 올라가고
 *   다음 회차가 같은 키워드를 또 훑는다 ⇒ **영원히 전진 0**. 통신판매 레인이 실제로 그렇게
 *   `Worker exceeded CPU time limit`(26초)로 며칠간 멈춰 있었다(2026-08-02 #927).
 *   이 레인은 키워드당 최대 10초 타임아웃이라 카카오가 느려지면 같은 벽에 닿는다 — 미리 끊는다.
 */
const RUN_DEADLINE_MS = 12_000
/** 키워드당 최대 페이지(카카오 15건/페이지). 1페이지만 보면 그 키워드의 우물이 15건에서 마르고,
 *  커서가 한 바퀴 돌아 다시 와도 **같은 15건**이라 재방문 수확이 0 이 된다. */
const MAX_PAGES = 3
/** 우선업종 블록이 가져갈 회차 몫 — 0 건에서 시작하므로 무인(1,110건)보다 앞선다. */
export const VOUCHER_SHARE = 0.7

/**
 * 🍰 회차 몫 배분 — **양쪽 다 0 이 되지 않게** 한다.
 *
 *   순진하게 `우선업종 70% → 남은 것 무인` 으로 두면 우선업종이 예산을 거의 다 쓰고(키워드당 최대
 *   3페이지) 무인이 **매 회차 0 키워드**가 된다. 그건 대표가 07-28 에 요청한 레인을 조용히 죽이는 것이다
 *   — 에러도 안 나고 커서도 안 움직여서 **아무도 모른다**(이 레포가 반복해 만난 '부재는 침묵과 다르게
 *   생겼다' 클래스). 그래서 무인 몫을 **먼저 떼고** 나머지를 우선업종에 준다.
 *
 *   예산이 최소치면 둘 다 1 키워드씩 — 느리더라도 **양쪽 커서가 전진한다**는 것이 여기서의 불변식이다.
 */
export function blockSlots(left: number, maxPages = MAX_PAGES, voucherShare = VOUCHER_SHARE): { voucher: number; unmanned: number } {
  const perKw = Math.max(1, maxPages)
  const total = Math.max(2, Math.floor(Math.max(0, left) / perKw)) // 최소 2 = 블록당 1
  const unmanned = Math.max(1, Math.round(total * (1 - voucherShare)))
  return { voucher: Math.max(1, total - unmanned), unmanned }
}

export interface StoreKakaoStats {
  last_run: string; keywords: string[]; found: number; saved: number
  cursor: number; cursor_v?: number; total_saved: number; spent: number; limit_hit: boolean
  /** 블록별 수확 — 어느 축이 실제로 돌고 있는지 한 줄로 판정하기 위해. */
  blocks?: Record<string, { kw: number; found: number }>
  stopped_by?: 'done' | 'deadline' | 'budget' | 'limit'
  elapsed_ms?: number
  diag: { configured: boolean; error?: string; sample?: unknown }
}

/** (지역 × 업태) 전량 — 회전 순회 대상. 순서 고정(커서가 의미를 유지해야 한다). */
export function buildUnmannedKeywords(trades: Array<{ kw: string; category: string }> = UNMANNED_TRADES, regions?: string[]): Array<{ q: string; region: string; category: string; trade: string }> {
  return buildGrid(trades, regions)
}

/** (지역 × 업태) 곱 — 두 블록이 **같은 함수**를 쓴다. 두 벌로 두면 한쪽만 고쳐져 조용히 갈라진다. */
function buildGrid(trades: Array<{ kw: string; category: string }>, regions: string[] = S2_REGIONS): Array<{ q: string; region: string; category: string; trade: string }> {
  const out: Array<{ q: string; region: string; category: string; trade: string }> = []
  for (const region of regions) {
    // `trade` 를 함께 들고 다닌다 — 나중에 `q` 에서 역산하면 지역명에 공백이 있는 곳('부산 해운대')에서 갈린다.
    for (const t of trades) out.push({ q: `${region} ${t.kw}`, region, category: t.category, trade: t.kw })
  }
  return out
}

/** 우선업종 그리드 — **별도 배열·별도 커서**. 무인 배열에 덧붙이면 인덱스가 통째로 밀려
 *  기존 커서가 가리키던 자리가 달라진다(일부 지역이 영영 조회되지 않는다). */
export function buildVoucherKeywords(trades: Array<{ kw: string; category: string }> = VOUCHER_TRADES, regions?: string[]): Array<{ q: string; region: string; category: string; trade: string }> {
  return buildGrid(trades, regions)
}

/**
 * 권역 이름 → 실제 지역 목록. 빈 배열/미지정 = 전국.
 * ⚠️ **순서는 `S2_REGIONS` 를 따른다** — 선택 순서로 만들면 같은 설정에서도 배열이 달라져 커서가 흔들린다.
 */
export function regionsForGroups(groups: string[]): string[] {
  if (!groups?.length) return S2_REGIONS
  const want = new Set(groups.flatMap(g => REGION_GROUPS[g] || []))
  const picked = S2_REGIONS.filter(r => want.has(r))
  return picked.length ? picked : S2_REGIONS // 아무것도 안 잡히면 전국(설정 오타로 수집이 0 이 되면 안 된다)
}

/** 카카오 문서 → StoreProspect. **받은 값만** 옮긴다(빈 값은 null — 지어내지 않는다). */
function toProspect(d: Record<string, unknown>, kwRegion: string, category: string): StoreProspect | null {
  const id = String(d.id ?? '').trim()
  const name = String(d.place_name ?? '').trim()
  if (!id || !name) return null
  const road = String(d.road_address_name ?? '').trim()
  const lot = String(d.address_name ?? '').trim()
  // 📍 지역은 **실제 소재지**에서 뽑는다 — 키워드 지역을 박으면 같은 가게가 이웃 구 키워드마다 별개 행이 된다
  //   (복합키 2번째가 지역이라 갈리면 UNIQUE 가 안 먹는다). 파트너 풀에서 같은 실수로 **중복 38.4%** 가
  //   났고 `regionFromAddress` 로 고쳤다 — 같은 함수를 그대로 쓴다(두 곳이 갈라지지 않게).
  const region = regionFromAddress(road || lot, kwRegion) || kwRegion
  return {
    opn_svc_id: 'kakao_place',            // 인허가 행(업종 슬러그)과 네임스페이스 분리
    opn_sf_team_code: region.slice(0, 20), // 복합키 2번째 — 지역
    mgt_no: id,                            // 카카오 place id = 전역 유일
    biz_name: name.slice(0, 120),
    category,
    uptae: String(d.category_name ?? '').trim().slice(0, 80) || null,
    addr_road: road || null,
    addr_lot: lot || null,
    phone: String(d.phone ?? '').trim() || null,
    contact_source: String(d.phone ?? '').trim() ? 'kakao' : null,
    local_code: null,
    region,
    // 카카오엔 영업상태/인허가일자가 없다 — 검색에 나온다는 것 자체가 영업 신호라 '01'(정상)로 본다.
    //   ⚠️ 폐업 여부는 별도 스윕(business-status)이 판정한다. 여기서 추정하지 않는다.
    trd_state: '01', trd_state_nm: '영업/정상',
    apv_perm_ymd: null, last_mod_ts: null,
    lon: Number(d.x) || null, lat: Number(d.y) || null,
  }
}

/** 1틱 — 두 블록(우선업종·무인)이 각자 커서로 회전한다. */
export async function runStoreKakaoCollect(env: Env): Promise<StoreKakaoStats> {
  const DB = env.DB
  const startedAt = Date.now()
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.KAKAO_REST_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: StoreKakaoStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as StoreKakaoStats : null } catch { prev = null }
  const persist = async (s: StoreKakaoStats) => {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  }
  const base = (n = 0): StoreKakaoStats => ({
    last_run: stamp, keywords: [], found: 0, saved: n, cursor: 0,
    total_saved: prev?.total_saved || 0, spent: 0, limit_hit: false, diag: { configured: !!key },
  })
  if (!key) { const s = base(); s.diag.error = 'NOT_CONFIGURED: KAKAO_REST_API_KEY 미설정'; await persist(s); return s }

  const readCursor = async (k: string): Promise<number> => {
    const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    const n = parseInt(raw?.value || '0', 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const cursorU = await readCursor(CURSOR_KEY)
  const cursorV = await readCursor(CURSOR_KEY_VOUCHER)

  // 🎛️ 회차 조건 — 화면에서 정한 값(서버 clamp 완료). env 는 하위호환 폴백.
  const cfg = await getStoreConfig(DB, Object.keys(REGION_GROUPS))
  const activeRegions = regionsForGroups(cfg.regions)
  const envBudget = Math.min(80, Math.max(5, parseInt(env.ADS_STORE_KAKAO_BUDGET || '', 10) || cfg.budget))
  const learnedRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('store_kakao')).first<{ value: string }>().catch(() => null)
  const learnedCap = Math.max(0, parseInt(learnedRaw?.value || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  // 다른 레인과 **같은 형태**의 예산 객체를 쓴다(가드가 이 형태를 요구한다 — 소비량 계산이 어긋나면
  //   백오프가 거꾸로 작동해 상한을 폭등시킨 전례가 있다: kakao_sweep 2026-07-28).
  const budget = { left: budgetTotal }
  budget.left -= 5 // 위 SELECT + 설정 조회분(스스로도 서브리퀘스트다)

  // 🎛️ 업태를 DB 에서 — 대표가 화면에서 켜고 끈 결과가 여기로 들어온다(store-trades 헤더의 폴백 규칙).
  //   ⚠️ 시드/조회 비용도 **같은 지갑**에서 낸다. 안 빼면 시드가 도는 회차에만 조용히 천장을 넘는다.
  budget.left -= await ensureStoreTrades(DB)
  const dbTrades = await loadActiveStoreTrades(DB)
  budget.left -= 2
  //   `null` = 시드 전/조회 실패 → 코드 상수 폴백(설정 조회 실패로 수집을 멈추지 않는다).
  //   비어 있지 않으면 DB 가 진실 — 블록이 빈 배열이면 그건 **의도적으로 끈 것**이라 폴백하지 않는다.
  const voucherTrades = dbTrades ? (dbTrades.voucher || []) : VOUCHER_TRADES
  const unmannedTrades = dbTrades ? (dbTrades.unmanned || []) : UNMANNED_TRADES
  let limitHit = false

  const rows: StoreProspect[] = []
  let saved = 0
  const used: string[] = []
  const blocks: Record<string, { kw: number; found: number }> = {}
  /** 업태별 발굴 수 — 어느 업태가 값을 만드는지 화면이 보여줄 수 있어야 끌 결정을 한다. */
  const perTrade = new Map<string, number>()
  let found = 0, sample: unknown, lastErr: string | undefined
  let stoppedBy: 'done' | 'deadline' | 'budget' | 'limit' = 'done'

  /** 저장 batch(50개당 1) 몫을 남겨둔다 — 다 캐놓고 저장에서 한도에 걸리는 게 가장 비싼 실패다. */
  const saveReserve = () => Math.ceil(rows.length / 50) + 2

  /**
   * 🏦 **중간 정산 — 완주를 전제하지 않는다** (2026-08-02 라이브 실측 후 신설).
   *
   *   이 레인은 원래 캔 것을 전부 모아 뒀다가 **맨 끝에서 한 번** 저장하고 커서를 올렸다.
   *   그러면 회차가 중간에 죽을 때 **캔 것도 전진도 통째로 사라진다** — 다음 회차가 같은 키워드를
   *   또 훑고, 또 죽으면 영원히 0 이다(#927 통신판매 레인이 실제로 그렇게 며칠 멈춰 있었다).
   *
   *   그리고 이 환경이 정확히 그렇다. 08-02 정각 하트비트 실측:
   *   ```
   *     08:01:01  ok=false  ms=3649  collect-commerce   Worker exceeded CPU time limit
   *     08:01:01  ok=false  ms=3649  maintenance?quality  〃
   *   ```
   *   부모가 3.6초에 죽는데 이 레인의 완주 시간은 `elapsed_ms 8,097` 이다. **끝까지 사는 쪽이 예외다.**
   *   자기 마감선(`RUN_DEADLINE_MS` 12초)은 부모 수명보다 길어서 아무것도 못 막는다 —
   *   마감선을 3초로 줄이면 부모가 건강한 회차의 수확까지 같이 깎는다. 그래서 마감선이 아니라
   *   **저장 시점**을 고쳤다: 무엇이 언제 죽든 **그때까지 캔 것은 남는다.**
   *
   *   💰 비용이 거의 0 인 게 이 설계의 핵심이다 — 저장 batch 는 **어차피 내야 하는** 값이고,
   *   추가분은 커서 write 1 뿐이다(batch 파편화로 가끔 +1).
   */
  const flushRows = async () => {
    if (!rows.length) return
    budget.left -= Math.ceil(rows.length / 50)
    saved += await saveProspects(DB, rows.splice(0)).catch(() => 0)
  }
  /** ⚠️ **키워드 경계에서만** 부른다 — 그 앞의 키워드는 전부 조회 완료라 커서 값이 정확하다.
   *  페이지 중간에서 올리면 안 본 페이지를 본 것으로 표시하게 된다. */
  const flushAt = async (cursorKey: string, at: number) => {
    await flushRows()
    budget.left -= 1
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(cursorKey, String(at)).run().catch(() => null)
  }
  /** 한 batch 가 찼으면 정산한다 — 더 모아 봐야 죽을 때 잃는 양만 커진다. */
  const FLUSH_ROWS = 50

  /** @param floor 이 블록이 **남겨둬야 할** 예산(뒤 블록 몫). 슬롯만 나누고 예산을 안 남기면
   *  앞 블록이 지갑을 비워 뒤 블록은 슬롯이 있어도 첫 검사에서 튕긴다 — 몫 배분이 무의미해진다. */
  const runBlock = async (
    name: string, all: Array<{ q: string; region: string; category: string; trade: string }>, cursor: number, slots: number, floor = 0,
    cursorKey?: string,
  ): Promise<number> => {
    let consumed = 0
    const stat = { kw: 0, found: 0 }
    blocks[name] = stat
    outer: for (const win of rotationWindow(all.length, cursor, slots)) {
      for (const kw of all.slice(win.offset, win.offset + win.limit)) {
        if (limitHit) { stoppedBy = 'limit'; break outer }
        if (Date.now() - startedAt > RUN_DEADLINE_MS) { stoppedBy = 'deadline'; break outer }
        if (budget.left <= saveReserve() + floor) { stoppedBy = 'budget'; break outer }
        consumed++; stat.kw++
        used.push(kw.q)
        for (let page = 1; page <= cfg.max_pages; page++) {
          if (budget.left <= saveReserve() + floor) { stoppedBy = 'budget'; break outer }
          budget.left -= 1
          let res: Response | null = null
          try {
            res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw.q)}&size=15&page=${page}`,
              { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) })
          } catch (err) {
            const m = (err as { message?: string } | null)?.message
            if (isSubrequestLimitError(m)) { limitHit = true; stoppedBy = 'limit'; break outer } // 우리 한도 — 이 페이지는 조회된 적 없다
            lastErr = `네트워크 오류: ${String(m || '').slice(0, 60)}`
            break // 이 키워드는 접고 다음으로
          }
          if (!res.ok) { lastErr = `HTTP ${res.status}`; break } // 상대 오류는 삼키지 않고 남긴다
          const data = await res.json().catch(() => null) as { documents?: Array<Record<string, unknown>>; meta?: { is_end?: boolean } } | null
          const docs = data?.documents || []
          if (!sample && docs[0]) sample = docs[0]
          for (const d of docs) {
            const p = toProspect(d, kw.region, kw.category)
            if (p) { rows.push(p); found++; stat.found++; perTrade.set(kw.trade, (perTrade.get(kw.trade) || 0) + 1) }
          }
          if (data?.meta?.is_end || docs.length < 15) break // 우물이 말랐다
        }
        // 🏦 키워드 하나가 끝난 지점 = 커서를 정확히 말할 수 있는 유일한 자리. 여기서 정산한다.
        if (cursorKey && rows.length >= FLUSH_ROWS) await flushAt(cursorKey, (cursor + consumed) % Math.max(1, all.length))
      }
    }
    return (cursor + consumed) % Math.max(1, all.length)
  }

  // 몫을 **먼저 나눈다** — 앞 블록이 다 쓰고 뒤가 0 이 되는 걸 막는다(위 blockSlots 주석).
  const slots = blockSlots(budget.left, cfg.max_pages, cfg.voucher_share)
  // 우선업종 먼저 — 0 건에서 시작하는 쪽이 앞선다. 다만 무인 몫은 이미 떼어 놨다.
  const nextV = voucherTrades.length ? await runBlock('voucher', buildVoucherKeywords(voucherTrades, activeRegions), cursorV, slots.voucher, slots.unmanned * cfg.max_pages, CURSOR_KEY_VOUCHER) : cursorV
  // 🏦 블록 경계 정산 — 뒤 블록에서 죽어도 앞 블록의 수확·전진이 남는다.
  if (voucherTrades.length) await flushAt(CURSOR_KEY_VOUCHER, nextV)
  const nextU = unmannedTrades.length ? await runBlock('unmanned', buildUnmannedKeywords(unmannedTrades, activeRegions), cursorU, slots.unmanned, 0, CURSOR_KEY) : cursorU

  // 남은 꼬리 — 저장은 saveProspects 가 50개씩 batch, 그 횟수만큼 예산에서 지불한다.
  await flushRows()

  // 업태별 누적 — 저장수는 업태별로 분해할 수 없다(upsert 가 전체 단위로 돈다). 발굴 비율로 배분하고,
  //   그 사실을 컬럼 의미에 남긴다(정확한 수인 척하지 않는다).
  if (perTrade.size) {
    const totalFound = [...perTrade.values()].reduce((a, b) => a + b, 0) || 1
    await bumpStoreTradeStats(DB, new Map([...perTrade].map(([k, f]) => [k, { found: f, saved: Math.round((saved * f) / totalFound) }])))
    budget.left -= 1
  }

  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextU)).run().catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY_VOUCHER, String(nextV)).run().catch(() => null)
  const nextCap = nextSubreqCap(budgetTotal - budget.left, limitHit, learnedCap, envBudget, pcap)
  if (nextCap != null) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(subreqCapKey('store_kakao'), String(nextCap)).run().catch(() => null)
  }
  const s: StoreKakaoStats = {
    last_run: stamp, keywords: used.slice(0, 12), found, saved, cursor: nextU, cursor_v: nextV,
    total_saved: (prev?.total_saved || 0) + saved, spent: budgetTotal - budget.left, limit_hit: limitHit,
    blocks, stopped_by: stoppedBy, elapsed_ms: Date.now() - startedAt,
    diag: { configured: true, error: limitHit ? '⛔ 플랫폼 요청한도 도달 — 남은 키워드는 커서가 다음 라운드에 이어받음' : lastErr, sample },
  }
  await persist(s)
  return s
}
