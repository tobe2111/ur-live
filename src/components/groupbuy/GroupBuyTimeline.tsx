/**
 * 커뮤니티 공동구매 타임라인 — "참여 → 달성 대기 → 결제 확정 → 배송" 시각화.
 *
 * ⚠️ 주의: 이 컴포넌트는 **커뮤니티 공동구매** (`/api/community-group-buy/*`)
 *         전용입니다. 유저가 보증금 내고 목표 인원 달성해야 성사되는 구조.
 *
 *         셀러가 등록하는 일반 식사권 상품은 개인 즉시 구매이므로
 *         이 타임라인을 쓰지 마세요. 그 경우 group_buy_current 는
 *         단순 "구매자 수 사회적 증명" 입니다.
 */

import { Check } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Props {
  /** 0: 참여 전 / 1: 참여 완료 / 2: 달성 / 3: 배송 시작 */
  stage: 0 | 1 | 2 | 3
  className?: string
}

const STAGES = [
  { label: '참여', desc: '공동구매 신청' },
  { label: '달성 대기', desc: '목표 인원 모집' },
  { label: '결제 확정', desc: '달성 후 자동 결제' },
  { label: '배송/발급', desc: '상품 또는 식사권' },
]

export function GroupBuyTimeline({ stage, className }: Props) {
  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      {STAGES.map((s, i) => {
        const done = i < stage
        const active = i === stage
        const pending = i > stage
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                done ? 'bg-green-500 text-white'
                : active ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                : 'bg-gray-200 text-gray-400'
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <p className={`text-[10px] font-bold text-center leading-tight ${
                done ? 'text-green-700' : active ? 'text-blue-700' : 'text-gray-400'
              }`}>{s.label}</p>
              <p className={`text-[9px] text-center leading-tight ${pending ? 'text-gray-300' : 'text-gray-500'}`}>{s.desc}</p>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-[2px] flex-1 rounded mb-5 -mx-1 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 참여 후 친구 초대 CTA — "X명만 더 모이면 달성!"
 * 결제 성공 화면 / 공동구매 상세에서 쓰는 공유 버튼들.
 */
interface InviteCTAProps {
  productId: number
  productName: string
  remaining: number
  className?: string
}

export function GroupBuyInviteCTA({ productId, productName, remaining, className }: InviteCTAProps) {
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://live.ur-team.com'}/products/${productId}`
  const shareText = `[유어딜 공동구매] ${productName} — ${remaining}명만 더 모이면 달성!`

  async function shareNative() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: productName, text: shareText, url: shareUrl })
      } catch { /* cancelled */ }
    } else {
      copyLink()
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      .then(() => toast.success('링크가 복사되었습니다'))
      .catch(() => { /* ignore */ })
  }

  function shareKakao() {
    // Kakao SDK 있으면 사용, 없으면 fallback
    const k = (typeof window !== 'undefined') ? (window as unknown as { Kakao?: { Share?: { sendDefault: (opts: unknown) => void } } }).Kakao : undefined
    if (k?.Share?.sendDefault) {
      k.Share.sendDefault({
        objectType: 'feed',
        content: { title: productName, description: shareText, imageUrl: '', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
      })
    } else {
      // Kakao 없으면 네이티브 share 대체
      shareNative()
    }
  }

  return (
    <div className={`bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3 ${className || ''}`}>
      <div className="text-center">
        <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">친구 초대</p>
        <p className="text-base font-extrabold text-amber-900 mt-1">
          {remaining <= 0 ? '🎉 달성 완료!' : `${remaining}명만 더 모이면 달성!`}
        </p>
        {remaining > 0 && (
          <p className="text-xs text-amber-700 mt-1">친구를 초대하고 할인 쿠폰을 받아보세요</p>
        )}
      </div>
      {remaining > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={shareKakao}
            className="py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-[#3C1E1E] text-xs font-bold flex items-center justify-center gap-1">
            💬 카톡
          </button>
          <button onClick={shareNative}
            className="py-2.5 rounded-xl bg-white border border-amber-300 text-amber-700 text-xs font-bold flex items-center justify-center gap-1">
            📤 공유
          </button>
          <button onClick={copyLink}
            className="py-2.5 rounded-xl bg-white border border-amber-300 text-amber-700 text-xs font-bold flex items-center justify-center gap-1">
            🔗 복사
          </button>
        </div>
      )}
    </div>
  )
}
