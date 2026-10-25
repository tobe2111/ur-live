/**
 * 🏠 홈 '생활' 탭 아래 업종 칩 (2026-10-25 대표 시안 안 A · "1번 방식으로 가자").
 *
 * - 칩은 `shared/life-deal-subcat` 표를 그대로 그린다(전체 + 이사·청소·방역·소독·수리·설치·간판).
 * - 업종은 서버 `{ 상품 id: 업종 }` 표(`/api/home-service/deal-subcats`)에서 오고, 표가 아직 없거나
 *   그 이용권이 표에 없으면 **같은 SSOT 의 이름 추정**으로 거른다(서버도 같은 함수로 채운다).
 * - 생활 탭이 아닐 때는 요청도 안 하고(`enabled`) 거르지도 않는다 — 다른 탭은 byte-동일.
 * - 칩만 담은 가벼운 모듈이다(아이콘 0) — 홈 첫 화면 묶음에 들어가도 무게가 거의 없다.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { LIFE_SUBCATS, guessLifeSubcat, type LifeSubcat } from '@/shared/life-deal-subcat'

export type LifeSubFilter = 'all' | LifeSubcat

const LIFE_CATEGORY = 'home_voucher'

export function useLifeSubcat(category: string) {
  const on = category === LIFE_CATEGORY
  const [sub, setSub] = useState<LifeSubFilter>('all')
  useEffect(() => { if (!on) setSub('all') }, [on])
  const { data: map } = useQuery({
    queryKey: ['life-deal-subcats'],
    queryFn: async () => (await api.get('/api/home-service/deal-subcats')).data?.data as Record<string, LifeSubcat> | undefined,
    enabled: on,
    staleTime: 60_000,
  })
  const active = on && sub !== 'all'
  const keep = (p: { id?: number | string; name?: string | null }) => {
    if (!active) return true
    const s = (p.id != null ? map?.[String(p.id)] : undefined) ?? guessLifeSubcat(p.name)
    return s === sub
  }
  /** useMemo 의존성에 넣을 원시값(맵이 도착하면 다시 거른다). */
  const key = active ? `${sub}:${map ? 1 : 0}` : ''
  return { on, sub, setSub, keep, key }
}

export function LifeSubcatChips({ value, onChange }: { value: LifeSubFilter; onChange: (v: LifeSubFilter) => void }) {
  const chips: Array<{ key: LifeSubFilter; label: string }> = [{ key: 'all', label: '전체' }, ...LIFE_SUBCATS.map((s) => ({ key: s.key, label: s.label }))]
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 no-scrollbar" role="tablist" aria-label="생활 업종">
      {chips.map((c) => {
        const sel = c.key === value
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onChange(c.key)}
            className={`shrink-0 rounded-full px-[14px] py-2 text-[13px] font-medium ${sel ? 'bg-brand text-white' : 'bg-surface text-gray-700 shadow-lift dark:text-gray-200'}`}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
