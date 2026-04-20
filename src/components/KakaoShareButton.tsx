/**
 * 통합 공유 버튼
 * - 한국: 카카오톡 공유 우선 + 일반 공유 폴백
 * - 해외: navigator.share 또는 링크 복사
 */
import { toast } from '@/hooks/useToast'
import { isKorea } from '@/shared/config/region'

interface ShareButtonProps {
  title: string
  description: string
  imageUrl?: string
  link: string
  buttonText?: string
  className?: string
  compact?: boolean
}

async function shareKakao(title: string, description: string, imageUrl: string | undefined, fullUrl: string, buttonText?: string) {
  const { ensureKakaoSdk } = await import('@/lib/kakao-sdk')
  await ensureKakaoSdk()
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
}

async function shareNative(title: string, description: string, fullUrl: string) {
  if (navigator.share) {
    await navigator.share({ title, text: description, url: fullUrl })
  } else {
    await navigator.clipboard.writeText(fullUrl)
    toast.success('링크가 복사되었습니다')
  }
}

export default function KakaoShareButton({ title, description, imageUrl, link, buttonText, className, compact }: ShareButtonProps) {
  const fullUrl = `https://live.ur-team.com${link}`
  const kr = isKorea()

  const handleShare = async () => {
    if (kr) {
      try {
        await shareKakao(title, description, imageUrl, fullUrl, buttonText)
      } catch {
        // 카카오 실패 시 일반 공유로 폴백
        await shareNative(title, description, fullUrl).catch(() => {})
      }
    } else {
      await shareNative(title, description, fullUrl).catch(() => {})
    }
  }

  if (compact) {
    return (
      <button onClick={handleShare} className={className || "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95"}>
        {kr ? '💬 공유' : '🔗 Share'}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleShare}
        className={className || "w-full flex items-center justify-center gap-2 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-[0.97]"}
      >
        {kr ? '💬 카카오톡 공유하기' : '🔗 Share'}
      </button>
      {!kr && (
        <div className="flex gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${fullUrl}`)}`} target="_blank" rel="noopener"
            className="flex-1 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold text-center">WhatsApp</a>
          <a href={`https://line.me/R/share?text=${encodeURIComponent(`${title} ${fullUrl}`)}`} target="_blank" rel="noopener"
            className="flex-1 py-2 bg-[#00B900] text-white rounded-xl text-xs font-bold text-center">LINE</a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`} target="_blank" rel="noopener"
            className="flex-1 py-2 bg-black text-white rounded-xl text-xs font-bold text-center">X</a>
        </div>
      )}
    </div>
  )
}
