import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { BookOpen } from 'lucide-react'
import GuideViewer from '@/components/guide/GuideViewer'

/**
 * 에이전시 운영 가이드 — 읽기 전용
 * 관리자가 /admin/operations-guide 에서 수정한 내용이 즉시 반영됩니다.
 */
export default function AgencyGuidePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) navigate('/agency/login', { replace: true })
  }, [navigate])

  const token = localStorage.getItem('agency_token') || ''

  return (
    <AgencyLayout title={t('agency.guide', '운영 가이드')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.guideTitle', '에이전시 운영 가이드')}
          subtitle={t('agency.guideSubtitle', '셀러 관리와 수익 성장을 위한 종합 매뉴얼')}
          icon={<BookOpen className="h-5 w-5" />}
        />

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
          💡 이 가이드는 유어딜 운영팀이 직접 작성하고 업데이트합니다. 에이전시 파트너로서 필수 내용을 담았습니다.
        </div>

        <GuideViewer guideType="agency" token={token} editable={false} />
      </div>
    </AgencyLayout>
  )
}
