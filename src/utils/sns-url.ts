// 🔗 2026-06-17 유어샵 통일 (#6): SNS 핸들/URL → 절대 URL 정규화 (핸들·@핸들·전체URL 모두 허용).
//   큐레이터 유어샵(CuratorHeader)·셀러 유어샵(ProfileHeader) 공용 — 중복 제거(SSOT).
// 🔒 2026-10-26: 판정은 `shared/sns-link.ts` 하나. 그 플랫폼 주소가 아니면 '' — 화면은 이름표를 안 그린다.
import { snsLinkStatus, type SnsPlatform } from '@/shared/sns-link'

export function snsUrl(platform: SnsPlatform, v: string | null | undefined): string {
  const st = snsLinkStatus(platform, v)
  return st.kind === 'ok' ? st.url : ''
}
