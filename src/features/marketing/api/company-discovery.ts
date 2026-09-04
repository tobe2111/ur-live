/**
 * 🤝 유어애즈 B2B 파트너(업체) 수집 트랙 — 격리 테이블 `ad_company_leads` 스키마 + CRUD (2026-07-21).
 *   목적: 유어딜 매장 입점을 대신 데려올 업체(마케팅 대행사 + 소상공인 접점 업체)의 **공개 연락처 DB**.
 *   인플루언서 트랙과 **같은 결**(영입 깔때기)이지만 **별도 격리 테이블**(한쪽 쿼리가 반대쪽 행 무접촉).
 *
 *   3레인(설계 SSOT docs/design/partner-company-collection.md):
 *     A 자동수집(네이버 지역검색) · B 레지스트리 배치(공정위 정보공개서) · C 수동 큐레이션 — `source` 로 구분.
 *   1단계(이 모듈+어드민): 테이블 + 수동입력 + 아웃리치 상태머신. 수집엔진(레인 A/B)은 후속.
 *
 *   ⚠️ 수집 ≠ 발송 — 공개된 *비즈니스* 연락처만. 자동 발송 경로 부존재(✉는 mailto 초안만).
 */
import { companyInflowByDay, type CompanyDayInflow, type CompanySegments } from './company-breakdown'
import { COMPANY_CUBE_SQL, foldCube, type CubeRow } from './company-stats-cube'
import type { Env } from '@/worker/types/env'
import { classifyLead, suspectCompanyName, REGISTRY_CATEGORY_SOURCES, CLASSIFY_RULES_VERSION } from './company-classify'
import { hygieneStatements } from './company-lead-hygiene'
import { emptyDelta, tallyVerdict, verdictChanged, writeReclassifyStats } from './reclassify-verdict-delta'
import { advanceRegistryFastPath } from './reclassify-registry-fastpath'
import { sweepSuppressedEmails } from './company-lead-hygiene'
import { normalizeCompanyName } from './registry-email-match'
import { runDdlOnce } from './ads-schema-guard'
import { pickPriorityBatch, pickCrawlBatch, writePrioState, type ReclassifyRow } from './reclassify-priority'
import { COMPANY_INDEX_DDL } from './company-ddl-indexes'

/* ── 접점 분류 (수집 카테고리 SSOT — 2026-07-27 대표 확정 v3: **실무 업종명이 최상위**) ── */
//   "카테고리를 대행사, 전문서비스(법률·세무·기장 등), 간판, 인테리어 이렇게 해야지" — 우산어
//   (매장인프라/정기납품/창업생태계)를 폐기하고 부르는 이름 그대로. 기존 행은 cat_v3 1회 마이그레이션.
export const COMPANY_CATEGORIES: Record<string, string[]> = {
  '대행사': ['마케팅대행', '종합광고기획', '행사·이벤트', '병원·뷰티마케팅', '체험단·플레이스', '조달등록'],
  '전문서비스': ['법률', '세무·기장', '회계', '노무', '정책자금컨설팅'],
  '간판': ['간판·광고물 제작'],
  '인테리어': ['인테리어·시공', '주방설비'],
  'POS·단말기': ['POS·카드단말기', 'VAN', '키오스크', '테이블오더', 'CCTV·보안'],
  '식자재·납품': ['주류도매', '식자재유통', '원두납품', '유제품배송', '배달대행'],
  '부동산': ['상가부동산'],
  '창업': ['창업컨설팅', '상권분석', '창업박람회', '프랜차이즈본사', '소상공인교육'],
  '지역조직': ['상인회', '소상공인연합회', '협동조합', '청년몰', '상권활성화재단', '새마을금고·신협'],
  '미디어': ['지역신문·매거진', '아파트게시판'],
  '온라인판매': ['통신판매'], // 공정위 통신판매사업자(이메일 소스) — 대행사 아님(2026-07-23 정합)
  // 🛒 공동구매 생태계(2026-07-29 대표 "창고형 공동구매, 공동구매 관련 키워드 업체들") —
  //   유어딜과 **같은 언어를 쓰는** 업체군이라 전환 설명 비용이 가장 낮다(공동구매를 설명할 필요가 없다).
  //   ⚠️ 도매몰(유통스타트) 제조사 풀과 혼동 금지 — 여기는 유어딜 파트너 풀(ad_company_leads)이고,
  //      B2B 도매 공급자 발굴은 `supply-maker-collect` 의 별개 레인이다(서비스 분리 룰).
  '공동구매': ['창고형 공동구매', '공동구매 총판·벤더', '공동구매 대행', '공동구매 플랫폼'],
}
export const COMPANY_CATEGORY_KEYS = Object.keys(COMPANY_CATEGORIES)

/** 아웃리치 상태머신(인플루언서 트랙과 동일 — B2B 영업 파이프라인). */
export const COMPANY_STATUSES = ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold']
/** 첫 접촉 채널 — 파트너 업체는 전화·방문 중심. */
export const COMPANY_CONTACT_CHANNELS = ['call', 'email', 'visit', 'sms', 'kakao', 'other']
/** tier 1~5 = 대표 우선순위(어드민 수동 조정). 1=최우선(주류도매·식자재), 5=후순위(프랜차이즈 본사). */
export const COMPANY_TIER_MIN = 1
export const COMPANY_TIER_MAX = 5

export interface CompanyLead {
  company_name: string
  category?: string | null
  subcategory?: string | null
  tier?: number | null
  region?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  description?: string | null
  business_no?: string | null   // 사업자등록번호(있을 때만 — 통신판매/수동. 폐업 상태조회 키). 상가정보엔 없음.
  contact_source?: string | null // 연락처 출처(provenance): govreg/kakao/homepage/naver/commerce/franchise/registry
  source?: string | null        // 'manual' | 'local' | 'webkr' | 'registry' | 'storeinfo'(공공 상가정보)
  source_keyword?: string | null
  /**
   * 🪦 **폐업/말소/휴업 업체** — 등록부가 그렇게 알려준 경우에만 true(추측 금지).
   *   저장은 하되 접촉 풀에서 뺀다(`active=0`). 삭제하지 않는 이유: 나중에 재개업하면 등록부가
   *   다시 '정상'으로 알려주고, 그때 되살아나야 하기 때문(멱등 자가 치유).
   */
  closed?: boolean
}

export interface CompanyLeadRow {
  id: number; company_key: string; company_name: string
  category: string | null; subcategory: string | null; tier: number | null; region: string | null
  website: string | null; email: string | null; phone: string | null; address: string | null
  description: string | null; business_no: string | null; source: string; source_keyword: string | null
  status: string; active: number; contact_source: string | null
  lead_type: string | null; classify_confidence: string | null; nps_members: number | null
  memo: string | null; contact_channel: string | null
  contacted_at: string | null; follow_up_at: string | null; last_verified_at: string | null; collected_at: string
}

/** 연락처(전화 또는 이메일) 보유 여부 — "연락처 필수" 판정 SSOT. */
export const hasContact = (l: Pick<CompanyLead, 'phone' | 'email'>): boolean =>
  !!(l.phone && String(l.phone).trim()) || !!(l.email && String(l.email).trim())

const SELECT_COLS = 'id, company_key, company_name, category, subcategory, tier, region, website, email, phone, address, description, business_no, source, source_keyword, status, active, contact_source, lead_type, classify_confidence, nps_members, memo, contact_channel, contacted_at, follow_up_at, last_verified_at, collected_at'

/* ── 스키마 (런타임 보장 — ur-ads 는 CI 마이그레이션 미작동, repair-schema 패턴) ─────── */
const _schemaDone = new WeakSet<object>()
/**
 * 스키마 보장. @returns **이번 호출이 실제로 쓴 D1 쿼리 수**(이미 보장돼 있으면 0).
 *
 *   ⚠️ 2026-07-29: 여기서 **35개**의 DDL 이 돈다. 그 비용이 **어느 레인의 예산에도 안 잡혀 있었다.**
 *   무료 플랜 인보케이션 천장이 50~60 인데, 콜드 격리에서 보강 레인은 예산 60 을 세면서 실제로는
 *   60+35=95 를 쓴다 → 라운드가 **잡을 예외도 없이** 중간에 죽는다. `partial:true` 로만 남고
 *   `limit_hit:false` 이던 그 미해결 증상의 유력한 실체다(학습 상한이 172 까지 드리프트한 이유이기도 하다:
 *   라운드가 `nextSubreqCap` 에 도달하지 못하니 하향이 한 번도 안 걸렸다).
 *   ⇒ 호출부가 예산에서 뺄 수 있게 실비를 돌려준다. 세지 않으면 "우리 계수"와 "플랫폼 계수"가 갈라진다.
 */
/**
 * 🧾 파트너 풀 스키마 DDL — `runDdlOnce` 로 **한 번만** 적용(2026-07-29).
 *
 *   왜 배열로 뺐나: 예전엔 이 21개를 **매 콜드 인보케이션마다** 실행했다. 무료 플랜 천장이 50~60 인데
 *   21+게이트3 = 24 를 스키마에만 썼다 — 보강 레인 예산 60 의 40% 다. `runDdlOnce` 는 체크섬을
 *   `platform_settings` 에 남겨 **따뜻한 DB 는 SELECT 1회**로 끝낸다(인플루언서 레인·시트 미러가 쓰던 검증된 헬퍼).
 *   ⚠️ 문장을 고치면 체크섬이 바뀌어 **자동으로 전부 재적용**된다 — 새 컬럼은 여기 배열에 추가하면 된다.
 */
export const COMPANY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS ad_company_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_key TEXT NOT NULL,
    company_name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    tier INTEGER,
    region TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    contact_channel TEXT,
    contacted_at DATETIME,
    follow_up_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(company_key)
  )`,
  'ALTER TABLE ad_company_leads ADD COLUMN name_norm TEXT',
  'CREATE INDEX IF NOT EXISTS idx_company_leads_name_norm ON ad_company_leads(name_norm)',
  'ALTER TABLE ad_company_leads ADD COLUMN merged_into INTEGER',
  'ALTER TABLE ad_company_leads ADD COLUMN business_no TEXT',
  'ALTER TABLE ad_company_leads ADD COLUMN last_verified_at DATETIME',
  'ALTER TABLE ad_company_leads ADD COLUMN active INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE ad_company_leads ADD COLUMN contact_source TEXT',
  'ALTER TABLE ad_company_leads ADD COLUMN lead_type TEXT',
  'ALTER TABLE ad_company_leads ADD COLUMN classify_confidence TEXT',
  'ALTER TABLE ad_company_leads ADD COLUMN nps_members INTEGER',
  'ALTER TABLE ad_company_leads ADD COLUMN nps_checked_at DATETIME',
  'ALTER TABLE ad_company_leads ADD COLUMN enrich_checked_at DATETIME',
  'ALTER TABLE ad_company_leads ADD COLUMN kakao_checked_at DATETIME',
  'ALTER TABLE ad_company_leads ADD COLUMN classified_v INTEGER',
  'ALTER TABLE ad_company_leads ADD COLUMN enrich_v INTEGER',
  // 🏷️ **상호를 사이트 자신에게 확인했는가** (2026-08-14 대표 *"최대한 이상적으로 끝까지"*).
  //   webkr 행의 이름은 **검색결과 제목**이라 출처상 신뢰할 근거가 처음부터 없다. 그래서 분류
  //   신뢰도로 거르지 않고 **전수 1회** 사이트에 물어본다. 이 플래그가 "정확히 한 번"을 보장한다:
  //   없으면 7일마다 영원히 재크롤하거나(낭비) 신뢰도 필터로 일부가 영영 빠진다(미커버 158건이 그거였다).
  'ALTER TABLE ad_company_leads ADD COLUMN name_verified INTEGER',
  `CREATE TABLE IF NOT EXISTS ad_email_suppress (
    email TEXT PRIMARY KEY,
    reason TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  ...COMPANY_INDEX_DDL, // 🗂️ 인덱스는 별 모듈 — 왜 각각이 필요한지가 길어서(읽기 증폭 근거) 여기서 밀려났다
]

export async function ensureCompanySchema(DB: D1Database): Promise<number> {
  if (_schemaDone.has(DB)) return 0
  _schemaDone.add(DB)
  // 🧾 DDL 은 체크섬 기반 1회 적용(위 COMPANY_DDL 주석) — 따뜻한 DB 는 SELECT 1회.
  const { ran, gateStuck } = await runDdlOnce(DB, 'ads_ddl_company', COMPANY_DDL)
  // 🩸 **기록이 안 남는 DB 에서는 "1회 마이그레이션"을 아예 하지 않는다** (2026-09-02 실사고).
  //   아래 세 블록(키 v2 · 오수집 정리 · 카테고리 v3)은 전부 `platform_settings` 플래그로 "이미 했다"를
  //   기억한다. 그 표가 없거나 쓰기가 실패하면 **매 부팅마다 전수 UPDATE/DELETE 가 다시 돈다** —
  //   실측: 회당 409,697행 × 하루 200여 회. 그날 계정의 D1 일일 읽기 한도가 그대로 소진됐다.
  //   ⇒ 기억할 수 없으면 **안 하는 쪽이 맞다.** 데이터는 그대로 남고(정리가 늦어질 뿐), 표가 생기는
  //     순간 다음 부팅에서 정상적으로 1회 실행된다.
  // 실비: 체크섬 SELECT 1 + (적용했다면 문장수 + platform_settings 보장 1 + 체크섬 쓰기 1)
  let spent = 1 + (ran ? COMPANY_DDL.length + 2 : 0)
  if (!gateStuck) return spent

  // 🧹 키 v2 마이그레이션(1회, 플래그) — 사업자번호 보유 행을 b: 키로 통일 + 기존 중복(통신판매 현황/상세 2서비스) 병합.
  spent += 1 // v2 게이트 SELECT
  const v2 = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_key_v2'").first<{ value: string }>().catch(() => null)
  if (!v2?.value) {
    // ① 중복군(같은 사업자번호)의 대표행(MIN id)에 형제 행의 연락처 백필(정보 손실 0)
    // merged-filter-ok — 사업자번호 기준 1회 마이그레이션(ads_company_key_v2 게이트). 병합 이전 시대의 정리.
    await DB.prepare(`UPDATE ad_company_leads SET
        email = COALESCE(email, (SELECT d.email FROM ad_company_leads d WHERE d.business_no = ad_company_leads.business_no AND d.id != ad_company_leads.id AND d.email IS NOT NULL LIMIT 1)),
        phone = COALESCE(phone, (SELECT d.phone FROM ad_company_leads d WHERE d.business_no = ad_company_leads.business_no AND d.id != ad_company_leads.id AND d.phone IS NOT NULL LIMIT 1)),
        website = COALESCE(website, (SELECT d.website FROM ad_company_leads d WHERE d.business_no = ad_company_leads.business_no AND d.id != ad_company_leads.id AND d.website IS NOT NULL LIMIT 1))
      WHERE business_no IS NOT NULL AND business_no != ''
        AND id = (SELECT MIN(m.id) FROM ad_company_leads m WHERE m.business_no = ad_company_leads.business_no)`).run().catch(() => null)
    // ② 대표행 외 **미큐레이션**(status=new·메모 없음) 중복만 삭제 — 대표가 손댄 행은 보존
    // merged-filter-ok — 같은 1회 마이그레이션의 짝(사업자번호 중복 정리).
    await DB.prepare(`DELETE FROM ad_company_leads WHERE business_no IS NOT NULL AND business_no != ''
        AND status = 'new' AND memo IS NULL
        AND id != (SELECT MIN(m.id) FROM ad_company_leads m WHERE m.business_no = ad_company_leads.business_no)`).run().catch(() => null)
    // ③ b: 키 통일(충돌 시 기존 유지 — OR IGNORE)
    await DB.prepare(`UPDATE OR IGNORE ad_company_leads SET company_key = 'b:' || replace(replace(business_no, '-', ''), ' ', '')
        WHERE business_no IS NOT NULL AND length(replace(replace(business_no, '-', ''), ' ', '')) = 10`).run().catch(() => null)
    // ④ 통신판매 재분류('대행사' tier1 오분류 → '온라인판매' tier4 — 보강 우선순위 정합)
    await DB.prepare("UPDATE ad_company_leads SET category = '온라인판매', tier = 4 WHERE source = 'commerce' AND category = '대행사'").run().catch(() => null)
    // ⑤ 백필로 연락처 생긴 보류 행 승격(일관성)
    //   ⚠️ **접힌 행(merged_into)은 제외** — 중복 병합의 패자는 전화가 있어서 보류된 게 아니라 *같은 업체라서*
    //   접힌 것이다. 이 스윕이 전화 유무만 보고 되살리면 **병합이 통째로 무효화**된다(2026-07-28 실측:
    //   첫 병합 1,523행이 전부 전화 보유 → 다음 정비 틱에 전원 부활할 뻔했다).
    await DB.prepare("UPDATE ad_company_leads SET active = 1 WHERE active = 0 AND merged_into IS NULL AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))").run().catch(() => null)
    await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ads_company_key_v2', '1')").run().catch(() => null)
  }

  // 🧹 오수집 정리 v1(2026-07-27) — 공고/모집글·정부페이지가 업체 리드로 저장된 것 제거.
  //   대표 신고: "은평구, 2026년 … 수행기관 모집" 이 '대행사 · 소상공인 마케팅' 리드로 노출.
  //   ⚠️ **미큐레이션 행만**(status='new' AND memo IS NULL) 삭제 — 대표가 손댄 행은 절대 안 건드림.
  spent += 1 // junk_v1 게이트 SELECT
  const j1 = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_junk_v1'").first<{ value: string }>().catch(() => null)
  if (!j1?.value) {
    const junkLike = ['%모집%', '%공고%', '%지원사업%', '%수행기관%', '%보도자료%', '%공지사항%', '%선정결과%', '%선정 결과%', '%합니다%', '%습니다%',
      '%"%', '%“%', '%”%', "%'%", '%‘%', '%’%'] // 기사 헤드라인(인용부호) — 상호에 따옴표 없음(2026-07-27 2차 신고)
    const nameOr = junkLike.map(() => 'company_name LIKE ?').join(' OR ')
    await DB.prepare(`DELETE FROM ad_company_leads WHERE status = 'new' AND memo IS NULL AND (${nameOr})`)
      .bind(...junkLike).run().catch(() => null)
    // 정부/학교 도메인에서 발굴된 행(webkr 오염) — 같은 보수 조건.
    await DB.prepare("DELETE FROM ad_company_leads WHERE status = 'new' AND memo IS NULL AND (website LIKE '%.go.kr%' OR website LIKE '%.gov%' OR website LIKE '%.ac.kr%' OR website LIKE '%korea.kr%')").run().catch(() => null)
    await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ads_company_junk_v1', '1')").run().catch(() => null)
  }

  // 🏷️ 카테고리 v3 마이그레이션(1회, 플래그) — 우산어 → 실무 업종명(2026-07-27 대표 "간판·인테리어처럼").
  //   순수 리라벨(삭제/연락처 무접촉) — 큐레이션 행도 새 어휘로 통일(택소노미 전환은 전량 적용이 정합).
  spent += 1 // cat_v3 게이트 SELECT
  const v3 = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_cat_v3'").first<{ value: string }>().catch(() => null)
  if (!v3?.value) {
    const remap: Array<[string, (string | number)[]]> = [
      // 매장인프라 분해 — 구체 업종 우선 매핑 후 잔여는 POS·단말기
      ["UPDATE ad_company_leads SET category = '간판', subcategory = '간판·광고물 제작' WHERE category = '매장인프라' AND (subcategory LIKE '%간판%' OR subcategory LIKE '%광고물%')", []],
      ["UPDATE ad_company_leads SET category = '인테리어' WHERE category = '매장인프라' AND (subcategory LIKE '%인테리어%' OR subcategory LIKE '%주방%')", []],
      ["UPDATE ad_company_leads SET category = 'POS·단말기' WHERE category = '매장인프라'", []],
      ["UPDATE ad_company_leads SET category = '식자재·납품' WHERE category = '정기납품'", []],
      ["UPDATE ad_company_leads SET category = '부동산', subcategory = '상가부동산' WHERE subcategory LIKE '%부동산%' OR subcategory LIKE '%상가 임대%'", []],
      ["UPDATE ad_company_leads SET category = '창업' WHERE category = '창업생태계'", []],
      ["UPDATE ad_company_leads SET category = '대행사', subcategory = '체험단·플레이스' WHERE subcategory LIKE '%체험단%' OR subcategory LIKE '%플레이스%'", []],
      // 키워드 시드 테이블도 동일 어휘(수집이 새 카테고리로 저장하게)
      ["UPDATE ad_company_keywords SET category = '간판' WHERE category = '매장인프라' AND (subcategory LIKE '%간판%' OR subcategory LIKE '%광고물%')", []],
      ["UPDATE ad_company_keywords SET category = '인테리어' WHERE category = '매장인프라' AND (subcategory LIKE '%인테리어%' OR subcategory LIKE '%주방%')", []],
      ["UPDATE ad_company_keywords SET category = 'POS·단말기' WHERE category = '매장인프라'", []],
      ["UPDATE ad_company_keywords SET category = '식자재·납품' WHERE category = '정기납품'", []],
      ["UPDATE ad_company_keywords SET category = '부동산' WHERE subcategory LIKE '%부동산%' OR subcategory LIKE '%상가 임대%'", []],
      ["UPDATE ad_company_keywords SET category = '창업' WHERE category = '창업생태계'", []],
    ]
    for (const [sql, binds] of remap) await DB.prepare(sql).bind(...binds).run().catch(() => null)
    await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ads_company_cat_v3', '1')").run().catch(() => null)
  }
  return spent // 실제로 쓴 D1 쿼리 수 — 호출부가 예산에서 뺀다
}

/** 중복 차단 키 — **사업자등록번호(10자리) 최우선**(같은 업체가 여러 소스/서비스에서 와도 1행 —
 *   통신판매 현황+상세 2서비스 중복 방지), 없으면 웹사이트(정규화), 없으면 회사명|지역. */
export function companyKey(lead: Pick<CompanyLead, 'company_name' | 'website' | 'region' | 'business_no'>): string {
  const digits = String(lead.business_no || '').replace(/\D/g, '')
  if (digits.length === 10) return `b:${digits}`
  const web = (lead.website || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  if (web.length >= 4) return `w:${web}`.slice(0, 200)
  const name = (lead.company_name || '').trim().toLowerCase().replace(/\s+/g, '')
  const region = (lead.region || '').trim().toLowerCase().replace(/\s+/g, '')
  return `n:${name}|${region}`.slice(0, 200)
}

/* ── 저장(멱등 upsert — 빈 컨택만 백필, 큐레이션 필드 불변) ────────────────────────── */
//   requireContact=true: 연락처(전화/이메일) 없는 리드는 active=0(액션풀 제외·보류) 로 저장 →
//   이후 보강 UPDATE 가 연락처를 채우면 active=1 로 승격("연락처 필수" 정책). 수동/명부는 false(항상 활성).

/* ── 붙여넣기 임포트(레인 B 공정위 정보공개서 · C 상인회 명부 등) ─────────────────── */
//   헤더 행이 있는 표(CSV/TSV)를 붙여넣으면 컬럼을 한글/영문 헤더로 매핑 → CompanyLead[]. source='registry'.
const IMPORT_HEADER_MAP: { keys: string[]; field: keyof CompanyLead }[] = [
  { keys: ['회사명', '상호', '업체명', '브랜드', '영업표지', 'company', 'name'], field: 'company_name' },
  { keys: ['전화', '연락처', '대표번호', '전화번호', 'tel', 'phone'], field: 'phone' },
  { keys: ['이메일', '메일', 'email', 'e-mail'], field: 'email' },
  { keys: ['홈페이지', '사이트', 'website', 'url', 'homepage'], field: 'website' },
  { keys: ['주소', '소재지', 'address'], field: 'address' },
  { keys: ['지역', 'region'], field: 'region' },
  { keys: ['업종', '카테고리', 'category'], field: 'category' },
  { keys: ['세부', 'subcategory'], field: 'subcategory' },
]
export function parsePartnerPaste(text: string): CompanyLead[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delim = (lines[0].match(/\t/g) || []).length >= (lines[0].match(/,/g) || []).length ? '\t' : ','
  const header = lines[0].split(delim).map(h => h.trim().toLowerCase())
  const col: Partial<Record<keyof CompanyLead, number>> = {}
  header.forEach((h, i) => {
    for (const m of IMPORT_HEADER_MAP) if (col[m.field] === undefined && m.keys.some(k => h.includes(k.toLowerCase()))) col[m.field] = i
  })
  if (col.company_name === undefined) return []
  const out: CompanyLead[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(delim)
    const get = (f: keyof CompanyLead): string => col[f] !== undefined ? String(cells[col[f] as number] || '').trim() : ''
    const name = get('company_name')
    if (name.length < 2) continue
    out.push({
      company_name: name,
      phone: get('phone') || null, email: get('email') || null, website: get('website') || null,
      address: get('address') || null, region: get('region') || null,
      category: get('category') || null, subcategory: get('subcategory') || null,
      source: 'registry', source_keyword: 'import',
    })
    if (out.length >= 2000) break
  }
  return out
}

/* ── 목록/필터 ─────────────────────────────────────────────────────────────── */
export interface CompanyLeadFilter {
  category?: string; subcategory?: string; region?: string; tier?: number
  status?: string; hasContact?: boolean; hasEmail?: boolean; includeHeld?: boolean; heldOnly?: boolean; q?: string
  limit?: number; offset?: number
  leadType?: string; pipeline?: boolean; recentDays?: number
}

/** WHERE 절 빌더 — 목록/카운트가 **같은 조건**을 쓰도록 SSOT(페이지네이션 총건수 정합). */
function buildLeadWhere(filter: CompanyLeadFilter): { sql: string; binds: (string | number)[] } {
  const where: string[] = ['1=1']
  const binds: (string | number)[] = []
  // heldOnly: 연락처 없어 보류(active=0)된 것만. includeHeld: 전체(보류 포함). 기본(둘 다 false): 액션풀(active=1)만.
  // 🧬 접힌 행(중복 병합 패자)은 **어느 목록에도 안 나온다** — 삭제하지 않고 표시만 하는 설계라
  //   필터에서 빼주지 않으면 '보류' 목록이 중복으로 부풀고 대표가 같은 업체를 여러 번 보게 된다.
  where.push('merged_into IS NULL')
  if (filter.heldOnly) where.push('active = 0')
  else if (!filter.includeHeld) where.push('active = 1')
  if (filter.category) { where.push('category = ?'); binds.push(filter.category) }
  if (filter.subcategory) { where.push('subcategory = ?'); binds.push(filter.subcategory) }
  if (filter.region) { where.push('region LIKE ?'); binds.push(`%${filter.region}%`) }
  if (typeof filter.tier === 'number') { where.push('tier = ?'); binds.push(filter.tier) }
  if (filter.status && COMPANY_STATUSES.includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasEmail) where.push("(email IS NOT NULL AND email != '')")
  else if (filter.hasContact) where.push("((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))")
  // 통계 카드 클릭 = 필터(카드 수치와 목록 건수가 1:1 로 맞도록 companyStats 와 같은 조건식 사용).
  if (filter.pipeline) where.push("status NOT IN ('new','rejected')")
  if (filter.recentDays && filter.recentDays > 0) { where.push("collected_at >= datetime('now', ?)"); binds.push(`-${Math.min(365, Math.round(filter.recentDays))} days`) }
  if (filter.leadType) {
    if (filter.leadType === 'unknown') where.push("(lead_type IS NULL OR lead_type = 'unknown')")
    else { where.push('lead_type = ?'); binds.push(filter.leadType) }
  }
  // 🔎 검색 — 상호/수집키워드/지역/전화 + **이메일·주소**(2026-07-27). 여러 단어는 AND(모두 포함).
  if (filter.q) {
    for (const tok of filter.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)) {
      where.push(`(LOWER(company_name) LIKE ? OR LOWER(COALESCE(source_keyword,'')) LIKE ? OR LOWER(COALESCE(region,'')) LIKE ?
                   OR COALESCE(phone,'') LIKE ? OR LOWER(COALESCE(email,'')) LIKE ? OR LOWER(COALESCE(address,'')) LIKE ?)`)
      const like = `%${tok}%`; binds.push(like, like, like, like, like, like)
    }
  }
  return { sql: where.join(' AND '), binds }
}

/** 한 페이지 조회. 정렬: tier 우선(1=최우선, NULL 은 뒤) → 최근 수집순. */
export async function listCompanyLeads(DB: D1Database, filter: CompanyLeadFilter = {}): Promise<CompanyLeadRow[]> {
  await ensureCompanySchema(DB)
  const { sql, binds } = buildLeadWhere(filter)
  const limit = Math.min(2000, Math.max(1, filter.limit || 500))
  const offset = Math.max(0, Math.round(filter.offset || 0))
  const r = await DB.prepare(
    // merged-filter-ok — 조건은 buildLeadWhere() SSOT 가 만들고 거기에 `merged_into IS NULL` 이 있다.
    `SELECT ${SELECT_COLS} FROM ad_company_leads WHERE ${sql}
     ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, collected_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all<CompanyLeadRow>().catch(() => null)
  return r?.results || []
}

/** 같은 필터의 총건수 — 페이지네이션(끝까지 다 보이게)용. */
export async function countCompanyLeads(DB: D1Database, filter: CompanyLeadFilter = {}): Promise<number> {
  await ensureCompanySchema(DB)
  const { sql, binds } = buildLeadWhere(filter)
  // merged-filter-ok — 위와 같은 buildLeadWhere() 조건(목록↔총건수 정합).
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM ad_company_leads WHERE ${sql}`).bind(...binds).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

/* ── 기존 리드 재분류(소급) ────────────────────────────────────────────────────
 *   이미 저장된 리드는 "검색 키워드 = 분류" 시절 값이라 실제 업종과 다를 수 있고, 공고/모집글도 섞여 있다.
 *   🔢 2026-07-27 재검사 스캔을 lead_type-빈 행 → **classified_v < CLASSIFY_RULES_VERSION** 으로 교체
 *   (대표 신고: "인천교통공사…특강"/"…무엇이 다를까요?" 같은 행이 옛 규칙 시절 lead_type 스탬프를 받아
 *   영구 재검사 제외 — 규칙을 고쳐도 소급이 안 되던 구조적 구멍). 이제 규칙 버전 bump = 전량 재검사.
 *     · ok=false(공고·정부페이지) → **미큐레이션 행만 삭제**(대표가 손댄 행은 보류 처리만)
 *     · ok=true → category/subcategory/lead_type/classify_confidence 갱신(근거 있을 때만 업종 덮어씀)
 *     · webkr 의심 이름(검색결과 제목 파편) → confidence='none'(분류 확인 카드로 노출 — 수동 검토 유도)
 *   커서(platform_settings)로 매 실행 이어서. 허위 0(연락처 무접촉). */
const RECLASSIFY_CURSOR = 'ads_company_reclassify_cursor'
// 🎯 재검사 우선순위(추측 많은 소스 먼저) — 근거·티어·상태는 `reclassify-priority.ts` SSOT.
export async function reclassifyCompanyLeads(DB: D1Database, limit = 500, housekeeping = true): Promise<{ scanned: number; updated: number; removed: number; held: number; cursor: number; done: boolean; phase?: string; fastPath?: string }> {
  await ensureCompanySchema(DB)
  const n = Math.min(1000, Math.max(1, limit))

  // ①②  배치 선택 — 우선순위(추측 많은 소스) 먼저, 다 비면 전체 크롤. 근거는 reclassify-priority.ts 헤더.
  const prio = await pickPriorityBatch(DB, n, CLASSIFY_RULES_VERSION)
  const prioDone = !prio
  const crawl = prioDone ? await pickCrawlBatch(DB, n, CLASSIFY_RULES_VERSION, RECLASSIFY_CURSOR) : null
  const rows: ReclassifyRow[] = prio?.rows || crawl?.rows || []
  const phase = prio?.phase || 'crawl'
  if (!rows.length) {
    // 한 바퀴 완료 — 커서 리셋(다음 실행은 처음부터, 새로 들어온 미분류 행을 잡음).
    //   우선순위 상태도 같이 리셋해야 **다음 랩에서 다시 앞줄에 선다**(안 하면 티어가 끝에 고정돼 무력화).
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(RECLASSIFY_CURSOR, '0').run().catch(() => null)
    await writePrioState(DB, 0, 0, CLASSIFY_RULES_VERSION)
    return { scanned: 0, updated: 0, removed: 0, held: 0, cursor: 0, done: true, phase }
  }
  let updated = 0, removed = 0, held = 0
  const delta = emptyDelta()   // 🔬 판정 *변화율* 계측(좁히기 판단 근거) — 동작은 안 바꾼다
  const stmts: D1PreparedStatement[] = []
  const stampOnly: number[] = []   // 판정 불변 — 재검사 표시만 필요한 행(위 블록 참조)
  for (const r of rows) {
    const c = classifyLead(r)
    if (!c.ok) {
      const curated = r.status !== 'new' || !!r.memo
      if (curated) { stmts.push(DB.prepare("UPDATE ad_company_leads SET active = 0, lead_type = 'org', classify_confidence = 'evidence', classified_v = ? WHERE id = ?").bind(CLASSIFY_RULES_VERSION, r.id)); held++ }
      else { stmts.push(DB.prepare('DELETE FROM ad_company_leads WHERE id = ?').bind(r.id)); removed++ }
      continue
    }
    // webkr 이름이 검색결과 제목 파편으로 의심되면("데이터 토론"/"insight") 분류 확인 카드로 노출.
    // 🔴 2026-08-08: 이름 파편은 소스 무관하게 정체 불명 — 아래 partner 승격에서 제외한다.
    const suspect = suspectCompanyName(r.company_name, r.source_keyword)
    const conf = r.source === 'webkr' && c.confidence !== 'evidence' && suspect ? 'none' : c.confidence
    // 카테고리 권위 위계: registry(공식 업종) 소스는 category 불가침 — lead_type/confidence 만 스탬프.
    const registry = REGISTRY_CATEGORY_SOURCES.has(r.source || '') && !!r.category
    // 🔬 **기록값을 한 번만 계산해 UPDATE 와 변화율 비교가 같은 값을 쓰게 한다.**
    //   v1 계측이 `classifyLead` 날것을 비교해 등록부 98% 라는 거짓값을 쌓았다(unknown→partner 매핑 누락).
    const written = {
      category: c.category, subcategory: c.subcategory, tier: c.tier,
      lead_type: registry && c.lead_type === 'unknown' && !suspect ? 'partner' : c.lead_type,
      confidence: registry ? 'registry' : conf,
    }
    /**
     * 🪞 **판정이 안 바뀐 행은 도장만 찍는다**(2026-09-04) — 여기가 업체 DB 쓰기의 주범이었다.
     *   이 랩은 규칙 버전이 오를 때마다 전 행(41만)을 다시 판정하는데, 아래 `changed` 를 **이미
     *   계산해 놓고 통계에만 쓰고** 쓰기는 무조건 했다. 라이브 실측이 그 대가를 말한다:
     *   ```
     *     reg_seen 28,777   reg_changed 40   →  실제로 바뀐 비율 0.14%
     *   ```
     *   SQLite 의 UPDATE 는 값이 같아도 행을 다시 쓰고, **바뀐 컬럼을 포함한 인덱스마다** 또 쓴다.
     *   판정 5개 컬럼을 건드리면 인덱스 다발이 따라오지만, `classified_v` 만 찍으면 그 인덱스 하나다.
     *   ⇒ 안 바뀐 99.86% 는 재검사 표시(`classified_v`)만 남기고 판정 컬럼은 손대지 않는다.
     *
     *   ⚠️ **도장은 반드시 찍는다.** 안 찍으면 이 행이 영영 "미검사"로 남아 다음 회차마다 다시
     *      읽힌다 — 쓰기를 아끼려다 읽기를 무한히 태우는 반대편 사고가 된다.
     *   ⚠️ 이미 현재 버전이면 그마저 불필요하므로 아무것도 안 한다.
     */
    const branch = registry ? 'registry' : c.confidence === 'evidence' ? 'evidence' : 'other'
    const changed = verdictChanged(r, written, branch)
    if (!changed) {
      if (r.classified_v !== CLASSIFY_RULES_VERSION) stampOnly.push(r.id)
    } else if (registry) {
      stmts.push(DB.prepare("UPDATE ad_company_leads SET lead_type = ?, classify_confidence = 'registry', classified_v = ? WHERE id = ?")
        .bind(written.lead_type, CLASSIFY_RULES_VERSION, r.id))
    } else if (c.confidence === 'evidence') {
      // 업종은 근거(evidence) 있을 때만 덮어쓰고, 그 외엔 기존 값 유지(대표 수동 분류 보존).
      stmts.push(DB.prepare('UPDATE ad_company_leads SET category = ?, subcategory = ?, tier = COALESCE(tier, ?), lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?')
        .bind(written.category, written.subcategory, written.tier, written.lead_type, written.confidence, CLASSIFY_RULES_VERSION, r.id))
    } else {
      stmts.push(DB.prepare('UPDATE ad_company_leads SET lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?').bind(written.lead_type, written.confidence, CLASSIFY_RULES_VERSION, r.id))
    }
    tallyVerdict(delta, r.source, r.classified_v, changed)
    // 🧼 소급 위생(전화 형식·플랫폼 연락처·뉴스룸 이메일) — 판정과 근거는 `company-lead-hygiene.ts`.
    for (const st of hygieneStatements(r, sql => DB.prepare(sql))) stmts.push(st)
    updated++
  }
  // 판정 불변 행은 **한 문장으로 묶어** 도장만 — 행당 UPDATE 를 만들면 아끼려던 쓰기가 그대로 돌아온다.
  for (let i = 0; i < stampOnly.length; i += 100) {
    const ids = stampOnly.slice(i, i + 100)
    stmts.push(DB.prepare(`UPDATE ad_company_leads SET classified_v = ? WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(CLASSIFY_RULES_VERSION, ...ids))
  }
  for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100)).catch(() => null)
  if (housekeeping) await sweepSuppressedEmails(DB)
  // 커서 전진 — **이번 회차가 어느 패스였는지에 맞는 쪽만** 옮긴다. 섞으면 한쪽이 조용히 건너뛴다.
  let nextCursor = rows[rows.length - 1].id
  // ⚡ 등록부 벌크 전진 — **이 회차의 표본이 "안 바뀐다"를 증명했을 때만**(근거·안전핀은 모듈 docblock).
  //   전체 크롤 패스에서만 한다: 우선순위 티어(webkr·local)는 애초에 등록부가 아니고, 거기서 커서를
  //   건드리면 두 상태가 섞인다(이 파일이 이미 겪은 "한쪽이 조용히 건너뜀").
  const fp = prioDone ? await advanceRegistryFastPath(DB, CLASSIFY_RULES_VERSION, nextCursor, delta.reg_seen, delta.reg_changed) : null
  if (fp) nextCursor = fp.cursor
  if (prioDone) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(RECLASSIFY_CURSOR, String(nextCursor)).run().catch(() => null)
  else await writePrioState(DB, prio!.tier, nextCursor, CLASSIFY_RULES_VERSION)
  // 📊 진행률 가시화(2026-07-27 대표 "청소 얼마나 됐나 안 보임") + 판정 변화율 — `reclassify-verdict-delta.ts`.
  await writeReclassifyStats(DB, CLASSIFY_RULES_VERSION, { scanned: rows.length, updated, removed, held, delta })
  return { scanned: rows.length, updated, removed, held, cursor: nextCursor, done: false, phase, fastPath: fp?.reason }
}

/* ── 큐레이션(상태머신·tier·메모·팔로업·채널) ──────────────────────────────────── */
export async function updateCompanyLead(DB: D1Database, id: number, patch: {
  status?: string; memo?: string; tier?: number | null; follow_up_at?: string | null; contact_channel?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  await ensureCompanySchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!COMPANY_STATUSES.includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
    if (['contacted', 'interested', 'contracted'].includes(patch.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (patch.tier !== undefined) {
    if (patch.tier === null) sets.push('tier = NULL')
    else {
      const t = Math.round(Number(patch.tier))
      if (!Number.isFinite(t) || t < COMPANY_TIER_MIN || t > COMPANY_TIER_MAX) return { ok: false, error: 'tier 는 1~5 입니다' }
      sets.push('tier = ?'); binds.push(t)
    }
  }
  if (patch.contact_channel !== undefined) {
    const ch = patch.contact_channel
    if (ch === null || ch === '') sets.push('contact_channel = NULL')
    else if (COMPANY_CONTACT_CHANNELS.includes(ch)) { sets.push('contact_channel = ?'); binds.push(ch) }
    else return { ok: false, error: '접촉 채널 값이 올바르지 않습니다' }
  }
  if (patch.follow_up_at !== undefined) {
    const f = patch.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return { ok: false, error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다' }
  }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE ad_company_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteCompanyLead(DB: D1Database, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureCompanySchema(DB)
  const r = await DB.prepare('DELETE FROM ad_company_leads WHERE id = ?').bind(id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

/** 선택 삭제(체크박스) — 정수 id 목록만 신뢰(최대 500). 삭제 건수 반환. */
export async function deleteCompanyLeads(DB: D1Database, ids: number[]): Promise<number> {
  await ensureCompanySchema(DB)
  const clean = [...new Set(ids.map(n => Math.trunc(Number(n))).filter(n => Number.isFinite(n) && n > 0))].slice(0, 500)
  if (!clean.length) return 0
  let deleted = 0
  const CHUNK = 100
  for (let i = 0; i < clean.length; i += CHUNK) {
    const slice = clean.slice(i, i + CHUNK)
    const ph = slice.map(() => '?').join(',')
    const r = await DB.prepare(`DELETE FROM ad_company_leads WHERE id IN (${ph})`).bind(...slice).run().catch(() => null)
    deleted += (r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0
  }
  return deleted
}

/* ── 통계(어드민 대시보드 스트립) ──────────────────────────────────────────────── */
export interface CompanyStats { total: number; with_contact: number; with_email: number; held_no_contact: number; active_pipeline: number; recent7: number; needs_review: number; merged_away: number }
export interface AgencyEmailFunnel { total: number; with_email: number; site_no_email: number; site_tried: number; no_site: number }

/**
 * 📊 **수집원별 연락처 보유율** — "어느 수집원을 늘릴지"를 의견이 아니라 데이터로 정하기 위한 표 (2026-08-02 신설).
 *
 *   왜 필요했나: 08-02 실측에서 풀 173,824건 중 **86.6%(150,529)가 연락처 없음**이었고, 그걸 채우는
 *   두 레인의 **적중률이 0** 이었다(카카오 전화 스윕 37시도 0발견 · 이메일 보강 hit_rate 0).
 *   즉 "더 모으고 나중에 채운다"가 작동하지 않는다 — 더 모으면 **연락처 없는 리드만 는다.**
 *
 *   그런데 그때 "통신판매는 대량이나 연락처가 빈약하고 카카오 로컬은 전화가 함께 온다"는 판단의 근거가
 *   **표본(`telno: "N/A"`)·깔때기·코드 주석뿐**이었다. 그 상태로 수집 전략을 바꾸면 정황을 확정으로
 *   읽는 것이고, 그건 같은 날 이미 두 번 틀렸던 방식이다. ⇒ **세고 나서 정한다.**
 *
 *   ⚠️ 이 표가 **말하지 않는 것**: 리드의 *가치*(대행사인지 잡음인지)는 여기 없다 — `byCategory`·`byTier`
 *     와 **함께** 봐야 한다. 연락처율이 높아도 전부 무관한 업종이면 늘릴 이유가 없다.
 */
export interface SourceContactRate {
  source: string
  n: number
  with_phone: number
  with_email: number
  with_any: number
}

export async function companyStats(DB: D1Database): Promise<{ stats: CompanyStats; byCategory: Array<{ k: string; n: number }>; byDay: CompanyDayInflow[]; todayKst: string; segments: CompanySegments; byTier: Array<{ k: number | null; n: number }>; byLeadType: Array<{ k: string; n: number }>; agencyEmailFunnel: AgencyEmailFunnel; bySource: SourceContactRate[] }> {
  await ensureCompanySchema(DB)
  /**
   * 🧊 **한 번의 스캔으로 전부** (2026-08-31). 예전엔 같은 39만 행 테이블을 **8번 훑었다** —
   *   통제 실험으로 잰 값이 호출 1회 **3,317,537행**(D1 무료 한도의 66%). 여덟 쿼리가 전부 같은
   *   행을 보고 다른 축으로 접을 뿐이라, 한 번 훑으며 묶고 코드에서 접는다.
   *   설계·주의점은 `company-stats-cube.ts`, 예전 8쿼리와의 동치는 유닛이 SQLite 로 직접 대조한다.
   */
  const cubeRows = (await DB.prepare(COMPANY_CUBE_SQL).all<CubeRow>().catch(() => null))?.results || []
  const cube = foldCube(cubeRows)
  // 📅 일자별 유입만 별도 — 최근 14일 **범위 조회**라 성격이 다르다(큐브에 넣으면 축이 날짜만큼 늘어난다).
  const { byDay, todayKst } = await companyInflowByDay(DB)
  return {
    stats: cube.stats,
    byCategory: cube.byCategory, byDay, todayKst, byTier: cube.byTier, byLeadType: cube.byLeadType,
    bySource: cube.bySource as SourceContactRate[],
    segments: cube.seg,
    agencyEmailFunnel: cube.agencyEmailFunnel,
  }
}

// 💾 저장 관문은 별 모듈로 분리(2026-07-29 god 파일 래칫) — 기존 import 경로 유지를 위해 re-export.
export { saveCompanyLeads, saveCompanyLeadsCounted } from './company-save'
