import type { ReactNode } from 'react'
import { IOS_HIDE_DIGITAL_TOPUP } from '@/shared/feature-flags'
import { isNative, isIOS, openExternalUrl } from '@/lib/native'

/**
 * 🛡️ 2026-06-27: iOS 인앱결제(IAP) 정책 대비 게이트 — '딜 충전'(순수 디지털) 전용.
 *   `IOS_HIDE_DIGITAL_TOPUP` 플래그가 켜졌고 iOS 네이티브 앱일 때만 충전 페이지 대신
 *   "외부 브라우저에서 충전" 안내를 렌더(잠긴 Toss 충전 페이지는 미수정 — 라우트 바깥 게이트).
 *   기본 플래그 OFF → 평소엔 children 그대로(웹·Android·iOS 전부 byte-동일, 회귀 0).
 *   ⚠️ `/pay/widget`(범용 결제·공구·숙소 등 실세계)에는 적용하지 말 것 — 딜충전 진입만.
 */
const CHARGE_WEB_URL = 'https://live.ur-team.com/points/charge'

export default function IosTopupGate({ children }: { children: ReactNode }) {
  const gated = IOS_HIDE_DIGITAL_TOPUP && isNative() && isIOS()
  if (!gated) return <>{children}</>

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">💳</div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">딜 충전은 웹에서 진행돼요</h1>
      <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
        앱 정책상 딜 충전은 외부 브라우저(웹)에서 안전하게 결제하실 수 있습니다.<br />
        충전 후 앱으로 돌아오면 잔액이 반영됩니다.
      </p>
      <button
        onClick={() => openExternalUrl(CHARGE_WEB_URL)}
        className="mt-6 rounded-xl bg-gray-900 dark:bg-white px-6 py-3 text-[14px] font-bold text-white dark:text-[#0A0A0A]"
      >
        웹에서 충전하기
      </button>
    </div>
  )
}
