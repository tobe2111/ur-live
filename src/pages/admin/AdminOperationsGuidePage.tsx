import { useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { BookOpen, Shield, Store, Building2 } from 'lucide-react'
import GuideViewer from '@/components/guide/GuideViewer'

/**
 * 어드민 운영 가이드 페이지
 *
 * 🛡️ 2026-04-23 배치 174: DB 기반으로 전환. 3개 탭 (어드민/셀러/에이전시) 모두 편집 가능.
 * 셀러/에이전시 탭은 각자의 대시보드에서 읽기 전용으로 표시됨.
 */
export default function AdminOperationsGuidePage() {
  const token = localStorage.getItem('admin_token') || ''
  const [tab, setTab] = useState<'admin' | 'seller' | 'agency'>('admin')

  const tabs = [
    { key: 'admin' as const, label: '어드민 가이드', icon: Shield, color: 'bg-red-500' },
    { key: 'seller' as const, label: '셀러 가이드', icon: Store, color: 'bg-blue-500' },
    { key: 'agency' as const, label: '에이전시 가이드', icon: Building2, color: 'bg-purple-500' },
  ]

  return (
    <AdminLayout title="운영 가이드">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="유어딜 운영 가이드"
          subtitle="어드민/셀러/에이전시 3종 가이드 — 여기서 수정하면 각 대시보드에 즉시 반영됩니다"
          icon={<BookOpen className="h-5 w-5" />}
        />

        {/* 탭 선택 */}
        <div className="bg-white rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-2 flex gap-2">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active ? `${t.color} text-white shadow-sm` : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 안내 박스 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">💡 편집 팁</p>
          <ul className="text-xs space-y-0.5 list-disc pl-4">
            <li>각 섹션의 <strong>연필 아이콘</strong>을 클릭하면 바로 편집 가능합니다</li>
            <li>Markdown 문법 사용 가능: <code className="bg-amber-100 px-1 rounded">**bold**</code>, <code className="bg-amber-100 px-1 rounded">### 제목</code>, 리스트, 표 등</li>
            <li>저장 즉시 셀러/에이전시 대시보드에도 반영됩니다 (캐시 없음)</li>
            <li>순서 번호를 조정해 섹션 순서를 변경할 수 있습니다</li>
          </ul>
        </div>

        {/* 가이드 뷰어 (편집 모드) */}
        <GuideViewer guideType={tab} token={token} editable={true} />
      </div>
    </AdminLayout>
  )
}
