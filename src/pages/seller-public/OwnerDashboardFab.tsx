/**
 * 🛡️ 2026-05-07: TD-018 분할 — 셀러 본인용 플로팅 대시보드 버튼.
 * 🛡️ 2026-04-28: KakaoConsultButton 과 겹치지 않도록 bottom-36 + max-w-[430px].
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'

export default function OwnerDashboardFab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="fixed bottom-36 left-0 right-0 z-50 px-4 pr-5 pointer-events-none">
      <div className="max-w-[430px] mx-auto flex justify-end">
        <button
          onClick={() => navigate('/seller')}
          className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/30 text-sm font-bold active:scale-95"
        >
          <Settings className="w-4 h-4" />
          {t('seller.dashboard')}
        </button>
      </div>
    </div>
  )
}
