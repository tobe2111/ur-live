/**
 * 🏨 먼저 산 숙소 이용권 — 매장에 연락해 날짜 잡기 (결재 2026-11-24 Q2 "구매 뒤 화면에 매장 전화·문자 버튼 + 이용권 코드")
 *
 * 먼저 판매 방식은 손님이 산 뒤 매장과 직접 날짜를 잡는다. 종전 화면엔 "매장 연락 권장" 문구뿐이고 누를 것이 없었다.
 * 전화·문자 버튼은 매장 번호가 있을 때만 그린다(없으면 코드만 — 없는 번호로 거는 버튼을 만들지 않는다).
 */
import { safeDate } from '@/utils/safe-date'

export function telDigits(phone: string | null | undefined): string {
  return (phone || '').replace(/[^0-9+]/g, '')
}

/** 문자 앱에 미리 채울 문구 — 코드가 있으면 같이 적는다. `?&body=` 는 iOS·안드로이드 양쪽에서 열린다. */
export function smsHref(phone: string, productName: string, code: string | null | undefined): string {
  const body = `유어딜에서 '${productName}' 숙소 이용권을 구매했어요.${code ? ` 이용권 코드 ${code}.` : ''} 희망 날짜: `
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}

/**
 * 유효기간이 지났나. 지난 숙박권은 환불 없이 이용한 것으로 닫히므로(`cron/stay-no-show.ts`)
 * 연락 버튼을 그리지 않는다. DB 시각은 `Z` 없는 UTC 문자열이라 `safeDate` 로 읽는다.
 */
export function stayVoucherExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  const d = safeDate(expiresAt)
  return !!d && d.getTime() < now
}

export default function StayVoucherContact({ phone, productName, code }: {
  phone: string | null | undefined
  productName: string
  code: string | null | undefined
}) {
  const tel = telDigits(phone)
  return (
    <div className="mt-2" data-stay-voucher-contact>
      {code && (
        <p className="text-[13px] text-gray-700 dark:text-gray-200">
          이용권 코드 <span className="ml-1 text-[20px] font-bold tabular-nums tracking-wider text-gray-900 dark:text-white">{code}</span>
        </p>
      )}
      {tel ? (
        <>
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">매장에 연락해 날짜를 잡아 주세요. 코드를 알려 주면 돼요.</p>
          <div className="mt-2 flex gap-2">
            <a href={`tel:${tel}`} className="h-9 px-4 inline-flex items-center rounded-full bg-brand text-white text-[13px] font-medium">전화하기</a>
            <a href={smsHref(tel, productName, code)} className="h-9 px-4 inline-flex items-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-white text-[13px] font-medium">문자 보내기</a>
          </div>
        </>
      ) : (
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">매장에 연락해 날짜를 잡아 주세요. 연락처는 숙소 화면에서 볼 수 있어요.</p>
      )}
    </div>
  )
}
