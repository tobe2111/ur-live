/**
 * 🆕 2026-07-15 어드민 소셜 홍보 — 스레드/인스타/유튜브 자동화 콘솔.
 *   계정 연결 · AI 초안 생성 · 검토/편집 · 승인 · 발행. 자동발행 없음(발행은 명시적 버튼).
 *   ⚠️ 라이트 대시보드 테마(AdminLayout) — dark: variant 금지.
 *   백엔드: /api/admin/social/* (features/social-media).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
  Sparkles, Edit2, Trash2, Send, CheckCircle2, ExternalLink, Loader2, AlertTriangle, Image as ImageIcon, Video,
} from 'lucide-react'
import SocialAccountsPanel from './admin-social/SocialAccountsPanel'
import SocialDraftEditor from './admin-social/SocialDraftEditor'
import SocialVideoControls from './admin-social/SocialVideoControls'
import {
  PLATFORMS, STATUS_META, parseHashtags,
  type SocialAccount, type SocialGate, type SocialPost, type SocialPlatform,
} from './admin-social/types'

export default function AdminSocialPage() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState<SocialPlatform | ''>('')
  const [editing, setEditing] = useState<SocialPost | null>(null)
  const [genLoading, setGenLoading] = useState<SocialPlatform | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const { data: acctData, refetch: refetchAccounts } = useApiQuery<{ accounts: SocialAccount[]; gates: SocialGate[]; videoEnabled: boolean }>(
    ['admin', 'social', 'accounts'], '/api/admin/social/accounts',
    { select: (r: any) => ({ accounts: r?.accounts || [], gates: r?.gates || [], videoEnabled: !!r?.video?.enabled }) },
  )
  const accounts = acctData?.accounts || []
  const gates = acctData?.gates || []
  const videoEnabled = acctData?.videoEnabled || false

  const { data: posts = [], isLoading, isError, refetch: refetchPosts } = useApiQuery<SocialPost[]>(
    ['admin', 'social', 'posts', platform || 'all'],
    `/api/admin/social/posts${platform ? `?platform=${platform}` : ''}`,
    { select: (r: any) => (r?.success ? r.posts || [] : []) },
  )

  const gateOf = (p: string) => gates.find((g) => g.platform === p)
  const accountOf = (p: string) => accounts.find((a) => a.platform === p)

  const generate = async (p: SocialPlatform) => {
    setGenLoading(p)
    try {
      const { data } = await api.post('/api/admin/social/posts/generate', { platform: p })
      if (data?.success) { toast.success(`${PLATFORMS.find((x) => x.key === p)?.label} 초안을 생성했습니다`); refetchPosts() }
      else if (data?.skipped) toast.error(data.skipped)
      else toast.error(data?.error === 'NOT_CONFIGURED' ? 'ANTHROPIC_API_KEY 가 설정되지 않았습니다' : (data?.error || '생성 실패'))
    } catch (e: any) {
      const err = e?.response?.data
      toast.error(err?.skipped || (err?.error === 'NOT_CONFIGURED' ? 'ANTHROPIC_API_KEY 가 설정되지 않았습니다' : err?.error) || '생성 중 오류')
    } finally { setGenLoading(null) }
  }

  const approve = async (post: SocialPost) => {
    setBusyId(post.id)
    try {
      const { data } = await api.post(`/api/admin/social/posts/${post.id}/approve`)
      if (data?.success) { toast.success('승인했습니다'); refetchPosts() } else toast.error(data?.error || '승인 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '승인 중 오류') } finally { setBusyId(null) }
  }

  const publish = async (post: SocialPost) => {
    const label = PLATFORMS.find((x) => x.key === post.platform)?.label || post.platform
    if (!(await confirmDialog({ message: `${label}에 지금 발행할까요? 실제 게시됩니다.`, confirmText: '발행' }))) return
    setBusyId(post.id)
    try {
      const { data } = await api.post(`/api/admin/social/posts/${post.id}/publish`)
      if (data?.success) { toast.success(`발행 완료${data.externalUrl ? '' : ''}`); refetchPosts() }
      else toast.error(data?.error || '발행 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '발행 중 오류') } finally { setBusyId(null) }
  }

  const archive = async (post: SocialPost) => {
    if (!(await confirmDialog({ message: '이 초안을 보관할까요?' }))) return
    setBusyId(post.id)
    try {
      const { data } = await api.delete(`/api/admin/social/posts/${post.id}`)
      if (data?.success) { toast.success('보관했습니다'); refetchPosts() } else toast.error(data?.error || '보관 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '보관 중 오류') } finally { setBusyId(null) }
  }

  // 발행 가능 여부: approved + 게이트 ON + 계정 연결 (+ 미디어 요구 충족)
  const canPublish = (post: SocialPost): { ok: boolean; reason?: string } => {
    if (post.status !== 'approved') return { ok: false, reason: '승인 필요' }
    if (!gateOf(post.platform)?.enabled) return { ok: false, reason: '발행 게이트 OFF' }
    if (!accountOf(post.platform)) return { ok: false, reason: '계정 미연결' }
    if ((post.platform === 'instagram' || post.platform === 'youtube') && !post.media_url) return { ok: false, reason: '미디어 URL 필요' }
    return { ok: true }
  }

  if (editing) {
    return (
      <AdminLayout title="소셜 홍보">
        <SocialDraftEditor post={editing} onBack={() => setEditing(null)} onSaved={() => { setEditing(null); refetchPosts() }} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="소셜 홍보">
      <DashboardPageHeader
        title="소셜 홍보 자동화"
        subtitle="스레드·인스타·유튜브에 유어딜을 홍보 — AI 초안 생성 후 검토·발행 (자동발행 없음)"
      />

      {/* 계정 연결 + 게이트 상태 */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">연결 계정 · 발행 게이트</h2>
        <SocialAccountsPanel accounts={accounts} gates={gates} onChange={() => { refetchAccounts(); refetchPosts() }} />
      </div>

      {/* 초안 생성 버튼 */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-gray-900">AI 초안 생성</span>
          <span className="text-xs text-gray-400">유어딜 홍보 문구를 사람 톤으로 자동 생성 (비공개 초안)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ key, label, emoji }) => (
            <Button key={key} variant="outline" onClick={() => generate(key)} disabled={genLoading !== null}>
              {genLoading === key ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <span className="mr-1">{emoji}</span>}
              {label} 초안
            </Button>
          ))}
        </div>
      </div>

      {/* 플랫폼 필터 */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setPlatform('')} className={`rounded-full px-3 py-1 text-sm ${platform === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>전체</button>
        {PLATFORMS.map(({ key, label, emoji }) => (
          <button key={key} onClick={() => setPlatform(key)} className={`rounded-full px-3 py-1 text-sm ${platform === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> 목록을 불러오지 못했습니다.
          <button onClick={() => refetchPosts()} className="ml-2 underline">다시 시도</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center text-gray-400">
          아직 초안이 없습니다. 위에서 “초안 생성”을 눌러보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const meta = PLATFORMS.find((x) => x.key === post.platform)
            const st = STATUS_META[post.status] || STATUS_META.draft
            const tags = parseHashtags(post.hashtags)
            const pub = canPublish(post)
            const busy = busyId === post.id
            return (
              <div key={post.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span>{meta?.emoji}</span>
                      <span className="text-xs font-medium text-gray-500">{meta?.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      {post.ai_generated ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">AI</span> : null}
                      {post.media_kind === 'image' && <ImageIcon className="h-3.5 w-3.5 text-gray-400" />}
                      {post.media_kind === 'video' && <Video className="h-3.5 w-3.5 text-gray-400" />}
                    </div>
                    {post.title && <div className="truncate font-semibold text-gray-900">{post.title}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 line-clamp-3">{post.body}</p>
                    {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="text-xs text-blue-500">#{t}</span>)}</div>}
                    {post.status === 'published' && post.external_url && (
                      <a href={post.external_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                        <ExternalLink className="h-3 w-3" /> 게시물 보기
                      </a>
                    )}
                    {post.status === 'failed' && post.error && (
                      <div className="mt-2 flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{post.error}</div>
                    )}
                    {/* 릴스/쇼츠 영상 컨트롤 — 유튜브·인스타 초안(미발행)만 */}
                    {(post.platform === 'youtube' || post.platform === 'instagram') && post.status !== 'published' && post.status !== 'archived' && (
                      <SocialVideoControls post={post} videoEnabled={videoEnabled} onChange={() => refetchPosts()} />
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {post.status !== 'published' && (
                      <button onClick={() => setEditing(post)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50" disabled={busy}>
                        <Edit2 className="h-3 w-3" /> 편집
                      </button>
                    )}
                    {post.status === 'draft' && (
                      <button onClick={() => approve(post)} className="flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50" disabled={busy}>
                        <CheckCircle2 className="h-3 w-3" /> 승인
                      </button>
                    )}
                    {post.status === 'approved' && (
                      <button onClick={() => publish(post)} title={pub.ok ? '' : pub.reason}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !pub.ok}>
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} 발행
                      </button>
                    )}
                    {post.status === 'approved' && !pub.ok && <span className="text-[10px] text-amber-600">{pub.reason}</span>}
                    {post.status !== 'published' && (
                      <button onClick={() => archive(post)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-400 hover:bg-gray-50" disabled={busy}>
                        <Trash2 className="h-3 w-3" /> 보관
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
