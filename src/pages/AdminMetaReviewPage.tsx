/**
 * 🎬 2026-11-18 어드민 — 메타 앱 검수 시연 화면(/admin/meta-review).
 *   메타는 권한마다 "실제 로그인 → 실제 기능 사용" 녹화를 요구한다. 대표가 이 화면을 켜 두고 화면 녹화를 한다.
 *   녹화 대본: /mnt/project-files/marketing/meta-review-recording.md (프로젝트 파일).
 *   바깥으로 나가는 행동(답글·DM)은 전부 사람이 확인란을 체크해야 나간다.
 *   ⚠️ 라이트 대시보드(AdminLayout) — dark: variant 금지. 백엔드: features/meta-review.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Loader2 } from 'lucide-react'
import { BASE, Section, type MetaStatus } from './admin-meta-review/shared'
import ConnectCard from './admin-meta-review/ConnectCard'
import ThreadsPanel from './admin-meta-review/ThreadsPanel'
import InstagramPanel from './admin-meta-review/InstagramPanel'

export default function AdminMetaReviewPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = useApiQuery<MetaStatus>(['admin', 'meta-review', 'status'], `${BASE}/status`, { select: (r: any) => r?.data })

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  // 로그인에서 돌아왔을 때 결과 알림
  useEffect(() => {
    const m = params.get('meta')
    if (!m) return
    if (m === 'connected') toast.success('Logged in / 로그인 완료')
    else if (m === 'cancelled') toast.error('Login cancelled / 로그인을 취소했어요')
    else toast.error(params.get('reason') || 'Login failed / 로그인 실패')
    setParams({}, { replace: true })
    status.refetch()
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = status.data
  return (
    <AdminLayout title="Meta App Review demo">
      <DashboardPageHeader
        title="UrDeal × Meta: how we use each permission"
        subtitle="Log in with your Meta account, then use each feature. Every outgoing reply or message requires a human to review and approve it."
      />
      {status.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !s ? (
        <p className="py-8 text-sm text-gray-500">상태를 불러오지 못했어요. 새로고침해 주세요.</p>
      ) : (
        <div className="max-w-4xl">
          <Section step="Step 1" title="Log in with Meta (OAuth)" ko="메타 계정으로 로그인 — 실제 로그인·권한 허용 화면이 나옵니다" perms={['threads_basic', 'instagram_basic', 'pages_show_list']}>
            <div className="grid gap-3 lg:grid-cols-2">
              <ConnectCard provider="threads" s={s.threads} onChange={() => status.refetch()} />
              <ConnectCard provider="facebook" s={s.facebook} onChange={() => status.refetch()} />
            </div>
          </Section>
          <ThreadsPanel connected={s.threads.connected} />
          <InstagramPanel connected={s.facebook.connected} />
        </div>
      )}
    </AdminLayout>
  )
}
