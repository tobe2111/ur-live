/**
 * 이용권 사용처리 **티켓 꼬리** — 스캔 틀 안의 QR (2026-10-10 대표 확정 안 3, *"바코드 모양이 아니라
 * QR모양이어야 하잖아"*). 손님이 내미는 이용권이 QR 이라 꼬리도 QR 이다(바코드면 다른 물건으로 읽힌다).
 *
 * ⚠️ `urdeal-icons` 의 `ScanIcon` 이 경고한 함정 — *"코드만 그리면 '내 티켓' 으로 읽힌다"* — 을
 *    **틀 모서리 넷**으로 피한다. 모서리가 "이걸 찍는다" 를 말한다.
 * 🎨 세트 규칙은 그대로(획 1.6 · 둥근 끝 · currentColor). 꼬리 자리가 행 아이콘(18px)보다 커서 32 그리드다.
 */
import { forwardRef, type SVGProps } from 'react'

type Props = Omit<SVGProps<SVGSVGElement>, 'size'> & { size?: number }

export const QrScanIcon = forwardRef<SVGSVGElement, Props>(function QrScanIcon({ size = 32, ...props }, ref) {
  return (
    <svg ref={ref} viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* 스캔 틀 모서리 */}
      <path d="M3 9V5.4A2.4 2.4 0 0 1 5.4 3H9M23 3h3.6A2.4 2.4 0 0 1 29 5.4V9M29 23v3.6a2.4 2.4 0 0 1-2.4 2.4H23M9 29H5.4A2.4 2.4 0 0 1 3 26.6V23" />
      {/* 위치 표시 사각 셋 — QR 을 QR 로 읽히게 하는 것은 이 셋이다 */}
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
      <rect x="18" y="8.5" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="18" width="5.5" height="5.5" rx="1" />
      <g fill="currentColor" stroke="none">
        <rect x="10.4" y="10.4" width="1.7" height="1.7" rx=".4" />
        <rect x="19.9" y="10.4" width="1.7" height="1.7" rx=".4" />
        <rect x="10.4" y="19.9" width="1.7" height="1.7" rx=".4" />
        <rect x="18" y="18" width="2.2" height="2.2" rx=".5" />
        <rect x="21.3" y="21.3" width="2.2" height="2.2" rx=".5" />
        <rect x="21.3" y="18" width="2.2" height="2.2" rx=".5" opacity=".55" />
        <rect x="18" y="21.3" width="2.2" height="2.2" rx=".5" opacity=".55" />
        <rect x="15.4" y="8.5" width="1.6" height="1.6" rx=".4" />
        <rect x="15.4" y="12.4" width="1.6" height="1.6" rx=".4" />
        <rect x="8.5" y="15.4" width="1.6" height="1.6" rx=".4" />
        <rect x="12.4" y="15.4" width="1.6" height="1.6" rx=".4" />
      </g>
    </svg>
  )
})
