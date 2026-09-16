import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { BookOpen } from 'lucide-react'
import GuideViewer from '@/components/guide/GuideViewer'
import { isSellerAuthenticated, getSellerToken } from '@/lib/seller-auth'

/**
 * 셀러 운영 가이드 — 읽기 전용
 * 관리자가 /admin/operations-guide 에서 수정한 내용이 즉시 반영됩니다.
 */
export default function SellerGuidePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSellerAuthenticated()) navigate('/seller/login')
  }, [navigate])

  const token = getSellerToken() || ''

  return (
    <SellerLayout title={t('seller.nav.guide', '운영 가이드')}>
      <div className="mx-auto max-w-5xl space-y-6">
        <DashboardPageHeader
          title={t('seller.guide.title', '셀러 운영 가이드')}
          subtitle={t('seller.guide.subtitle', '유어딜에서 매장과 이용권을 운영하는 방법')}
          icon={<BookOpen className="h-5 w-5" />}
        />

        <div className="bg-white border border-rule rounded-xl p-3 text-xs text-gray-700">
          이 가이드는 유어딜 운영팀이 직접 작성하고 업데이트합니다. 궁금한 점이 있으면 각 섹션을 펼쳐서 확인하세요.
        </div>

        <GuideViewer guideType="seller" token={token} editable={false} />
      </div>
    </SellerLayout>
  )
}
