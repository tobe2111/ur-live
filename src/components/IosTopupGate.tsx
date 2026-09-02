import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IOS_HIDE_DIGITAL_TOPUP, TOPUP_DISABLED } from '@/shared/feature-flags'
import { isNative, isIOS, openExternalUrl } from '@/lib/native'

/**
 * 🛡️ 2026-06-27: iOS 인앱결제(IAP) 정책 대비 게이트 — '딜 충전'(순수 디지털) 전용.
 *   `IOS_HIDE_DIGITAL_TOPUP` 플래그가 켜졌고 iOS 네이티브 앱일 때만 충전 페이지 대신
 *   "외부 브라우저에서 충전" 안내를 렌더(잠긴 Toss 충전 페이지는 미수정 — 라우트 바깥 게이트).
 *   기본 플래그 OFF → 평소엔 children 그대로(웹·Android·iOS 전부 byte-동일, 회귀 0).
 *   ⚠️ `/pay/widget`(범용 결제·공구·숙소 등 실세계)에는 적용하지 말 것 — 딜충전 진입만.
 */
const CHARGE_WEB_URL = 'https://urdeal.kr/points/charge'

/**
 * 🛡️ 2026-07-18 (대표 확정 "충전 자체를 빼자"): TOPUP_DISABLED — 유상 충전 서비스 전체 종료.
 *   전 플랫폼(웹·앱)에서 /points/charge 진입 시 종료 안내 렌더. 딜 적립(초대/추천/커미션)과
 *   사용은 불변 — 안내가 적립 경로로 유도. 플래그 false 로 즉시 복원(가역).
 */
function TopupClosedNotice() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">💎</div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">딜 충전이 종료되었어요</h1>
      <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
        이제 딜은 충전이 아니라 <b className="text-gray-900 dark:text-white">활동으로 모으는 리워드</b>예요.<br />
        친구 초대·유어샵 추천으로 딜을 모아 교환권과 이용권에 사용하세요.<br />
        이미 보유하신 딜은 그대로 사용·환불 가능합니다.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => navigate('/user/profile')}
          className="rounded-xl bg-gray-900 dark:bg-white px-5 py-3 text-[14px] font-bold text-white dark:text-[#11141C]"
        >
          딜 모으러 가기
        </button>
        <button
          onClick={() => navigate('/my-deal-history')}
          className="rounded-xl border border-gray-200 dark:border-[#2C2F35] px-5 py-3 text-[14px] font-bold text-gray-700 dark:text-gray-200"
        >
          내 딜 내역
        </button>
      </div>
    </div>
  )
}

export default function IosTopupGate({ children }: { children: ReactNode }) {
  // 서비스 전체 종료가 iOS 게이트보다 우선 (전 플랫폼)
  if (TOPUP_DISABLED) return <TopupClosedNotice />

  const gated = IOS_HIDE_DIGITAL_TOPUP && isNative() && isIOS()
  if (!gated) return <>{children}</>

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">💳</div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">딜 충전은 웹에서 진행돼요</h1>
      <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
        앱 정책상 딜 충전은 외부 브라우저(웹)에서 안전하게 결제하실 수 있습니다.<br />
        충전 후 앱으로 돌아오면 잔액이 반영됩니다.
      </p>
      <button
        onClick={() => openExternalUrl(CHARGE_WEB_URL)}
        className="mt-6 rounded-xl bg-gray-900 dark:bg-white px-6 py-3 text-[14px] font-bold text-white dark:text-[#11141C]"
      >
        웹에서 충전하기
      </button>
    </div>
  )
}
