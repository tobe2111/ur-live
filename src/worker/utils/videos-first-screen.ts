/**
 * 🎬 `/videos?v=…` 서버 첫 화면 — 검은 바탕 + 표지 한 장(`shared/videos-first.ts`). 목록·재생기는 앱이 맡는다.
 * 노드 id 는 다른 첫 화면과 같다(`lib/boot-first-screen.ts` 가 청크를 받는 동안 이 노드를 도로 붙인다).
 */
import { VIDEOS_FS_STYLE, videosCoverSrc } from '../../shared/videos-first'

export function buildVideosFirstScreen(videoId: string): string {
  const src = videosCoverSrc(videoId).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return `<div id="ur-first-screen"><div style="${VIDEOS_FS_STYLE.page}"><img src="${src}" alt="" aria-hidden="true" fetchpriority="high" decoding="async" style="${VIDEOS_FS_STYLE.cover}"></div></div>`
}
