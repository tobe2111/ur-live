/**
 * 🗺️ 2026-07-15 (대표 — "내 주변 누르니 '위치 권한이 필요합니다' 뜨면 어떻게 해?"):
 *   위치 조회 실패 시 **상황별 실질 안내** 바텀시트. 기존엔 실패=단일 토스트라 원인 구분이 안 됐음.
 *   - inapp   : 카카오톡/인스타 등 인앱 브라우저 — 위치 제한. '외부 브라우저로 열기' 제공(근본 해결).
 *   - denied  : 사용자가 거부(브라우저는 재요청 안 함) — iOS/Android 설정 경로 안내 + 다시 시도.
 *   - timeout : GPS 응답 지연 — 다시 시도(저정밀은 호출부가 먼저 시도).
 *   - unavailable : 미지원/일시 실패 — 지역 필터로 대체 안내.
 */
import { MapPin, ExternalLink, RotateCw, X } from 'lucide-react'
import { detectInAppBrowser, openInExternalBrowser, isIOS, isAndroid } from '@/lib/in-app-browser'
import { getInAppLabel } from '@/lib/in-app-warning'
import { Z } from '@/constants/z-index'

export type GeoHelpReason = 'inapp' | 'prompt' | 'denied' | 'timeout' | 'unavailable'

export default function GeoHelpSheet({
  reason,
  onClose,
  onRetry,
}: {
  reason: GeoHelpReason
  onClose: () => void
  onRetry?: () => void
}) {
  // 인앱 브라우저면 원인 문구와 무관하게 '외부 브라우저' 경로를 최우선(가장 확실한 해결).
  const inAppLabel = getInAppLabel()
  const effReason: GeoHelpReason = detectInAppBrowser() ? 'inapp' : reason
  const ios = isIOS()
  const android = isAndroid()

  const title =
    effReason === 'inapp' ? '외부 브라우저에서 열어주세요'
    : effReason === 'prompt' ? '위치 접근을 허용해주세요'
    : effReason === 'denied' ? '위치 권한을 허용해주세요'
    : effReason === 'timeout' ? '위치를 찾는 데 시간이 걸려요'
    : '위치를 가져오지 못했어요'

  const steps: string[] =
    effReason === 'inapp'
      ? [
          `${inAppLabel || '인앱'} 브라우저에선 위치 사용이 제한돼요.`,
          '아래 버튼으로 크롬/사파리에서 열면 내 주변 딜을 정확히 볼 수 있어요.',
        ]
      : effReason === 'prompt'
      ? [
          // 아직 '거부'가 아니라 재요청 가능 — 아래 버튼이 브라우저 권한 창을 다시 띄운다(설정 갈 필요 없음).
          '아래 "위치 허용"을 누르면 브라우저 권한 창이 다시 떠요.',
          '창에서 "허용"을 선택하면 바로 내 주변 딜이 보여요.',
        ]
      : effReason === 'denied' && ios
      ? [
          '① 아이폰 설정 → 개인정보 보호 및 보안 → 위치 서비스 → 켜기',
          '② 설정 → Safari → 위치 → "허용" 또는 "확인"',
          '③ 이 페이지로 돌아오면 자동으로 내 주변이 켜져요.',
        ]
      : effReason === 'denied' && android
      ? [
          '① 주소창 왼쪽 자물쇠(ⓘ) → 권한 → 위치 → 허용',
          '② 안드로이드 설정 → 위치 → 켜기(앱 위치 권한도 허용)',
          '③ 이 페이지로 돌아오면 자동으로 내 주변이 켜져요.',
        ]
      : effReason === 'denied'
      ? [
          '브라우저 주소창의 위치 아이콘/사이트 설정에서 위치를 "허용"으로 바꿔주세요.',
          '허용하면 이 페이지에서 자동으로 내 주변이 켜져요.',
        ]
      : effReason === 'timeout'
      ? [
          'GPS 신호를 받는 데 시간이 걸리고 있어요. 실외이거나 창가에서 더 잘 잡혀요.',
          '다시 시도하거나, 위 지역 필터로 원하는 동네를 직접 골라도 돼요.',
        ]
      : [
          '현재 위치를 확인하지 못했어요.',
          '잠시 후 다시 시도하거나, 위 지역 필터로 동네를 직접 선택해보세요.',
        ]

  const retryLabel = effReason === 'prompt' ? '위치 허용' : '다시 시도'

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: Z.SHEET_BODY }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#11141C] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-6 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 dark:bg-[#1D1F29] text-gray-500 dark:text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3">
          <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white">{title}</h3>

        <ul className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{s}</li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          {effReason === 'inapp' ? (
            <button
              onClick={() => { openInExternalBrowser() }}
              className="w-full flex items-center justify-center gap-1.5 bg-gray-900 text-white rounded-xl py-3 text-[14px] font-bold active:scale-[0.98] transition-transform"
            >
              <ExternalLink className="w-4 h-4" /> 외부 브라우저로 열기
            </button>
          ) : (
            onRetry && (
              <button
                onClick={() => { onClose(); onRetry() }}
                className="w-full flex items-center justify-center gap-1.5 bg-gray-900 text-white rounded-xl py-3 text-[14px] font-bold active:scale-[0.98] transition-transform"
              >
                <RotateCw className="w-4 h-4" /> {retryLabel}
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-[14px] font-semibold text-gray-500 dark:text-gray-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
