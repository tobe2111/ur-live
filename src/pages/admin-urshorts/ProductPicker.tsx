import { useEffect, useRef, useState } from 'react'
import { Search, X, Check } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

/**
 * 🔎 이용권 고르기 — **ID 를 외우게 하지 않는다** (2026-09-08 대표 신고).
 *
 * 처음엔 `<input type="number" placeholder="상품 ID">` 였다. 대표가 실제로 써 보고 물었다:
 * *"이용권 ID 입력 말고 다른 방법 없을까? ID 하나하나 다 모르는데."*
 * 맞는 지적이다 — 상품이 수백 개인데 번호를 아는 사람은 아무도 없고, **틀린 번호를 넣어도
 * 아무 에러가 안 난다**(존재하는 다른 상품이면 조용히 엉뚱한 이용권에 영상이 붙는다).
 *
 * ## 왜 새 API 를 안 만드나
 * 어드민 상품 검색(`GET /api/admin/products?q=`)이 이미 있고, 그 쿼리는 이름·설명뿐 아니라
 * **매장명(`restaurant_name`)까지 훑는다.** 2026-08-01 에 남긴 그 주석이 정확히 이 경우를
 * 말한다 — *"이용권은 상품명이 서로 비슷해서(버섯 샤브 2인 류) 매장명이 사실상 식별자다."*
 * 그러니 검색은 그걸 쓰고, 이 컴포넌트는 **고르는 일**만 한다.
 *
 * ## 고를 때 무엇을 보여 주나
 * 사진 · 매장명 · 상품명 · 가격. 이름만 보여 주면 "버섯 샤브 2인"이 셋 나왔을 때 못 고른다.
 * 활성 상품만 기본으로 찾는다 — 꺼진 상품에 영상을 붙이면 홈에 영원히 안 나온다
 * (공개 쿼리가 `p.is_active = 1` 로 거른다).
 */

interface Hit {
  id: number
  name: string
  restaurant_name?: string | null
  image_url?: string | null
  price?: number | null
  category?: string | null
}

export default function ProductPicker({
  value, label, onPick,
}: {
  value: number | null
  /** 이미 연결돼 있으면 그 이름(매장명 우선) — 버튼에 그대로 보여 준다. */
  label?: string | null
  onPick: (productId: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  // 바깥을 누르면 닫힌다 — 목록이 여러 줄이라 열어 둔 채 다른 줄을 만지면 헷갈린다.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 🔴 타이핑마다 부르지 않는다 — 어드민이라 트래픽은 작지만 D1 읽기는 계정 단위 한도다
  //   (2026-09-01 에 그 한도를 넘겨 소비자 API 가 통째로 멈춘 적이 있다).
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 1) { setHits(null); return }
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      api.get<{ success?: boolean; data?: Hit[] }>(
        `/api/admin/products?status=active&limit=20&q=${encodeURIComponent(term)}`,
      )
        .then((r) => { if (alive) setHits(Array.isArray(r.data?.data) ? r.data.data : []) })
        .catch(() => { if (alive) setHits([]) })
        .finally(() => { if (alive) setBusy(false) })
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [q, open])

  return (
    <div ref={boxRef} className="relative w-[210px] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[12px] ${
          value
            ? 'border-gray-200 bg-white text-gray-900'
            : 'border-red-200 bg-red-50 font-semibold text-red-600'
        }`}
      >
        <Search size={12} className="shrink-0 opacity-60" />
        <span className="truncate">{value ? (label || `#${value}`) : '이용권 고르기'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[10500] w-[340px] rounded-xl border border-gray-200 bg-white p-2 shadow-2xl">
          <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2">
            <Search size={13} className="shrink-0 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="매장명 또는 이용권 이름"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-gray-900 outline-none"
            />
            {value != null && (
              <button
                type="button"
                onClick={() => { onPick(null); setOpen(false) }}
                title="연결 해제"
                className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-700"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="mt-1.5 max-h-[300px] overflow-y-auto">
            {busy && <p className="px-2 py-3 text-[12px] text-gray-400">찾는 중…</p>}
            {!busy && hits?.length === 0 && (
              <p className="px-2 py-3 text-[12px] text-gray-500">
                찾는 이용권이 없어요. 매장명으로도 찾아 보세요.
              </p>
            )}
            {!busy && hits == null && (
              <p className="px-2 py-3 text-[12px] text-gray-400">매장명이나 이용권 이름을 입력하세요.</p>
            )}
            {!busy && hits?.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => { onPick(h.id); setOpen(false); setQ('') }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50"
              >
                {h.image_url ? (
                  <img
                    src={cfImage(h.image_url, { width: 80 })} alt=""
                    width={32} height={32}
                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                    onError={(e) => cfImageOnError(e.currentTarget, h.image_url || '')}
                  />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-md bg-gray-100" />
                )}
                <span className="min-w-0 flex-1">
                  {h.restaurant_name && (
                    <span className="block truncate text-[11px] text-gray-500">{h.restaurant_name}</span>
                  )}
                  <span className="block truncate text-[12.5px] text-gray-900">{h.name}</span>
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-gray-600">
                  {h.price != null ? `${formatNumber(h.price)}원` : ''}
                </span>
                {value === h.id && <Check size={13} className="shrink-0 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
