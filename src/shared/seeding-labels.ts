/**
 * 🎁 무상 체험 — 화면 첫 렌더가 쓰는 라벨만 (2026-10-31)
 *
 * 이용권 상세의 '팔아보기' 카드가 `seeding.ts`(알림 문구·판정·패널티 규칙) 전체를 끌고 오면
 * 상세 첫 화면 무게가 늘어난다(surface-budgets). 그래서 라벨만 따로 둔다 — `seeding.ts` 가 그대로 재수출한다.
 */

export const SEEDING_PLATFORMS = ['instagram', 'youtube', 'tiktok'] as const
export type SeedingPlatform = (typeof SEEDING_PLATFORMS)[number]

export const PLATFORM_LABEL: Record<SeedingPlatform, string> = {
  instagram: '인스타그램',
  youtube: '유튜브',
  tiktok: '틱톡',
}
/** 플랫폼마다 "팔로워" 를 부르는 말이 다르다. */
export const FOLLOWER_WORD: Record<SeedingPlatform, string> = {
  instagram: '팔로워',
  youtube: '구독자',
  tiktok: '팔로워',
}
