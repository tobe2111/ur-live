import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { toast } from '@/hooks/useToast'
import { MALL_OPERATOR_TERMS, MALL_OPERATOR_TERMS_VERSION } from '@/shared/mall/operator-terms'

/**
 * 🏬 **몰 운영자 콘솔** (`/mall-admin`) — 2026-08-10. 공구 서비스(운영자 SaaS)의 운영자 화면.
 *
 * 그동안 운영자는 **자기 몰을 만질 방법이 없었다**(운영자 로그인 부재 → 공지 하나도 어드민 대행).
 * 이 화면이 그 갭을 닫는다. 새 로그인 체계는 만들지 않았다 — 카카오 계정으로 들어오면 서버가
 * `operator_user_id` 로 "내 몰"을 확정한다(URL 에 몰 id 가 없다 = 남의 몰을 열 파라미터가 없다).
 *
 * 첫 진입에 **운영자 약관 동의**(= 승낙형 전자계약)를 받는다. 유캔사인 같은 외부 서명형은 쓰지 않는다.
 * 라이트 고정 — 대시보드 성격이라 `force-light-theme`.
 */
interface MallMe {
  mall: { id: number; slug: string; name: string; live: boolean }
  stats: { stores: number; products: number; notices: number }
  terms: { agreed: boolean; version: string }
  privacy_md: string
}
interface Notice { id: number; type: string; title: string; body: string | null; active: number; created_at: string }

export default function MallAdminPage() {
  const [me, setMe] = useState<MallMe | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'notoperator' | 'login'>('loading')
  const [agreeChecked, setAgreeChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ type: 'banner', title: '', body: '' })

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/mall-admin/me')
      if (!r.data?.success) { setState('notoperator'); return }
      setMe(r.data.data)
      setState('ok')
      if (r.data.data?.terms?.agreed) {
        const n = await api.get('/api/mall-admin/notices').catch(() => null)
        setNotices(n?.data?.notices ?? [])
      }
    } catch (e) {
      const st = (e as { response?: { status?: number } })?.response?.status
      setState(st === 401 ? 'login' : 'notoperator')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function agree() {
    if (!agreeChecked) { toast.error('약관에 동의해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/mall-admin/agree', { agree: true })
      if (r.data?.success) { toast.success('약관 동의가 완료되었습니다'); await load() }
      else toast.error(r.data?.error || '처리에 실패했습니다')
    } catch { toast.error('처리에 실패했습니다') } finally { setBusy(false) }
  }

  async function addNotice() {
    if (!form.title.trim()) { toast.error('제목을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/mall-admin/notices', { type: form.type, title: form.title.trim(), body: form.body.trim() || null })
      if (r.data?.success) { toast.success('공지가 게시되었습니다'); setForm({ type: 'banner', title: '', body: '' }); await load() }
      else toast.error(r.data?.error || '게시에 실패했습니다')
    } catch { toast.error('게시에 실패했습니다') } finally { setBusy(false) }
  }

  async function toggleNotice(n: Notice) {
    await api.patch(`/api/mall-admin/notices/${n.id}`, { active: n.active ? 0 : 1 }).catch(() => null)
    await load()
  }
  async function removeNotice(n: Notice) {
    if (!window.confirm(`"${n.title}" 공지를 삭제할까요?`)) return
    await api.delete(`/api/mall-admin/notices/${n.id}`).catch(() => null)
    await load()
  }

  const input = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400'

  if (state === 'loading') return <BrandLoader fullScreen />

  if (state === 'login') {
    return (
      <div className="force-light-theme min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">🏬</div>
          <p className="text-base font-bold text-gray-900">몰 운영자 로그인</p>
          <p className="mt-2 text-sm text-gray-500">담당자 카카오 계정으로 로그인해주세요.</p>
          <a href={`/login?returnUrl=${encodeURIComponent('/mall-admin')}`}
            className="mt-5 inline-block w-full py-3 rounded-lg bg-[#FEE500] text-[#3C1E1E] text-sm font-semibold">
            카카오로 로그인
          </a>
        </div>
      </div>
    )
  }

  if (state === 'notoperator' || !me) {
    return (
      <div className="force-light-theme min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-base font-bold text-gray-900">운영 중인 몰이 없습니다</p>
          <p className="mt-2 text-sm text-gray-500">
            이 계정에 연결된 몰이 없습니다. 담당자 계정이 맞는지 확인하시거나 유어딜에 문의해주세요.
          </p>
        </div>
      </div>
    )
  }

  // 📜 승낙형 전자계약 — 동의 전에는 콘솔 기능을 열지 않는다.
  if (!me.terms.agreed) {
    return (
      <div className="force-light-theme min-h-[100dvh] bg-gray-50 py-10 px-4">
        <SEO title="운영자 약관 동의 - 유어딜" description="몰 운영자 약관" url="/mall-admin" noindex />
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-gray-900">{me.mall.name} 운영자 약관</h1>
          <p className="mt-1 text-sm text-gray-500">버전 {MALL_OPERATOR_TERMS_VERSION} · 동의하시면 콘솔을 이용할 수 있습니다.</p>
          <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-5 max-h-[55dvh] overflow-y-auto">
            {MALL_OPERATOR_TERMS.map((t) => (
              <div key={t.title}>
                <p className="text-[13px] font-bold text-gray-900">{t.title}</p>
                <p className="mt-1 text-[13px] leading-[1.7] text-gray-600">{t.body}</p>
              </div>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={agreeChecked} onChange={(e) => setAgreeChecked(e.target.checked)} className="mt-0.5" />
            <span>위 약관 전체에 동의합니다. (동의 일시·접속 IP가 증적으로 기록됩니다)</span>
          </label>
          <button onClick={agree} disabled={busy}
            className="mt-4 w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? '처리 중…' : '동의하고 시작하기'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 py-8 px-4">
      <SEO title={`${me.mall.name} 운영 콘솔 - 유어딜`} description="몰 운영자 콘솔" url="/mall-admin" noindex />
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{me.mall.name}</h1>
            <a href={`/${me.mall.slug}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 break-all">
              urdeal.kr/{me.mall.slug}
            </a>
          </div>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${me.mall.live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {me.mall.live ? '공개 중' : '비공개'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '참여 매장', value: me.stats.stores },
            { label: '판매 중 상품', value: me.stats.products },
            { label: '게시 중 공지', value: me.stats.notices },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {me.stats.products === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            아직 판매 중인 상품이 없습니다. 참여 매장 연결·상품 등록은 유어딜 담당자에게 요청해주세요.
          </p>
        )}

        <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
          <div>
            <p className="text-sm font-bold text-gray-900">공지 올리기</p>
            <p className="text-xs text-gray-400">배너는 몰 상단 띠로, 팝업은 첫 방문 시 한 번 뜹니다.</p>
          </div>
          <div className="flex gap-2">
            <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}
              className="h-10 px-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white">
              <option value="banner">배너</option>
              <option value="popup">팝업</option>
            </select>
            <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              maxLength={120} placeholder="제목 — 예: 이번 주 픽업 안내" className={input} />
          </div>
          <input value={form.body} onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))}
            maxLength={2000} placeholder="내용(선택)" className={input} />
          <button onClick={addNotice} disabled={busy}
            className="px-4 h-10 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? '게시 중…' : '공지 게시'}
          </button>
        </div>

        {notices.length > 0 && (
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm">
                <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded ${n.type === 'popup' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                  {n.type === 'popup' ? '팝업' : '배너'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                  <p className="text-xs text-gray-400 truncate">{n.body || '—'}</p>
                </div>
                <button onClick={() => toggleNotice(n)}
                  className={`shrink-0 px-2 py-1 rounded text-[11px] font-semibold border ${n.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {n.active ? '게시 중' : '숨김'}
                </button>
                <button onClick={() => removeNotice(n)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">삭제</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
