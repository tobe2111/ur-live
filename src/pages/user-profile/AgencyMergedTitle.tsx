import { SectionTitle } from './list-grammar'
import { useAgencyPresence } from './useAgencyPresence'

/**
 * 🧩 '내 가게' 와 '에이전시' 를 한 구역으로 — 2026-11-02 대표 *"에이전시 계정이니까 에이전시 계정 안에 저 업체들이
 *   종속되는 형태잖아? 근데 왜 따로 노는 형태인거지?"* → 통합 시안 v2.
 *
 * 에이전시 로그인이 있고 이 사람이 맡은 매장(내 가게)이 있으면, 그 매장 판 **위**에 에이전시 이름을 구역 제목으로
 *   세운다. 매장 판(사용처리·이용권 등록·관리·매출…)은 그대로이고, 에이전시 할 일은 그 판 **아래** '에이전시'
 *   묶음으로 이어진다(`MyAgencyZone merged`). 에이전시가 없거나 매장이 없으면 아무것도 그리지 않는다.
 */
export default function AgencyMergedTitle({ storeCount }: { storeCount: number }) {
  const { on, agencyName, isAdmin } = useAgencyPresence()
  if (!on || storeCount <= 0) return null
  return (
    <div data-testid="agency-merged-title">
      <SectionTitle>{agencyName || '에이전시'}</SectionTitle>
      <p className="px-4 mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        에이전시 · {isAdmin ? '관리자' : '직원'} · 매장 {storeCount}곳
      </p>
    </div>
  )
}
