/**
 * 🌐 **네이버 웹문서 검색(webkr) 수집 SSOT** — `company-collect.ts` 에서 분리 (2026-08-22).
 *
 * ## 왜 분리했나
 * 이 검색은 **연락처 수율이 가장 높은 발굴 경로**다(라이브 실측 2026-08-22):
 * ```
 *   webkr    2,860행 · 이메일 828 (29.0%)   ← 전부 사이트 보유. 크롤이 이메일을 만든다
 *   commerce 302,591행 · 이메일 40,042 (13.2%) ← 등록부가 직접 준 것(크롤 성과 아님)
 *   storeinfo 33,844행 · 이메일 74 (0.2%)
 * ```
 * 그런데 이 함수는 `collect-company` 회차의 **맨 뒤**에 붙어 있어 가장 먼저 굶는다 —
 * 그 레인은 키워드당 [지역검색 → 카카오 → 웹문서] 를 순차로 도는데 **12초 벽시계 마감**에 걸려
 * 실측 회차가 `키워드 3개 · deadline_hit: true` 로 끝난다. 웹문서 전용 레인(`collect-webkr`)이
 * 이 함수를 자기 인보케이션에서 부르려면 모듈이 공유돼야 한다.
 *
 * ⚠️ **로직은 이동뿐 — 한 줄도 바꾸지 않았다**(export 키워드와 타입 이름만). 판정 규칙
 * (제3자/정부/학교 도메인 제외 · 언론사 별도 수집 · 기사 URL 제외 · 도메인 dedup)은 그대로다.
 */
import type { FetchBudget } from './influencer-discovery'
import type { CompanyLead } from './company-discovery'
import type { PickKeyword } from './company-keyword-pick'
import { noteNaverCall } from './naver-api-usage'
import { naverOpenapiBlocked, noteOpenapiStatus } from './naver-openapi-block'

export const NAVER_OPENAPI = 'https://openapi.naver.com'
export const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
export const outOfBudget = (b?: FetchBudget) => !!b && (b.left <= 0 || (!!b.deadline && Date.now() >= b.deadline))
export const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }

/**
 * 🚨 2026-07-28: 이 레인의 검색 fetch 3종이 전부 `.catch(() => null)` 로 **플랫폼 한도 오류를 삼켰다**.
 *   "Too many subrequests" 가 나도 그냥 빈 결과로 보여서, 라운드 중간에 한도를 넘으면 **남은 키워드가
 *   조용히 0건**이 되고 아무 신호도 안 남는다(집계만 보면 "그 키워드는 결과가 없었나 보다" 로 읽힌다).
 *   → 한도 신호를 잡아 `budget.limitHit` 을 세우고, 상태줄(diag)에 노출해 판독 가능하게 한다.
 *   ⚠️ 이 레인은 학습 상한을 쓰지 않지만(고정 예산), limitHit 이 서면 루프가 즉시 멈춰 헛돈을 막는다.
 */
export async function laneFetch(url: string, init: RequestInit & { timeoutMs?: number }, budget?: FetchBudget): Promise<Response | null> {
  const { timeoutMs = 12000, ...rest } = init
  // 🚧 429/403 이 연속으로 오면 **쏘지 않는다**. 실패 응답도 쿼터를 먹으므로, 막힌 채로 계속 쏘는 건
  //   그날의 허용량만 태우는 짓이다. 상세·판정규칙: `naver-openapi-block.ts`.
  if (naverOpenapiBlocked()) return null
  if (!noteNaverCall(url)) return null // 📟 계측+일일목표(90%) 게이트. 실패분도 쿼터를 먹어 호출 전에 센다
  try {
    const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
    noteOpenapiStatus(res.status)
    return res
  } catch (err) {
    const msg = String((err as { message?: string } | null)?.message || '')
    if (/too many subrequests/i.test(msg) && budget) budget.limitHit = true
    noteOpenapiStatus(null) // 예외는 차단의 증거도, 회복의 증거도 아니다 — 연속을 건드리지 않는다
    return null
  }
}

/** 🌐 레인 A-웹: 네이버 **웹문서 검색**으로 대행사 자체 사이트 발굴 (2026-07-27 — 대표 "대행사 많이 모집").
 *   대행사는 사무실업이라 지도(지역검색) 미등록이 많고 display=5 제약도 큼 — 반면 **웹엔 자기 사이트가 반드시 있음**.
 *   사이트 자체가 리드(도메인이 dedup 키) → 보강 크롤이 그 사이트에서 이메일/전화 확보(대행사 이메일 수율 최고 경로).
 *   제3자/UGC/구인 플랫폼 도메인 제외. 상호는 페이지 제목에서 유도(표시 라벨용 — 정체성 키는 도메인). */
export async function searchNaverWeb(clientId: string, clientSecret: string, kw: PickKeyword, budget?: FetchBudget, pages = 1): Promise<CompanyLead[]> {
  if (outOfBudget(budget)) return []
  const { THIRD_PARTY_HOST, NEWS_MEDIA_HOST } = await import('./contact-enrich')
  const { NON_BUSINESS_HOST, unbalancedBracket } = await import('./company-classify')
  // 📄 2026-07-28: 이 레인이 **이메일 수율 최고**(라이브 실측 webkr 75% vs 지도 2%)인데 1페이지(30건)만 봤다.
  //   start=1,31,61… 로 더 깊게 판다. dedup(seen)이 페이지 간에도 유지돼 중복 도메인은 1건으로 접힌다.
  const items: Array<{ title?: string; link?: string; description?: string }> = []
  for (let p = 0; p < Math.max(1, pages); p++) {
    if (outOfBudget(budget)) break
    spendBudget(budget)
    const url = `${NAVER_OPENAPI}/v1/search/webkr.json?query=${encodeURIComponent(kw.keyword)}&display=30&start=${p * 30 + 1}`
    const res = await laneFetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }, budget)
    if (!res || !res.ok) break
    const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string }> } | null
    const got = data?.items || []
    items.push(...got)
    if (got.length < 30) break // 마지막 페이지
  }
  const out: CompanyLead[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const link = (it.link || '').trim()
    if (!/^https?:\/\//i.test(link)) continue
    let u: URL
    try { u = new URL(link) } catch { continue }
    const host = u.hostname.replace(/^www\./, '')
    // 제3자/UGC + **정부·학교 도메인** 제외 — 구청 공고 페이지가 '대행사' 리드로 저장되던 오염원(2026-07-27 대표 신고).
    if (THIRD_PARTY_HOST.test(u.hostname) || NON_BUSINESS_HOST.test(u.hostname) || seen.has(host)) continue
    // 📰 언론사 = 기사제목 리드로 버리지 않고 **'미디어' 카테고리로 별도 수집**(2026-07-27 대표
    //   "언론사도 따로 수집을 하던가" — 지역 언론은 소상공인 접점 큰 잠재 광고제휴 파트너).
    //   이름은 도메인 placeholder(기사제목 오염 방지) → 보강 크롤 og:site_name 치유가 실명으로 교체.
    if (NEWS_MEDIA_HOST.test(u.hostname)) {
      seen.add(host)
      out.push({
        company_name: host, category: '미디어', subcategory: '지역신문·매거진', tier: 3, region: kw.region,
        website: u.origin, phone: null, email: null, address: null,
        description: stripTag(it.description).slice(0, 200) || null,
        source: 'webkr', source_keyword: kw.keyword,
      })
      continue
    }
    // 뉴스 기사 URL 제외(비언론 호스트의 기사 CMS 경로 — 보도자료/미디어 섹션 페이지는 업체 홈이 아님).
    if (/(\/news|\/article|articleview|newsview|\/press\/|\/media\/)/i.test((u.pathname + u.search).toLowerCase())) continue
    seen.add(host)
    // 상호 라벨: 제목 첫 구획(구분자 앞) — 정체성은 도메인(company_key=w:host)이라 라벨 오차 무해.
    const cut = stripTag(it.title).split(/[|\-–—:·]/)[0].trim().slice(0, 60)
    const name = cut.length >= 2 && !unbalancedBracket(cut) ? cut : host // 괄호 안에서 끊긴 파편("[광주")은 상호가 아니다 → 도메인(og:site_name 치유가 실명으로)
    out.push({
      company_name: name, category: kw.category, subcategory: kw.subcategory, tier: kw.tier, region: kw.region,
      website: u.origin, // origin 만 저장 — 도메인 dedup + 크롤 진입점
      phone: null, email: null, address: null,
      description: stripTag(it.description).slice(0, 200) || null,
      source: 'webkr', source_keyword: kw.keyword,
    })
  }
  return out
}
