import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Factory } from 'lucide-react'
import GuideViewer from '@/components/guide/GuideViewer'

/**
 * 도매몰(유통스타트 B2B) 전용 운영 가이드 페이지 — 어드민 전용.
 *
 * 🏭 2026-06-07: 어드민 일반 가이드의 도매 섹션을 단일 진실원천(SSOT)으로 분리.
 *   - DB guide_type='wholesale' 기반 (어드민만 GET/PATCH/DELETE).
 *   - 끝의 '코드 자동 참조' 섹션은 코드 스캔으로 자동 갱신
 *     (`npm run generate:guide-refs`, 도매 페이지/API 변경 시).
 */
export default function AdminWholesaleGuidePage() {
  return (
    <AdminLayout title="도매몰 운영 가이드">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="🏭 도매몰(유통스타트) 운영 가이드"
          subtitle="제조사·유통사 온보딩부터 등급/마진·상품 검수·주문/배송·정산·세금까지 — 여기서 수정하면 즉시 반영됩니다"
          icon={<Factory className="h-5 w-5" />}
        />

        {/* 안내 박스 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">💡 편집 팁</p>
          <ul className="text-xs space-y-0.5 list-disc pl-4">
            <li>각 섹션의 <strong>연필 아이콘</strong>을 클릭하면 바로 편집 가능합니다</li>
            <li>Markdown 문법 사용 가능: <code className="bg-amber-100 px-1 rounded">**bold**</code>, <code className="bg-amber-100 px-1 rounded">### 제목</code>, 리스트, 표 등</li>
            <li>맨 아래 <strong>코드 자동 참조</strong> 섹션은 도매 코드(제조사/유통사/공급 API) 변경 시 자동 갱신됩니다 (<code className="bg-amber-100 px-1 rounded">npm run generate:guide-refs</code>)</li>
          </ul>
        </div>

        {/* 가이드 뷰어 (편집 모드, 어드민 전용) */}
        <GuideViewer guideType="wholesale" editable={true} />
      </div>
    </AdminLayout>
  )
}
