import { Navigate, useLocation } from 'react-router-dom'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import { useSellerEmbedded } from '@/shared/seller-embed'
import { sellerEntryRedirect } from '@/lib/seller-deep-link'

interface SellerLayoutProps {
  /** 화면 이름. 시트 머리가 이름을 말하므로 이 컴포넌트는 그리지 않는다 — 호출부 호환으로 남는다. */
  title: string
  children: React.ReactNode
  /** @deprecated 2026-10-12 — 단독 틀(머리줄)과 함께 사라졌다. 시트 안에서는 원래부터 안 그려졌다. */
  headerRight?: React.ReactNode
  /** @deprecated 2026-10-12 — 하단 탭·사이드바 배지가 사라졌다. 호출부 호환으로만 남는다. */
  pendingOrders?: number
  /**
   * 🪟 **본문만** — 마이 안 시트가 이 화면을 *그대로* 열 때. 같은 폼을 두 벌 만들지 않기 위한 유일한 길이다.
   * ⚠️ 라이트 고정은 **호출부가 라이트 섬 클래스로** 준다(이 페이지들은 `dark:` 가 금지돼 있다) —
   *   `VoucherNewSheet` 를 볼 것. 여기서는 그 클래스를 **쓰지도, 이름을 적지도 않는다**:
   *   `dark-contrast-coverage` 가 소스를 원시 텍스트로 훑어 사용처를 찾기 때문에
   *   주석에 적기만 해도 "이 파일이 섬을 만든다" 로 오탐된다(실제로 한 번 그랬다).
   */
  bare?: boolean
}

/**
 * 🧭 **셀러 화면의 본문 래퍼 — 단독 틀은 없다** (2026-10-12 대표 *"대시보드는 완전히 지워줘"*).
 *
 *   셀러 대시보드는 지웠다. 화면 파일들은 남아 있고 마이(사장님)·에이전시 콘솔(직원)이 **시트로** 연다
 *   (`ToolPageSheet` 가 실제 라우트 표를 메모리 라우터로 렌더한다). 이 컴포넌트가 하는 일은 셋뿐이다:
 *     ① 시트 안이면 본문을 셀러 스코프(`.seller-light-theme`)로 감싸 돌려준다.
 *     ② 브라우저 주소창으로 왔으면(알림톡·메일·옛 북마크) **마이 또는 콘솔로 보낸다** — 판정은 `sellerEntryRedirect` 한 곳.
 *     ③ 외부 OAuth 복귀 주소(`RENDER_BARE`)만 보내지 않고 같은 래퍼로 그 자리에서 렌더한다(쿼리를 그 화면이 읽는다).
 *
 *   ⚠️ 2026-10-12 이전의 틀(머리줄·전체 메뉴 `/seller/more`·홈 `/seller`·⌘K·카카오 상담 버튼·승인 배너·귀환 띠)은
 *   전부 지웠다. 되살리지 말 것 — 사람이 일하는 곳은 마이와 콘솔이다.
 *   ⚠️ 도매 전용 판매사를 `/wholesale` 로 보내던 분기도 지웠다 — 도매몰은 2026-10-11 철거됐고 그 주소는 410 이다.
 */
export default function SellerLayout({ children, bare = false }: SellerLayoutProps) {
  // 🪟 마이 시트 안인가. **페이지가 아니라 여기가 읽는다** — 41개 화면에 prop 을 뚫으면 반드시 몇 개를 빠뜨린다.
  const embedded = useSellerEmbedded()
  const location = useLocation()

  // 🛡️ 2026-04-30: 만료 5분 전 자동 refresh + 탭 복귀 시 검증 — 시트 안에서도 돈다(훅은 조기 반환보다 앞).
  useTokenAutoRefresh('seller')

  if (!bare && !embedded) {
    const to = sellerEntryRedirect(location.pathname, location.search)
    if (to) return <Navigate to={to} replace />
  }

  //   🩸 2026-09-26: 종전엔 `<>{children}</>` 였는데, 그러면 **스코프가 통째로 사라진다** —
  //     `.seller-light-theme` 에 걸린 규칙들(장식 아이콘 칩 숨김 · 폰에서 페이지 제목 한 번만)이
  //     시트 안에서만 죽었고, 여백이 없어 화면이 **가장자리에 딱 붙어** 그려졌다.
  //   ⚠️ `ur-embed-page` 는 "시트 안" 표시다 — 시트 머리가 이미 이름을 말하므로 페이지 h1 을
  //     한 번 더 그리지 않는다(CSS 한 줄, `index.css`). 부제는 남긴다(정보다).
  return (
    <div className="seller-light-theme ur-embed-page p-3 sm:p-5 space-y-3 sm:space-y-5">
      {children}
    </div>
  )
}
