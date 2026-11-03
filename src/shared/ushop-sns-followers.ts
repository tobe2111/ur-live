/**
 * 📈 유어샵 SNS 이름표의 팔로워 수 — 2026-11-03 대표 *"유어샵은 B. 근데 아직은 없지만 인스타그램, 틱톡 등
 *   연동도 해서 나타날텐데..?"* → *"응 그 순서대로 하자"*(시안 I5·I6).
 *
 * 숫자는 **SNS 연동(`user_sns_links`)으로 플랫폼에서 직접 받은 값만** 쓴다. 스스로 적은 숫자는 없다.
 * 🔒 이름표는 유저가 적은 주소(`users.instagram_url` 등)에서 나오고 숫자는 연동 계정에서 나온다 —
 *   둘이 **같은 계정일 때만** 숫자를 붙인다(`sameSnsAccount`). 다른 계정이면 남의 팔로워를 내 것처럼 보이게 된다.
 *
 * 이 파일은 API(붙일지 판정) · 화면(`CuratorHeader`) · 서버 첫 화면(`curator-ssr-body`)이 **같이** 쓴다 —
 *   글자가 갈리면 마운트 때 이름표 폭이 바뀌어 줄이 튄다.
 */
export type UShopSnsPlatform = 'youtube' | 'instagram' | 'tiktok'
export type UShopSnsFollowers = Partial<Record<UShopSnsPlatform, number>>

/** 1.2만 · 8,400 · 950 — 만 단위는 소수 한 자리(.0 은 뗀다). */
export function snsFollowerLabel(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n >= 10000) return `${(Math.floor(n / 1000) / 10).toFixed(1).replace(/\.0$/, '')}만`
  return Math.floor(n).toLocaleString('ko-KR')
}

/** 주소 안의 계정 이름(@ 포함 · 대소문자 무시)이 연동 계정 이름과 같은가. 이름을 모르면 붙이지 않는다. */
export function sameSnsAccount(url: string | null | undefined, username: string | null | undefined): boolean {
  const u = String(username ?? '').trim().replace(/^@/, '').toLowerCase()
  if (!u) return false
  const s = String(url ?? '').trim().toLowerCase()
  if (!s) return false
  // 주소 조각(경로·@핸들)을 낱말로 잘라 정확히 같은 조각이 있을 때만 — `jiwon` 이 `jiwon_food` 에 걸리지 않게.
  return s.split(/[/?#@\s]+/).some((part) => part === u)
}
