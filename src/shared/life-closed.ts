/**
 * 🚧 생활 견적(`/life*`) 공개 입구 닫힘 — 2026-11-12 대표 지시(토스페이먼츠 PG 심사).
 *
 * 토스가 홈페이지 심사에서 **"견적 문의"** 를 입점 불가 업종으로 지적했다(정해진 가격 없이 나중에 금액이
 * 정해지는 거래). 대표 *"응 너가 해줄래?"* — 기능·데이터는 그대로 두고 **손님이 들어오는 입구만** 닫는다:
 *   - 워커: `/life` · `/life/*` 문서 요청 → 홈으로 302(임시 — 다시 열 수 있으니 301 아님)
 *   - sitemap: 생활 URL 제출 중단
 *   - 홈 탭·PC 상단 네비의 '생활' 버튼 숨김(`deal-cats.ts`)
 * 운영팀 화면(`/admin/home-service`)과 API 는 손대지 않는다.
 *
 * 🔁 다시 열려면 이 값을 `false` 로 바꾸면 된다(위 세 곳이 이 값 하나만 본다).
 */
export const LIFE_PUBLIC_CLOSED = true

/** `/life` 허브와 그 아래 모든 화면(요청서·업체 모집·공유·업체 소개·내 요청). */
export function isClosedLifePath(pathname: string): boolean {
  if (!LIFE_PUBLIC_CLOSED) return false
  return pathname === '/life' || pathname.startsWith('/life/')
}
