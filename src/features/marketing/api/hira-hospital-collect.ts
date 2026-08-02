/**
 * 🏥 매장 후보 수집 — 심평원 병원정보서비스 (data.go.kr B551182/hospInfoServicev2) — 2026-07-27.
 *   전국 병·의원 전수: 기관명·종별(의원/치과/한의원…)·주소·**전화(telno)** 에 더해 **홈페이지(hospUrl)를 직접**
 *   제공 — 인허가 병원보다 연락처가 풍부(홈페이지 → 이메일 크롤 관문 공짜 확보). → `store_prospects`
 *   (opn_svc_id='hira_hospital', mgt_no = ykiho 해시 접두 — 암호화 요양기호가 길어 60자 키로 축약).
 *
 *   ⚠️ 응답 포맷 XML(활용신청 화면 명시) — `_type=json` 시도 후 실패하면 XML 을 경량 파서로 처리(양대응).
 *   키 `PUBLIC_DATA_SERVICE_KEY`. 게이트 `ADS_HIRA_ENABLED`(매시간 소량 청크 — 전국 ~10만 기관을 며칠에 순회).
 *   수동 트리거 게이트 무관. ⚠️ 수집 ≠ 발송 — 공개 요양기관 현황만. SSOT: partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { envLaneBudget , envPlanValue} from './collect-budget'
import { ensureProspectSchema, saveProspects, type StoreProspect } from './store-prospects'
import { serviceKeyParam } from './public-data-diag'

const HIRA_BASE = 'https://apis.data.go.kr/B551182/hospInfoServicev2'
const HIRA_OP = 'getHospBasisList'
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawH = Record<string, string>
const fnv = (s: string): string => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16) }

/** XML `<item>…</item>` 경량 파싱(Workers 에 DOMParser 없음) — `<tag>값</tag>` 쌍 추출. JSON 응답이면 그대로.
 *  data.go.kr 표준 봉투 공용 — 국민연금(nps-workplace-enrich)도 재사용(export). */
export function parseItems(text: string): { items: RawH[]; msg?: string } {
  const t = text.trim()
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>
      const resp = (j.response ?? j) as Record<string, unknown>
      const header = resp.header as Record<string, unknown> | undefined
      const rc = header ? String(header.resultCode ?? '') : ''
      const rm = header ? String(header.resultMsg ?? '') : ''
      const body = (resp.body ?? j) as Record<string, unknown>
      let items = (body?.items ?? []) as unknown
      if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
      const arr = (Array.isArray(items) ? items : items ? [items] : []) as Record<string, unknown>[]
      const msg = rc && rc !== '00' ? `${rc} ${rm}`.trim() : undefined
      return { items: arr.map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stripTag(v)]))), msg }
    } catch { return { items: [], msg: 'JSON 파싱 실패' } }
  }
  // XML 경로 — resultCode 회수 + item 블록별 태그 추출.
  const rc = t.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1]?.trim() || ''
  const rm = t.match(/<resultMsg>([^<]*)<\/resultMsg>/)?.[1]?.trim() || ''
  const items: RawH[] = []
  const blocks = t.split(/<item>/).slice(1)
  for (const b of blocks) {
    const chunk = b.split('</item>')[0]
    const o: RawH = {}
    for (const m of chunk.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) o[m[1]] = stripTag(m[2])
    if (Object.keys(o).length) items.push(o)
  }
  const msg = rc && rc !== '00' ? `${rc} ${rm}`.trim() : (!blocks.length && rm ? rm : undefined)
  return { items, msg }
}

function toProspect(it: RawH): StoreProspect {
  const ykiho = it.ykiho || ''
  const addr = it.addr || ''
  const regionM = addr.match(/([가-힣]+?)(시|군|구)\s/)
  const url = (it.hospUrl || '').trim()
  return {
    opn_svc_id: 'hira_hospital',
    opn_sf_team_code: it.sidoCd || it.sidoCdNm || 'HIRA',
    mgt_no: ykiho ? `${fnv(ykiho)}:${ykiho.slice(0, 40)}` : '', // 60자 내 결정적 축약(해시+접두)
    biz_name: it.yadmNm || '',
    category: '병원',
    uptae: it.clCdNm || null, // 종별(의원/치과의원/한의원/병원…)
    addr_road: addr || null, addr_lot: null,
    phone: (it.telno || '').trim() || null,
    website: url && /^https?:\/\//i.test(url) ? url : (url ? `http://${url}` : null), // ⭐ 홈페이지 직접 제공 → 이메일 크롤 관문
    local_code: it.sgguCd || null,
    region: (regionM?.[1] || it.sgguCdNm || '').replace(/특별|광역|자치/g, '').slice(0, 20) || null,
    trd_state: '01', trd_state_nm: '운영(요양기관 현황)', // 현황 목록 = 운영 중 기관
    apv_perm_ymd: (it.estbDd || '').replace(/\D/g, '').slice(0, 8) || null,
    last_mod_ts: null, lon: Number(it.XPos) || null, lat: Number(it.YPos) || null,
  }
}

export interface HiraStats { last_run: string; page: number; found: number; saved: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown; retry?: string } }
const STATS_KEY = 'ads_hira_stats'
const CURSOR_KEY = 'ads_hira_cursor'

/** 병원 1틱(매시간 크론 소량 또는 수동). 전국 목록을 페이지 커서 순환 — 소진 시 1페이지부터 재순환(갱신). */
export async function runHiraHospitalCollect(env: Env, maxPagesArg?: number): Promise<HiraStats> {
  // 🎚️ 회차당 일감도 **요금제를 따른다** — 예산만 커지고 이 숫자가 고정이면 늘어난 예산이 남는다.
  //   호출부가 명시로 넘기면 그 값이 이긴다(수동 트리거·테스트가 그렇게 쓴다).
  const maxPages = maxPagesArg ?? envPlanValue(undefined, 3, 12, env)
  const DB = env.DB
  await ensureProspectSchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const todayYmd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: HiraStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as HiraStats : null } catch { prev = null }
  const persist = async (s: HiraStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: HiraStats = { last_run: stamp, page: 0, found: 0, saved: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1

  let found = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  let retried = false, retryNote: string | undefined
  for (let i = 0; i < Math.max(1, maxPages); i++) {
    // 🩹 2026-07-28 실측 수리: `numOfRows=500` 으로 **42회 실행 전부 타임아웃**(total_saved 0).
    //   심평원 병원목록은 페이지가 크면 응답이 느리다 — 한 번도 성공한 적이 없으니 크기를 줄이는 것이 맞다.
    //   env 로 조정 가능(무배포): 성공하면 올리고, 여전히 타임아웃이면 더 줄인다. 판정은 stats.diag.error 로.
    const numRows = Math.min(500, Math.max(20, parseInt((env as unknown as { ADS_HIRA_ROWS?: string }).ADS_HIRA_ROWS || '', 10) || 100))
    // ⚠️ 2026-07-28 수리: `.catch(() => null)` 이 예외 원문을 버려 32회 연속 실패가 전부 '네트워크 오류'
    //   한 줄로 뭉개졌다 — 서브리퀘스트 한도인지 실제 네트워크 장애인지 구분 불가(오진의 원인).
    const shoot = async (rows: number, ms: number): Promise<{ res: Response | null; msg: string }> => {
      const u = `${HIRA_BASE}/${HIRA_OP}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=${rows}&_type=json`
      try { return { res: await fetch(u, { signal: AbortSignal.timeout(ms) }), msg: '' } } catch (err) {
        const m = err instanceof Error ? err.message : String(err || '')
        if (/too many subrequests/i.test(m)) return { res: null, msg: '⛔ 플랫폼 요청한도 도달 — maxPages 를 줄일 것' }
        return { res: null, msg: m ? `네트워크 오류: ${m.slice(0, 80)}` : '네트워크 오류' }
      }
    }
    let { res, msg: netMsg } = await shoot(numRows, 25000)
    /**
     * 🔬 **재시도를 실험으로 쓴다** (2026-08-03 — 60회 연속 timeout 의 원인을 라이브가 스스로 가르게).
     *
     *   이 레인은 `page=1 · rows=100` 에서 **60회 전부** `AbortSignal.timeout(25000)` 로 죽었다.
     *   그런데 **프로브는 같은 워커·같은 키·같은 주소로 `rows 1~500` 전부 즉답 200** 이었다
     *   (다른 점은 시각뿐 — 레인은 매시 :00, 프로브는 비정각).
     *   그리고 같은 :00 에 같은 게이트웨이를 때리는 `commerce`(누적 130,795건)·`storeinfo`(14,271건)는
     *   **성공한다** ⇒ "정각엔 게이트웨이가 바쁘다" 만으로는 설명이 안 된다.
     *
     *   ⚠️ **이 재시도는 원인을 단정하지 않는다.** 어느 원인이든 손해가 없고(실패해도 지금과 동일),
     *   결과가 `diag.retry` 에 남아 **다음 세션이 원인을 가른다**:
     *     · 작은 페이지로 성공  → 페이지 크기/응답량 문제 (`ADS_HIRA_ROWS` 를 내리면 무배포로 해결)
     *     · 작은 페이지도 실패  → 페이지 크기 **무관** (동시성·외부 요인 — 회차 분산을 봐야 한다)
     *
     *   회차당 **1회만** — 예산(무료 서브리퀘스트 천장)과 벽시계를 둘 다 묶어 둔다.
     */
    if (!res && !retried && /timeout|abort/i.test(netMsg)) {
      retried = true
      const small = Math.max(20, Math.floor(numRows / 5))
      const r2 = await shoot(small, 8000)
      retryNote = r2.res
        ? `rows=${numRows}→${small} 재시도 성공 ⇒ 페이지 크기 문제(ADS_HIRA_ROWS 를 내릴 것)`
        : `rows=${numRows}→${small} 재시도도 실패 ⇒ 페이지 크기 무관(동시성·외부 요인)`
      if (r2.res) { res = r2.res; netMsg = '' }
    }
    if (!res || !res.ok) { lastMsg = res ? `HTTP ${res.status}` : netMsg; break }
    const text = await res.text().catch(() => '')
    const { items, msg } = parseItems(text)
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    if (!items.length) { page = 1; break } // 전국 목록 소진 → 처음부터 재순환(갱신 스윕)
    const rows = items.map(toProspect).filter(r => r.mgt_no && r.biz_name)
    found += rows.length
    saved += await saveProspects(DB, rows, todayYmd).catch(() => 0)
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  const error = found === 0 && lastMsg ? `API: ${lastMsg}` : undefined
  const s: HiraStats = { last_run: stamp, page, found, saved, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample, retry: retryNote } }
  await persist(s)
  return s
}
