/**
 * 🙋 **내 가게 찾기 (소유권 신청)** — `/store/find` · 설계 §5(a), 3단계
 *
 * 대표 확정 2026-09-09. 중개자가 대신 올린 매장의 진짜 사장님이 **직접 오는 문**이다.
 *
 * ## 🕳️ 이게 없던 자리 = 막다른 길
 * `StoreRegisterModal` 의 중복(409) 화면이 *"사장님이신데 들어갈 수 없다면 … 상담으로 알려주세요"*
 * 라고 말하고 끝났다. 상담은 창구가 아니라 **부재의 완곡어**였다 — 받은 뒤에 주인을 바꿀 수단이
 * 코드에 아예 없었다(`POST /stores/:id/operators` 는 이미 주인인 사람만 부를 수 있고 역할도
 * `'operator'` 로 못 박혀 있다).
 *
 * ## 🔒 번호 일치는 증명이 아니다
 * 사업자번호는 인터넷에 공개돼 있다. 그래서 이 화면은 **찾기만** 하고, 증명은 등록증 사본을
 * 사람이 확인한다(2026-08-26 에 번호만으로 자동 승인되던 매장 등록 경로를 이미 한 번 막았다).
 * 화면이 그 사실을 숨기지 않는다 — "바로 됩니다" 라고 쓰면 기다리는 사람이 화를 낸다.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import BusinessCertUpload from '@/components/BusinessCertUpload'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync } from '@/utils/auth'
import { formatKSTDate } from '@/utils/date'
import { ChevronLeft, Search, Store } from 'lucide-react'

interface FoundStore {
  seller_id: number; business_name: string | null; name: string | null
  address: string | null; status: string | null; has_owner: boolean; is_mine: boolean
}
interface MyClaim {
  id: number; seller_id: number; status: string; decision_reason: string | null
  decided_at: string | null; created_at: string | null
  business_name: string | null; store_name: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: '심사 중', approved: '승인됨', rejected: '거절됨', cancelled: '종료됨',
}

export default function StoreOwnerClaimPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [bno, setBno] = useState('')
  const [stores, setStores] = useState<FoundStore[] | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [certUrl, setCertUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [mine, setMine] = useState<MyClaim[]>([])

  useEffect(() => {
    if (!isLoggedInSync()) navigate(`/login?returnUrl=${encodeURIComponent('/store/find')}`, { replace: true })
  }, [navigate])

  // 중복 등록 화면(`STORE_EXISTS`)에서 넘어오면 매장이 이미 정해져 있다 — 찾기를 건너뛴다.
  useEffect(() => {
    const pre = Number(params.get('seller_id'))
    if (Number.isFinite(pre) && pre > 0) setPicked(pre)
  }, [params])

  const loadMine = useCallback(async () => {
    try {
      const res = await api.get('/api/seller/store-claims/mine')
      setMine(res.data?.data?.claims || [])
    } catch { /* 내역이 안 뜨는 것으로 신청 자체를 막지 않는다 */ }
  }, [])
  useEffect(() => { void loadMine() }, [loadMine])

  async function lookup() {
    const n = bno.replace(/-/g, '')
    if (!/^\d{10}$/.test(n)) { toast.error('사업자번호를 숫자 10자리로 입력해주세요'); return }
    setBusy(true)
    try {
      const res = await api.get(`/api/seller/stores/lookup-by-business?business_number=${n}`)
      const list: FoundStore[] = res.data?.data?.stores || []
      setStores(list)
      if (list.length === 1) setPicked(list[0].seller_id)
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '조회에 실패했어요')
    } finally { setBusy(false) }
  }

  async function submit() {
    if (!picked) { toast.error('신청할 매장을 선택해주세요'); return }
    if (!certUrl) { toast.error('사업자등록증 사본을 첨부해주세요'); return }
    setBusy(true)
    try {
      const res = await api.post('/api/seller/store-claims', {
        seller_id: picked,
        business_number: bno.replace(/-/g, '') || undefined,
        business_cert_url: certUrl,
        contact_phone: phone || undefined,
        note: note || undefined,
      })
      if (res.data?.success) {
        toast.success('신청이 접수됐어요 — 확인 후 알려드릴게요')
        setCertUrl(''); setNote(''); setPicked(null); setStores(null)
        await loadMine()
      } else toast.error(res.data?.error || '신청에 실패했어요')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '신청에 실패했어요')
    } finally { setBusy(false) }
  }

  const pickedStore = stores?.find((s) => s.seller_id === picked) || null

  return (
    /* 🕳️ `force-light-theme` — 전역 `.dark input`(특이도 0,5,1)이 `text-gray-900`(0,1,0)을 이겨
       다크모드에서 흰 배경 위 흰 글자가 된다. 형제 `/store/new` 가 같은 이유로 이미 붙여 뒀다. */
    <div className="force-light-theme min-h-[100dvh] bg-gray-50">
      <SEO title="내 가게 찾기 - 유어딜" description="이미 등록된 내 가게의 소유권을 신청하세요" noindex />

      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-600" aria-label="뒤로">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-gray-900">내 가게 찾기</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        <p className="text-[13px] text-gray-600 leading-relaxed">
          이미 유어딜에 등록된 가게의 <b className="text-gray-900">진짜 사장님</b>이시면, 사업자등록증을 올려
          소유권을 신청해주세요. 확인되면 그 매장의 주인으로 등록해 드립니다 —
          <b className="text-gray-900"> 지금까지 쌓인 상품·주문·리뷰·정산 이력은 그대로 남습니다.</b>
        </p>

        {/* ── ① 찾기 ─────────────────────────────────────── */}
        {!picked && (
          <section className="bg-white rounded-2xl p-4">
            <label className="block text-[13px] font-semibold mb-1.5 text-gray-900">사업자등록번호</label>
            <div className="flex gap-2">
              <input
                value={bno} onChange={(e) => setBno(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookup() }}
                inputMode="numeric" placeholder="0000000000 (숫자 10자리)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
              />
              <button onClick={() => void lookup()} disabled={busy}
                className="px-4 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {stores && stores.length === 0 && (
              <p className="mt-3 text-[13px] text-gray-600 leading-relaxed">
                이 번호로 등록된 매장이 없어요. 아직 유어딜에 없는 가게라면{' '}
                <button onClick={() => navigate('/store/new')} className="text-brand-text underline font-semibold">
                  매장 등록
                </button>
                {' '}으로 바로 시작하실 수 있어요.
              </p>
            )}
            {stores && stores.length > 0 && (
              <ul className="mt-3 space-y-2">
                {stores.map((s) => (
                  <li key={s.seller_id}>
                    <button onClick={() => setPicked(s.seller_id)}
                      className="w-full text-left border border-gray-200 rounded-xl p-3 hover:bg-gray-50">
                      <p className="text-sm font-semibold text-gray-900">
                        <Store className="w-4 h-4 inline mr-1 text-gray-400" />
                        {s.business_name || s.name || `매장 ${s.seller_id}`}
                      </p>
                      {s.address && <p className="text-[12px] text-gray-500 mt-0.5">{s.address}</p>}
                      <p className="text-[12px] mt-1">
                        {s.is_mine
                          ? <span className="text-green-700">이미 사장님 매장입니다</span>
                          : s.has_owner
                            ? <span className="text-gray-500">현재 다른 분이 소유자로 등록돼 있어요</span>
                            : <span className="text-gray-500">아직 소유자가 없는 매장이에요</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── ② 신청 ─────────────────────────────────────── */}
        {picked && (
          <section className="bg-white rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {pickedStore?.business_name || pickedStore?.name || `매장 #${picked}`}
              </p>
              <button onClick={() => { setPicked(null); setCertUrl('') }} className="text-[12.5px] text-gray-500">
                다시 찾기
              </button>
            </div>

            <BusinessCertUpload value={certUrl} onChange={setCertUrl} required />

            <div>
              <label className="block text-[13px] font-semibold mb-1.5 text-gray-900">연락처 (선택)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                placeholder="010-0000-0000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5 text-gray-900">남길 말 (선택)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
                placeholder="예: 제가 이 가게 대표입니다. 대행사와 계약이 끝났어요."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
            </div>

            <button onClick={() => void submit()} disabled={busy || !certUrl}
              className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-40 transition">
              {busy ? '접수 중…' : '소유권 신청하기'}
            </button>
            <p className="text-[11.5px] text-gray-400 leading-relaxed">
              신청하면 유어딜이 등록증을 확인한 뒤 소유자로 등록해 드립니다. 사업자번호가 같다는 것만으로는
              바로 넘겨드릴 수 없어요 — 번호는 누구나 볼 수 있기 때문이에요.
            </p>
          </section>
        )}

        {/* ── ③ 내 신청 내역 ─────────────────────────────── */}
        {mine.length > 0 && (
          <section className="bg-white rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">내 신청 내역</p>
            <ul className="divide-y divide-gray-100">
              {mine.map((m) => (
                <li key={m.id} className="py-2.5">
                  <p className="text-[13px] text-gray-900">
                    {m.business_name || m.store_name || `매장 ${m.seller_id}`}
                    <span className="ml-2 text-[12px] text-gray-500">{STATUS_LABEL[m.status] || m.status}</span>
                  </p>
                  {m.decision_reason && <p className="text-[12px] text-gray-500 mt-0.5">{m.decision_reason}</p>}
                  <p className="text-[11.5px] text-gray-400 mt-0.5">
                    {m.created_at ? formatKSTDate(m.created_at) : ''}
                    {m.decided_at ? ` · 처리 ${formatKSTDate(m.decided_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
