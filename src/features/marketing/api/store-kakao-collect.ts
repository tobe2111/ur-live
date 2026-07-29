/**
 * 🏪 무인매장 후보 수집 — 카카오 로컬 **키워드 검색** (2026-07-28 대표 요청 "아이스크림 할인점, 무인판매점").
 *
 *   왜 인허가(LOCALDATA)가 아니라 카카오인가:
 *     ① 무인 아이스크림 할인점·무인판매점은 인허가 업종 분류가 갈린다(식품소분·즉석판매제조가공·자동판매기…).
 *        어느 엔드포인트에 들어있는지 **확인할 방법이 이 환경에 없다**(apis.data.go.kr CONNECT 차단).
 *        추측으로 슬러그를 넣는 건 개발 룰 #1 위반이다.
 *     ② 인허가 레인은 지금 `found: 0` 이라 살아있는지도 불명이다(진단은 public-data-diag 로 별도 배선).
 *     ③ **카카오 로컬은 이미 검증된 경로**다 — 같은 API(`/v2/local/search/keyword.json`)를 연락처 보강이
 *        매일 쓰고 있고, 응답에 **전화번호가 들어있다**(네이버 지역검색은 전화가 빈값이다).
 *        전화가 붙은 채로 들어오면 그 순간 접촉 가능한 리드가 된다.
 *
 *   구조: (지역 235 × 업태 N) 키워드를 커서로 회전 순회 → 카카오 키워드 검색 → `store_prospects` upsert.
 *   복합키는 `opn_svc_id='kakao_place'` + `opn_sf_team_code=지역` + `mgt_no=카카오 place id` (인허가 행과 충돌 0).
 *
 *   ⚠️ 허위 0 — 카카오가 준 값(상호/주소/전화)만 저장한다. 추정하지 않는다.
 *   ⚠️ 서브리퀘스트: 학습 상한(`store_kakao` 레인 키) 안에서만. D1 쓰기도 같은 지갑에서 지불한다.
 *   게이트 `ADS_STORE_KAKAO_ENABLED`(기본 OFF).
 */
import type { Env } from '@/worker/types/env'
import { S2_REGIONS, rotationWindow } from './company-keyword-grid'
import { saveProspects, type StoreProspect } from './store-prospects'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, platformSubreqCap } from './collect-budget'

/** 무인매장 업태 — 대표 요청분. 카테고리는 `store_prospects.category` 표시값이 된다. */
export const UNMANNED_TRADES: Array<{ kw: string; category: string }> = [
  { kw: '무인 아이스크림 할인점', category: '무인아이스크림' },
  { kw: '아이스크림 할인점', category: '무인아이스크림' },
  { kw: '무인판매점', category: '무인판매점' },
  { kw: '무인점포', category: '무인판매점' },
]

const STATS_KEY = 'ads_store_kakao_stats'
const CURSOR_KEY = 'ads_store_kakao_cursor'

export interface StoreKakaoStats {
  last_run: string; keywords: string[]; found: number; saved: number
  cursor: number; total_saved: number; spent: number; limit_hit: boolean
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

/** 카카오 문서 → StoreProspect. **받은 값만** 옮긴다(빈 값은 null — 지어내지 않는다). */
function toProspect(d: Record<string, unknown>, region: string, category: string): StoreProspect | null {
  const id = String(d.id ?? '').trim()
  const name = String(d.place_name ?? '').trim()
  if (!id || !name) return null
  const road = String(d.road_address_name ?? '').trim()
  const lot = String(d.address_name ?? '').trim()
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
    local_code: null,
    region,
    // 카카오엔 영업상태/인허가일자가 없다 — 검색에 나온다는 것 자체가 영업 신호라 '01'(정상)로 본다.
    //   ⚠️ 폐업 여부는 별도 스윕(business-status)이 판정한다. 여기서 추정하지 않는다.
    trd_state: '01', trd_state_nm: '영업/정상',
    apv_perm_ymd: null, last_mod_ts: null,
    lon: Number(d.x) || null, lat: Number(d.y) || null,
  }
}

/** 1틱 — 커서가 가리키는 키워드 묶음만 조회한다. */
export async function runStoreKakaoCollect(env: Env): Promise<StoreKakaoStats> {
  const DB = env.DB
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

  const all = buildUnmannedKeywords()
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRaw?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0

  const envBudget = Math.min(80, Math.max(5, parseInt(env.ADS_STORE_KAKAO_BUDGET || '', 10) || 30))
  const learnedRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('store_kakao')).first<{ value: string }>().catch(() => null)
  const learnedCap = Math.max(0, parseInt(learnedRaw?.value || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  // 다른 레인과 **같은 형태**의 예산 객체를 쓴다(가드가 이 형태를 요구한다 — 소비량 계산이 어긋나면
  //   백오프가 거꾸로 작동해 상한을 폭등시킨 전례가 있다: kakao_sweep 2026-07-28).
  const budget = { left: budgetTotal }
  budget.left -= 3 // 위 SELECT 3회분(스스로도 서브리퀘스트다)
  let limitHit = false

  // 한 라운드에 볼 키워드 수 — 남은 예산의 절반(나머지는 저장 batch 몫).
  const batchKw = Math.max(1, Math.floor(budget.left / 2))
  const rows: StoreProspect[] = []
  const used: string[] = []
  let found = 0, sample: unknown, lastErr: string | undefined
  let consumed = 0

  outer: for (const win of rotationWindow(all.length, cursor, batchKw)) {
    for (const kw of all.slice(win.offset, win.offset + win.limit)) {
      if (budget.left <= 2 || limitHit) break outer
      budget.left -= 1; consumed++
      used.push(kw.q)
      let res: Response | null = null
      try {
        res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw.q)}&size=15`,
          { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) })
      } catch (err) {
        const m = (err as { message?: string } | null)?.message
        if (isSubrequestLimitError(m)) { limitHit = true; break outer } // 우리 한도 — 이 키워드는 조회된 적 없다
        lastErr = `네트워크 오류: ${String(m || '').slice(0, 60)}`
        continue
      }
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue } // 상대 오류는 삼키지 않고 남긴다
      const data = await res.json().catch(() => null) as { documents?: Array<Record<string, unknown>> } | null
      const docs = data?.documents || []
      if (!sample && docs[0]) sample = docs[0]
      for (const d of docs) {
        const p = toProspect(d, kw.region, kw.category)
        if (p) { rows.push(p); found++ }
      }
    }
  }

  // 저장은 saveProspects 가 50개씩 batch — 우리가 예산에서 그 횟수만큼 지불한다.
  const chunks = Math.ceil(rows.length / 50)
  budget.left -= chunks
  const saved = rows.length ? await saveProspects(DB, rows).catch(() => 0) : 0

  const nextCursor = (cursor + consumed) % Math.max(1, all.length)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  const nextCap = nextSubreqCap(budgetTotal - budget.left, limitHit, learnedCap, envBudget, pcap)
  if (nextCap != null) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(subreqCapKey('store_kakao'), String(nextCap)).run().catch(() => null)
  }
  const s: StoreKakaoStats = {
    last_run: stamp, keywords: used.slice(0, 12), found, saved, cursor: nextCursor,
    total_saved: (prev?.total_saved || 0) + saved, spent: budgetTotal - budget.left, limit_hit: limitHit,
    diag: { configured: true, error: limitHit ? '⛔ 플랫폼 요청한도 도달 — 남은 키워드는 커서가 다음 라운드에 이어받음' : lastErr, sample },
  }
  await persist(s)
  return s
}
