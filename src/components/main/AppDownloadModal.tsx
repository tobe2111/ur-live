/**
 * 🖥️ 2026-07-19 (대표 요청 — 그루폰식 버튼): PC 상단 네비 버튼 클릭 시 뜨는 모바일 이어보기 팝업.
 *   QR + 안내. 모달 z-index 는 표준(10500, 네비 위).
 *
 * 📱 2026-09-28 (대표 확정 *"아직 앱은 하나도 없어"*): App Store·Google Play 배지를 **삭제**했다.
 *   이 배지들은 링크가 `urdeal.kr`(모바일 웹)이라 **누르면 동작은 했지만**, 스토어 로고를 달고
 *   "App Store" 라고 적혀 있어 **없는 앱이 있다고 말하고 있었다.** 원 주석도 "출시 시 스토어 URL 로 교체"
 *   라고 전제했는데 그 출시가 없었다. 남은 QR + '지금 유어딜 열기' 는 실제 동작 그대로라 정직하다.
 *   ⚠️ 앱이 실제로 나오면 배지를 되살리되 **스토어 URL 이 200 인지 먼저 확인**할 것.
 */
import { lazy, Suspense, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'

// 🟢 qrcode.react lazy (ConsumerFrameRails/LinkshopVisitorRails 와 동일 — 첫 페인트 번들 제외).
const QRCodeSVG = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })))

const APP_URL = 'https://urdeal.kr'

interface Props {
  onClose: () => void
}

export default function AppDownloadModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 🚑 2026-07-19 (대표 신고 — "팝업 위가 잘리고 상단만 블러"): 부모 DesktopTopNav 헤더가 backdrop-blur
  //   (backdrop-filter)를 가져 CSS 규칙상 fixed 자손의 containing block 이 헤더가 됨 → inset-0 오버레이가
  //   화면 전체가 아닌 '헤더 영역'에만 깔리고 모달이 헤더 기준으로 잘렸음. createPortal 로 body 직속
  //   렌더 → 진짜 뷰포트 기준 fixed(전체 딤 + 중앙 정렬).
  return createPortal(
    <div
      className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="폰에서 유어딜 열기"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-3xl bg-surface overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <h2 className="text-[19px] font-extrabold text-gray-900 dark:text-white leading-snug pr-4">
            폰에서 유어딜을<br />더 빠르게 · 더 편하게
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 w-9 h-9 -mt-1 -mr-1 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR */}
        <div className="px-6 pt-3 pb-1 flex flex-col items-center">
          <div className="p-3 rounded-2xl bg-white dark:bg-white border border-gray-100 dark:border-gray-200 shadow-sm">{/* QR 는 스캔 위해 항상 흰 배경 */}
            <Suspense fallback={<div className="w-[188px] h-[188px] bg-gray-100 dark:bg-gray-100 rounded-lg animate-pulse" />}>{/* 흰 QR박스 안 — 항상 라이트 */}
              <QRCodeSVG value={APP_URL} size={188} fgColor="#11141C" bgColor="#ffffff" level="M" />
            </Suspense>
          </div>

          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mt-4 leading-relaxed">
            QR 코드를 스캔하면<br />폰에서 바로 이어서 볼 수 있어요
          </p>
        </div>

        {/* CTA */}
        <a
          href={APP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-4 bg-brand hover:bg-brand-dark text-white text-[15px] font-bold transition-colors"
        >
          <UrDealLogo size={16} forceDark /> 지금 유어딜 열기
        </a>
      </div>
    </div>,
    document.body,
  )
}
