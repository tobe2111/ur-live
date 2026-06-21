/**
 * 👥 2026-06-12 (감사 부채): 조회 전용(viewer) 직원 계정 UI 사전 안내.
 *   서버는 이미 주문/충전신청/견적/클레임을 403 으로 차단(감사 🟡#5 게이트) — 그러나 UI 에
 *   사전 안내가 없어 버튼을 누르고 나서야 거절을 보던 것. 버튼 disable + 안내 배너로 선제 안내.
 *   sub_role 은 /api/wholesale/me 응답(useWholesaleMe — 5분 캐시)에서 읽음. 로딩/미로그인은
 *   false(게이트 안 함) — 서버 차단이 최종 방어선이므로 fail-open 이 안전.
 */
import { useWholesaleMe } from '@/hooks/queries/useWholesale'
import { WT } from './wholesale-theme'

/** 현재 세션이 조회 전용(viewer) 직원 계정인지. 로딩/미로그인/owner = false. */
export function useIsWholesaleViewer(): boolean {
  const meQ = useWholesaleMe()
  return (meQ.data as { sub_role?: string | null } | null | undefined)?.sub_role === 'viewer'
}

/** 뷰어 차단 안내 배너 — action 예: '주문', '예치금 충전 신청', '견적 요청'. */
export function ViewerNotice({ action }: { action: string }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold"
      style={{ background: '#f9fafb', color: '#9A6B00', border: '1px solid #F5E1B8' }}>
      👀 조회 전용(뷰어) 직원 계정입니다 — {action}은(는) 관리자·직원 권한 계정만 할 수 있어요.
      <span className="block mt-0.5 font-normal" style={{ color: WT.ink3 }}>
        권한이 필요하면 대표 계정에서 직원 관리로 역할을 변경해 달라고 요청해주세요.
      </span>
    </div>
  )
}
