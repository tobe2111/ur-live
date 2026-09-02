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
        <path d="M10.2 19.5v-4.6h3.6v4.6" stroke="var(--surface, #fff)" fill="var(--surface, #fff)" />
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
      <path d="M12 7.5V20" stroke={filled ? 'var(--surface, #fff)' : 'currentColor'} />
    </svg>
  )
})

/** 이용권 — 양쪽 홈이 파인 티켓 + 절취선. 결제 완료·지갑의 티켓 카드와 같은 모양이라 탭과 화면이 한 물건이다. */
export const TicketStubIcon = forwardRef<SVGSVGElement, IconProps>(function TicketStubIcon({ size = 24, filled, ...props }, ref) {
  const d = 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z'
  return (
    <svg ref={ref} {...base} width={size} height={size} {...props}>
      <path d={d} fill={filled ? 'currentColor' : 'none'} />
      <path d="M9.5 8.6v6.8" strokeDasharray="1.6 1.8" stroke={filled ? 'var(--surface, #fff)' : 'currentColor'} />
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
