/**
 * 📣 2026-08-09 캠페인 신청(인플루언서 모집) SSOT — 클라 페이지와 워커 API 가 같은 표를 읽는다.
 *
 *   배경: 방배 상권 캠페인 인플루언서 모집 — "신청 = 유어딜 인플루언서 파트너 등록"이 되도록
 *   기존 인바운드 신청(ad_influencer_leads, /creators/apply)과 ref 링크(users.id) 레일을 재사용한다.
 *   캠페인 코드는 **경로 파라미터**(/campaign/{code})로만 받는다 — 쿼리로 받으면 카카오 로그인
 *   왕복에서 삭제된다(safe-internal-path 화이트리스트 밖, CreatorStartPage 헤더 주석의 그 함정).
 *
 *   ⚠️ 택소노미(플랫폼/카테고리)는 influencer-apply.routes / CreatorApplyPage 와 동일 어휘 —
 *   나중에 매칭·유어애즈 풀이 같은 값으로 읽을 수 있게 유지한다(불일치 시 '기타' 강등).
 */

export interface SignupCampaign {
  /** 경로 코드 (소문자/숫자/하이픈) — inflow_clicks.campaign 값과 동일 문자열 */
  code: string
  title: string
  /** 신청 폼 상단 소개 한 줄 */
  subtitle: string
  /** false 면 페이지가 '접수 종료' 안내만 렌더(라우트·데이터는 보존 — 가역) */
  active: boolean
}

/** 진행 캠페인 레지스트리 — 새 캠페인은 여기 한 줄 추가(서버·클라 동시 반영). */
export const SIGNUP_CAMPAIGNS: readonly SignupCampaign[] = [
  {
    code: 'bangbae',
    title: '방배 동네딜 캠페인 인플루언서 모집',
    subtitle: '방배 상권의 맛집·카페·뷰티 딜을 소개할 인플루언서를 찾습니다.',
    active: true,
  },
] as const

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,39}$/

/** 코드 → 캠페인 (정규화 + 레지스트리 대조). 미등록/형식 위반은 null. */
export function getSignupCampaign(raw: string | null | undefined): SignupCampaign | null {
  const code = String(raw ?? '').trim().toLowerCase()
  if (!CODE_RE.test(code)) return null
  return SIGNUP_CAMPAIGNS.find((c) => c.code === code) ?? null
}

/** influencer-apply.routes PLATFORMS 와 동일 어휘(매칭 DB 정합). */
export const CAMPAIGN_PLATFORMS: readonly { v: string; label: string }[] = [
  { v: 'youtube', label: '유튜브' }, { v: 'instagram', label: '인스타그램' }, { v: 'naver_blog', label: '네이버 블로그' },
  { v: 'tistory', label: '티스토리' }, { v: 'tiktok', label: '틱톡' }, { v: 'etc', label: '기타' },
] as const

/** influencer-apply.routes CATEGORIES 와 동일 택소노미(불일치 시 '기타' 강등 — 함께 갱신할 것). */
export const CAMPAIGN_CATEGORIES: readonly string[] = [
  '공동구매', '마케팅대행사', '맛집', '카페', '푸드', '외식창업', '뷰티', '네일', '골프', '숙소',
  '여행', '패션', '육아', '운동', '반려동물', '리빙', 'IT/재테크', '취미', '기타',
] as const

/** 완료 화면·서버 응답이 함께 쓰는 ref 링크 — `?c=` 로 캠페인이 inflow_clicks.campaign 에 태워진다. */
export function buildCampaignRefLink(userId: string | number, campaignCode: string): string {
  return `https://urdeal.kr/?ref=${encodeURIComponent(String(userId))}&c=${encodeURIComponent(campaignCode)}`
}
