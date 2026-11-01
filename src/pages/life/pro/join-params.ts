/**
 * 🔗 공유 링크에서 온 업체의 미리 채움(`?share=&cat=&sido=&sigungu=`) — 로그인 왕복을 건너가게 세션에 맡긴다.
 * 로그인은 복귀 주소의 쿼리를 지운다(`safeInternalPath`). 그래서 랜딩이 누르는 순간 여기 적고,
 * `/life/pro` 가 주소에 쿼리가 없을 때 한 번 읽고 지운다.
 */
export const JOIN_KEY = 'ur_life_pro_join'

export function joinParams(search: string): URLSearchParams {
  const here = new URLSearchParams(search)
  if (here.get('share')) return here
  try {
    const saved = sessionStorage.getItem(JOIN_KEY)
    if (saved) { sessionStorage.removeItem(JOIN_KEY); return new URLSearchParams(saved) }
  } catch { /* 막힌 저장소 */ }
  return here
}
