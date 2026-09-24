/**
 * 🏨 숙소 상세 — 본문 섹션 (제목 · 시설 · 안내표)
 *
 * ## 왜 뺐나 (2026-08-30 대표 "AI 티 안나는 디자인으로")
 * 숙소 상세는 **모든 블록이 같은 무게의 흰 라운드 카드**였다 — 날짜 박스, 시설 3칸, 객실,
 * 위치, 취소 정책이 전부 `bg-white border rounded-xl p-4 shadow-sm`. 카드가 리듬을 균일하게
 * 만들면 눈이 어디를 먼저 볼지 못 고르고, 그게 "자동 생성된 화면" 처럼 읽히는 가장 큰 원인이다.
 * 같은 레포의 공구 상세(`GroupBuyDetailPage`)는 이미 이걸 벗어나 있었다 — **헤어라인 스펙표**와
 * 16px/800 섹션 제목. 숙소만 뒤처져 있어서 여기로 맞춘다(두 상세가 갈리는 것도 그 자체로 티가 난다).
 *
 * ## 규칙
 * - 섹션 제목은 한 종류(`SectionTitle`) — 15px 는 본문과 안 갈리고, 13px 굵게는 위계가 없다.
 * - 시설은 **카드가 아니다**. 아이콘+낱말이 문장처럼 흐른다(야놀자·여기어때가 그렇게 한다).
 *   3분할 카드로 감싸면 "무료 주차" 세 글자에 테두리 하나를 쓰는 셈이라 화면이 시끄러워진다.
 * - 안내는 **헤어라인으로 나뉜 라벨+본문 블록**. 카드 세 장(취소/하우스룰/체크인)을 대신한다.
 *
 * ⚠️ 여기서 이모지 아이콘(📋 🔑 🛡️)을 쓰지 말 것. 되돌아오면 그 자리만 톤이 튄다.
 */
import React, { lazy, Suspense } from 'react'
import DeferUntilVisible from '../group-buy/DeferUntilVisible'
import { cancellationLabel } from './StayBookingPanel'

const ProductReviews = lazy(() => import('../product-detail/ProductReviews'))

/** 섹션 제목 — 상세 페이지 전체에서 이것 하나만 쓴다(공구 상세 16/800/-.02em 와 동일 스펙). */
export function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[16px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white ${className}`}>
      {children}
    </h2>
  )
}

/**
 * 시설 — 아이콘 + 낱말이 줄바꿈되며 흐른다. 카드·테두리 없음.
 * `items` 는 이미 아이콘이 매핑된 상태로 받는다(아이콘 매핑 SSOT 는 stay-detail/amenity-meta.tsx).
 */
export function AmenityFlow({ items }: { items: Array<{ key: string; label: string; icon: React.ReactNode }> }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2.5">
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5 text-[13.5px] text-gray-700 dark:text-gray-300">
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  )
}

/**
 * 라벨이 위, 값이 아래로 떨어지는 안내 블록.
 * ⚠️ 라벨↔값을 한 줄에 좌우 정렬하는 표 형태도 만들어 봤는데 숙소에선 안 맞았다 —
 *    "체크인 48시간 전 100% 환불 · 24시간 전 50% 환불" 처럼 값이 길면 라벨과 뭉개지고
 *    화면 끝까지 밀린다(실제로 그렇게 렌더됐다). 값이 한 줄을 넘길 성질이면 이 형태다.
 *    값이 짧은 스펙표가 필요하면 공구 상세 '이용 안내'(GroupBuyDetailPage)를 볼 것.
 */
export function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3.5 mt-3.5 first:mt-0">
      <div className="text-[13px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1.5 text-[14px] leading-relaxed text-gray-900 dark:text-white">{children}</div>
    </div>
  )
}

/**
 * 🏷️ 숙소 유형 배지 라벨 — DB 값은 영문('hotel')이라 그대로 두면 화면에 원본 데이터가 비친다.
 *   어휘는 시드의 `STAY_TYPES.label`(admin-stays.routes)과 맞춘다.
 *   상세 본문(배지)과 빵부스러기(`stayCrumbs`)가 **같은 라벨**을 써야 해서 여기(공용)에 둔다.
 */
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: '호텔', pension: '펜션', guesthouse: '스테이', resort: '리조트',
  glamping: '글램핑', motel: '모텔', villa: '풀빌라', camping: '캠핑',
}
export function propertyTypeLabel(t?: string | null): string {
  const key = String(t || '').trim().toLowerCase()
  return PROPERTY_TYPE_LABELS[key] || (t || '숙소')
}

/**
 * ⭐ 리뷰 (2026-09-14 안 B) — 공구 상세가 쓰는 `ProductReviews` 를 그대로 붙인다. 새로 만들지 않는다.
 *
 * 숙소 상세엔 평점 **숫자만** 있고 후기 본문이 한 줄도 없었다(라이브에 30건이 쌓여 있는데도).
 * 리뷰를 쓰는 진입도 이 컴포넌트가 들고 있다 — 주문 상세의 작성 버튼은 **배송완료** 조건이라
 * 배송이 없는 숙소·이용권엔 열리지 않는다. 그래서 여기가 사실상 유일한 작성 자리다.
 *
 * 끝에 하단 구매 바 높이만큼 자리를 비운다 — 그 바는 이제 담기 전에도 상시 떠 있다.
 */
export function StayReviews({ productId }: { productId: number }) {
  return (
    <div className="mb-6">
      <DeferUntilVisible minHeight={80}>
        <Suspense fallback={<div className="h-20 rounded-xl bg-gray-100 dark:bg-[#1D1F29]" />}>
          <ProductReviews productId={productId} limit={5} />
        </Suspense>
      </DeferUntilVisible>
      <div className="lg:hidden h-[76px]" aria-hidden="true" />
    </div>
  )
}

/**
 * 🚫 만실 (2026-09-14 안 B) — 종전엔 객실 카드마다 붉은 '매진' 글자뿐이라, 전부 매진인 날에도
 * 사용자가 카드를 하나씩 훑고서야 알았고 **다음에 뭘 해야 하는지**는 아무도 말하지 않았다.
 * 카드 한 장 + 주 행동(다른 날짜 고르기) 하나로 그 자리에서 끝낸다.
 */
export function StaySoldOutCard({ onPickDates }: { onPickDates: () => void }) {
  return (
    <div className="rounded-2xl bg-surface shadow-lift p-5 text-center">
      <p className="text-[15px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">고른 날짜는 모두 예약됐어요</p>
      <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">날짜를 바꾸면 남은 객실을 볼 수 있어요.</p>
      <button type="button" onClick={onPickDates} className="mt-4 w-full py-3 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-dark">
        다른 날짜 고르기
      </button>
    </div>
  )
}

/**
 * 🏨 이용 안내 — 취소 정책 · 하우스 룰 · 체크인 안내.
 *
 * 2026-09-24 `StayDetailPage` 에서 **옮기기만 했다**(마크업 불변). 같은 커밋에서 '이곳과 비슷한
 * 스테이'를 붙이는데 그 파일이 파일크기 래칫 **858/858** 로 여유가 0이었다 — `UsageGuide`·
 * `SellerCard` 와 같은 이유·같은 방식이다. 값이 없는 행은 종전처럼 스스로 빠진다.
 */
export function StayPolicyInfo({
  policy, customText, houseRules, checkInInstructions,
}: { policy?: string | null; customText?: string | null; houseRules?: string | null; checkInInstructions?: string | null }) {
  return (
    <div className="mb-6">
      <SectionTitle>이용 안내</SectionTitle>
      <div className="mt-4">
        <InfoBlock label="취소 정책">
          {cancellationLabel(policy)}
          {customText && (
            <span className="block mt-1 text-[13px] text-gray-500 dark:text-gray-400">{customText}</span>
          )}
        </InfoBlock>
        {houseRules && (
          <InfoBlock label="하우스 룰">
            <span className="whitespace-pre-line">{houseRules}</span>
          </InfoBlock>
        )}
        {checkInInstructions && (
          <InfoBlock label="체크인 안내">
            <span className="whitespace-pre-line">{checkInInstructions}</span>
          </InfoBlock>
        )}
      </div>
    </div>
  )
}
