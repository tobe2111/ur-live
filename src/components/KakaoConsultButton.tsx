/**
 * 🛡️ 2026-04-22 배치 124: 카카오 상담 플로팅 버튼
 *
 * - 모든 유저 대면 페이지 우측 하단에 표시 (셀러/어드민/에이전시 대시보드 제외)
 * - 430px 컬럼 기준 내부 정렬 (PC 에서 viewport 밖으로 벗어나지 않음)
 * - BottomNav 위에 위치 (bottom offset 조정)
 * - admin-registered SideBanner 와 무관하게 항상 표시
 */
import { useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'

const KAKAO_CHAT_URL = 'http://pf.kakao.com/_AITdn/chat'

// 대시보드 경로 — 이 경로에서는 버튼 숨김 (각 대시보드가 자체 상담 버튼 보유)
const DASHBOARD_PREFIXES = ['/seller', '/admin', '/agency']

export default function KakaoConsultButton() {
  const location = useLocation()

  // 대시보드 경로에서는 표시 안 함 (공개 셀러 프로필 /profile/, /s/ 는 표시)
  const isDashboard = DASHBOARD_PREFIXES.some((p) => location.pathname.startsWith(p + '/') || location.pathname === p)
  // 임베드/결제 등 full-screen 페이지에서도 숨김
  const isFullScreen = location.pathname.startsWith('/embed/') || location.pathname.startsWith('/checkout/return')
  if (isDashboard || isFullScreen) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pr-5 pointer-events-none">
      {/* 🛡️ 2026-04-28: pr-5 로 우측 여백 보강 (모바일에서 화면 벽에 너무 붙던 문제) */}
      <div className="max-w-[430px] mx-auto flex justify-end">
        <a
          href={KAKAO_CHAT_URL}
          target="_blank" rel="noopener noreferrer"
          aria-label="카카오 상담"
          className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: '#FEE500' }}
        >
          <MessageCircle className="w-6 h-6 text-[#3C1E1E]" strokeWidth={2.5} />
        </a>
      </div>
    </div>
  )
}
