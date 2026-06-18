/**
 * 🎨 2026-06-18 (사용자 시안 — 나브랜딩 랜딩): PC 프레임 우하단 gutter 에 "모바일로 보기" QR.
 *   링크샵(`/u/`·`/profile/`·`/s/`) 페이지에서만, PC(xl+) 에서만 표시 — 모바일/태블릿은 숨김
 *   (모바일은 이미 그 화면이라 QR 불필요). 현재 페이지 URL 을 QR 로.
 *   qrcode.react 는 lazy — 컨슈머 critical path 에 QR 라이브러리 안 들임.
 */
import { lazy, Suspense, useEffect, useState } from 'react'

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

export default function LinkshopMobileQR() {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    setUrl(window.location.origin + window.location.pathname)
  }, [])

  if (!url) return null

  return (
    // xl+ 에서만 (프레임 우측 gutter 확보) · fixed 우하단.
    <div className="hidden xl:flex fixed bottom-6 right-6 z-30 flex-col items-center gap-2 rounded-2xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] shadow-lg p-3">
      <Suspense fallback={<div className="w-[104px] h-[104px] rounded-lg bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />}>
        {/* QR 은 스캔성 위해 다크에서도 흰 배경 유지 (의도적 양모드 흰색). */}
        <div className="rounded-lg bg-white dark:bg-white p-1.5">
          <QRCodeSVG value={url} size={104} level="M" />
        </div>
      </Suspense>
      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">모바일로 보기</span>
    </div>
  )
}
