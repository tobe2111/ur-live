/**
 * 🎨 유어딜 전용 아이콘 (2026-08-30 — 대표 결정 "3번 2안: 핵심만 전용 제작")
 *
 * ■ 왜 만들었나
 *   대표 지적: *"아이콘들이 AI가 만든 티가 많이 나"*. 실측하니 531개 파일이 lucide
 *   하나에 묶여 있고 대안 세트가 0개였다. 그중 결정적인 것이 **유어샵의 `Sparkles`**(반짝임) —
 *   지난 몇 년간 생성된 화면마다 "AI 마법"을 뜻하며 붙어 온 관용 기호이고,
 *   무엇보다 *내 가게* 라는 뜻이 전혀 없다. 동네딜의 `MapPin` 도 마찬가지로
 *   **한 지점**을 가리키는데 실제 개념은 **동네**다.
 *
 * ■ 왜 세트를 통째로 안 바꿨나 (대표 결정)
 *   세트 교체는 531개 파일이 흔들리는데 얻는 것은 "다른 회사의 기본값"이다.
 *   반면 유어샵·동네딜은 **유어딜에만 있는 개념**이라 남의 세트에 맞는 그림이 애초에 없다.
 *   그래서 이 둘만 직접 그리고 나머지 lucide 는 조연으로 둔다.
 *
 * ■ 그리기 규칙 (lucide 와 나란히 놓이므로 계약을 맞춘다)
 *   - 24×24 뷰박스 · `currentColor` · `fill="none"` — lucide 와 동일. 크기는 className 으로.
 *   - **stroke-width 1.6** (lucide 기본 2보다 가늘다). 한글 라벨 옆에서 글자 무게와 맞추기 위함 —
 *     2px 는 한글 획 대비 너무 굵어 아이콘만 튄다.
 *   - `strokeLinecap/Join="round"` — lucide 와 같은 끝 처리라 한 줄에 섞여도 이질감이 없다.
 *
 * ⚠️ **forwardRef 로 감싼다.** lucide 아이콘은 `ForwardRefExoticComponent` 라,
 *    `icon: LucideIcon` 으로 타입된 자리(예: ConsumerFrameRails 의 QuickLink)에 평범한
 *    함수 컴포넌트를 넣으면 TS2741 로 막힌다. 감싸 두면 어디서든 lucide 대체품이 된다.
 */
import { forwardRef, type SVGProps } from 'react'

/**
 * ⚠️ 2026-08-31 (대표 신고 — "유어샵 아이콘만 너무 커") — **실제 버그였다.**
 *   호출부(`BottomNav`)는 모든 탭에 `<Icon size={22} />` 를 준다. 그런데 `size` 는
 *   **lucide 가 자기 안에서 width/height 로 변환해 주는 lucide 전용 prop** 이고,
 *   표준 SVG 속성이 아니다. 커스텀 아이콘은 그걸 `<svg size="22">` 로 그대로 흘려보냈고
 *   브라우저는 그 속성을 **무시**한다 → width/height 가 없어 크기가 안 먹었다.
 *   lucide 아이콘들 사이에 섞여 쓰이는 한, **lucide 의 계약을 그대로 지켜야 한다.**
 *   ⇒ `size` 를 받아 width/height 로 변환한다(lucide 와 동일한 기본값 24).
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'size'> & {
  size?: number | string
  /**
   * 🎫 2026-09-02 표면 체계(대표 시안 — 코레일톡): 하단 탭의 활성 아이콘은 **면**, 비활성은 **선**.
   * 같은 실루엣을 채우기만 바꾼다(모양이 바뀌면 탭이 점프한다). lucide 는 이 상태가 없어서
   * 다섯 탭을 전부 여기서 그린다.
   */
  filled?: boolean
}

/**
 * 면(`filled`) 버전에서 **도려낸 획**의 색 — 아이콘이 놓이는 카드 바탕이다.
 * ⚠️ 리터럴을 자리마다 적지 말 것: 20군데에 흩어져 있으면 카드 바탕을 바꾸는 날 몇 개는 반드시 놓친다
 *    (`check-consumer-hex-ratchet` 이 그 흩어짐을 잡아 여기로 모으게 했다).
 *    hex 는 토큰이 없을 때만 쓰이는 **폴백**이고, 색의 정본은 `src/index.css` 의 `--surface` 다.
 */
const KNOCKOUT = 'var(--surface, #fff)'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/**
 * 유어샵 — **차양이 달린 가게 앞**.
 * 유어샵은 "내 진열대"이므로 진열대를 그린다. 위쪽 사선 지붕 + 물결치는 차양 + 아래 매대.
 * (반짝임은 무엇을 파는 곳인지 한 글자도 말해 주지 않았다.)
 */
export const UrShopIcon = forwardRef<SVGSVGElement, IconProps>(function UrShopIcon({ size = 24, filled, ...props }, ref) {
  if (filled) {
    return (
      <svg ref={ref} {...base} width={size} height={size} {...props}>
        <path d="M4 9.5 5.6 5h12.8L20 9.5z" fill="currentColor" />
        <path d="M4 9.5c0 1.4 1 2.3 2.3 2.3s2.3-.9 2.3-2.3c0 1.4 1 2.3 2.3 2.3s2.4-.9 2.4-2.3c0 1.4 1 2.3 2.3 2.3s2.4-.9 2.4-2.3z" fill="currentColor" />
        <path d="M5.6 12v7.5h12.8V12z" fill="currentColor" />
        <path d="M10.2 19.5v-4.6h3.6v4.6" stroke={KNOCKOUT} fill={KNOCKOUT} />
      </svg>
    )
  }
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4 9.5 5.6 5h12.8L20 9.5" />
      <path d="M4 9.5c0 1.4 1 2.3 2.3 2.3s2.3-.9 2.3-2.3c0 1.4 1 2.3 2.3 2.3s2.4-.9 2.4-2.3c0 1.4 1 2.3 2.3 2.3s2.4-.9 2.4-2.3" />
      <path d="M5.6 12v7.5h12.8V12" />
    </svg>
  )
})

/**
 * 🎫 2026-09-02 하단 탭 나머지 넷 — 홈 · 교환권 · 이용권 · 마이.
 * 대표: *"아이콘 디자인들도 저 정도로 우리도 해줬으면 좋겠어"* (코레일톡 하단 탭: 기차·자동차·캐리어·QR 티켓).
 * 그쪽은 자기 물건을 그렸다. 우리 물건은 집·선물 상자·절취선 티켓·가게·사람이다.
 * 계약은 위 UrShopIcon 과 동일(24 그리드 · 1.6 · round). `filled` 는 같은 실루엣의 면 버전.
 */

/** 홈 — 집. 문이 아치라 '들어가는 곳'으로 읽힌다. */
export const HomeIcon = forwardRef<SVGSVGElement, IconProps>(function HomeIcon({ size = 24, filled, ...props }, ref) {
  const d = 'M4 11.2 12 4.8l8 6.4V19a1 1 0 0 1-1 1h-4v-4.6a3 3 0 0 0-6 0V20H5a1 1 0 0 1-1-1z'
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d={d} fill={filled ? 'currentColor' : 'none'} />
    </svg>
  )
})

/** 교환권 — 선물 상자. 기프티콘의 실물. 리본 매듭은 면 버전에서도 선으로 남긴다(상자와 구분). */
export const GiftBoxIcon = forwardRef<SVGSVGElement, IconProps>(function GiftBoxIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <rect x="3.5" y="10.5" width="17" height="9.5" rx="2" fill={filled ? 'currentColor' : 'none'} />
      <rect x="2.5" y="7" width="19" height="3.5" rx="1.2" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 7c-2.6 0-4-1.6-3.3-3 .7-1.3 3.3.4 3.3 3zm0 0c2.6 0 4-1.6 3.3-3-.7-1.3-3.3.4-3.3 3z" />
      <path d="M12 7.5V20" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 이용권 — 양쪽 홈이 파인 티켓 + 절취선. 결제 완료·지갑의 티켓 카드와 같은 모양이라 탭과 화면이 한 물건이다. */
export const TicketStubIcon = forwardRef<SVGSVGElement, IconProps>(function TicketStubIcon({ size = 24, filled, ...props }, ref) {
  const d = 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z'
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d={d} fill={filled ? 'currentColor' : 'none'} />
      <path d="M9.5 8.6v6.8" strokeDasharray="1.6 1.8" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 마이 — 사람. 장식 없이. */
export const PersonIcon = forwardRef<SVGSVGElement, IconProps>(function PersonIcon({ size = 24, filled, ...props }, ref) {
  return filled ? (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="8" r="4.2" fill="currentColor" />
      <path d="M4.2 20.4a7.8 7.8 0 0 1 15.6 0z" fill="currentColor" />
    </svg>
  ) : (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  )
})

/**
 * 동네딜 — **접힌 종이 지도**.
 * 핀은 한 지점을 뜻하지만 동네딜은 *지역*이다. 접힌 면이 셋인 지도로 "동네"를 그린다.
 */
export const DongneDealIcon = forwardRef<SVGSVGElement, IconProps>(function DongneDealIcon({ size = 24, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M5 6.5 10 5l4 1.6L19 5v12.5L14 19l-4-1.6L5 19z" />
      <path d="M10 5v12.4M14 6.6V19" />
    </svg>
  )
})

/**
 * 🗺️ 2026-09-02 지도 위 카테고리 칩 — **B안**(대표 확정: "B안으로 진행해줘").
 *   시안 셋 중 [흰 알약 · 잉크 선 아이콘 · 선택 = 블루 면]. 하단 탭과 같은 24 그리드·1.6 이라
 *   탭과 지도 위 칩이 한 물건으로 읽힌다. 이모지(✨🍽️💇🏨🎯)를 대체한다 — 표면 규칙 ⑥ 이모지 0.
 *   `filled` 는 안 받는다(칩의 선택은 알약 면이 뒤집혀서 표현한다 — 아이콘까지 바뀌면 두 번 말하는 것).
 */

/** 전체 — 2×2 격자. */
export const GridIcon = forwardRef<SVGSVGElement, IconProps>(function GridIcon({ size = 24, filled: _f, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  )
})

/** 식사 — 포크와 나이프. */
export const MealLineIcon = forwardRef<SVGSVGElement, IconProps>(function MealLineIcon({ size = 24, filled: _f, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" />
      <path d="M17 3c-2 1-3 3.5-3 6.5V12h3zM17 12v9" />
    </svg>
  )
})

/** 뷰티·헬스 — 가위. */
export const BeautyLineIcon = forwardRef<SVGSVGElement, IconProps>(function BeautyLineIcon({ size = 24, filled: _f, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" />
      <path d="M9 15 19 4M15 15 5 4" />
    </svg>
  )
})

/** 숙소 — 침대. */
export const StayLineIcon = forwardRef<SVGSVGElement, IconProps>(function StayLineIcon({ size = 24, filled: _f, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M3 19V9a2 2 0 0 1 2-2h2v4h10V9h2a2 2 0 0 1 2 2v8M3 15h18" />
      <rect x="7" y="7" width="10" height="4" rx="1" />
    </svg>
  )
})

/**
 * 유어쇼츠 — **세로 화면 + 재생**. (2026-09-09 대표 확정 "아이콘 1")
 *
 * 왜 이 그림인가: 쇼츠는 **9:16 세로**라는 형태 자체가 정체성이다. 원 + 삼각형(범용 재생)은
 * 읽기는 쉬워도 "유어쇼츠"라는 신호가 없고, 카드 두 장을 겹친 안은 실제로 쓰이는 **16px 에서
 * 뒤 장이 앞 장에 먹혔다**(시안 3안을 40px·16px 나란히 놓고 판정 — `docs/design/`).
 *
 * ⚠️ 삼각형만 `fill="currentColor" stroke="none"` 이다. 선으로 그리면 16px 에서 속이 비어
 *    무엇인지 안 읽힌다. 나머지 획은 세트 규약대로 1.6.
 * ⚠️ `filled` 는 안 받는다 — 하단 탭이 아니라 헤더 링크에만 쓰여 활성 상태가 없다.
 */
export const ShortsIcon = forwardRef<SVGSVGElement, IconProps>(function ShortsIcon({ size = 24, filled: _f, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <rect x="6.5" y="3" width="11" height="18" rx="3.2" />
      <path d="M10.6 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none" />
    </svg>
  )
})

/**
 * 🧭 셀러 대시보드 하단 탭 (2026-09-14 대표 승인 — 모바일 우선 재설계, `docs/design/seller-dashboard-mobile-first-2026-09.md`).
 *   다섯 대분류 `홈 · 주문 · 이용권 · 정산 · 더보기` 중 홈(`HomeIcon`)·이용권(`TicketStubIcon`)은 소비자 탭과
 *   같은 물건을 쓰고, 나머지 셋만 여기 더 그린다. 규약은 위와 같다(24 그리드 · 1.6 · round · `filled` = 면).
 */

/** 주문 — 영수증. 아래가 톱니로 찢긴 종이 + 줄 두 개. 면 버전은 줄을 흰 선으로 남긴다. */
export const ReceiptIcon = forwardRef<SVGSVGElement, IconProps>(function ReceiptIcon({ size = 24, filled, ...props }, ref) {
  const d = 'M6 3.5h12v16.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z'
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d={d} fill={filled ? 'currentColor' : 'none'} />
      <path d="M9 8.5h6M9 12h6" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 정산 — 동전 하나에 ₩. 돈이 들어오는 자리라 원화 기호를 그대로 쓴다(그래프·지갑보다 뜻이 곧다). */
export const WonCoinIcon = forwardRef<SVGSVGElement, IconProps>(function WonCoinIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.5" fill={filled ? 'currentColor' : 'none'} />
      <path d="M8 8.5 9.8 15l2.2-6 2.2 6L16 8.5M7.5 12h9" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 더보기 — 점 넷. 격자(전체)와 구분하려고 네모가 아니라 점이다. 면 버전은 점이 굵어진다. */
export const MoreDotsIcon = forwardRef<SVGSVGElement, IconProps>(function MoreDotsIcon({ size = 24, filled, ...props }, ref) {
  const r = filled ? 2.6 : 2
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="7.5" cy="7.5" r={r} fill={filled ? 'currentColor' : 'none'} />
      <circle cx="16.5" cy="7.5" r={r} fill={filled ? 'currentColor' : 'none'} />
      <circle cx="7.5" cy="16.5" r={r} fill={filled ? 'currentColor' : 'none'} />
      <circle cx="16.5" cy="16.5" r={r} fill={filled ? 'currentColor' : 'none'} />
    </svg>
  )
})

/* ─────────────────────────────────────────────────────────────────────────────
 * 📋 목록 행 아이콘 18종 (2026-09-28 — 대표 *"앞으로 아이콘은 모두 저 컨셉"*)
 *
 * ■ 왜 늘렸나 (실측)
 *   마이 한 화면에 lucide 가 **36종**, 유어딜 아이콘이 **0종**이었다. 위 탭 다섯은 우리 것으로
 *   바꿔 놓고 **그 바로 아래 본문은 통째로 남의 세트**였다 — 한 화면에서 획 두께도 모서리도
 *   갈린다. 대표 규칙은 *"앞으로 아이콘은 모두 저 컨셉"* 이다.
 *
 * ■ 무엇을 안 바꿨나 — 유틸리티는 lucide 로 남긴다
 *   화살표·닫기·검색·복사·로딩(`ChevronRight`·`X`·`Search`·`Check`·`Plus`·`Loader2`)은
 *   **글자가 아니라 조작**이고, 어느 앱에서나 같은 모양이라 직접 그릴 값이 없다.
 *   바꾸는 것은 **뜻을 가진 아이콘**(내 이용권·찜·정산·설정 …)뿐이다.
 *
 * ■ 계약은 위와 동일 — 24 그리드 · `currentColor` · stroke 1.6 · round.
 *   목록 행은 18px 로 그려진다: **작다.** 그래서 획 셋을 넘기지 않고, 안에 글자를 넣지 않고,
 *   덩어리 하나가 실루엣을 잡게 했다. 탭과 달리 `filled` 가 필요 없지만(행은 선택 상태가 없다)
 *   계약을 깨지 않으려고 prop 은 그대로 받는다.
 * ────────────────────────────────────────────────────────────────────────── */

/** 쿠폰함 — 이용권과 같은 티켓 틀에 **%**. 틀이 같아서 "같은 종이" 로 읽히고 내용이 할인임을 말한다. */
export const CouponIcon = forwardRef<SVGSVGElement, IconProps>(function CouponIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill={filled ? 'currentColor' : 'none'} />
      <path d="m9.4 14.6 5.2-5.2" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="9.6" cy="9.8" r="1.05" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="14.4" cy="14.2" r="1.05" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 찜 — 하트. 담아 둔 것이지 산 것이 아니라 속을 비운다(면 버전은 목록에서 안 쓴다). */
export const HeartIcon = forwardRef<SVGSVGElement, IconProps>(function HeartIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M12 19.9 5.1 13a4.4 4.4 0 0 1 6.2-6.2l.7.7.7-.7A4.4 4.4 0 0 1 18.9 13z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  )
})

/** 단골 가게 — 별. 가게 그림에 별을 얹으면 18px 에서 둘 다 뭉개진다 ⇒ 별 하나로 '자주 가는 곳'. */
export const StarIcon = forwardRef<SVGSVGElement, IconProps>(function StarIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="m12 4.3 2.45 4.96 5.47.8-3.96 3.86.94 5.45L12 16.8l-4.9 2.57.94-5.45L4.08 10.06l5.47-.8z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  )
})

/** 관심 맛집(오픈 알림) — 종. 아래 추까지 그려야 '알림' 이지 그냥 모자처럼 안 보인다. */
export const BellIcon = forwardRef<SVGSVGElement, IconProps>(function BellIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M18 9.4a6 6 0 1 0-12 0c0 4-1.6 5.6-1.6 5.6h15.2S18 13.4 18 9.4z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M10.2 18.2a2 2 0 0 0 3.6 0" />
    </svg>
  )
})

/** 주문 내역 — 택배 상자. 입체로 그려야 '배송된 물건' 이고 평면 네모면 그냥 상자다. */
export const BoxIcon = forwardRef<SVGSVGElement, IconProps>(function BoxIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M3.8 7.9 12 3.7l8.2 4.2v8.2L12 20.3l-8.2-4.2z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M3.8 7.9 12 12.1l8.2-4.2M12 12.1v8.2" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 배송지 — 핀 하나. 동네(DongneDealIcon)와 달리 **한 지점**이라 이 자리엔 이게 맞다. */
export const PinIcon = forwardRef<SVGSVGElement, IconProps>(function PinIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M12 20.8s6.6-5.9 6.6-10.4a6.6 6.6 0 1 0-13.2 0C5.4 14.9 12 20.8 12 20.8z" fill={filled ? 'currentColor' : 'none'} />
      <circle cx="12" cy="10.2" r="2.5" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 내 리뷰 — 말풍선 + 별. 브랜드메시지(줄 두 개)와 **내용물로** 갈린다: 리뷰는 평가고 메시지는 글이다. */
export const ReviewIcon = forwardRef<SVGSVGElement, IconProps>(function ReviewIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4.2 6.6a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2h-6.3L7.2 19.6v-3.8H6.2a2 2 0 0 1-2-2z" fill={filled ? 'currentColor' : 'none'} />
      <path d="m12 7.4 1.28 2.6 2.87.42-2.08 2.02.5 2.86L12 14l-2.57 1.3.5-2.86-2.08-2.02 2.87-.42z" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 동네 공구 제안 — 말풍선 + 더하기. '내가 올린다' 는 뜻은 덧셈 기호가 가장 짧게 말한다. */
export const ProposeIcon = forwardRef<SVGSVGElement, IconProps>(function ProposeIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4.2 6.6a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2h-6.3L7.2 19.6v-3.8H6.2a2 2 0 0 1-2-2z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 7.6v5.2M9.4 10.2h5.2" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 소개 파트너 — 두 사람. 한 사람(PersonIcon)이 '나' 라서, 둘이면 '나 말고 누군가와' 가 된다. */
export const PeopleIcon = forwardRef<SVGSVGElement, IconProps>(function PeopleIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="9.2" cy="8.6" r="3.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M3 19.6a6.2 6.2 0 0 1 12.4 0" fill={filled ? 'currentColor' : 'none'} />
      <path d="M16.2 6.1a3.4 3.4 0 0 1 0 6.6M17.4 14.2a5.6 5.6 0 0 1 3.6 5.2" />
    </svg>
  )
})

/** 내 가게 등록 — 유어샵 차양 + 더하기. 같은 실루엣이라 '가게' 로 읽히고 `+` 가 '새로 낸다' 를 더한다. */
export const ShopPlusIcon = forwardRef<SVGSVGElement, IconProps>(function ShopPlusIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M3.4 9.3 4.9 5.2h11.4l1.1 3" fill={filled ? 'currentColor' : 'none'} />
      <path d="M3.4 9.3c0 1.3.9 2.1 2.1 2.1s2.1-.8 2.1-2.1c0 1.3.9 2.1 2.1 2.1s2.2-.8 2.2-2.1c0 1.3.9 2.1 2.1 2.1" />
      <path d="M4.9 11.6v7.7h7.3" />
      <circle cx="17.6" cy="16.2" r="4" />
      <path d="M17.6 14.3v3.8M15.7 16.2h3.8" />
    </svg>
  )
})

/** 주문(판매) — 클립보드. 손님 쪽 '주문 내역'(상자)과 갈린다: 이쪽은 **처리할 목록**이다. */
export const OrdersIcon = forwardRef<SVGSVGElement, IconProps>(function OrdersIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M8.6 5.4H6.9a1.9 1.9 0 0 0-1.9 1.9v11a1.9 1.9 0 0 0 1.9 1.9h10.2a1.9 1.9 0 0 0 1.9-1.9v-11a1.9 1.9 0 0 0-1.9-1.9h-1.7" fill={filled ? 'currentColor' : 'none'} />
      <rect x="8.6" y="3.4" width="6.8" height="4" rx="1.2" stroke={filled ? KNOCKOUT : 'currentColor'} fill={filled ? KNOCKOUT : 'none'} />
      <path d="M8.6 11.8h6.8M8.6 15.4h4.4" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 매출 분석 — 축 + 올라가는 선. 막대는 1.6 획에서 선인지 막대인지 안 보인다(그려 보고 버렸다). */
export const ChartIcon = forwardRef<SVGSVGElement, IconProps>(function ChartIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4.4 4.4v15.2h15.2" />
      <path d="m7.2 15.6 3.4-4.2 3 2.6 5-6" />
      <path d="M18.6 8h-3.2m3.2 0v3.2" />
    </svg>
  )
})

/** 브랜드메시지 — 말풍선 + 글 두 줄. 리뷰(별)와 제안(+)이 같은 풍선을 쓰므로 **내용물이 이름표**다. */
export const MessageIcon = forwardRef<SVGSVGElement, IconProps>(function MessageIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4.2 6.6a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2h-6.3L7.2 19.6v-3.8H6.2a2 2 0 0 1-2-2z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M8 8.6h8M8 11.8h5" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 설정 — 톱니. 이가 열둘이면 18px 에서 테두리가 톱니바퀴가 아니라 원으로 뭉친다 ⇒ **여섯**. */
export const SettingsIcon = forwardRef<SVGSVGElement, IconProps>(function SettingsIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M10.6 3.6h2.8l.35 2.2a6.4 6.4 0 0 1 1.7.98l2.07-.86 1.4 2.42-1.72 1.4a6.5 6.5 0 0 1 0 1.96l1.72 1.4-1.4 2.42-2.07-.86a6.4 6.4 0 0 1-1.7.98l-.35 2.2h-2.8l-.35-2.2a6.4 6.4 0 0 1-1.7-.98l-2.07.86-1.4-2.42 1.72-1.4a6.5 6.5 0 0 1 0-1.96l-1.72-1.4 1.4-2.42 2.07.86a6.4 6.4 0 0 1 1.7-.98z" fill={filled ? 'currentColor' : 'none'} />
      <circle cx="12" cy="11.7" r="2.6" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 이용권 사용처리 — QR 을 찍는 **틀**. 코드 자체를 그리면 '내 티켓' 으로 읽히므로 모서리 넷 + 스캔선. */
export const ScanIcon = forwardRef<SVGSVGElement, IconProps>(function ScanIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4 9V6.4A2.4 2.4 0 0 1 6.4 4H9M15 4h2.6A2.4 2.4 0 0 1 20 6.4V9M20 15v2.6a2.4 2.4 0 0 1-2.4 2.4H15M9 20H6.4A2.4 2.4 0 0 1 4 17.6V15" />
      <path d="M4.6 12h14.8" />
    </svg>
  )
})

/**
 * 이용권 사용처리 **티켓 꼬리**용 — 스캔 틀 안의 QR (2026-10-10 대표 확정 안 3, *"바코드 모양이 아니라
 * QR모양이어야 하잖아"*). 손님이 내미는 이용권은 QR 이라 꼬리도 QR 이다(바코드면 다른 물건으로 읽힌다).
 * ⚠️ 위 `ScanIcon` 이 "코드만 그리면 '내 티켓' 으로 읽힌다" 고 경고한 그 함정을 **틀 모서리**로 피한다 —
 * 모서리 넷이 "이걸 찍는다" 를 말한다. 32 그리드(꼬리 자리가 18px 행 아이콘보다 크다), 획 1.6 은 세트 그대로.
 */
export const QrScanIcon = forwardRef<SVGSVGElement, IconProps>(function QrScanIcon({ size = 32, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} viewBox="0 0 32 32" width={size} height={size} {...props}>
      <path d="M3 9V5.4A2.4 2.4 0 0 1 5.4 3H9M23 3h3.6A2.4 2.4 0 0 1 29 5.4V9M29 23v3.6a2.4 2.4 0 0 1-2.4 2.4H23M9 29H5.4A2.4 2.4 0 0 1 3 26.6V23" />
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

/** 로그아웃 — 문 + 나가는 화살표. 화살표만 그리면 '공유' 로 읽힌다(그게 lucide 의 오래된 혼동이다). */
export const LogOutIcon = forwardRef<SVGSVGElement, IconProps>(function LogOutIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M14.4 4.6h3.2a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2h-3.2" fill={filled ? 'currentColor' : 'none'} />
      <path d="m9.6 8.4 3.6 3.6-3.6 3.6M13.2 12H4.2" />
    </svg>
  )
})

/** 이메일 — 봉투. 뚜껑이 겹쳐야 봉투고, 없으면 그냥 카드다. */
export const MailIcon = forwardRef<SVGSVGElement, IconProps>(function MailIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2" fill={filled ? 'currentColor' : 'none'} />
      <path d="m3.8 7.4 7.1 5a2 2 0 0 0 2.2 0l7.1-5" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 리뷰어 등급 — 메달. 별(단골)과 겹치지 않게 **리본 달린 원**으로, 등급은 '받은 것' 이다. */
export const MedalIcon = forwardRef<SVGSVGElement, IconProps>(function MedalIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M8.4 3.6 10.9 9M15.6 3.6 13.1 9" />
      <circle cx="12" cy="14.6" r="5.6" fill={filled ? 'currentColor' : 'none'} />
      <path d="m12 11.6 1.03 2.09 2.31.34-1.67 1.63.39 2.3L12 16.87l-2.06 1.09.39-2.3-1.67-1.63 2.31-.34z" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/* ──────────────────────────────────────────────────────────────────────────
 * 🎨 2026-09-29 (대표 UI 네 트랙 중 ④): 마이 밖 **전 소비자 화면**으로 넓히며 추가한 10종.
 *   고른 기준은 하나다 — **뜻을 가진 것**(우리 물건의 이름)만 그리고, 조작(화살표·닫기·검색)은
 *   lucide 그대로 둔다. 실측으로 lucide 853건 중 482건이 뜻이었고, 그중 300건 남짓이
 *   아래 10종 + 이미 있던 10종으로 덮인다(나머지는 한 번씩만 쓰는 긴 꼬리).
 * ────────────────────────────────────────────────────────────────────────── */

/** 시간 — 시계. 바늘이 12시·4시를 가리켜야 '시계' 로 읽힌다(대칭이면 나침반처럼 보인다). */
export const ClockIcon = forwardRef<SVGSVGElement, IconProps>(function ClockIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 7.4v4.9l3.2 1.9" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 매장(남의 가게) — 차양 없는 **건물 앞면**. 유어샵(내 진열대)과 실루엣이 겹치면 안 된다. */
export const StoreIcon = forwardRef<SVGSVGElement, IconProps>(function StoreIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M4.6 9.6h14.8v10.2H4.6z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M3.4 9.6 5.6 4.6h12.8l2.2 5" />
      <path d="M9.8 19.8v-5.2h4.4v5.2" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 장바구니 — 손잡이 달린 **가방**. 바퀴 달린 카트는 우리 흐름(픽업·이용권)에 안 맞다. */
export const BagIcon = forwardRef<SVGSVGElement, IconProps>(function BagIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M5.2 7.8h13.6l-1.1 12H6.3z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M8.9 9.8V6.9a3.1 3.1 0 0 1 6.2 0v2.9" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 지갑(딜 잔액) — **접힌 지갑 + 잠금 단추**. 동전(WonCoin)은 '금액', 이쪽은 '담아 두는 곳'. */
export const WalletIcon = forwardRef<SVGSVGElement, IconProps>(function WalletIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <rect x="3.4" y="6.2" width="17.2" height="12" rx="2.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M3.4 10.2h17.2" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="16.6" cy="14.2" r="1.3" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 됨 — 원 안 체크. 상태 넷(OkIcon·WarnIcon·BadIcon·InfoIcon)은 **같은 원**을 공유한다. */
export const OkIcon = forwardRef<SVGSVGElement, IconProps>(function OkIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="m8.4 12.2 2.5 2.5 4.7-5" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 주의 — 원 안 느낌표. 삼각형은 '위험' 이라 더 세다 ⇒ 경고는 WarnIcon 을 쓴다. */
export const AlertIcon = forwardRef<SVGSVGElement, IconProps>(function AlertIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 7.9v4.6" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="12" cy="15.9" r=".5" fill={filled ? KNOCKOUT : 'currentColor'} stroke="none" />
    </svg>
  )
})

/** 경고 — 세모 안 느낌표. 되돌릴 수 없는 일(삭제·만료) 앞에서만 쓴다. */
export const WarnIcon = forwardRef<SVGSVGElement, IconProps>(function WarnIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M12 3.9 21 19.6H3z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 9.8v4" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="12" cy="16.6" r=".5" fill={filled ? KNOCKOUT : 'currentColor'} stroke="none" />
    </svg>
  )
})

/** 안 됨 — 원 안 ✕. 실패·거절·취소. */
export const BadIcon = forwardRef<SVGSVGElement, IconProps>(function BadIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/** 안내 — 원 안 i. 중립이라 색은 쓰는 자리가 정한다(tone-info). */
export const InfoIcon = forwardRef<SVGSVGElement, IconProps>(function InfoIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="8.4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 11.4v4.7" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="12" cy="8.2" r=".5" fill={filled ? KNOCKOUT : 'currentColor'} stroke="none" />
    </svg>
  )
})

/** 배송 — 짐칸 + 운전칸. 상자(BoxIcon)는 '물건', 이쪽은 '오는 중' 이다. */
export const TruckIcon = forwardRef<SVGSVGElement, IconProps>(function TruckIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M2.8 6.6h10.4v9.8H2.8z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M13.2 10h3.9l3.9 3.4v3h-7.8z" fill={filled ? 'currentColor' : 'none'} />
      <circle cx="7" cy="18" r="1.8" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <circle cx="17.4" cy="18" r="1.8" stroke={filled ? KNOCKOUT : 'currentColor'} />
    </svg>
  )
})

/**
 * 고치기(편집) — 연필 + 그 아래 받침선. 몸통만 그리면 '쓰기' 로 읽혀서,
 * 밑줄이 "이 줄을 고친다" 를 만든다. `filled` 는 연필 몸통만 채운다(촉은 비워 방향이 남는다).
 */
export const EditIcon = forwardRef<SVGSVGElement, IconProps>(function EditIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d="M16.1 4.3a1.9 1.9 0 0 1 2.7 0l.9.9a1.9 1.9 0 0 1 0 2.7l-8.2 8.2-4 1.3 1.3-4z" fill={filled ? 'currentColor' : 'none'} />
      <path d="m14.6 5.8 3.6 3.6" stroke={filled ? KNOCKOUT : 'currentColor'} />
      <path d="M4.6 20.2h14.8" />
    </svg>
  )
})
