/**
 * 배너 제목 줄 수 제한 (2026-10-15 대표 — 어드민에서 줄 띄어쓰기를 직접 정한다).
 *
 * 배너는 두 줄까지 보인다(line-clamp-2). 세 번째 줄부터를 그대로 두면 화면에선 잘려 사라지므로,
 * 두 번째 줄 뒤의 줄바꿈은 공백으로 이어 붙인다 — 글자는 남고 줄만 두 줄로 묶인다.
 */
export const BANNER_TITLE_MAX_LINES = 2

export function clampTitleLines(value: string): string {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length <= BANNER_TITLE_MAX_LINES) return lines.join('\n')
  const head = lines.slice(0, BANNER_TITLE_MAX_LINES - 1)
  return [...head, lines.slice(BANNER_TITLE_MAX_LINES - 1).join(' ')].join('\n')
}
