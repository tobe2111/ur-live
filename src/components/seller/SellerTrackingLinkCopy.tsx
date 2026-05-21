/**
 * 🛡️ 2026-05-21 Phase D: 셀러 고유 판매 링크 위젯.
 *
 * 셀러가 자기 트래킹 링크를 한 클릭에 복사 → 인스타/카톡 공유.
 * URL 패턴: `https://live.ur-team.com/browse?seller=<sellerId>`
 *           또는 `?seller=<sellerId>&product=<productId>` (상품별)
 *
 * 클릭 → /browse 진입 시 sessionStorage 에 seller_ref 저장 →
 * 결제 시 referral_commissions 로 자동 attribution.
 *
 * AI 1 핵심 영업 무기: "인플 도파민 + 즉시 공유" UX.
 */
import { useMemo, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Props {
  sellerId: number | string
  productId?: number | string
  productName?: string
}

export default function SellerTrackingLinkCopy({ sellerId, productId, productName }: Props) {
  const [copied, setCopied] = useState(false)

  const url = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://live.ur-team.com'
    const params = new URLSearchParams({ seller: String(sellerId) })
    if (productId) params.set('product', String(productId))
    return productId
      ? `${base}/group-buy/${productId}?seller=${sellerId}`
      : `${base}/browse?${params.toString()}`
  }, [sellerId, productId])

  async function copy() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        // legacy fallback
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      toast.success('내 링크 복사됨! 인스타/카톡에 붙여넣으세요')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사 실패 — 길게 눌러 직접 복사하세요')
    }
  }

  async function share() {
    if (!navigator.share) { copy(); return }
    try {
      await navigator.share({
        title: productName || '유어딜 공동구매',
        text: productName ? `🔥 ${productName} 같이 사실 분?` : '🔥 유어딜 공동구매',
        url,
      })
    } catch { /* user cancelled */ }
  }

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🔗</span>
        <p className="text-xs font-bold text-purple-900">내 트래킹 링크</p>
      </div>
      <div className="bg-white rounded-lg px-3 py-2 mb-2 font-mono text-[10px] text-gray-700 truncate">
        {url}
      </div>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
        >
          {copied ? <><Check className="w-3.5 h-3.5" /> 복사됨!</> : <><Copy className="w-3.5 h-3.5" /> 링크 복사</>}
        </button>
        <button
          onClick={share}
          className="px-3 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg text-xs font-medium flex items-center gap-1"
        >
          <Share2 className="w-3.5 h-3.5" /> 공유
        </button>
      </div>
      <p className="text-[10px] text-purple-600 mt-2 leading-relaxed">
        💡 이 링크로 들어온 유저가 구매하면 자동 commission 적립됩니다.
      </p>
    </div>
  )
}
