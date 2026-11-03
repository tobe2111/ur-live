/**
 * 🏠 2026-11-03 대표 *"홈 페이지에서 윗부분 동탄5동, 전체, 식사 … 로고 전체적으로 그 부분이 되게 느려 처음에"*
 *
 * 홈 맨 위 위치 이름("동탄5동"·"서울"·"전국")을 서버 첫 화면이 **처음부터** 그리게, 화면이 마지막에 그린 이름을 쿠키로 남긴다.
 * 서버는 지역(localStorage)·위치를 모른다 — 그래서 ① 쿠키가 없으면(처음 온 손님) '전국'(화면 규칙 `homeLocationLabel` 과 같다)
 * ② 있으면 그 글자. 표시용이다(권한·금액 무관) — 틀려도 이름 한 줄이 마운트 때 바뀔 뿐 자리는 같다.
 * 받는 쪽(워커)이 길이를 자르고 HTML 탈출한다.
 */
export const HOME_LOC_LABEL_COOKIE = 'ur_home_loc'
export const HOME_LOC_LABEL_DEFAULT = '전국'
const MAX = 20

export function homeLocLabelCookie(label: string): string {
  const v = encodeURIComponent((label || '').trim().slice(0, MAX))
  return `${HOME_LOC_LABEL_COOKIE}=${v}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function homeLocLabelFromCookieHeader(header: string | null | undefined): string {
  const m = (header || '').match(new RegExp(`(?:^|;\\s*)${HOME_LOC_LABEL_COOKIE}=([^;]*)`))
  if (!m) return HOME_LOC_LABEL_DEFAULT
  try {
    const v = decodeURIComponent(m[1]).replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX)
    return v || HOME_LOC_LABEL_DEFAULT
  } catch {
    return HOME_LOC_LABEL_DEFAULT
  }
}
