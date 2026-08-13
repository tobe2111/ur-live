/**
 * 🧼 **파트너 리드 소급 위생** — `company-discovery.ts` 에서 분리 (2026-08-12, 600줄 래칫).
 *
 * ## 왜 한 덩어리인가
 * 재분류 레인은 두 가지 일을 한다: **분류**(업종·리드타입·신뢰도)와 **위생**(이미 저장된 연락처의
 * 오염 제거). 성격이 다르다 — 분류는 *규칙이 바뀌면* 다시 돌고, 위생은 *과거 버그의 흔적을 지운다*.
 * 넷 다 "행 하나를 보고 UPDATE 문 0~1개를 만든다"는 같은 모양이라 여기 모았다.
 *
 * ## 🔑 순수함수로 둔 이유
 * D1 을 직접 치지 않고 **문장만 만들어 돌려준다**. 호출부가 `DB.batch` 로 100개씩 묶어 보내므로
 * 여기서 실행하면 회차 예산(무료 플랜 인보케이션당 서브리퀘스트)이 조용히 샌다.
 *
 * ## ⚠️ 이 파일이 지키는 경계
 * - **숫자는 안 바꾼다** — 전화 교정은 하이픈 위치만(`formatKrPhone` 이 그 성질을 보장).
 * - **경로 있는 플랫폼 페이지는 건드리지 않는다** — 업체가 직접 운영하는 채널이다.
 * - **정부등록·카카오 번호는 무효화 대상이 아니다** — 출처가 권위 있다(포맷 교정만 적용).
 */
import { isValidKrPhone, formatKrPhone, isPlatformRootUrl, NEWSROOM_EMAIL_LOCAL } from './contact-enrich'

/**
 * 🔤 **HTML 엔티티 디코딩** — 화면에 `SM C&amp;C 성수` 가 **글자 그대로** 보인다 (2026-08-13 실측 24건).
 *
 * 크롤/검색 결과를 그대로 저장하면서 이스케이프가 풀리지 않았다. React 는 문자열을 텍스트로 렌더하므로
 * 저장된 `&amp;` 는 화면에서도 `&amp;` 다 — 대표가 "이름이 이상하다"고 느끼는 것의 일부다.
 *
 * ⚠️ **디코딩은 이름을 고치는 게 아니라 되돌리는 것**이다(`&amp;`→`&`). 원래 글자로 돌릴 뿐이라
 *   오탐 개념이 없다 — 아래 상호 판정(무엇이 상호가 아닌가)과는 성격이 전혀 다르다.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')          // ⚠️ 반드시 마지막 — 먼저 하면 `&amp;lt;` 가 `<` 로 이중 디코딩된다
    .replace(/\s+/g, ' ').trim()
}

/** 위생 판정에 필요한 최소 필드 — `ReclassifyRow` 의 부분집합(타입 결합을 줄인다). */
export interface HygieneRow {
  id: number
  company_name?: string | null
  phone: string | null
  email: string | null
  website: string | null
  category: string | null
  contact_source: string | null
}

/**
 * 행 하나의 소급 위생 문장을 만든다(0~2개).
 *
 * @param prep `DB.prepare` — 호출부가 넘긴다(이 모듈은 DB 를 모른다).
 */
export function hygieneStatements<T>(
  r: HygieneRow,
  prep: (sql: string) => { bind: (...a: unknown[]) => T },
): T[] {
  const out: T[] = []

  // 🔤 이름에 박힌 HTML 엔티티를 되돌린다(실측 24건 — `SM C&amp;C 성수` 가 화면에 그대로 보였다).
  //   ⚠️ 값이 바뀔 때만 문장을 만든다. 대부분의 행은 멀쩡하다.
  if (r.company_name) {
    const decoded = decodeEntities(r.company_name)
    if (decoded && decoded !== r.company_name) {
      out.push(prep('UPDATE ad_company_leads SET company_name = ? WHERE id = ?').bind(decoded.slice(0, 120), r.id))
    }
  }

  // ☎️ 쓰레기 전화 소급 정리(2026-07-27 대표 신고 "0405-120-0000" — 페이지의 날짜/ID 숫자열 오인).
  //   홈페이지 크롤 출처만 — 정부등록/카카오 번호는 출처가 권위 있어 손대지 않는다.
  //   실존 국번 검증 실패 → NULL + 이메일도 없으면 보류(active=0, "연락처 필수" 정책).
  if (r.contact_source === 'homepage' && r.phone && !isValidKrPhone(r.phone)) {
    out.push(prep("UPDATE ad_company_leads SET phone = NULL, contact_source = CASE WHEN email IS NOT NULL AND email != '' THEN contact_source ELSE NULL END, active = CASE WHEN email IS NOT NULL AND email != '' THEN active ELSE 0 END WHERE id = ?").bind(r.id))
  } else if (r.phone) {
    // ☎️ 하이픈 위치 소급 교정 (2026-08-12 대표 신고 "연락처랑 업체명이 전혀 안맞아").
    //   이전 포맷이 국번을 몰라 `010-4233-5119` 를 `0104-233-5119` 로 찍었다 — 실측 8,850건 중 **873건**.
    //   **숫자는 그대로**라 재크롤 없이 여기서 되돌린다(이 레인은 어차피 전 행을 한 바퀴 돈다 — 추가 스캔 0).
    //   ⚠️ 출처를 가리지 않는다 — 정부등록 API 도 `0418-540-2114`(맞는 값 041-8540-2114)처럼 준다.
    //   ⚠️ 값이 같으면 문장을 만들지 않는다(대부분 이미 정상 — 쓸데없는 쓰기가 곧 수집량이다).
    const fixed = formatKrPhone(r.phone)
    if (fixed && fixed !== r.phone) out.push(prep('UPDATE ad_company_leads SET phone = ? WHERE id = ?').bind(fixed, r.id))
  }

  // 🏢 **플랫폼 자기 페이지에서 긁은 연락처는 그 플랫폼 것이다** — 소급 무효화 (2026-08-12).
  //   실측: `이루더스`(www.daangn.com, 1877-9737 = 당근 대표번호) · `블라인드`(www.teamblind.com).
  //   그 번호로 제휴 제안을 보내면 **엉뚱한 회사에 연락**하게 된다.
  //   ⚠️ **경로가 있으면 건드리지 않는다** — `blog.naver.com/nuricom6779` 은 그 업체가 직접 운영하는
  //   블로그라 번호가 그 업체 것이 맞다(판정은 `isPlatformRootUrl` SSOT 한 곳).
  if (r.contact_source === 'homepage' && (r.phone || r.email) && isPlatformRootUrl(r.website)) {
    out.push(prep('UPDATE ad_company_leads SET phone = NULL, email = NULL, contact_source = NULL, active = 0 WHERE id = ?').bind(r.id))
  }

  // 📰 뉴스룸 계정 이메일 소급 제거(press11@·pcoop@… — 기사/보도자료 페이지에서 긁힌 오염, B2B 영업 무의미).
  //   '미디어' 카테고리(언론사 별도 수집 레인)는 뉴스룸 계정이 유효 연락처라 보존.
  if (r.email && NEWSROOM_EMAIL_LOCAL.test(r.email) && r.category !== '미디어') {
    out.push(prep("UPDATE ad_company_leads SET email = NULL, contact_source = CASE WHEN phone IS NOT NULL AND phone != '' THEN contact_source ELSE NULL END, active = CASE WHEN phone IS NOT NULL AND phone != '' THEN active ELSE 0 END WHERE id = ?").bind(r.id))
  }

  return out
}
