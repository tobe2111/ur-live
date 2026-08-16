/**
 * 📦 상품 종류 1차 세그먼트 — 교환권(기프티콘) / 쇼핑(배송) / 전체.
 *   〔2026-08-16 `AdminProductsPage.tsx`(927줄, god 파일 래칫 동결)에서 추출 — 마크업 불변〕
 *
 * ⚠️ 이 세그먼트는 **"유어딜 안에서 무엇인가"** 를 고른다. 그 위의 서비스 스코프
 * (`AdminServiceScopeTabs` — "누구 가게인가")가 상위 질문이라 화면에서도 위에 온다.
 * 둘을 같은 층으로 두면 대표가 "교환권"을 골랐을 때 그게 유어딜 것인지 몰 것인지 알 수 없다.
 */
export type ProductSource = 'all' | 'kt_alpha' | 'regular'

const SEGMENTS = [
  { key: 'all' as const, label: '전체 상품', desc: '교환권 + 쇼핑 모두', icon: '📦' },
  { key: 'kt_alpha' as const, label: '교환권 (기프티콘)', desc: 'KT 기프티쇼 자동발송 상품', icon: '🎁' },
  { key: 'regular' as const, label: '쇼핑 상품 (배송)', desc: '실물 배송/일반 판매 상품', icon: '🛍️' },
]

export function SourceSegments({
  value,
  onChange,
  ktAlphaCount,
}: {
  value: ProductSource
  onChange: (v: ProductSource) => void
  ktAlphaCount: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {SEGMENTS.map((seg) => (
        <button
          key={seg.key}
          onClick={() => onChange(seg.key)}
          className={`flex-1 min-w-[180px] text-left px-4 py-3 rounded-xl border-2 transition-colors ${
            value === seg.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{seg.icon}</span>
            <div>
              <p className={`text-sm font-bold ${value === seg.key ? 'text-blue-700' : 'text-gray-900'}`}>
                {seg.label}
                {seg.key === 'kt_alpha' && (
                  <span className="ml-1.5 text-xs font-medium text-amber-600">{ktAlphaCount.toLocaleString()}</span>
                )}
              </p>
              <p className="text-[11px] text-gray-500">{seg.desc}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
