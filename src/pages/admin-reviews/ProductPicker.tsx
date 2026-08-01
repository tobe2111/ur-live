/**
 * 🔎 2026-08-01 (대표: "상품 선택 시 매장명을 보여줘야 해. 이 많은걸 스크롤로 어떻게 확인해?")
 *
 * 기존 `/admin/reviews` 의 상품 선택은 **네이티브 `<select>` 하나에 전 상품**이었다. 두 가지가 동시에 문제였다:
 *   ① 옵션 라벨이 상품명뿐 — 이용권·동네딜은 이름이 서로 비슷해("버섯 샤브 2인 …") **매장명 없이는 구분 불가**.
 *   ② 목록이 서버 기본 100건에서 잘려 있었고, 그마저도 스크롤로만 훑어야 했다(= 사실상 못 찾음).
 *
 * 그래서 "긴 목록을 잘 스크롤하게" 대신 **찾아서 좁히는** 방식으로 바꾼다:
 *   검색(상품명 + **매장명** 서버측) · 카테고리 칩 · "리뷰 없는 것만" 토글 · 결과 카드에 매장명/리뷰현황 노출.
 *   리뷰 생성의 실제 목적이 "리뷰 0개인 상품 채우기"라 그 토글이 기본 진입점이 된다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Search, Star, X, Store, Loader2 } from 'lucide-react'
import api from '@/lib/api'

export interface PickerProduct {
  id: number
  name: string
  image_url?: string | null
  price?: number
  category?: string | null
  restaurant_name?: string | null
  seller_name?: string | null
  review_count?: number
  avg_rating?: number
}

/** 상품을 사람이 알아보는 이름 — 매장명이 있으면 그게 먼저다(이용권·동네딜의 실질 식별자). */
export function storeLabel(p: PickerProduct): string | null {
  return p.restaurant_name?.trim() || p.seller_name?.trim() || null
}

const CATEGORY_CHIPS: Array<{ key: string; label: string }> = [
  { key: '', label: '전체' },
  { key: 'meal_voucher', label: '식사' },
  { key: 'beauty_voucher', label: '미용' },
  { key: 'stay_voucher', label: '숙소' },
  { key: 'etc_voucher', label: '기타' },
]

export default function ProductPicker({
  selected,
  onSelect,
}: {
  selected: PickerProduct | null
  onSelect: (p: PickerProduct | null) => void
}) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [category, setCategory] = useState('')
  const [onlyEmpty, setOnlyEmpty] = useState(true)
  const [rows, setRows] = useState<PickerProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const p = new URLSearchParams({ limit: '100', sort: 'created', order: 'desc' })
    if (debouncedQ) p.set('q', debouncedQ)
    if (category) p.set('category', category)
    api.get(`/api/admin/products?${p.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    })
      .then(r => {
        if (!alive) return
        setRows(r.data?.success ? (r.data.data ?? []) : [])
        setTotal(r.data?.total ?? 0)
      })
      .catch(() => { if (alive) { setRows([]); setTotal(0) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [debouncedQ, category])

  // "리뷰 없는 것만" 은 클라에서 좁힌다 — 서버 필터가 아니라서, 켠 채로 결과가 비면
  // 그 사실을 그대로 알려 준다(조용히 빈 목록을 보여 주면 검색이 고장난 것처럼 보인다).
  const visible = useMemo(
    () => (onlyEmpty ? rows.filter(r => !r.review_count) : rows),
    [rows, onlyEmpty]
  )

  if (selected) {
    const store = storeLabel(selected)
    return (
      <div className="rounded-xl border-2 border-yellow-500 bg-yellow-50 p-3">
        <div className="flex items-center gap-3">
          {selected.image_url
            ? <img src={selected.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            : <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-200" />}
          <div className="min-w-0 flex-1">
            {store && (
              <p className="flex items-center gap-1 truncate text-[12px] font-bold text-gray-900">
                <Store className="h-3.5 w-3.5 shrink-0 text-gray-500" />{store}
              </p>
            )}
            <p className="truncate text-sm text-gray-700">{selected.name}</p>
            <p className="text-[11px] text-gray-500">
              리뷰 {selected.review_count ?? 0}개
              {!!selected.review_count && ` · 평균 ${(selected.avg_rating ?? 0).toFixed(1)}점`}
            </p>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-yellow-100"
            aria-label="선택 해제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="border-b border-gray-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="상품명 또는 매장명으로 검색"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORY_CHIPS.map(chip => (
            <button
              key={chip.key}
              onClick={() => setCategory(chip.key)}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                category === chip.key
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-gray-600">
            <input
              type="checkbox"
              checked={onlyEmpty}
              onChange={e => setOnlyEmpty(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            리뷰 없는 상품만
          </label>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-gray-500">
            {rows.length > 0 && onlyEmpty
              ? '검색 결과는 있지만 모두 리뷰가 있습니다 — "리뷰 없는 상품만" 을 끄면 보입니다.'
              : debouncedQ ? `"${debouncedQ}" 검색 결과가 없습니다.` : '상품이 없습니다.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {visible.map(p => {
              const store = storeLabel(p)
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      : <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[13px] font-bold text-gray-900">
                        {store
                          ? <><Store className="h-3.5 w-3.5 shrink-0 text-gray-400" />{store}</>
                          : <span className="text-gray-400">매장명 없음</span>}
                      </p>
                      <p className="truncate text-[12px] text-gray-600">{p.name}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-500">
                      {p.review_count
                        ? <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {(p.avg_rating ?? 0).toFixed(1)} · {p.review_count}
                          </span>
                        : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">리뷰 0</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500">
        {visible.length}개 표시
        {total > rows.length && ` · 전체 ${total}개 중 최근 ${rows.length}개만 불러왔습니다 — 검색으로 좁혀 주세요`}
      </p>
    </div>
  )
}
