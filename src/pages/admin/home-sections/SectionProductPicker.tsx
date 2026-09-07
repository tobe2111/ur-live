import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { Search, Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import { SECTION_MAX_LIMIT } from '@/shared/constants/home-showcase'
import { formatWon } from '@/utils/format'

/**
 * 🏠 "직접 고르기" 섹션에 상품을 담는 패널 (2026-08-04 대표 요청).
 *
 * 규칙 섹션(인기순·카테고리…)은 서버가 알아서 채우지만, `source='manual'` 섹션은
 * **여기서 담기 전까지 빈 줄**이고 빈 줄은 홈에서 아예 빠진다. 그래서 이 화면이 없으면
 * 직접 고르기는 선택은 되는데 쓸 수는 없는 반쪽 기능이었다(이 패널이 그 구멍을 메운다).
 *
 * 저장은 `POST /api/sections/:id/products` 하나로 **전체 교체**다 — 서버가 기존 행을 지우고
 * 배열 순서대로 다시 넣는다. 그래서 여기서 정한 순서가 곧 홈에 뜨는 순서다.
 */

interface PickerProduct {
  id: number
  name: string
  price?: number | null
  image_url?: string | null
  restaurant_name?: string | null
  category?: string | null
}

export default function SectionProductPicker({
  sectionId, initial, onClose, onSaved,
}: {
  sectionId: number
  initial: PickerProduct[]
  onClose: () => void
  onSaved: (msg: string, ok: boolean) => void
}) {
  const [picked, setPicked] = useState<PickerProduct[]>(initial)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)

  // 검색어가 없으면 최근 등록 상품을 보여준다 — 빈 화면보다 낫다(뭘 담을 수 있는지 보인다).
  const { data: results = [], isLoading, isError, refetch } = useApiQuery<PickerProduct[]>(
    ['admin', 'section-picker', q],
    '/api/admin/products',
    {
      params: { limit: 20, status: 'active', sort: 'created', order: 'desc', ...(q ? { q } : {}) },
      select: (r) => {
        const x = r as { success?: boolean; data?: PickerProduct[] }
        return x?.success ? (x.data ?? []) : []
      },
      staleTime: 30_000,
    },
  )

  const pickedIds = new Set(picked.map(p => p.id))
  const full = picked.length >= SECTION_MAX_LIMIT

  const add = (p: PickerProduct) => {
    if (pickedIds.has(p.id) || full) return
    setPicked(prev => [...prev, p])
  }
  const remove = (id: number) => setPicked(prev => prev.filter(p => p.id !== id))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= picked.length) return
    setPicked(prev => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      // ⚠️ 서버가 "전체 교체"라 빈 배열은 400 을 준다. 전부 비우려면 섹션을 숨기거나 지우는 게 맞다.
      if (picked.length === 0) { onSaved('상품을 1개 이상 담아 주세요. (비우려면 섹션을 숨기세요)', false); return }
      await api.post(`/api/sections/${sectionId}/products`, { product_ids: picked.map(p => p.id) })
      onSaved(`${picked.length}개 상품을 담았습니다.`, true)
      onClose()
    } catch {
      onSaved('상품 저장 실패', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 왼쪽 — 담긴 상품(= 홈에 뜨는 순서) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700">
              담긴 상품 <span className="text-gray-400 font-normal">{picked.length}/{SECTION_MAX_LIMIT}</span>
            </h4>
            <span className="text-xs text-gray-400">위에서부터 홈에 표시됩니다</span>
          </div>
          {picked.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
              아직 없습니다 — 오른쪽에서 골라 담으세요.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {picked.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <span className="w-5 text-center text-xs font-bold text-gray-400 tabular-nums">{i + 1}</span>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" loading="lazy" />
                    : <div className="w-9 h-9 rounded bg-gray-200 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {[p.restaurant_name, formatWon(p.price)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로"
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5 text-gray-500" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label="아래로"
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5 text-gray-500" /></button>
                  <button type="button" onClick={() => remove(p.id)} aria-label="빼기"
                    className="p-1 rounded hover:bg-red-50"><X className="w-3.5 h-3.5 text-red-400" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">닫기</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 오른쪽 — 상품 검색 */}
        <div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="상품명 · 매장명으로 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          {full && (
            <p className="mb-2 text-xs text-amber-600">최대 {SECTION_MAX_LIMIT}개까지 담을 수 있습니다.</p>
          )}
          {isError ? (
            // 🛡️ 빈 결과와 조회 실패를 구분한다 — 둘 다 "0건"으로 보이면 원인을 못 찾는다.
            <div className="py-8 text-center">
              <p className="text-xs text-gray-500 mb-2">상품을 불러오지 못했습니다.</p>
              <button type="button" onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200">다시 시도</button>
            </div>
          ) : isLoading ? (
            <p className="py-8 text-center text-xs text-gray-400">불러오는 중...</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">검색 결과가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {results.map(p => {
                const already = pickedIds.has(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" loading="lazy" />
                      : <div className="w-9 h-9 rounded bg-gray-100 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {[p.restaurant_name, formatWon(p.price)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={already || full}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" /> {already ? '담김' : '담기'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
