/**
 * 🏪 매장 후보(store_prospects) — 유어딜 입점 대상 *매장* 발굴 트랙 (2026-07-22).
 *   소스: **지방행정 인허가정보**(공공데이터포털, localdata.go.kr 폐쇄 후 이관). 파트너(업체) 리드와 **별개 엔티티**
 *   — `ad_company_leads`(업체를 *데려올*) vs `store_prospects`(매장을 *입점시킬*). 한쪽 쿼리가 반대쪽 무접촉.
 *
 *   3용도: ⓐ 매장 발굴(요식·미용·숙박 전수) ⓑ 신규 개업 감지(최근 인허가 = 입점 전환율 최고) ⓒ 폐업 자동 정리.
 *   복합키 UNIQUE(opn_svc_id, opn_sf_team_code, mgt_no) — 인허가 표준 식별자(대표 스펙).
 *   영업상태구분: 01 영업중 / 02 휴업 / 03 폐업 / 04 취소·말소·만료·정지 → active=01만 1.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 *   ⚠️ 수집 ≠ 발송 — 공개 인허가 정보만. 자동 발송 경로 부존재.
 */
import type { Env } from '@/worker/types/env'

/**
 * 인허가 업종 ↔ REST 엔드포인트 슬러그(SSOT). 지방행정 인허가는 **업종별 개별 엔드포인트**다(단일 아님):
 *   `https://apis.data.go.kr/1741000/<slug>`. 응답 필드는 localdata 표준 소문자(bplcnm/sitetel/…).
 *   현재 승인 2종만 코드에 고정 — 미용업·숙박업은 활성화 후 슬러그 확정 시 여기 추가(또는 무배포로
 *   `ADS_LOCALDATA_ENDPOINTS` env JSON 병합). localdata-collect.ts 가 이 맵을 endpoint→category 로 순회.
 */
export const LICENSE_UPJONG: Record<string, string> = {
  general_restaurants: '일반음식점',       // 행정안전부_식품_일반음식점 조회서비스 (승인)
  rest_cafes: '휴게음식점',                // 행정안전부_식품_휴게음식점 조회서비스 (승인)
  beauty_salons: '미용업',                 // 행정안전부_생활_미용업 조회서비스 (승인)
  tourist_accommodations: '숙박업',        // 행정안전부_문화_관광숙박업 조회서비스 (승인)
  pet_grooming: '동물미용업',              // 행정안전부_동물_동물미용업 조회서비스 (승인)
  pharmacies: '약국',                      // 행정안전부_건강_약국 조회서비스 (승인 2026-07-27)
  hospitals: '병원',                       // 행정안전부_건강_병원 조회서비스 (승인 2026-07-27)
  barber_shops: '이용업',                  // 행정안전부_생활_이용업 조회서비스 (승인 2026-07-27)
  public_baths: '목욕장업',                // 행정안전부_생활_목욕장업 조회서비스 (승인 2026-07-27)
  animal_hospitals: '동물병원',            // 행정안전부_동물_동물병원 조회서비스 (승인 2026-07-27)
  animal_pharmacies: '동물약국',           // 행정안전부_동물_동물약국 조회서비스 (승인 2026-07-27)
}
/** 필터 드롭다운 표시용 카테고리(수집 업종). */
export const LICENSE_CATEGORIES = ['일반음식점', '휴게음식점', '미용업', '숙박업', '동물미용업', '약국', '병원', '이용업', '목욕장업', '동물병원', '동물약국']
export const PROSPECT_STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected', 'hold']
export const PROSPECT_CONTACT_CHANNELS = ['call', 'visit', 'sms', 'kakao', 'other']

export interface StoreProspect {
  opn_svc_id: string; opn_sf_team_code: string; mgt_no: string  // 복합키
  biz_name: string
  category?: string | null           // 업종(일반음식점 등)
  uptae?: string | null              // 업태명(세부)
  addr_road?: string | null; addr_lot?: string | null
  phone?: string | null
  email?: string | null              // 인허가엔 없음 — 보강(홈페이지 크롤)으로만 채움
  website?: string | null            // 보강(네이버 지역검색 link)으로 발견한 매장 홈페이지
  contact_source?: string | null     // 연락처 출처(govreg/kakao/naver/homepage) — 허위 방지 투명성
  local_code?: string | null         // 자치단체코드(지역 필터 키)
  region?: string | null             // 자치단체코드/주소에서 유도
  trd_state?: string | null          // 영업상태구분코드 01~04
  trd_state_nm?: string | null
  apv_perm_ymd?: string | null       // 인허가일자(YYYYMMDD) — 개업 감지
  last_mod_ts?: string | null        // 최종수정시각(변동분 커서)
  lon?: number | null; lat?: number | null
}

export interface StoreProspectRow extends StoreProspect {
  id: number; status: string; active: number; is_new_open: number
  memo: string | null; contact_channel: string | null; follow_up_at: string | null
  collected_at: string; last_verified_at: string | null
}

const SELECT_COLS = 'id, opn_svc_id, opn_sf_team_code, mgt_no, biz_name, category, uptae, addr_road, addr_lot, phone, email, website, contact_source, local_code, region, trd_state, trd_state_nm, apv_perm_ymd, last_mod_ts, lon, lat, status, active, is_new_open, memo, contact_channel, follow_up_at, collected_at, last_verified_at'

const _schemaDone = new WeakSet<object>()
export async function ensureProspectSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS store_prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opn_svc_id TEXT NOT NULL,
    opn_sf_team_code TEXT NOT NULL,
    mgt_no TEXT NOT NULL,
    biz_name TEXT NOT NULL,
    category TEXT,
    uptae TEXT,
    addr_road TEXT,
    addr_lot TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    contact_source TEXT,
    local_code TEXT,
    region TEXT,
    trd_state TEXT,
    trd_state_nm TEXT,
    apv_perm_ymd TEXT,
    last_mod_ts TEXT,
    lon REAL,
    lat REAL,
    status TEXT NOT NULL DEFAULT 'new',
    active INTEGER NOT NULL DEFAULT 1,
    is_new_open INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    contact_channel TEXT,
    follow_up_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    last_verified_at DATETIME,
    UNIQUE(opn_svc_id, opn_sf_team_code, mgt_no)
  )`).run().catch(() => null)
  // 기존 테이블 보강(연락처 확장 — 인허가엔 없어 크롤로만 채움).
  await DB.prepare('ALTER TABLE store_prospects ADD COLUMN email TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE store_prospects ADD COLUMN website TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE store_prospects ADD COLUMN contact_source TEXT').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_prospects_region ON store_prospects(region, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_prospects_active ON store_prospects(active, category, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_prospects_newopen ON store_prospects(is_new_open, apv_perm_ymd)').run().catch(() => null)
}

/** 영업상태구분코드 → active(01 영업중만 1). */
export const isOperating = (trdState?: string | null): boolean => String(trdState || '').trim() === '01'

/** 인허가일자(YYYYMMDD)가 N일 이내면 신규 개업. today = YYYYMMDD 문자열(호출부 주입 — Date 비결정 회피). */
export function isNewOpen(apvPermYmd?: string | null, todayYmd?: string, withinDays = 30): boolean {
  const ymd = String(apvPermYmd || '').replace(/\D/g, '').slice(0, 8)
  if (ymd.length !== 8 || !todayYmd || todayYmd.length !== 8) return false
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))
  const diff = (d(todayYmd) - d(ymd)) / 86400000
  return diff >= 0 && diff <= withinDays
}

/** 멱등 upsert(복합키) — 인허가 변동분 재수신 시 상태/주소/전화 갱신 + active/개업 재계산. todayYmd 주입. */
export async function saveProspects(DB: D1Database, rows: StoreProspect[], todayYmd?: string): Promise<number> {
  if (!rows.length) return 0
  await ensureProspectSchema(DB)
  const clamp = (v: unknown, n: number): string | null => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null }
  const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null }
  const valid = rows.filter(r => r.opn_svc_id && r.opn_sf_team_code && r.mgt_no && (r.biz_name || '').trim().length >= 1)
  if (!valid.length) return 0
  const CHUNK = 50
  let saved = 0
  for (let i = 0; i < valid.length; i += CHUNK) {
    const slice = valid.slice(i, i + CHUNK)
    const stmts = slice.map(r => {
      const active = isOperating(r.trd_state) ? 1 : 0
      const newOpen = active && isNewOpen(r.apv_perm_ymd, todayYmd) ? 1 : 0
      const phone = clamp(r.phone, 40)
      return DB.prepare(
        `INSERT INTO store_prospects (opn_svc_id, opn_sf_team_code, mgt_no, biz_name, category, uptae, addr_road, addr_lot, phone, contact_source, local_code, region, trd_state, trd_state_nm, apv_perm_ymd, last_mod_ts, lon, lat, active, is_new_open, last_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(opn_svc_id, opn_sf_team_code, mgt_no) DO UPDATE SET
           biz_name = excluded.biz_name,
           addr_road = COALESCE(excluded.addr_road, store_prospects.addr_road),
           addr_lot = COALESCE(excluded.addr_lot, store_prospects.addr_lot),
           phone = COALESCE(excluded.phone, store_prospects.phone),
           contact_source = COALESCE(store_prospects.contact_source, excluded.contact_source),
           region = COALESCE(excluded.region, store_prospects.region),
           trd_state = excluded.trd_state,
           trd_state_nm = excluded.trd_state_nm,
           last_mod_ts = excluded.last_mod_ts,
           active = excluded.active,
           is_new_open = excluded.is_new_open,
           last_verified_at = datetime('now')`
      ).bind(
        clamp(r.opn_svc_id, 40), clamp(r.opn_sf_team_code, 40), clamp(r.mgt_no, 60), (r.biz_name || '').slice(0, 120),
        clamp(r.category, 40), clamp(r.uptae, 60), clamp(r.addr_road, 300), clamp(r.addr_lot, 300), phone, phone ? 'govreg' : null,
        clamp(r.local_code, 20), clamp(r.region, 60), clamp(r.trd_state, 4), clamp(r.trd_state_nm, 40),
        clamp(r.apv_perm_ymd, 8), clamp(r.last_mod_ts, 20), num(r.lon), num(r.lat), active, newOpen,
      )
    })
    const res = await DB.batch(stmts).catch(() => null)
    if (res) saved += slice.length
  }
  return saved
}

/* ── 목록/통계/큐레이션 ─────────────────────────────────────────────────────── */
export async function listProspects(DB: D1Database, filter: {
  category?: string; region?: string; status?: string; newOpenOnly?: boolean; includeClosed?: boolean; hasPhone?: boolean; hasEmail?: boolean; q?: string; limit?: number
} = {}): Promise<StoreProspectRow[]> {
  await ensureProspectSchema(DB)
  const where: string[] = ['1=1']; const binds: (string | number)[] = []
  if (!filter.includeClosed) where.push('active = 1')            // 기본: 영업중만(폐업 숨김)
  if (filter.newOpenOnly) where.push('is_new_open = 1')
  if (filter.category) { where.push('category = ?'); binds.push(filter.category) }
  if (filter.region) { where.push('region LIKE ?'); binds.push(`%${filter.region}%`) }
  if (filter.status && PROSPECT_STATUSES.includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasPhone) where.push("(phone IS NOT NULL AND phone != '')")
  if (filter.hasEmail) where.push("(email IS NOT NULL AND email != '')")
  if (filter.q) { where.push('(LOWER(biz_name) LIKE ? OR COALESCE(region,\'\') LIKE ? OR COALESCE(phone,\'\') LIKE ?)'); const l = `%${filter.q.toLowerCase()}%`; binds.push(l, `%${filter.q}%`, `%${filter.q}%`) }
  const limit = Math.min(2000, Math.max(1, filter.limit || 500))
  const r = await DB.prepare(`SELECT ${SELECT_COLS} FROM store_prospects WHERE ${where.join(' AND ')}
     ORDER BY is_new_open DESC, apv_perm_ymd DESC, id DESC LIMIT ?`).bind(...binds, limit).all<StoreProspectRow>().catch(() => null)
  return r?.results || []
}

export interface ProspectStats { total: number; operating: number; new_open: number; closed: number; with_phone: number; with_email: number; onboarded: number }
export async function prospectStats(DB: D1Database): Promise<{ stats: ProspectStats; byCategory: Array<{ k: string; n: number }> }> {
  await ensureProspectSchema(DB)
  const t = await DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS operating,
      SUM(CASE WHEN is_new_open = 1 THEN 1 ELSE 0 END) AS new_open,
      SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) AS with_phone,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN status = 'onboarded' THEN 1 ELSE 0 END) AS onboarded
    FROM store_prospects`).first<Record<string, number>>().catch(() => null)
  const byCategory = (await DB.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM store_prospects WHERE active = 1 GROUP BY category ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  return {
    stats: {
      total: Number(t?.total) || 0, operating: Number(t?.operating) || 0, new_open: Number(t?.new_open) || 0,
      closed: Number(t?.closed) || 0, with_phone: Number(t?.with_phone) || 0, with_email: Number(t?.with_email) || 0, onboarded: Number(t?.onboarded) || 0,
    }, byCategory,
  }
}

export async function updateProspect(DB: D1Database, id: number, patch: { status?: string; memo?: string; contact_channel?: string | null; follow_up_at?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureProspectSchema(DB)
  const sets: string[] = []; const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!PROSPECT_STATUSES.includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (patch.contact_channel !== undefined) {
    const ch = patch.contact_channel
    if (ch === null || ch === '') sets.push('contact_channel = NULL')
    else if (PROSPECT_CONTACT_CHANNELS.includes(ch)) { sets.push('contact_channel = ?'); binds.push(ch) }
    else return { ok: false, error: '접촉 채널 값이 올바르지 않습니다' }
  }
  if (patch.follow_up_at !== undefined) {
    const f = patch.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return { ok: false, error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다' }
  }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE store_prospects SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '후보를 찾을 수 없습니다' }
  return { ok: true }
}
