// ──────────────────────────────────────────────────────────────
// 👥 2026-06-09 유통사 직원 계정 관리 (owner/admin 전용).
//   회사(유통사 owner) 1계정 아래 직원 서브계정 초대/역할변경/활성토글/삭제.
//   서브계정 로그인 토큰의 seller_id = 회사(parent) seller_id → 예치금/주문/카탈로그 공유.
//   라이트 고정 B2B 서피스(WholesaleDashboardShell). i18n defaultValue.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Users, ShieldCheck, Eye, Pencil, Loader2, Trash2, UserPlus, Store } from 'lucide-react'
import SEO from '@/components/SEO'
import { WT } from './wholesale-theme'
import WholesaleDashboardShell from '@/components/wholesale/WholesaleDashboardShell'
import { buildWholesaleNav } from './wholesale-nav'
import { useWholesaleMall, useWholesaleMe } from '@/hooks/queries/useWholesale'
import {
  useWholesaleSubAccounts, useCreateWholesaleSubAccount, useUpdateWholesaleSubAccount,
  useDeleteWholesaleSubAccount, type WholesaleSubRole,
} from '@/hooks/queries/useWholesale'
import { toast } from '@/hooks/useToast'

const ROLE_META: Record<WholesaleSubRole, { label: string; desc: string; icon: typeof ShieldCheck; color: string; bg: string }> = {
  admin:  { label: '관리자', desc: '직원 관리 + 주문 + 모든 기능', icon: ShieldCheck, color: WT.brand, bg: WT.brandSoft },
  staff:  { label: '직원',   desc: '주문 + 조회 (직원 관리 불가)', icon: Pencil, color: WT.pos, bg: WT.posBg },
  viewer: { label: '뷰어',   desc: '조회만 가능 (주문 불가)',     icon: Eye, color: WT.ink2, bg: WT.fill },
}

export default function WholesaleStaffPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { displayName: mallName } = useWholesaleMall()

  const meQ = useWholesaleMe()
  const me = (meQ.data ?? null) as { can_manage_staff?: boolean; sub_role?: string | null } | null
  // owner(sub_role 없음) 또는 admin 만 직원 관리 가능. 그 외엔 대시보드로.
  const canManage = me ? me.can_manage_staff !== false : true

  // 🛡️ 2026-06-19 (대표 신고 동일 패턴): is_distributor localStorage 가드 제거 — token 기준 일치.
  //   직원 관리 권한은 서버 me.can_manage_staff(canManage)가 검증하므로 클라 가드 완화 안전.
  useEffect(() => {
    if (!token) { navigate('/wholesale/login', { replace: true }); return }
  }, [token, navigate])

  useEffect(() => {
    if (meQ.isSuccess && !canManage) {
      toast.error('직원 계정을 관리할 권한이 없습니다')
      navigate('/wholesale/dashboard', { replace: true })
    }
  }, [meQ.isSuccess, canManage, navigate])

  const listQ = useWholesaleSubAccounts(canManage)
  const createM = useCreateWholesaleSubAccount()
  const updateM = useUpdateWholesaleSubAccount()
  const deleteM = useDeleteWholesaleSubAccount()
  const staff = listQ.data ?? []

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<WholesaleSubRole>('staff')

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    if (createM.isPending) return
    if (!email.trim() || !password) { toast.error('이메일과 비밀번호를 입력해주세요'); return }
    const r = await createM.mutateAsync({ email: email.trim(), password, name: name.trim(), role })
    if (r?.success) {
      toast.success('직원 계정을 추가했어요')
      setEmail(''); setPassword(''); setName(''); setRole('staff')
    } else {
      toast.error(r?.error || '추가에 실패했어요')
    }
  }

  async function changeRole(id: number, nextRole: WholesaleSubRole) {
    const r = await updateM.mutateAsync({ id, role: nextRole })
    if (!r?.success) toast.error(r?.error || '변경에 실패했어요')
  }
  async function toggleActive(id: number, active: number) {
    const r = await updateM.mutateAsync({ id, active: active ? 0 : 1 })
    if (!r?.success) toast.error(r?.error || '변경에 실패했어요')
  }
  async function remove(id: number) {
    if (!window.confirm('이 직원 계정을 삭제할까요? 되돌릴 수 없습니다.')) return
    const r = await deleteM.mutateAsync(id)
    if (r?.success) toast.success('삭제했어요')
    else toast.error(r?.error || '삭제에 실패했어요')
  }

  const navItems = buildWholesaleNav(location.pathname, navigate, canManage)

  const inputCls = 'w-full h-11 px-3 rounded-lg border text-[14px] outline-none focus:border-[#0C2454] transition-colors text-gray-900'

  return (
    <WholesaleDashboardShell brand="유통사 센터" roleIcon={Store} navItems={navItems} title="직원 계정 관리">
      <SEO title="직원 계정 관리 — 유통사" description="유통사 직원 서브계정 초대/권한 관리" url="/wholesale/staff" noindex />

      <div className="space-y-6">
        {/* 역할 안내 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(ROLE_META) as WholesaleSubRole[]).map((r) => {
            const m = ROLE_META[r]; const Icon = m.icon
            return (
              <div key={r} className="rounded-xl bg-white p-4" style={{ boxShadow: WT.shSoft }}>
                <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold mb-2" style={{ background: m.bg, color: m.color }}>
                  <Icon size={13} /> {m.label}
                </div>
                <p className="text-[13px] text-gray-600">{m.desc}</p>
              </div>
            )
          })}
        </div>

        {/* 초대 폼 */}
        <div className="rounded-xl bg-white p-5" style={{ boxShadow: WT.shCard }}>
          <h2 className="text-[15px] font-bold text-gray-900 mb-1 inline-flex items-center gap-2"><UserPlus size={16} /> 직원 초대</h2>
          <p className="text-[13px] text-gray-500 mb-4">직원은 본인 이메일/비밀번호로 로그인하지만 회사 계정(예치금·주문·카탈로그)을 공유합니다.</p>
          <form onSubmit={submitInvite} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={{ borderColor: WT.line }} placeholder="staff@email.com" autoComplete="off" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">이름 (선택)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={{ borderColor: WT.line }} placeholder="홍길동" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} style={{ borderColor: WT.line }} placeholder="영문+숫자 8자 이상" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">역할</label>
              <select value={role} onChange={(e) => setRole(e.target.value as WholesaleSubRole)} className={inputCls} style={{ borderColor: WT.line }}>
                <option value="admin">관리자 — 직원 관리 + 주문 + 전체</option>
                <option value="staff">직원 — 주문 + 조회</option>
                <option value="viewer">뷰어 — 조회만 (주문 불가)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={createM.isPending}
                className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-lg text-white font-bold text-[14px] disabled:opacity-60" style={{ background: WT.brand }}>
                {createM.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} 직원 추가
              </button>
            </div>
          </form>
        </div>

        {/* 직원 목록 */}
        <div className="rounded-xl bg-white p-5" style={{ boxShadow: WT.shCard }}>
          <h2 className="text-[15px] font-bold text-gray-900 mb-4 inline-flex items-center gap-2"><Users size={16} /> 직원 목록 ({staff.length})</h2>
          {listQ.isLoading ? (
            <div className="py-10 text-center text-gray-400"><Loader2 className="inline w-5 h-5 animate-spin" /></div>
          ) : staff.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-gray-400">아직 등록된 직원이 없습니다.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: WT.line }}>
              {staff.map((s) => {
                const m = ROLE_META[s.role as WholesaleSubRole] || ROLE_META.staff
                return (
                  <div key={s.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-gray-900 truncate">{s.name || s.email}</span>
                        {!s.active && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">비활성</span>}
                      </div>
                      <div className="text-[12px] text-gray-500 truncate">{s.email}{s.last_login_at ? ` · 최근 로그인 ${s.last_login_at.slice(0, 10)}` : ''}</div>
                    </div>
                    <select value={s.role} onChange={(e) => changeRole(s.id, e.target.value as WholesaleSubRole)} disabled={updateM.isPending}
                      className="h-9 px-2 rounded-lg border text-[13px] text-gray-900 outline-none" style={{ borderColor: WT.line }}>
                      <option value="admin">관리자</option>
                      <option value="staff">직원</option>
                      <option value="viewer">뷰어</option>
                    </select>
                    <button onClick={() => toggleActive(s.id, s.active)} disabled={updateM.isPending}
                      className="h-9 px-3 rounded-lg border text-[13px] font-semibold text-gray-700 hover:bg-gray-50" style={{ borderColor: WT.line }}>
                      {s.active ? '비활성화' : '활성화'}
                    </button>
                    <button onClick={() => remove(s.id)} disabled={deleteM.isPending} aria-label="삭제"
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border text-gray-400 hover:text-red-500 hover:border-red-200" style={{ borderColor: WT.line }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </WholesaleDashboardShell>
  )
}
