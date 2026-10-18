/**
 * 🏷️ 이용권 상세 "다른 지점" 한 줄의 문구 — 서버(`/api/brands/of-store`)가 센 수만 말한다.
 *
 * - `usable_branches` = 이 이용권을 받는 **같은 주인** 지점 수 + 판 지점(1·2단계 — 늘 받는다).
 * - `cross_owner_branches` = 받기를 켠 **다른 점주** 지점 수(3단계, 게이트 OFF 면 0). 소개 링크로 산 이용권은
 *   그 지점들이 받지 않으므로(결재 ②) "어디서나" 에 섞지 않고 따로 말하고, 주의 한 줄을 붙인다.
 * 순수 함수 — 화면과 시험이 같은 문구를 본다.
 */
export interface BrandBranchesRef { name: string; branch_count: number; usable_branches?: number; cross_owner_branches?: number }

export function brandBranchesLabel(d: BrandBranchesRef): { main: string; note: string | null } {
  const usable = Number(d.usable_branches) || 0
  const cross = Number(d.cross_owner_branches) || 0
  const note = cross > 0 ? '소개 링크로 산 이용권은 가맹점에서 못 쓸 수 있어요' : null
  if (cross > 0 && usable > 1) return { main: `${d.name} ${usable}곳 + 가맹점 ${cross}곳에서 사용 가능 · 지점 보기`, note }
  if (cross > 0) return { main: `${d.name} 가맹점 ${cross}곳에서도 사용 가능 · 지점 보기`, note }
  if (usable > 1) return { main: `${d.name} ${usable}곳 어디서나 사용 가능 · 지점 보기`, note: null }
  return { main: `${d.name} 다른 지점 ${Math.max(0, (Number(d.branch_count) || 0) - 1)}곳 보기`, note: null }
}
