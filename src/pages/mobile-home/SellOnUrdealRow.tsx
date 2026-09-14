/**
 * 🏪 **피드 끝 판매 진입점** — 모바일 홈 (대표 확정 2026-09-14, 안 1)
 *
 * 대표 *"모바일 버전 기준 메인페이지에도 urdeal로 판매하세요 이런 버튼이 있어야 하지 않을까?"*
 * 시안 4안 → 안 1(피드 끝 한 줄). 근거: `docs/design/mobile-home-sell-entry-2026-09-14.md`.
 *
 * ## 왜 필요했나 — 모바일에는 상시 문이 하나도 없었다
 * 실측: 모바일 홈에 판매 진입점 **0개**, 그리고 **푸터도 없다**. 남은 상시 문은 마이페이지
 * 2×2 그리드 하나뿐인데 거기는 로그인해서 마이까지 들어간 사람만 본다 —
 * 2026-07-03 인계가 *"이미 관심 있는 사람만 봄(self-selection) · 깔때기 중간 단절"* 이라고
 * 적어 둔 그 상태다.
 *
 * ## 🚫 2026-08-26 결정을 뒤집는 것이 아니다
 * 그날 지도 핀 모달의 "사장님이신가요?" 를 뺀 판단은 옳았다. 문제는 **존재가 아니라 자리**였다 —
 * 손님이 가게를 보던 중에 끼어들었다. 여기는 **피드를 다 본 뒤**라 아무 작업도 끊지 않는다.
 * ⚠️ 그래서 이 줄을 위로 올리지 말 것. 올리는 순간 그때 뺀 것과 같은 물건이 된다.
 *
 * ## 노출 규칙은 새로 만들지 않았다
 * `seller_token` 이 있으면 미노출 — 마이페이지 `RoleCtaGrid` 의 '내 가게 등록' 타일과
 * **같은 신호·같은 목적지**(`/store/new`)다. 규칙이 둘이 되면 언젠가 갈린다.
 * **비로그인에게는 보인다**: 이 문장은 로그인해야 뜻이 통하는 말이 아니고, 가리면 정작
 * 새 사장님을 놓친다(`/store/new` 가 로그인을 요구하면 그쪽이 복귀 주소로 데려온다).
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** 매장 등록의 상시 문(2026-08-26 주석이 지목한 그 자리). 카카오맵 검색이 안에 있다. */
const SELL_PATH = '/store/new'

export default function SellOnUrdealRow() {
  // 이미 사장님이면 그릴 것이 없다. localStorage 접근 실패는 미노출로 — 화면을 막지 않는다.
  let isSeller = false
  try { isSeller = !!localStorage.getItem('seller_token') } catch { isSeller = true }
  if (isSeller) return null

  return (
    <Link
      to={SELL_PATH}
      className="mt-6 flex items-center gap-2.5 border-t border-rule px-4 py-4 active:opacity-60 transition-opacity"
    >
      {/* 라이트에서 이 문장은 **잉크**다(대표 2026-09-14: "화이트 버전에서의 글자는 검정이어야 해").
          회색으로 흐리면 피드 끝에서 읽히지 않는다 — 여긴 이미 스크롤 끝이라 더 물러설 곳이 없다. */}
      <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-gray-900 dark:text-gray-200">
        <b className="font-bold text-gray-900 dark:text-white">사장님이신가요?</b>{' '}
        내 가게도 유어딜에 올려보세요
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-brand-text">
        시작하기 <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
