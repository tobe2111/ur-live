/**
 * 🔀 업체형 블로그/카페 → **B2B 파트너풀 라우팅** (2026-07-28 대표 지시)
 *
 *   ## 왜 필요한가 (라이브 실측)
 *   인플루언서 풀의 네이버 블로그 27,864건 표본에서 **~7.7% 가 업체 블로그**다 —
 *   "에스공인중개사사무소", "수원중고주방", "(주)지디네트웍스 1544 3542", "울산철거N강원종합공사".
 *   인플루언서로는 노이즈지만, **광고주 리드로는 자산**이다. 게다가 이들은
 *   **블로그를 직접 운영한다 = 마케팅에 이미 돈과 시간을 쓰고 있다**는 뜻이라 유어애즈 적합도가 높다.
 *
 *   ## 왜 크롤이 (거의) 필요 없는가
 *   ① 업체 블로그는 **이름 자체에 상호+전화를 쓴다**(위 `1544 3542` 예시) → 이미 저장된 텍스트에서 추출.
 *   ② 그마저 없어도, 파트너풀에는 **상호로 전화를 채우는 보강 레인이 이미 있다**
 *      (카카오 로컬 `kakaoLocalLookup` + 홈페이지 크롤 — `enrich-lane.ts`).
 *      ⇒ 우리는 **상호 + 블로그 URL 을 넘기기만** 하면 되고, 나머지는 기존 파이프라인이 한다.
 *   결과적으로 이 레인 자체의 외부 요청은 **0회**(D1 읽기/쓰기만) — 무료 플랜 서브리퀘스트 부담이 없다.
 *
 *   ## 서비스 분리
 *   인플루언서 풀(`ad_influencer_leads`)과 파트너풀(`ad_company_leads`) 은 **둘 다 유어애즈** 안이다
 *   (소비자/도매 무접촉). 대표 지시대로 **저장은 B2B 풀에만** 하고, 인플루언서 쪽은 `is_brand=1` 로
 *   태깅만 한다(삭제 아님 — 오탐이어도 숨김일 뿐 데이터는 보존).
 *
 *   ## 오탐 방어
 *   개인 블로거를 업체로 오판해 파트너풀을 오염시키는 것이 유일한 실질 리스크다. 그래서
 *   ① 판별은 **보수적**(강한 신호 1개 이상 — 애매하면 false) ② `saveCompanyLeads` 의 자체 관문
 *   (`company-classify`)이 2차 필터 ③ **dry-run 기본**으로 대표가 표본을 먼저 본다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, type CompanyLead } from './company-discovery'
import { POOL_ACCOUNT_ID } from './influencer-auto-collect'

/**
 * 🏢 업체(사업자)가 운영하는 블로그/카페인가 — **보수적**(강한 신호 1개 이상).
 *   개인 크리에이터를 업체로 오판하면 파트너풀이 오염되므로, 애매하면 false 를 반환한다.
 *   ⚠️ 순수 함수(유닛테스트로 고정) — 규칙을 바꾸면 테스트의 오탐 케이스를 반드시 함께 확인할 것.
 */
const BIZ_STRONG = [
  // 법인격·공식 표기
  /\(주\)|㈜|주식회사|유한회사|합자회사|\bInc\.?\b|\bCorp\.?\b|Co\.,?\s?Ltd/i,
  /공식\s*(블로그|카페|채널|계정)/,
  // 업종 상호 접미(자격/면허 업종 — 개인 블로그 이름에 잘 안 쓴다)
  //   ⚠️ 한글 뒤 `\b`(단어 경계) 금지 — JS 의 \b 는 [A-Za-z0-9_] 기준이라 한글 사이엔 경계가 없다.
  //   "명인리얼티부동산중개법인"·"하늘마음한의원" 이 통째로 빠지던 실버그(유닛테스트가 잡았다).
  /(공인중개사|중개법인|중개사무소|법무사|세무사|노무사|변리사|손해사정|행정사)/,
  /(한의원|치과|병원|약국|동물병원|피부과|성형외과|정형외과|산부인과|의원$)/,
  /(학원|아카데미|교습소|어린이집|유치원)/,
  /(공업사|정비소|철물점|인쇄소|세탁소)/,
  // 사업 형태 표기
  /(전문업체|전문점|본점|지점|직영점|대리점|총판|납품|시공|제작\s*전문|출장\s*전문|종합공사)/,
  /(펜션|게스트하우스|모텔|리조트|캠핑장|글램핑)/,
]
/** 이름에 전화번호(대표번호·지역번호)가 박혀 있으면 사실상 영업용 계정 — 개인 블로그는 이렇게 안 쓴다. */
const PHONE_IN_NAME = /(1[5-9]\d{2}[-. ]?\d{4}|0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4})/
/** 영업 문구(상담/문의 유도) — 단독으로는 약하나 전화/상호와 겹치면 확실하다. */
const SALES_PHRASE = /(24시간\s*상담|상담\s*환영|무료\s*상담|견적\s*문의|문의\s*환영|전국\s*출장)/

export function looksLikeBusinessBlog(name?: string | null, description?: string | null): boolean {
  const n = String(name || '')
  if (!n.trim()) return false
  const d = String(description || '')
  // ① 이름에 강한 업종/법인 신호
  if (BIZ_STRONG.some(re => re.test(n))) return true
  // ② 이름에 전화번호 — 영업 계정의 결정적 신호
  if (PHONE_IN_NAME.test(n)) return true
  // ③ 이름의 영업 문구 + 소개글에도 영업/전화 신호(둘이 겹칠 때만 — 단독은 약함)
  if (SALES_PHRASE.test(n) && (PHONE_IN_NAME.test(d) || SALES_PHRASE.test(d))) return true
  return false
}

/** 이미 저장된 텍스트(이름+소개글)에서 전화/이메일 추출 — 외부 요청 0. 못 찾으면 null(허위 금지). */
export function extractBlogBizContact(name?: string | null, description?: string | null): { phone: string | null; email: string | null } {
  const text = `${name || ''} ${description || ''}`
  const phoneRaw = text.match(/(1[5-9]\d{2}[-. ]?\d{4}|0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4})/)?.[0] || null
  const phone = phoneRaw ? phoneRaw.replace(/[.\s]/g, '-').replace(/-+/g, '-') : null
  const emailRaw = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] || null
  // 네이버 플랫폼 자체 주소·이미지 파일명 오탐 제거.
  const email = emailRaw && !/@(naver\.com\/|blog\.|example\.)|\.(png|jpg|jpeg|gif)$/i.test(emailRaw) ? emailRaw : null
  return { phone, email }
}

export interface BizRouteResult {
  scanned: number
  matched: number
  routed: number        // 파트너풀에 저장된 수(dry-run 이면 0)
  withPhone: number     // 넘긴 것 중 이름/소개글에서 전화를 뽑은 수
  tagged: number        // 인플루언서 풀에서 is_brand=1 로 숨긴 수
  cursor: number        // 다음 회차 시작 id
  done: boolean
  dry_run: boolean
  samples: string[]     // dry-run 검수용 표본(최대 15)
}

const CURSOR_KEY = 'ads_bizblog_route_cursor'

/**
 * 🔀 업체형 블로그/카페를 파트너풀로 넘긴다. **기본은 dry-run**(저장 없이 표본만) — 대표가 표본을 보고
 *   승인하면 `dryRun:false` 로 실행. id 커서로 순회하므로 여러 번 나눠 돌려도 중복 처리 없음.
 */
export async function routeBusinessBlogsToPartnerPool(
  env: Env, opts: { dryRun?: boolean; max?: number; reset?: boolean } = {},
): Promise<BizRouteResult> {
  const DB: D1Database = env.DB
  const dryRun = opts.dryRun !== false // 명시적으로 false 일 때만 실제 저장
  const MAX = Math.max(100, Math.min(20_000, opts.max ?? 3000))
  const PAGE = 500

  let cursor = 0
  if (!opts.reset) {
    const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
      .first<{ value: string }>().catch(() => null)
    cursor = Math.max(0, parseInt(raw?.value || '0', 10) || 0)
  }

  let scanned = 0, matched = 0, routed = 0, withPhone = 0, tagged = 0, done = false
  const samples: string[] = []
  while (scanned < MAX) {
    const rows = (await DB.prepare(`SELECT id, name, description, url, handle, platform, source_keyword, category
      FROM ad_influencer_leads
      WHERE account_id = ? AND platform IN ('naver_blog','naver_cafe') AND id > ?
      ORDER BY id ASC LIMIT ?`).bind(POOL_ACCOUNT_ID, cursor, PAGE)
      .all<{ id: number; name: string | null; description: string | null; url: string | null; handle: string | null; platform: string; source_keyword: string | null; category: string | null }>()
      .catch(() => null))?.results || []
    if (!rows.length) { done = true; break }
    scanned += rows.length
    cursor = rows[rows.length - 1].id

    const hits = rows.filter(r => looksLikeBusinessBlog(r.name, r.description))
    matched += hits.length
    if (!hits.length) continue

    const leads: CompanyLead[] = []
    for (const r of hits) {
      const { phone, email } = extractBlogBizContact(r.name, r.description)
      if (phone) withPhone++
      if (samples.length < 15) samples.push(`${(r.name || '').slice(0, 30)}${phone ? ` · ☎ ${phone}` : ''} · ${r.url || r.handle || ''}`)
      leads.push({
        company_name: (r.name || '').trim().slice(0, 120),
        // 블로그가 그 업체의 실질 홈페이지 역할 — 파트너풀 보강(홈페이지 크롤)이 그대로 쓸 수 있다.
        website: r.url || (r.handle ? `https://blog.naver.com/${r.handle}` : null),
        phone, email,
        description: (r.description || '').slice(0, 300) || null,
        source: 'influencer_blog',          // 출처 표시 — 나중에 이 유입분만 되돌리거나 성과를 갈라 볼 수 있다
        source_keyword: r.source_keyword || null,
        contact_source: phone || email ? 'blog_text' : null,
      })
    }
    if (!dryRun && leads.length) {
      // requireContact=true → 연락처 없으면 active=0(보류)로 저장되고, 파트너풀 보강 레인이 채우면 승격.
      routed += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
      // 인플루언서 쪽은 **숨김 태깅만**(삭제 아님) — 기존 노이즈 숨김 필터(hideNoise)에 자동 합류.
      const ids = hits.map(h => h.id)
      const ph = ids.map(() => '?').join(',')
      const t = await DB.prepare(`UPDATE ad_influencer_leads SET is_brand = 1 WHERE account_id = ? AND id IN (${ph}) AND COALESCE(is_brand,0) = 0`)
        .bind(POOL_ACCOUNT_ID, ...ids).run().catch(() => null)
      tagged += t?.meta?.changes || 0
    }
  }

  if (!dryRun) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null) // 끝까지 돌았으면 0 으로(다음 회차 재순회)
  }
  return { scanned, matched, routed, withPhone, tagged, cursor, done, dry_run: dryRun, samples }
}
