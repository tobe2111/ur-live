/**
 * 🎉 개업 웰컴 파이프라인 + 개업 컨설팅 브리핑 (2026-07-27 대표 "모두 진행하자, 개업 컨설팅도 가능하겠네").
 *   신규 개업 감지(is_new_open — 이 DB 의 가장 값진 시그널)를 매출 활동으로 바꾸는 도구:
 *     · newOpenDigest  — 최근 개업 매장 큐(연락처 포함) + 지역별 집계 → 어드민 "오늘의 개업" 패널.
 *     · openingBriefing — 매장 1곳의 **상권 데이터 브리핑**: 같은 동네·같은 업종의 경쟁 밀도,
 *       최근 90일 개업/폐업 흐름, 인근 동종 최근 개업 목록 + **전화 멘트 초안**(실측 수치만 삽입).
 *   영업 전화가 "입점하세요"가 아니라 "사장님 동네 상권 데이터 브리핑"으로 시작되게 한다(개업 컨설팅).
 *
 *   ⚠️ 허위 0: 모든 수치는 우리 store_prospects(공공 인허가 수집분) 집계 — 외부 호출 0, 추정치 생성 0.
 *   수치가 없으면 문구에서 그 문장을 뺀다(지어내지 않음). ⚠️ 수집 ≠ 발송 — 브리핑은 어드민 열람/복사용.
 */
import { ensureProspectSchema } from './store-prospects'

const ymdDaysAgo = (days: number): string => {
  const d = new Date(Date.now() - days * 86400_000)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

export interface NewOpenRow {
  id: number; biz_name: string; category: string | null; uptae: string | null
  region: string | null; addr_road: string | null; phone: string | null; email: string | null
  apv_perm_ymd: string | null; status: string
}
export interface NewOpenDigest {
  days: number
  total: number
  rows: NewOpenRow[]
  byRegion: Array<{ k: string; n: number }>
}

/** 최근 개업 큐 — 웰컴 아웃리치 대상(영업중 + 미거절). 연락처 보유 우선, 최신 인허가순. */
export async function newOpenDigest(DB: D1Database, days = 14, limit = 30): Promise<NewOpenDigest> {
  await ensureProspectSchema(DB)
  const cutoff = ymdDaysAgo(Math.min(90, Math.max(1, days)))
  const base = "FROM store_prospects WHERE active = 1 AND is_new_open = 1 AND status NOT IN ('rejected','onboarded') AND apv_perm_ymd >= ?"
  const rows = (await DB.prepare(
    `SELECT id, biz_name, category, uptae, region, addr_road, phone, email, apv_perm_ymd, status ${base}
     ORDER BY (CASE WHEN (phone IS NOT NULL AND phone != '') OR (email IS NOT NULL AND email != '') THEN 0 ELSE 1 END), apv_perm_ymd DESC, id DESC LIMIT ?`)
    .bind(cutoff, Math.min(100, Math.max(5, limit))).all<NewOpenRow>().catch(() => null))?.results || []
  const totalRow = await DB.prepare(`SELECT COUNT(*) AS n ${base}`).bind(cutoff).first<{ n: number }>().catch(() => null)
  const byRegion = (await DB.prepare(`SELECT COALESCE(region,'?') AS k, COUNT(*) AS n ${base} GROUP BY region ORDER BY n DESC LIMIT 10`)
    .bind(cutoff).all<{ k: string; n: number }>().catch(() => null))?.results || []
  return { days, total: Number(totalRow?.n) || 0, rows, byRegion }
}

export interface OpeningBriefing {
  store: { id: number; biz_name: string; category: string | null; region: string | null; addr_road: string | null; phone: string | null; apv_perm_ymd: string | null }
  competitors_active: number       // 같은 지역 · 같은 업종 · 영업중(경쟁 밀도)
  opened_90d: number               // 같은 지역 · 같은 업종 최근 90일 개업
  closed_90d: number               // 같은 지역 · 같은 업종 최근 90일 폐업(인허가 변동 감지 기준)
  recent_openings: Array<{ biz_name: string; apv_perm_ymd: string | null }>  // 인근 동종 최근 개업 5
  script: string                   // 전화 멘트 초안 — 실측 수치만 삽입(없으면 해당 문장 생략)
}

/** 매장 1곳의 상권 브리핑 — 같은 region×category 집계(전부 우리 수집분, 외부 호출 0). */
export async function openingBriefing(DB: D1Database, id: number): Promise<OpeningBriefing | null> {
  await ensureProspectSchema(DB)
  const store = await DB.prepare(
    'SELECT id, biz_name, category, region, addr_road, phone, apv_perm_ymd FROM store_prospects WHERE id = ?')
    .bind(id).first<OpeningBriefing['store']>().catch(() => null)
  if (!store) return null
  const region = store.region || ''
  const category = store.category || ''
  const cut90 = ymdDaysAgo(90)
  // 지역·업종 둘 다 있어야 의미 있는 비교 — 없으면 0/빈으로 두고 문구에서 생략(허위 0).
  const scoped = region && category
  const cnt = async (sql: string, binds: (string | number)[]): Promise<number> => {
    const r = await DB.prepare(sql).bind(...binds).first<{ n: number }>().catch(() => null)
    return Number(r?.n) || 0
  }
  const competitors = !scoped ? 0 : await cnt(
    'SELECT COUNT(*) AS n FROM store_prospects WHERE region = ? AND category = ? AND active = 1 AND id != ?', [region, category, id])
  const opened90 = !scoped ? 0 : await cnt(
    'SELECT COUNT(*) AS n FROM store_prospects WHERE region = ? AND category = ? AND apv_perm_ymd >= ? AND id != ?', [region, category, cut90, id])
  // 폐업: active=0 로 전환된 행 — 폐업 신고일 컬럼은 없어 인허가 최종변동(last_mod_ts) 90일 기준(라벨에 명시).
  const closed90 = !scoped ? 0 : await cnt(
    "SELECT COUNT(*) AS n FROM store_prospects WHERE region = ? AND category = ? AND active = 0 AND COALESCE(replace(substr(last_mod_ts,1,10),'-',''), '') >= ?", [region, category, cut90])
  const recent = !scoped ? [] : ((await DB.prepare(
    'SELECT biz_name, apv_perm_ymd FROM store_prospects WHERE region = ? AND category = ? AND active = 1 AND id != ? ORDER BY apv_perm_ymd DESC LIMIT 5')
    .bind(region, category, id).all<{ biz_name: string; apv_perm_ymd: string | null }>().catch(() => null))?.results || [])

  // 전화 멘트 초안 — 수치가 있는 문장만 조립(추정·과장 없음). 어드민이 복사 후 다듬어 사용.
  const fmtYmd = (y: string | null) => y && y.length === 8 ? `${y.slice(0, 4)}.${y.slice(4, 6)}.${y.slice(6, 8)}` : ''
  const lines: string[] = []
  lines.push(`사장님 안녕하세요, 유어딜입니다. ${store.apv_perm_ymd ? `${fmtYmd(store.apv_perm_ymd)} ` : ''}${region ? `${region} ` : ''}개업 진심으로 축하드립니다.`)
  if (scoped && competitors > 0) lines.push(`저희가 공공 인허가 데이터를 보는데, 지금 ${region}에 같은 업종(${category})이 ${competitors}곳 영업 중입니다.`)
  if (scoped && opened90 > 0) lines.push(`최근 3개월 사이에만 ${opened90}곳이 새로 문을 열었고${closed90 > 0 ? `, ${closed90}곳은 문을 닫았습니다` : ''}.`)
  lines.push('개업 초기 3개월이 단골이 만들어지는 골든타임이라, 동네 주민에게 바로 노출되는 유어딜 동네딜에 첫 이용권을 걸어보시는 걸 제안드리고 싶어서 연락드렸습니다.')
  lines.push('입점비·고정비는 없고 판매될 때만 수수료가 나가는 구조라 개업 초기 부담이 없습니다. 5분만 설명드려도 될까요?')

  return { store, competitors_active: competitors, opened_90d: opened90, closed_90d: closed90, recent_openings: recent, script: lines.join('\n') }
}
