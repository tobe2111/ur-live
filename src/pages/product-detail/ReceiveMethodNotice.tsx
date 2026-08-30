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

/**
 * 🧾 하단 고정 바 요약 줄 — `1개 · 8월 10일 픽업` 〔시안 A-2 하단 바〕.
 *
 * 🔴 **여기서 export 하는 이유**: 날짜 라벨을 호출부에서 다시 짜면 이 레포가 반복해 만난
 *   *"UTC-naive 를 로컬로 오해석해 하루 밀림"* 클래스가 **두 벌**이 된다(`check-utc-date-parse`).
 *   픽업일 문자열의 정의는 이 파일 하나여야 한다.
 *
 * 날짜가 없으면 수량만 돌려준다 — **없는 날짜를 지어내지 않는다.**
 */
export function pickupSummaryLine(quantity: number, date: string | null | undefined): string {
  const day = date ? pickupDayLabel(date) : ''
  return day ? `${quantity}개 · ${day} 픽업` : `${quantity}개`
}

/** 보관 배지 — 냉장·냉동은 파랑(주의 환기), 실온은 중립.〔시안 재사용 요소〕 */
const STORAGE_BADGE: Record<'cold' | 'room', string> = {
  cold: 'text-[#3C6E8F] bg-[#E7F0F6] dark:text-[#8FBDDA] dark:bg-[#1B2A34]',
  room: 'text-[#6B6469] bg-[#F0EDEE] dark:text-[#A29A9F] dark:bg-[#242024]',
}

/**
 * 📦 픽업 안내. 픽업 정보가 없으면 **아무것도 그리지 않는다**(빈 껍데기 금지).
 *
 * ## 🎨 2026-08-02 시안 적용 〔`docs/design/operator-mall-pilot.md` 화면 A-2〕
 * 추가분 의뢰서가 이 블록을 **이 화면의 핵심**으로 지목하며 정확히 이렇게 적었다:
 * > *"4번이 **가격만큼 눈에 띄어야** 합니다. 지금은 옅은 테두리 상자 하나라 흘려보기 쉽습니다."*
 *
 * 그래서 옅은 테두리 상자를 **채움 블록**으로 올렸다:
 * - 머리에 *"가게에 직접 찾으러 오는 상품이에요"* 채움 띠 — 스크롤 중에도 잡힌다
 * - `받는 날`은 **17px/800** 으로 옵션·수량보다 크게. 손님이 달력에 적을 수 있어야 한다
 * - 냉장·냉동이면 배지로 **결제 전에** 보인다(안 찾아가면 환불이 어려운 상품)
 *
 * 🔴 **몰 대표 색을 쓰지 않는다.** 이 컴포넌트는 판정을 *픽업 데이터*로 하고 본진 픽업 상품도
 *   같은 블록을 쓴다(위 주석) — 여기서 `mall.colorLight` 를 물면 이 파일이 금지한 **몰 결합**이
 *   생긴다. 대신 잉크 채움(라이트 검정 / 다크 반전)으로 "가격만큼"의 무게를 만든다.
 *   시안은 로즈 띠였지만 로즈는 2026-07-29 대표 확정상 **유어딜 본진 색**이고 몰과 구분돼야 한다.
 */
export function PickupNotice({ pickup }: { pickup: PickupInfo }) {
  if (!hasPickupInfo(pickup) || !pickup) return null
  return (
    <div className="mt-3 rounded-2xl overflow-hidden bg-[#F7F5F6] dark:bg-[#1A1C21]">
      <div className="flex items-center gap-[7px] px-4 py-3 bg-[#1A1719] dark:bg-[#F3EFF1]">
        <svg className="w-[15px] h-[15px] shrink-0 text-white dark:text-[#1A1719]" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 8.2 12 3.5l9 4.7v7.6L12 20.5 3 15.8z" /><path d="M3 8.2 12 13l9-4.8M12 13v7.5" />
        </svg>
        <span className="text-[13.5px] font-extrabold tracking-[-0.03em] text-white dark:text-[#1A1719]">
          가게에 직접 찾으러 오는 상품이에요
        </span>
      </div>

      <div className="px-4 py-[15px]">
        {pickup.date && (
          <div className="flex items-baseline gap-3">
            <span className="w-12 shrink-0 text-[12px] font-bold tracking-[-0.02em] text-[#8A8288] dark:text-[#8B93A3]">받는 날</span>
            {/* 🔴 날짜로 읽혀야 한다 — 옵션·수량보다 크게. */}
            <span className="text-[17px] font-extrabold tracking-[-0.035em] text-gray-900 dark:text-white">{pickupDayLabel(pickup.date)}</span>
          </div>
        )}
        {pickup.place && (
          <div className="flex items-baseline gap-3 mt-2.5">
            <span className="w-12 shrink-0 text-[12px] font-bold tracking-[-0.02em] text-[#8A8288] dark:text-[#8B93A3]">받는 곳</span>
            <span className="text-[13.5px] font-semibold leading-[1.5] tracking-[-0.025em] text-[#3F383C] dark:text-gray-200">{pickup.place}</span>
          </div>
        )}
        {/* ⚠️ 보관 고지 문구는 법무 확인 대기(X4c) 임시 표기 — 시안이 ~어요체로 그렸어도 바꾸지 않는다. */}
        {pickup.storage && (
          <div className="flex items-center gap-[7px] mt-3 pt-3 border-t border-[#EAE5E7] dark:border-[#2C2F35]">
            <span className={`shrink-0 px-1.5 py-[3px] rounded-[5px] text-[10.5px] font-bold tracking-[-0.02em] ${STORAGE_BADGE[pickup.storage]}`}>
              {pickup.storage === 'cold' ? '냉장·냉동' : '실온'}
            </span>
            <span className="text-[12px] font-semibold leading-[1.5] tracking-[-0.025em] text-[#6B6469] dark:text-gray-300">{STORAGE_NOTICE[pickup.storage]}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** 🚚 배송 약속. **픽업 상품이면 그리지 않는다** — 위 주석의 사고가 정확히 이 배타성의 부재였다. */
export function DeliveryNotice({ pickup }: { pickup: PickupInfo }) {
  const { t } = useTranslation()
  if (hasPickupInfo(pickup)) return null
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50 dark:bg-[#1A1C21]">
        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span className="text-[12px] font-semibold text-gray-900 dark:text-white">{t('productDetail.tomorrowDelivery')}</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('productDetail.freeShippingNote', { defaultValue: '· 5만원 이상 무료' })}</span>
      </div>
    </div>
  )
}
