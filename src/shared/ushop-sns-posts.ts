/**
 * 🖼️ 유어샵 SNS 최근 게시물 — 2026-11-03 유어샵 B + SNS. 서버(`worker/routes/curator/sns-posts.routes.ts`)와
 *   화면(`pages/curator-page/UShopSnsPosts.tsx`)이 같이 쓰는 모양·개수.
 */
export const USHOP_SNS_POSTS_MAX = 6
export interface UShopSnsPost {
  platform: 'instagram' | 'youtube'
  /** 게시물 주소(그 플랫폼의 https) */
  url: string
  /** 썸네일(https) */
  thumb: string
  /** 올린 시각(플랫폼 원문 ISO) — 정렬에만 쓴다 */
  at: string
  video: boolean
}
