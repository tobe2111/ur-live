/**
 * 🎬 `/videos?v=…` 첫 화면 — 표지 한 장 (2026-11-11 대표 *"계속 진행해줘"* · 로딩 최적화).
 *
 * 공유 링크(`/videos?v=<영상>`)로 곧장 들어오면 종전엔 앱이 켜지고(1.5초) 목록이 오고 유튜브 재생기가
 * 뜰 때까지 **검은 화면**이었다. 표지 주소는 영상 번호만으로 정해지므로(`youTubeThumbUrl`) 서버가 목록 없이도
 * 바로 그릴 수 있다. 앱도 같은 표지를 재생이 시작될 때까지 덮어 둔다(서버 그림 → 앱 그림이 같은 사진).
 *
 * 🔑 화면(`VideosPage`)·워커(`videos-first-screen.ts`)·Link 헤더가 **이 파일의 같은 함수**로 주소를 만든다 —
 *   한 글자라도 갈리면 사진을 두 번 받고 한 번 깜빡인다.
 * ⚠️ 못 막는 것: `v` 가 우리 목록에 없는 유튜브 영상이어도 그 표지가 잠깐 보인다(목록이 오면 첫 영상으로 간다).
 *   서버가 목록을 읽어 대조하면 막을 수 있지만 HTML 응답이 그만큼 늦어진다 — 표지는 이미 우리 리사이저로 누구나 받을 수 있는 사진이다.
 */
import { cfImage } from '../utils/cf-image'
import { youTubeThumbUrl } from './urshorts'

/** 뷰어의 덮개(`VideosPage` `shorts-cover`)와 같은 폭. */
export const VIDEOS_COVER_WIDTH = 480

/** 화면이 쓰는 클래스(뷰어 루트 · 덮개와 같은 값). */
export const VIDEOS_FS_CLS = {
  page: 'relative min-h-[100dvh] overflow-hidden overscroll-none bg-[#0A0C12]',
  cover: 'pointer-events-none absolute inset-0 h-full w-full object-cover',
} as const

/** 서버가 쓰는 인라인 스타일 — 이 표면은 첫 화면 CSS 묶음이 없어(로더-먼저) 클래스가 아직 안 먹는다. 위 클래스와 같은 모양. */
/** 바탕색은 위 클래스에서 꺼낸다 — 색을 두 번 적으면 한쪽만 바뀌는 날이 온다. */
const VIDEOS_BG = VIDEOS_FS_CLS.page.match(/bg-\[(#[0-9A-Fa-f]{6})\]/)?.[1] ?? 'black'
export const VIDEOS_FS_STYLE = {
  page: `position:relative;min-height:100dvh;overflow:hidden;background:${VIDEOS_BG}`,
  cover: 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none',
} as const

/** 주소의 `v` — 유튜브 영상 번호 모양(11자)일 때만. 그 밖은 null(주소에 든 글자를 그대로 HTML 에 넣지 않는다). */
export function videosStartIdOf(search: string | null | undefined): string | null {
  const v = new URLSearchParams(search || '').get('v')
  return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null
}

export function videosCoverSrc(videoId: string): string {
  return cfImage(youTubeThumbUrl(videoId), { width: VIDEOS_COVER_WIDTH })
}
