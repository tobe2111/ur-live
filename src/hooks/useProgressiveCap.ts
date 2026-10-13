import { startTransition, useEffect, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { runAfterLoad } from '@/lib/after-load'

/**
 * 📜 긴 목록의 **첫 렌더 개수 상한** — 나머지는 페이지가 다 뜬 뒤에 그린다(2026-10-13).
 *
 * 왜: 홈 피드는 첫 응답 50장을 **한 번에** 그렸다. 그런데 홈에서 이 피드는 편성 섹션 아래(모바일 1,605px)라
 *   첫 화면에 한 장도 안 보인다. 재생 측정(느린 4G · CPU 4배)의 첫 렌더 CPU 에서 카드 부품이 가장 큰
 *   앱 코드였다 — 보이지도 않는 50장을 짓느라 사람이 누를 수 있게 되는 시점이 늦었다.
 *
 * 규칙:
 *   - 처음엔 `initial` 장만 그린다. `load` 뒤 한가할 때 전부(전환 우선순위 — 입력을 막지 않는다).
 *   - **뒤로가기(POP)로 돌아온 경우는 처음부터 전부** — 짧은 목록이면 스크롤 복원이 빗나간다.
 *     하드로드도 POP 이지만 `location.key === 'default'` 라 구분된다.
 *   ⚠️ 호출부는 무한 스크롤 센티넬을 `capped === false` 일 때만 켤 것 — 짧은 목록이면 센티넬이 화면 안에
 *      들어와 다음 페이지를 엉뚱하게 일찍 부른다.
 */
export function useProgressiveCap(initial: number): { cap: number; capped: boolean } {
  const navType = useNavigationType()
  const location = useLocation()
  const restoring = navType === 'POP' && location.key !== 'default'
  const [full, setFull] = useState(restoring)
  useEffect(() => {
    if (full) return
    return runAfterLoad(() => startTransition(() => setFull(true)))
  }, [full])
  return { cap: full ? Infinity : initial, capped: !full }
}
