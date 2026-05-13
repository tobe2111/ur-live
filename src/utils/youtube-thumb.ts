/**
 * YouTube 썸네일 fallback 헬퍼.
 *
 * YouTube CDN 의 vi/<id>/<size>.jpg 는 다음 경우 404 가 정상:
 *   - 영상이 삭제 / 비공개로 전환됨
 *   - 라이브 broadcast 만 생성하고 실제 송출 안 함 (frame 부재로 썸네일 미생성)
 *   - 라이브 시작 직후 15-30초 동안 CDN 복제 지연
 *
 * 404 자체는 정상 — 사용자에게 broken-image 아이콘 노출 방지가 목적.
 */

const PLACEHOLDER_BG = 'rgba(0,0,0,0)' // 부모 div 가 placeholder 배경/아이콘 처리

/**
 * 썸네일 onError 핸들러 — mqdefault → hqdefault → 숨김 체인.
 * <img onError={onYoutubeThumbError} />
 */
export function onYoutubeThumbError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement
  const src = img.src
  // mqdefault 404 → hqdefault 시도
  if (src.includes('mqdefault.jpg')) {
    img.src = src.replace('mqdefault.jpg', 'hqdefault.jpg')
    return
  }
  // hqdefault 404 → maxresdefault 마지막 시도
  if (src.includes('hqdefault.jpg')) {
    img.src = src.replace('hqdefault.jpg', 'maxresdefault.jpg')
    return
  }
  // 모두 실패 → 숨김 (부모의 placeholder 가 노출)
  img.style.display = 'none'
  img.style.backgroundColor = PLACEHOLDER_BG
}

/**
 * 우선순위에 따라 가장 적합한 thumbnail URL 반환.
 *   custom_thumbnail_url → thumbnail_url → image_url → YouTube hqdefault
 */
export function getStreamThumb(s: {
  custom_thumbnail_url?: string | null
  thumbnail_url?: string | null
  image_url?: string | null
  youtube_video_id?: string | null
}): string | null {
  if (s.custom_thumbnail_url) return s.custom_thumbnail_url
  if (s.thumbnail_url) return s.thumbnail_url
  if (s.image_url) return s.image_url
  if (s.youtube_video_id) return `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`
  return null
}
