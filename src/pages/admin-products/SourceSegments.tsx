/**
 * 📦 상품 종류 1차 세그먼트 — 교환권(기프티콘) / 쇼핑(배송) / 전체.
 *   〔2026-08-16 `AdminProductsPage.tsx`(927줄, god 파일 래칫 동결)에서 추출 — 마크업 불변〕
 *
 * ⚠️ 이 세그먼트는 **"유어딜 안에서 무엇인가"** 를 고른다. 그 위의 서비스 스코프
 * (`AdminServiceScopeTabs` — "누구 가게인가")가 상위 질문이라 화면에서도 위에 온다.
 * 둘을 같은 층으로 두면 대표가 "교환권"을 골랐을 때 그게 유어딜 것인지 몰 것인지 알 수 없다.
 *
 * 🩸 2026-09-16 체리픽: 원 커밋(08-16)의 마크업은 **이모지 + `bg-blue-50`/`text-amber-600`** 이었다.
 *   그 사이 main 이 lucide 아이콘과 디자인 토큰(`border-brand bg-brand-tint`·`text-tone-warn`)으로
 *   옮겼고 `admin-tones-2026-09-15` 가 어드민 표면의 **이모지 0 · 색 정보상자 0** 을 잠갔다.
 *   ⇒ 추출(래칫)은 받고 **내용은 main 것**을 쓴다. 원본을 그대로 되살렸다면 가드 둘이 빨간불이다.
 */
import { Boxes, Gift, ShoppingBag, type LucideIcon } from 'lucide-react'

export type ProductSource = 'all' | 'kt_alpha' | 'regular'

const SEGMENTS: Array<{ key: ProductSource; label: string; desc: string; Icon: LucideIcon }> = [
  { key: 'all', label: '전체 상품', desc: '교환권 + 쇼핑 모두', Icon: Boxes },
  { key: 'kt_alpha', label: '교환권 (기프티콘)', desc: 'KT 기프티쇼 자동발송 상품', Icon: Gift },
  { key: 'regular', label: '쇼핑 상품 (배송)', desc: '실물 배송/일반 판매 상품', Icon: ShoppingBag },
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
            value === seg.key ? 'border-brand bg-brand-tint' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <seg.Icon className="w-[18px] h-[18px] shrink-0 text-gray-500" strokeWidth={1.9} aria-hidden />
            <div>
              <p className={`text-sm font-bold ${value === seg.key ? 'text-gray-700' : 'text-gray-900'}`}>
                {seg.label}
                {seg.key === 'kt_alpha' && (
                  <span className="ml-1.5 text-xs font-medium text-tone-warn">{ktAlphaCount.toLocaleString()}</span>
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
