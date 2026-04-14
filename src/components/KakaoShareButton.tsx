/**
 * 카카오톡 공유 버튼
 * - 상품/라이브 페이지에서 카카오톡으로 친구에게 공유
 * - Kakao JS SDK의 Share.sendDefault 사용 (별도 승인 불필요)
 * - friends API 승인 후에는 친구 목록 기반 공유도 가능
 */
import { toast } from '@/hooks/useToast'

interface KakaoShareProps {
  title: string
  description: string
  imageUrl?: string
  link: string
  buttonText?: string
  className?: string
  compact?: boolean
}

function ensureKakaoSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.Kakao?.isInitialized()) { resolve(); return }
    if (w.Kakao) {
      const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY
      if (key) { w.Kakao.init(key); resolve() }
      else reject(new Error('Kakao JS key not set'))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    script.onload = () => {
      const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY
      if (key && w.Kakao) { w.Kakao.init(key); resolve() }
      else reject(new Error('Kakao SDK load failed'))
    }
    script.onerror = () => reject(new Error('Kakao SDK load failed'))
    document.head.appendChild(script)
  })
}

export default function KakaoShareButton({ title, description, imageUrl, link, buttonText, className, compact }: KakaoShareProps) {
  const handleShare = async () => {
    try {
      await ensureKakaoSDK()
      const fullUrl = `https://live.ur-team.com${link}`
      ;(window as any).Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description,
          imageUrl: imageUrl || 'https://live.ur-team.com/icons/og-default.png',
          link: { mobileWebUrl: fullUrl, webUrl: fullUrl },
        },
        buttons: [
          { title: buttonText || '유어딜에서 보기', link: { mobileWebUrl: fullUrl, webUrl: fullUrl } },
        ],
      })
    } catch {
      toast.error('카카오톡 공유 기능을 불러올 수 없습니다')
    }
  }

  if (compact) {
    return (
      <button onClick={handleShare} className={className || "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95"}>
        💬 공유
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      className={className || "w-full flex items-center justify-center gap-2 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-[0.97]"}
    >
      💬 카카오톡 공유하기
    </button>
  )
}
