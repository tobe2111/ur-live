/**
 * 🏭 유통스타트(도매몰) — 제조사(브랜드사)·판매사 후보 **수집 엔진** (2026-07-28).
 *   대표 확정: "제조사, 브랜드사 같은 개념" — 자사 상품(브랜드)을 보유해 **도매로 공급 가능한 주체**가 타깃.
 *
 *   레인 2개(둘 다 무료·검증된 API만 — 프랜차이즈/고용24 처럼 승인·차단으로 죽는 소스에 의존하지 않음):
 *     ① 🟡 카카오 로컬 — 품목×제조/브랜드 어휘 그리드. 키워드당 45건(15×3p) + **전화·주소가 응답에 직접** 실림.
 *        무료 일 10만 쿼터(소비자 트랙과 별도 소비 아님 — 같은 키지만 여유가 큼).
 *     ② 📥 통신판매사업자 임포트 — 이미 확보된 공정위 원부(대표자 이메일 포함)를 **판매사 후보**로 1회 복사.
 *        ⚠️ 서비스 분리: 유어애즈 테이블은 **읽기만**(SELECT), 원본 행 무접촉. 도매는 자기 테이블만 씀.
 *
 *   ⚠️ 수집 ≠ 발송. 공개된 비즈니스 연락처만. 게이트 `SUPPLY_MAKER_COLLECT_ENABLED`(기본 OFF, 수동 무관).
 */
import type { Env } from '@/worker/types/env'
import { saveMakerLeads, ensureMakerSchema, type MakerLead } from './maker-leads'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

/** 품목군 × 제조/브랜드 어휘 — "브랜드를 가진 공급 주체"를 겨냥(단순 공장보다 브랜드사 우선). */
type Trade = { kw: string; category: string }
const TRADES: Trade[] = [
  { kw: '식품 제조', category: '식품·가공' }, { kw: '식품 브랜드', category: '식품·가공' },
  { kw: '건강식품 제조', category: '건강식품' }, { kw: '건강기능식품 브랜드', category: '건강식품' },
  { kw: '화장품 제조', category: '화장품·뷰티' }, { kw: '화장품 브랜드', category: '화장품·뷰티' },
  { kw: '생활용품 제조', category: '생활용품' }, { kw: '주방용품 제조', category: '주방용품' },
  { kw: '의류 제조', category: '패션·의류' }, { kw: '패션 브랜드', category: '패션·의류' },
  { kw: '잡화 제조', category: '잡화·액세서리' }, { kw: '반려동물용품 제조', category: '반려동물' },
  { kw: '유아용품 제조', category: '유아·출산' }, { kw: '가전 제조', category: '가전·디지털' },
  { kw: '스포츠용품 제조', category: '스포츠·레저' }, { kw: '문구 제조', category: '문구·팬시' },
  // 공급 주체 어휘 — 브랜드 본사/총판/수입원은 도매 공급 계약의 실제 카운터파트.
  { kw: '총판', category: '기타' }, { kw: '수입원', category: '기타' }, { kw: 'OEM ODM', category: '기타' },
  // ⚠️ 2026-07-28 대표 지적 "제조사·브랜드사·총판이 다 적다" — 원인은 그리드가 `품목+제조/브랜드` 조합에
  //   치우쳐 **한국 도매 생태계의 실제 주체 명칭**이 빠져 있었던 것. 특히 '상사'는 국내 무역·도매의 관용
  //   명칭인데 통째로 누락. 아래는 간판·상호에 실제로 쓰이는 주체 어휘 — 카카오 로컬은 상호를 매칭하므로
  //   이 어휘가 곧 발굴량이다(품목 어휘보다 수확이 크다).
  { kw: '상사', category: '기타' }, { kw: '무역상사', category: '기타' }, { kw: '수출입', category: '기타' },
  { kw: '대리점', category: '기타' }, { kw: '공식수입사', category: '기타' }, { kw: '독점수입', category: '기타' },
  { kw: '도매', category: '기타' }, { kw: '도매상', category: '기타' }, { kw: '도매유통', category: '기타' },
  { kw: '유통전문', category: '기타' }, { kw: '납품업체', category: '기타' }, { kw: '공급업체', category: '기타' },
  { kw: '벤더', category: '기타' }, { kw: '브랜드본사', category: '기타' }, { kw: '제조공장', category: '기타' },
  // 품목 확장 — 도매 카탈로그로 실제 팔리는 군(현 그리드에 없던 것들).
  { kw: '침구 제조', category: '생활용품' }, { kw: '가구 제조', category: '생활용품' },
  { kw: '세제 제조', category: '생활용품' }, { kw: '위생용품 제조', category: '생활용품' },
  { kw: '커피 원두 납품', category: '식품·가공' }, { kw: '음료 제조', category: '식품·가공' },
  { kw: '소스 제조', category: '식품·가공' }, { kw: '냉동식품 제조', category: '식품·가공' },
  { kw: '축산물 도매', category: '식품·가공' }, { kw: '수산물 도매', category: '식품·가공' },
  { kw: '농산물 도매', category: '식품·가공' }, { kw: '제과 제조', category: '식품·가공' },
  { kw: '헤어 미용재료', category: '화장품·뷰티' }, { kw: '네일 재료', category: '화장품·뷰티' },
  { kw: '미용기기 제조', category: '화장품·뷰티' }, { kw: '의료기기 제조', category: '가전·디지털' },
  { kw: '조명 제조', category: '가전·디지털' }, { kw: '주방기기 제조', category: '주방용품' },
  { kw: '포장재 제조', category: '기타' }, { kw: '완구 제조', category: '유아·출산' },
  { kw: '캠핑용품 제조', category: '스포츠·레저' }, { kw: '가방 제조', category: '잡화·액세서리' },
  { kw: '신발 제조', category: '패션·의류' }, { kw: '원단 도매', category: '패션·의류' },
]
/** 제조·물류 밀집 지역 우선(산업단지 보유) + 브랜드 본사 밀집(서울 강남·마포 등). */
// 제조 밀집(산업단지) + **도매 집산지**(2026-07-28 추가 — 총판·상사·도매상은 산업단지가 아니라
//   전통 도매시장·유통단지에 몰려 있다. 기존 지역 목록은 '제조'에만 맞춰져 그 주체들을 못 잡았다).
const REGIONS = ['서울', '서울 중구', '서울 동대문', '서울 종로', '서울 금천', '서울 강서',
  '경기 성남', '경기 화성', '경기 부천', '경기 안산', '경기 김포', '경기 광주', '경기 파주',
  '인천', '부산', '부산 중구', '대구', '대구 서구', '광주', '대전', '울산',
  '충북 청주', '충남 천안', '경남 김해', '전북 익산', '경북 구미']

interface Cursor { ri: number; ti: number }
const CURSOR_KEY = 'supply_maker_cursor'
const STATS_KEY = 'supply_maker_stats'

export interface MakerCollectStats {
  last_run: string; keyword: string; found: number; saved: number
  total_runs: number; total_saved: number; diag: { configured: boolean; error?: string }
}

/** 🟡 카카오 로컬 1키워드(3페이지=45건) — 전화·주소 직접 확보. */
async function searchKakao(key: string, keyword: string, category: string, region: string): Promise<MakerLead[]> {
  const out: MakerLead[] = []
  for (let page = 1; page <= 3; page++) {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(`${region} ${keyword}`)}&size=15&page=${page}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(12000) }).catch(() => null)
    if (!res || !res.ok) break
    const data = await res.json().catch(() => null) as { documents?: Array<{ place_name?: string; phone?: string; road_address_name?: string; address_name?: string; category_name?: string }>; meta?: { is_end?: boolean } } | null
    for (const d of (data?.documents || [])) {
      const name = stripTag(d.place_name)
      if (name.length < 2) continue
      // 매장·소매점 제외 — 도매 공급 주체가 아님(음식점/카페/편의점 등 카카오 업종경로로 판별).
      const cat = stripTag(d.category_name)
      if (/음식점|카페|편의점|미용|병원|약국|학원|부동산|숙박/.test(cat)) continue
      out.push({
        company_name: name, kind: 'maker', category, region,
        phone: (d.phone || '').trim() || null,
        address: stripTag(d.road_address_name || d.address_name) || null,
        description: cat || null,
        contact_source: (d.phone || '').trim() ? 'kakao' : null,
        source: 'local', source_keyword: keyword,
      })
    }
    if (data?.meta?.is_end) break
  }
  return out
}

/** 제조사 수집 1틱 — 지역×품목 커서 순환(회당 4키워드 = 최대 180건 발굴). */
export async function runMakerCollect(env: Env): Promise<MakerCollectStats> {
  const DB = adsLeadsDb(env)
  await ensureMakerSchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.KAKAO_REST_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: MakerCollectStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as MakerCollectStats : null } catch { prev = null }
  const persist = async (s: MakerCollectStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) {
    const s: MakerCollectStats = { last_run: stamp, keyword: '', found: 0, saved: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: KAKAO_REST_API_KEY 미설정' } }
    await persist(s); return s
  }
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cur: Cursor = { ri: 0, ti: 0 }
  try { const c = curRaw?.value ? JSON.parse(curRaw.value) as Cursor : null; if (c) cur = { ri: c.ri || 0, ti: c.ti || 0 } } catch { /* 초기 */ }
  if (cur.ri < 0 || cur.ri >= REGIONS.length) cur.ri = 0
  if (cur.ti < 0 || cur.ti >= TRADES.length) cur.ti = 0

  let found = 0, saved = 0
  const used: string[] = []
  for (let n = 0; n < 4; n++) {
    const region = REGIONS[cur.ri]
    const trade = TRADES[cur.ti]
    used.push(`${region} ${trade.kw}`)
    const leads = await searchKakao(key, trade.kw, trade.category, region)
    found += leads.length
    saved += await saveMakerLeads(DB, leads).catch(() => 0)
    cur.ti++
    if (cur.ti >= TRADES.length) { cur.ti = 0; cur.ri = (cur.ri + 1) % REGIONS.length }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, JSON.stringify(cur)).run().catch(() => null)
  const s: MakerCollectStats = {
    last_run: stamp, keyword: used.join(', ').slice(0, 120), found, saved,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true },
  }
  await persist(s)
  return s
}

/* ── 📥 판매사 후보 임포트(통신판매사업자) ───────────────────────────────────────
 *   공정위 통신판매사업자 = **사입해 재판매하는 온라인 판매 주체** → 도매몰 판매사 영입의 1차 모수.
 *   ⚠️ 서비스 분리: 유어애즈 `ad_company_leads` 는 **SELECT 만**(원본 무접촉), 결과를 도매 테이블로 복사.
 *   커서(id)로 이어받아 회당 500행씩 — 2.5만 건을 며칠이 아니라 몇 틱에 소진. */
const IMPORT_CURSOR = 'supply_reseller_import_cursor'
export interface ResellerImportStats { last_run: string; scanned: number; saved: number; cursor: number; done: boolean; total_saved: number }

export async function runResellerImport(env: Env, limit = 500): Promise<ResellerImportStats> {
  const DB = adsLeadsDb(env)
  await ensureMakerSchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const curRow = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(IMPORT_CURSOR).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRow?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const n = Math.min(1000, Math.max(50, limit))
  // 연락처(이메일 또는 전화) 보유분만 — 영업 가능한 행만 도매 풀에 넣는다.
  const rows = (await DB.prepare(
    `SELECT id, company_name, region, address, phone, email, website, business_no, description
     FROM ad_company_leads
     WHERE id > ? AND source = 'commerce'
       AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
     ORDER BY id ASC LIMIT ?`)
    .bind(cursor, n).all<{ id: number; company_name: string; region: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; business_no: string | null; description: string | null }>()
    .catch(() => null))?.results || []
  const prevRaw = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'supply_reseller_import_stats'").first<{ value: string }>().catch(() => null)
  let totalSaved = 0; try { totalSaved = Number((prevRaw?.value ? JSON.parse(prevRaw.value) : {}).total_saved) || 0 } catch { /* 초기 */ }
  if (!rows.length) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(IMPORT_CURSOR, '0').run().catch(() => null)
    const s: ResellerImportStats = { last_run: stamp, scanned: 0, saved: 0, cursor: 0, done: true, total_saved: totalSaved }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('supply_reseller_import_stats', JSON.stringify(s)).run().catch(() => null)
    return s
  }
  const leads: MakerLead[] = rows.map(r => ({
    company_name: r.company_name, kind: 'reseller' as const, category: null,
    region: r.region, address: r.address, phone: r.phone, email: r.email, website: r.website,
    business_no: r.business_no, description: r.description,
    contact_source: 'commerce', source: 'commerce', source_keyword: '통신판매사업자',
  }))
  const saved = await saveMakerLeads(DB, leads).catch(() => 0)
  const nextCursor = rows[rows.length - 1].id
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(IMPORT_CURSOR, String(nextCursor)).run().catch(() => null)
  const s: ResellerImportStats = { last_run: stamp, scanned: rows.length, saved, cursor: nextCursor, done: false, total_saved: totalSaved + saved }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('supply_reseller_import_stats', JSON.stringify(s)).run().catch(() => null)
  return s
}
