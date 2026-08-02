/**
 * 📦 **이 상품을 어떻게 받는가** — 픽업 안내 / 배송 약속 (2026-08-02)
 *
 * 두 블록을 한 파일에 둔 이유가 이 파일의 존재 이유다. 원래는 상세 페이지 안에서
 * **200줄 떨어진 두 자리**에 각각 있었고, 그래서 실제로 이렇게 됐다:
 *
 * > 픽업 공구 상품인데 아래쪽에서 **"내일 도착 · 5만원 이상 무료"** 를 약속하고 있었다.
 *
 * 배송이 없는 상품에 배송을 약속하면 그 오해는 전부 **운영자 문의**로 돌아간다 —
 * 파일럿에서 가장 걱정하던 실패 모드를 화면이 직접 만들고 있었던 셈이다.
 *
 * ⇒ 둘을 **같은 입력(`pickup`)을 읽는 형제**로 만들어, 한쪽을 고치는 사람이 반드시 다른 쪽을 본다.
 *   배타성이 "두 군데의 조건이 우연히 맞아떨어지는 것"이 아니라 **구조**가 된다.
 *
 * 🔴 판정 기준은 **몰이 아니라 픽업 데이터**다. 본진에서 열린 픽업 상품에도 똑같이 적용돼야 한다
 *   (`products.routes` GET /:id 주석과 같은 원칙 — 몰 결합을 만들지 않는다).
 */
import { useTranslation } from 'react-i18next'
import { STORAGE_NOTICE } from '@/shared/pickup'
import { parseUTCDate } from '@/utils/date'

export type PickupInfo = { date: string | null; place: string | null; storage: 'cold' | 'room' | null } | null | undefined

/** 보여 줄 픽업 정보가 실제로 있는가. 빈 껍데기(전 필드 null)는 **없는 것**으로 본다. */
export function hasPickupInfo(pickup: PickupInfo): boolean {
  return !!pickup && !!(pickup.date || pickup.place || pickup.storage)
}

/** 픽업일 라벨 — "8월 10일". UTC-naive 를 로컬로 오해석하면 하루가 밀려 "어제 픽업"이 된다(반복 사고 클래스). */
function pickupDayLabel(iso: string): string {
  const d = parseUTCDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}

/** 📦 픽업 안내. 픽업 정보가 없으면 **아무것도 그리지 않는다**(빈 껍데기 금지). */
export function PickupNotice({ pickup }: { pickup: PickupInfo }) {
  if (!hasPickupInfo(pickup) || !pickup) return null
  return (
    <div className="mt-3 rounded-xl border border-gray-200 dark:border-[#2A3446] p-3 space-y-1">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white">📦 픽업 안내</p>
      {pickup.date && (
        <p className="text-[12px] text-gray-600 dark:text-gray-300">받는 날 · {pickupDayLabel(pickup.date)}</p>
      )}
      {pickup.place && (
        <p className="text-[12px] text-gray-600 dark:text-gray-300">받는 곳 · {pickup.place}</p>
      )}
      {/* ⚠️ 보관 고지 문구는 법무 확인 대기(X4c) 임시 표기. */}
      {pickup.storage && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{STORAGE_NOTICE[pickup.storage]}</p>
      )}
    </div>
  )
}

/** 🚚 배송 약속. **픽업 상품이면 그리지 않는다** — 위 주석의 사고가 정확히 이 배타성의 부재였다. */
export function DeliveryNotice({ pickup }: { pickup: PickupInfo }) {
  const { t } = useTranslation()
  if (hasPickupInfo(pickup)) return null
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50 dark:bg-[#1A2334]">
        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span className="text-[12px] font-semibold text-gray-900 dark:text-white">{t('productDetail.tomorrowDelivery')}</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('productDetail.freeShippingNote', { defaultValue: '· 5만원 이상 무료' })}</span>
      </div>
    </div>
  )
}
