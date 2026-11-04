/**
 * 통합 공유 버튼
 * - 한국: 카카오톡 공유 우선 + 일반 공유 폴백
 * - 해외: navigator.share 또는 링크 복사
 */
import { toast } from '@/hooks/useToast'
import { useEffect, useState } from 'react'
import { isKorea } from '@/shared/config/region'
import { useTranslation } from '@/lib/i18n-lite'
import { buildCommerce, commercePayload, feedPayload, sendKakaoShare, shareViaKakao } from '@/lib/kakao-share'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 12차 ⑨ — 링크가 **복사됐을 때** 동그란 공유 버튼의 그림이 체크로 바뀌었다 돌아온다(버튼에서 눌렸다는 게 보인다).
//   ⚠️ 한국에선 이 버튼이 카카오톡 공유 창을 연다 — 체크는 카카오가 실패해 링크 복사로 넘어갔을 때(또는 해외)만 뜬다.
injectMotionCss('ur-m-sharecopy', `@keyframes ur-share-ok { from { opacity: 0; transform: scale(.4); } }.ur-share-copied { color: var(--brand-text); animation: ur-share-ok .32s cubic-bezier(.3,1.4,.5,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-share-copied{animation:none!important}}`)

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

/**
 * 🔁 2026-10-12 — `buildCommerce` 와 `sendDefault` 호출을 `lib/kakao-share.ts` 로 **행동 불변**으로
 *   옮겼다(유어샵 공유가 세 번째 사본이 되려던 참이었다 — 그 파일 머리말). 여기선 호출만 한다.
 */
/**
 * 🩸 2026-11-04 대표 *"share card 로 공유가 안 되고 있는 것들 정리해서"* — 이 함수는 `shareViaKakao` 의 **false**(SDK 못 받음·
 *   카카오 키 없음)를 버리고 있었다. 호출부는 **예외**일 때만 일반 공유로 넘어가서, 카카오가 안 되는 순간 버튼이
 *   **아무 일도 안 했다**(이용권·상품·공구 상세 · 블로그 · 숙소 · 추천 페이지 전부 이 버튼). ⇒ 보냈는지를 돌려준다.
 */
async function shareKakao(
  title: string, description: string, imageUrl: string | undefined, fullUrl: string,
  buttonText: string | undefined,
  commerce: ReturnType<typeof buildCommerce>, secondaryButtonText?: string,
): Promise<boolean> {
  if (commerce) {
    // 🛒 커머스 카드 — 가격/할인율 강조 + 버튼 2개(중복 라벨이면 1개).
    const primary = buttonText || '구매하기'
    const secondary = secondaryButtonText || '자세히 보기'
    const buttons = [{ title: primary }]
    if (secondary && secondary !== primary) buttons.push({ title: secondary })
    const p = commercePayload({ title, imageUrl, url: fullUrl, commerce, buttons })
    return sendKakaoShare(p) || await shareViaKakao(p)
  }
  const p = feedPayload({
    title, description, imageUrl, url: fullUrl,
    buttons: [{ title: buttonText || '유어딜에서 보기' }],
  })
  return sendKakaoShare(p) || await shareViaKakao(p)
}

/** @returns 링크를 클립보드에 복사했으면 true(그때만 버튼에 체크를 띄운다). */
async function shareNative(title: string, description: string, fullUrl: string): Promise<boolean> {
  if (navigator.share) {
    await navigator.share({ title, text: description, url: fullUrl })
    return false
  }
  await navigator.clipboard.writeText(fullUrl)
  toast.success('링크가 복사되었습니다')
  return true
}

export default function KakaoShareButton({ title, description, imageUrl, link, buttonText, className, compact, style, regularPrice, salePrice, discountRate, secondaryButtonText }: ShareButtonProps) {
  const { t } = useTranslation()
  const fullUrl = `https://urdeal.kr${link}`
  const kr = isKorea()
  const commerce = buildCommerce(regularPrice, salePrice, discountRate)

  const [copied, setCopied] = useState(0)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(0), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  const markCopied = (ok: boolean | void) => { if (ok) setCopied(Date.now()) }

  const handleShare = async () => {
    if (kr) {
      let sent = false
      try { sent = await shareKakao(title, description, imageUrl, fullUrl, buttonText, commerce, secondaryButtonText) } catch { sent = false }
      // 카카오로 못 보냈으면(예외든 false 든) 일반 공유로
      if (!sent) markCopied(await shareNative(title, description, fullUrl).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }))
    } else {
      markCopied(await shareNative(title, description, fullUrl).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }))
    }
  }

  if (compact) {
    // className이 원형 버튼이면 아이콘만, 아니면 텍스트 포함
    const isCircle = className?.includes('rounded-full')
    return (
      <button onClick={handleShare} className={className || "flex items-center gap-1 px-2 py-2 rounded-lg text-[12px] font-medium bg-[#FEE500] text-[#3C1E1E] active:scale-95"} style={style} aria-label={t('common.share', { defaultValue: '공유' })}>
        {isCircle && copied ? (
          <svg key={copied} className="ur-share-copied" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : isCircle ? (
          <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        className={className || "w-full flex items-center justify-center gap-2 py-2 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-[15px] font-bold active:scale-[0.97]"}
      >
        {kr ? '💬 카카오톡 공유하기' : '🔗 Share'}
      </button>
      {!kr && (
        <div className="flex gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${fullUrl}`)}`} target="_blank" rel="noopener"
            className="flex-1 py-2 bg-[#25D366] text-white rounded-xl text-[12px] font-medium text-center">WhatsApp</a>
          <a href={`https://line.me/R/share?text=${encodeURIComponent(`${title} ${fullUrl}`)}`} target="_blank" rel="noopener"
            className="flex-1 py-2 bg-[#00B900] text-white rounded-xl text-[12px] font-medium text-center">LINE</a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`} target="_blank" rel="noopener"
            // X(구 트위터)의 플랫폼 브랜드색 — 형제가 LINE #00B900 인 것과 같은 축이고 우리 주 버튼이 아니다.
            className="flex-1 py-2 bg-black text-white rounded-xl text-[12px] font-medium text-center">X</a>{/* primary-button-ok */}
        </div>
      )}
    </div>
  )
}
