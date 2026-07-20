/**
 * 🗺️ 2026-07-19 (대표 — "지도 버튼을 위치바 우측 빈 공간에"): 좌측 레일 제거로 사라졌던
 *   지도 썸네일 버튼 복원 — 홈 상단 위치바/카테고리 행의 우측(빈 공간)에 배치. 클릭 → /map.
 *   지도 그래픽은 항상 라이트(사진처럼) — 텍스트/색 인라인 hex(테마 무관, 가드-안전).
 */
import { useNavigate } from 'react-router-dom'

export default function PcHomeMapButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/map')}
      aria-label="지도에서 가까운 딜 보기"
      className="relative hidden lg:block w-[320px] shrink-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
    >
      <svg viewBox="0 0 340 110" className="w-full block" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <rect width="340" height="110" fill="#edefeb" />
        <path d="M0 0 L58 0 L0 48 Z" fill="#cfe7a4" />
        <path d="M340 0 L340 36 L300 0 Z" fill="#cfe7a4" />
        <path d="M0 110 L0 70 L48 110 Z" fill="#cfe7a4" />
        <path d="M340 110 L292 110 L340 76 Z" fill="#cfe7a4" />
        <path d="M340 0 L340 20 L322 0 Z" fill="#a9d8ef" />
        <g stroke="#d9dbd6" strokeWidth="6" strokeLinecap="round">
          <path d="M0 38 H340" /><path d="M0 78 H340" />
          <path d="M96 0 V110" /><path d="M192 0 V110" /><path d="M266 0 V110" />
        </g>
        <g stroke="#f6d24a" strokeWidth="9" strokeLinecap="round" fill="none">
          <path d="M-8 22 C 70 12, 120 34, 210 14" />
          <path d="M0 56 H340" />
          <path d="M-10 108 L 140 -8" />
        </g>
      </svg>
      {/* 빨강 핀 */}
      <svg width="26" height="33" viewBox="0 0 24 32" className="absolute left-1/2 -translate-x-1/2" style={{ top: '14%' }} aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.4 12 32 12 32s12-11.6 12-20.1C24 5.3 18.6 0 12 0z" fill="#ea4335" />
        <circle cx="12" cy="11.5" r="4.4" fill="#fff" />
      </svg>
      <span className="absolute inset-x-0 text-center font-extrabold" style={{ bottom: '12%', color: '#191b1f', fontSize: '14px' }}>
        지도에서 가까운 딜 보기
      </span>
    </button>
  )
}
