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
import { S2_REGIONS, rotationWindow } from './company-keyword-grid'
import { regionFromAddress } from './company-collect'
import { saveProspects, type StoreProspect } from './store-prospects'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, envSubreqCap } from './collect-budget'

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
export function buildUnmannedKeywords(): Array<{ q: string; region: string; category: string }> {
  const out: Array<{ q: string; region: string; category: string }> = []
  for (const region of S2_REGIONS) {
    for (const t of UNMANNED_TRADES) out.push({ q: `${region} ${t.kw}`, region, category: t.category })
  }
  return out
}

/** 우선업종 그리드 — **별도 배열·별도 커서**. 무인 배열에 덧붙이면 인덱스가 통째로 밀려
 *  기존 커서가 가리키던 자리가 달라진다(일부 지역이 영영 조회되지 않는다). */
export function buildVoucherKeywords(): Array<{ q: string; region: string; category: string }> {
  const out: Array<{ q: string; region: string; category: string }> = []
  for (const region of S2_REGIONS) {
    for (const t of VOUCHER_TRADES) out.push({ q: `${region} ${t.kw}`, region, category: t.category })
  }
  return out
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

  const envBudget = Math.min(80, Math.max(5, parseInt(env.ADS_STORE_KAKAO_BUDGET || '', 10) || 30))
  const learnedRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('store_kakao')).first<{ value: string }>().catch(() => null)
  const learnedCap = Math.max(0, parseInt(learnedRaw?.value || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  // 다른 레인과 **같은 형태**의 예산 객체를 쓴다(가드가 이 형태를 요구한다 — 소비량 계산이 어긋나면
  //   백오프가 거꾸로 작동해 상한을 폭등시킨 전례가 있다: kakao_sweep 2026-07-28).
  const budget = { left: budgetTotal }
  budget.left -= 4 // 위 SELECT 4회분(스스로도 서브리퀘스트다)
  let limitHit = false

  const rows: StoreProspect[] = []
  const used: string[] = []
  const blocks: Record<string, { kw: number; found: number }> = {}
  let found = 0, sample: unknown, lastErr: string | undefined
  let stoppedBy: 'done' | 'deadline' | 'budget' | 'limit' = 'done'

  /** 저장 batch(50개당 1) 몫을 남겨둔다 — 다 캐놓고 저장에서 한도에 걸리는 게 가장 비싼 실패다. */
  const saveReserve = () => Math.ceil(rows.length / 50) + 2

  /** @param floor 이 블록이 **남겨둬야 할** 예산(뒤 블록 몫). 슬롯만 나누고 예산을 안 남기면
   *  앞 블록이 지갑을 비워 뒤 블록은 슬롯이 있어도 첫 검사에서 튕긴다 — 몫 배분이 무의미해진다. */
  const runBlock = async (
    name: string, all: Array<{ q: string; region: string; category: string }>, cursor: number, slots: number, floor = 0,
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
        for (let page = 1; page <= MAX_PAGES; page++) {
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
            if (p) { rows.push(p); found++; stat.found++ }
          }
          if (data?.meta?.is_end || docs.length < 15) break // 우물이 말랐다
        }
      }
    }
    return (cursor + consumed) % Math.max(1, all.length)
  }

  // 몫을 **먼저 나눈다** — 앞 블록이 다 쓰고 뒤가 0 이 되는 걸 막는다(위 blockSlots 주석).
  const slots = blockSlots(budget.left)
  // 우선업종 먼저 — 0 건에서 시작하는 쪽이 앞선다. 다만 무인 몫은 이미 떼어 놨다.
  const nextV = await runBlock('voucher', buildVoucherKeywords(), cursorV, slots.voucher, slots.unmanned * MAX_PAGES)
  const nextU = await runBlock('unmanned', buildUnmannedKeywords(), cursorU, slots.unmanned)

  // 저장은 saveProspects 가 50개씩 batch — 우리가 예산에서 그 횟수만큼 지불한다.
  budget.left -= Math.ceil(rows.length / 50)
  const saved = rows.length ? await saveProspects(DB, rows).catch(() => 0) : 0

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
