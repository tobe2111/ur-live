/**
 * 🖥️ 2026-07-19 (대표 요청 — 그루폰식 '앱' 버튼): PC 상단 네비의 '앱' 버튼 클릭 시 뜨는 앱 다운로드 팝업.
 *   QR + 스토어 배지 + 안내. QR/스토어 링크는 모바일 사이트(urdeal.kr)로 — 네이티브 앱 출시 전까지
 *   모바일 웹으로 안내(출시 시 스토어 URL 로 교체). 모달 z-index 는 표준(10500, 네비 위).
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
      aria-label="유어딜 앱 다운로드"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-3xl bg-white dark:bg-[#1A1C21] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <h2 className="text-[19px] font-extrabold text-gray-900 dark:text-white leading-snug pr-4">
            유어딜 앱으로<br />더 빠르게 · 더 편하게
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
              <QRCodeSVG value={APP_URL} size={188} fgColor="#0D0F12" bgColor="#ffffff" level="M" />
            </Suspense>
          </div>

          {/* 스토어 배지 */}
          <div className="flex items-center gap-3 mt-5">
            <a href={APP_URL} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 text-white active:scale-95 transition-transform">
              <svg viewBox="0 0 384 512" className="w-4 h-4 fill-current" aria-hidden><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              <span className="text-[12px] font-bold leading-tight">App Store</span>
            </a>
            <a href={APP_URL} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 text-white active:scale-95 transition-transform">
              <svg viewBox="0 0 512 512" className="w-4 h-4" aria-hidden><path fill="#00d4ff" d="M47 41C36 47 30 58 30 74v364c0 16 6 27 17 33l211-215z"/><path fill="#00e676" d="M47 41c8-4 18-3 29 3l257 148-64 64z"/><path fill="#ffea00" d="M333 192l70 40c22 13 22 35 0 48l-70 40-64-64z"/><path fill="#ff3d00" d="M76 471c-11 6-21 7-29 3l222-222 64 64z"/></svg>
              <span className="text-[12px] font-bold leading-tight">Google Play</span>
            </a>
          </div>

          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mt-4 leading-relaxed">
            QR 코드를 스캔해<br />유어딜을 바로 열어보세요!
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
