/**
 * 🧭 상세 페이지 카테고리 경로 (breadcrumb) — 사진 위 한 줄
 *
 * 2026-08-30 대표: *"그루폰처럼 이용권 사진 위에 카테고리바 같이 저렇게 우리도 유사하게 하자.
 * 숙소 이용권도 마찬가지고."* (그루폰 딜 상세 스크린샷 첨부 — `Local / Things To Do /
 * Sightseeing & Tours / Boat Tours`)
 *
 * ## 원칙 — 안 눌리는 경로는 넣지 않는다
 * 그루폰의 빵부스러기는 전부 **실제 목록 페이지**로 간다. 장식이 아니라 길이다.
 * 이 레포는 이미 그 반대 사례로 데였다: `/stays` 의 카테고리 칩이 **죽은 링크**여서 2026-07-20 에
 * 고쳤고(`?category=` 딥링크 신설), `/meal-vouchers` 는 구조적으로 영구 0건이라 별칭으로 접었다.
 * ⇒ 여기서는 **목적지가 실재하고 그 화면이 실제로 필터링되는 것만** 링크로 만든다.
 *   확인한 것: `/?category=meal_voucher` 를 PC 홈(`PcHomePage`)과 모바일 홈(`RestaurantMapPage`)이
 *   **둘 다** 초기 카테고리로 읽는다. `/stays` 는 숙소 검색 페이지로 실재한다.
 *
 * ## 왜 단계 수가 페이지마다 다른가
 * 우리 분류는 그루폰보다 얕다(이용권 카테고리 4종이 전부). 없는 중간 단계를 지어내면
 * `홈 / 이용권` 처럼 **같은 곳으로 가는 크럼 두 개**가 되고, 그건 길이 아니라 장식이다.
 *   · 이용권 상세 → `홈 / 식사 이용권`      (2단)
 *   · 숙소 상세   → `홈 / 숙소 / 호텔`       (3단 — `/stays` 가 실재하는 중간 목록이라)
 * 마지막 항목은 **현재 위치**라 링크가 아니다(`aria-current="page"`).
 *
 * ## 딸려오는 이득
 * 검색결과 빵부스러기(`BreadcrumbList` JSON-LD)는 각 페이지가 `breadcrumbJsonLd()`(SEO.tsx)로
 * 따로 넣는다 — 이 컴포넌트는 화면만 그린다(서버 메타와 클라 렌더를 한 군데서 섞지 않는다).
 */
import { Link } from 'react-router-dom'
import { getVoucherShortLabel, normalizeCategory } from '@/shared/constants/voucher-categories'

export type Crumb = {
  label: string
  /** 없으면 현재 위치 — 링크가 아니다. */
  to?: string
}

/**
 * 바깥 여백은 **여기서** 정한다. 페이지마다 손으로 적으면 두 상세가 조금씩 갈리고, 그 어긋남이
 * 정확히 이 레포가 반복해 겪은 "숙소만 다르게 보인다" 클래스다.
 * `overlayHeader` = 그 페이지의 헤더가 `fixed` 로 사진 위에 떠 있는가(공구 상세가 그렇다).
 * 떠 있으면 그 높이(≈56px = 패딩 10 + 버튼 36 + 패딩 10)만큼 비켜 줘야 크럼이 가려지지 않는다.
 */
export default function DetailBreadcrumb({
  items,
  overlayHeader = false,
}: {
  items: Crumb[]
  overlayHeader?: boolean
}) {
  const shown = items.filter((c) => c.label)
  if (shown.length < 2) return null // 크럼이 하나면 경로가 아니다 — 안 그린다.
  return (
    <nav
      aria-label="현재 위치"
      className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[13px] leading-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-2.5 lg:px-8 lg:pt-4 lg:pb-1 lg:max-w-[1200px] lg:mx-auto ${overlayHeader ? 'pt-[64px]' : 'pt-3'}`}
    >
      {shown.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 shrink-0">
          {i > 0 && <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">/</span>}
          {c.to ? (
            <Link
              to={c.to}
              className="text-gray-600 dark:text-gray-300 underline underline-offset-[3px] decoration-gray-300 dark:decoration-gray-600 hover:text-gray-900 dark:hover:text-white hover:decoration-current"
            >
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-gray-500 dark:text-gray-400">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

/**
 * 이용권/공구 상세의 경로. 카테고리 라벨은 명칭 SSOT(`getVoucherShortLabel`)를 그대로 쓴다 —
 * 여기서 "식사권" 같은 옛 어휘가 되살아나지 않게.
 */
export function voucherCrumbs(category: string | null | undefined): Crumb[] {
  const cat = normalizeCategory(category)
  if (!cat) return []
  return [
    { label: '홈', to: '/' },
    { label: getVoucherShortLabel(cat), to: `/?category=${cat}` },
  ]
}

/** 숙소 상세의 경로 — `/stays` 가 실재하는 중간 목록이라 3단이 된다. */
export function stayCrumbs(propertyTypeLabel: string | null | undefined): Crumb[] {
  return [
    { label: '홈', to: '/' },
    { label: '숙소', to: '/stays' },
    ...(propertyTypeLabel ? [{ label: propertyTypeLabel }] : []),
  ]
}
