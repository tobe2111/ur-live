// 🔗 2026-06-17 링크샵 통일 (#6): SNS 핸들/URL → 절대 URL 정규화 (핸들·@핸들·전체URL 모두 허용).
//   큐레이터 링크샵(CuratorHeader)·셀러 링크샵(ProfileHeader) 공용 — 중복 제거(SSOT).
export function snsUrl(platform: 'youtube' | 'instagram' | 'tiktok', v: string): string {
  const s = v.trim()
  if (/^https?:\/\//i.test(s)) return s
  const h = s.replace(/^@/, '')
  if (platform === 'youtube') return `https://youtube.com/@${h}`
  if (platform === 'instagram') return `https://instagram.com/${h}`
  return `https://tiktok.com/@${h}`
}
