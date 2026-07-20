/**
 * 통합 공유 버튼
 * - 한국: 카카오톡 공유 우선 + 일반 공유 폴백
 * - 해외: navigator.share 또는 링크 복사
 */
import { toast } from '@/hooks/useToast'
import { isKorea } from '@/shared/config/region'
import { useTranslation } from 'react-i18next'

interface ShareButtonProps {
  title: string
  description: string
  imageUrl?: string
  link: string
  buttonText?: string
  className?: string
  style?: React.CSSProperties
  compact?: boolean
  /**
   * 💰 커머스 카드(카카오 commerce 템플릿) — 가격이 있으면 공유 카드가 쇼핑몰 상품처럼 렌더:
   *   정가 취소선 → 할인가 강조 + 할인율 배지 + 버튼 2개. 가격이 없으면 자동으로 기존 feed 카드.
   *   ⚠️ 딜(원화 아님) 결제 상품은 넘기지 말 것 — 카카오 커머스는 '원' 표기 전용.
   */
  regularPrice?: number   // 정가(원). salePrice 와 함께면 취소선. 없고 salePrice 만 있으면 그 값이 정가.
  salePrice?: number      // 할인/판매가(원)
  discountRate?: number   // 할인율(%). 없어도 regular>sale 이면 자동 계산.
  secondaryButtonText?: string // 커머스 카드 2번째 버튼(기본 '자세히 보기')
}

/** 가격 props → 카카오 commerce 객체(또는 null). 정가만/할인가만/할인율만 어떤 조합이든 안전 처리. */
function buildCommerce(regularPrice?: number, salePrice?: number, discountRate?: number): { regularPrice: number; discountPrice?: number; discountRate?: number } | null {
  const sale = Math.round(Number(salePrice) || 0)
  let regular = Math.round(Number(regularPrice) || 0)
  let rate = Math.round(Number(discountRate) || 0)
  // 할인율만 주어지고 정가가 없으면 판매가에서 역산.
  if (sale > 0 && rate > 0 && regular <= sale) regular = Math.round(sale / (1 - Math.min(rate, 95) / 100))
  const hasDiscount = sale > 0 && regular > sale
  if (hasDiscount && rate <= 0) rate = Math.round((1 - sale / regular) * 100)
  const base = regular || sale
  if (!base || base <= 0) return null
  const commerce: { regularPrice: number; discountPrice?: number; discountRate?: number } = { regularPrice: base }
  if (hasDiscount) {
    commerce.discountPrice = sale
    if (rate > 0) commerce.discountRate = rate // 카카오: discountRate 는 discountPrice 있을 때만 유효
  }
  return commerce
}

async function shareKakao(
  title: string, description: string, imageUrl: string | undefined, fullUrl: string,
  buttonText: string | undefined,
  commerce: ReturnType<typeof buildCommerce>, secondaryButtonText?: string,
) {
  const { ensureKakaoSdk } = await import('@/lib/kakao-sdk')
  await ensureKakaoSdk()
  const link = { mobileWebUrl: fullUrl, webUrl: fullUrl }
  const img = imageUrl || 'https://urdeal.kr/icons/og-default.png'
  if (commerce) {
    // 🛒 커머스 카드 — 가격/할인율 강조 + 버튼 2개(중복 라벨이면 1개).
    const primary = buttonText || '구매하기'
    const secondary = secondaryButtonText || '자세히 보기'
    const buttons = [{ title: primary, link }]
    if (secondary && secondary !== primary) buttons.push({ title: secondary, link })
    ;(window as any).Kakao.Share.sendDefault({
      objectType: 'commerce',
      content: { title, imageUrl: img, link },
      commerce,
      buttons,
    })
    return
  }
  ;(window as any).Kakao.Share.sendDefault({
    objectType: 'feed',
    content: { title, description, imageUrl: img, link },
    buttons: [
      { title: buttonText || '유어딜에서 보기', link },
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

export default function KakaoShareButton({ title, description, imageUrl, link, buttonText, className, compact, style, regularPrice, salePrice, discountRate, secondaryButtonText }: ShareButtonProps) {
  const { t } = useTranslation()
  const fullUrl = `https://urdeal.kr${link}`
  const kr = isKorea()
  const commerce = buildCommerce(regularPrice, salePrice, discountRate)

  const handleShare = async () => {
    if (kr) {
      try {
        await shareKakao(title, description, imageUrl, fullUrl, buttonText, commerce, secondaryButtonText)
      } catch {
        // 카카오 실패 시 일반 공유로 폴백
        await shareNative(title, description, fullUrl).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      }
    } else {
      await shareNative(title, description, fullUrl).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    }
  }

  if (compact) {
    // className이 원형 버튼이면 아이콘만, 아니면 텍스트 포함
    const isCircle = className?.includes('rounded-full')
    return (
      <button onClick={handleShare} className={className || "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95"} style={style} aria-label={t('common.share', { defaultValue: '공유' })}>
        {isCircle ? (
          <svg style={{ width: 18, height: 18, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        ) : (kr ? '💬 공유' : '🔗 Share')}
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
