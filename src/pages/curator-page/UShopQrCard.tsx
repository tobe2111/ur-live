/**
 * 🖥️ 2026-09-02 (대표 확정 — 유어샵 안P1 "왼쪽 프로필 고정 + 오른쪽 3열 진열대"): PC 좌측 열의
 *   "폰에서 이어 보기" QR. 종전 `LinkshopVisitorRails`(거터 레일, 2026-07-07)의 QR 을 프로필 아래로
 *   옮긴 것이다 — 레일은 430 액자 양옆 빈 거터를 채우던 장치라 액자를 벗은 지금은 자리가 없다.
 *   lg 미만에선 그리지 않는다(폰에서 폰 QR 을 보여줄 이유가 없다). qrcode.react 는 lazy(18KB).
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

export default function UShopQrCard() {
  const [url, setUrl] = useState('')
  useEffect(() => { if (typeof window !== 'undefined') setUrl(window.location.origin + window.location.pathname) }, [])
  return (
    <div className="hidden lg:flex items-center gap-3 mt-4 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift p-3.5">
      <div className="rounded-lg bg-white dark:bg-white p-1.5 shrink-0">
        <Suspense fallback={<div className="w-[76px] h-[76px] rounded bg-gray-100 dark:bg-gray-100 animate-pulse" />}>
          {url ? <QRCodeSVG value={url} size={76} level="M" /> : <div className="w-[76px] h-[76px]" />}
        </Suspense>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-900 dark:text-white"><Smartphone className="w-3.5 h-3.5" aria-hidden="true" />폰에서 이어 보기</p>
        <p className="mt-1 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">카메라로 스캔하면 이 유어샵을 폰에서 엽니다</p>
      </div>
    </div>
  )
}
