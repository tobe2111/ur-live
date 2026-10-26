/**
 * 🔗 유어샵 SNS 링크 판정 — 화면·서버·서버 첫 화면이 함께 쓰는 규칙 (2026-10-26 대표)
 *
 * 대표: *"일반 유어딜 유어샵에서도 링크 넣을 때 인스타그램이랑 유튜브 그런 것들도 되어야겠지?"*
 *   — 칸은 이미 있었다(인스타그램·유튜브·틱톡). 빠진 것은 **그 칸이 그 플랫폼 주소만 받는가**였다.
 *   종전 서버는 `https://` 로 시작하면 아무 주소나 받아서, 인스타그램 이름표를 누르면 엉뚱한 사이트
 *   (도박·피싱)로 가게 만들 수 있었다. 생활 견적 후기 링크(`home-service-review.ts`)와 같은 원칙.
 *
 * 받는 것: ① 아이디(`@abc` · `abc`) ② 그 플랫폼 주소(앞의 `https://` 는 없어도 된다).
 * 🔒 읽을 때도 다시 거른다 — 규칙 전에 저장된 엉뚱한 주소가 이름표로 나가지 않게(서버 첫 화면도 같은 함수).
 */
export type SnsPlatform = 'youtube' | 'instagram' | 'tiktok'

export const SNS_HOSTS: Record<SnsPlatform, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
}

export const SNS_LABEL: Record<SnsPlatform, string> = { youtube: '유튜브', instagram: '인스타그램', tiktok: '틱톡' }

const HANDLE = /^@?[A-Za-z0-9._-]{1,60}$/

export type SnsStatus = { kind: 'empty' } | { kind: 'ok'; url: string } | { kind: 'bad' }

export function snsLinkStatus(platform: SnsPlatform, raw: unknown): SnsStatus {
  const s = String(raw ?? '').trim()
  if (!s) return { kind: 'empty' }
  // 아이디 — 점이 있어도 주소처럼 생기지 않았으면(`abc.def`) 아이디로 본다. 단 `.com` 같은 꼬리는 주소 쪽에서 판정.
  if (HANDLE.test(s) && !/\.[a-z]{2,}(\/|$)/i.test(s.replace(/^@/, ''))) {
    const h = s.replace(/^@/, '')
    if (platform === 'youtube') return { kind: 'ok', url: `https://youtube.com/@${h}` }
    if (platform === 'instagram') return { kind: 'ok', url: `https://instagram.com/${h}` }
    return { kind: 'ok', url: `https://tiktok.com/@${h}` }
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`
  let u: URL
  try { u = new URL(withScheme) } catch { return { kind: 'bad' } }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return { kind: 'bad' }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '')
  if (!SNS_HOSTS[platform].some((h) => host === h || host.endsWith(`.${h}`))) return { kind: 'bad' }
  u.protocol = 'https:'
  return { kind: 'ok', url: u.toString() }
}
