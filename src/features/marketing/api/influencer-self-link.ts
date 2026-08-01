/**
 * 🔗 **자기 블로그 링크 판정 SSOT** (2026-07-29).
 *
 * ## 왜 한 곳에 모으나
 * 네이버 블로거에게 `blog.naver.com/...` 은 **연락처가 아니라 자기 글 주소**다. 그런데 그 판정이
 * 세 곳에 각자 적혀 있었다 — 발굴(`influencer-discovery`), 측정(`influencer-performance`),
 * 재조우 스킵(`influencer-known-contacts`, SQL LIKE). 여기에 정리 패스까지 더하면 **네 벌**이 된다.
 * 이 레포가 반복해 겪은 실패가 정확히 그것이다: 같은 규칙을 여러 벌 두면 한쪽만 고쳐지고 조용히 갈라진다.
 *
 * ## 무엇이 문제였나 (라이브 실측)
 * `platform=naver_blog&hasContact=1` 표본 200건: `links` 보유 198건 중 **197건이 자기링크뿐**(외부 1건).
 * 그리고 **117건(58%)** 은 이메일도 인스타도 없이 `links` 만 차 있었다 —
 * 화면·통계엔 '연락처 보유'로 잡히는데 **실제로 연락할 수단이 없다.**
 *
 * 더 나쁜 건 그 다음이다. 연락처 백필이 `COALESCE(links, ?)`(빈 칸만 채움)라
 * **한 번 자기링크로 채워지면 나중에 찾은 진짜 외부 링크가 영영 못 들어간다** — 노이즈가 자리를 막는다.
 *
 * ⚠️ `blog.me` 도 네이버 블로그 도메인이라 포함한다(기존 세 곳은 `blog.naver.com` 만 봤다 — 의도적 확장).
 * ⚠️ 이 판정은 **네이버 블로거 맥락 전용**이다. 유튜버에게 블로그 링크는 크로스플랫폼 발자국이라 값지다.
 */

/** 네이버 블로그 자기 주소 패턴(m./blog.me 포함). */
export const SELF_BLOG_LINK_RE = /(?:^|\/\/|\.)(?:m\.)?(?:blog\.naver\.com|blog\.me)(?:[/?#]|$)/i

/** SQL `LIKE` 용 패턴 — 정규식을 못 쓰는 자리(후보 조회)에서 **넓게 거르고**, 정밀 판정은 아래 함수가 한다. */
export const SELF_BLOG_LIKE = '%naver.com%'

/** 이 URL 이 네이버 블로거 본인의 글 주소인가(= 연락처가 아닌가). */
export function isSelfBlogLink(url: string): boolean {
  return SELF_BLOG_LINK_RE.test(String(url || ''))
}

/** 공백으로 이어진 링크 문자열에서 **외부 링크만** 남긴다(연락처로 셀 수 있는 것). */
export function externalLinks(links: string | null | undefined): string[] {
  return String(links || '').split(/\s+/).filter(u => u && !isSelfBlogLink(u))
}

/**
 * 🧹 저장된 `links` 값을 정리한 결과.
 *
 *   - `undefined` — **바꿀 것 없음**(외부 링크만 있거나 원래 비어 있음). 호출부는 UPDATE 를 건너뛴다.
 *   - `null` — 전부 자기링크였다 → 비운다. 그래야 다음 측정 때 진짜 연락처가 들어갈 자리가 생긴다.
 *   - `string` — 자기링크가 섞여 있었다 → 외부만 남긴다.
 *
 * 멱등: 결과에 자기링크가 없으므로 같은 행을 다시 넣으면 `undefined` 가 나온다.
 */
export function cleanSelfLinks(links: string | null | undefined): string | null | undefined {
  const raw = String(links || '').trim()
  if (!raw) return undefined
  const all = raw.split(/\s+/).filter(Boolean)
  const ext = all.filter(u => !isSelfBlogLink(u))
  if (ext.length === all.length) return undefined // 자기링크 없음 — 손대지 않는다
  return ext.length ? ext.join(' ') : null
}
