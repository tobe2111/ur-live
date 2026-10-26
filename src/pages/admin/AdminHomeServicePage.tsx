/**
 * 🧾 생활 견적 — 운영팀 화면 (2026-10-24 대표 "실제 손님 있어. 두 기능 모두 만들어줘")
 *
 * ① 대리 접수: 영업으로 찾은 실제 손님의 이사·청소 요청서를 운영팀이 대신 올린다(손님 동의 기록 필수).
 * ② 유어딜 직영 견적: 받은 견적을 보고 유어딜(또는 협력 업체)이 견적을 낸다 — 손님 화면에 "유어딜 직영" 표시.
 * 대리 접수 건은 손님이 전화로 고른 견적을 운영팀이 대신 누른다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { formatKSTDate } from '@/utils/date'
import { formatNumber } from '@/utils/format'

interface Field { key: string; label: string; type: string; required: boolean; options?: string[]; unit?: string; placeholder?: string }
interface Cat { key: string; label: string; fields: Field[] }
interface Row { id: number; category: string; summary: string; desired_date: string; status: string; quote_count: number; max_quotes: number; source: string; contact_name: string | null; created_at: string; share_token?: string | null }
interface Quote { id: number; price: number | null; message: string; status: string; is_house: number; partner?: number; pro_name: string; pro_phone: string | null }
interface Detail extends Row { details: Record<string, string>; contact_phone: string; consent_note: string | null; quotes: Quote[]; houseSellerId: number | null }

const STATUS: Record<string, string> = { open: '받는 중', chosen: '선택됨', cancelled: '취소', expired: '만료' }
const input = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900'

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback
}

export default function AdminHomeServicePage() {
  const list = useApiQuery<{ requests: Row[]; categories: Cat[] }>(['admin', 'home-service', 'requests'], '/api/admin/home-service/requests', {
    select: (raw) => (raw as { data: { requests: Row[]; categories: Cat[] } }).data, staleTime: 0,
  })
  const house = useApiQuery<{ seller: { id: number; name: string } | null }>(['admin', 'home-service', 'house'], '/api/admin/home-service/house', {
    select: (raw) => (raw as { data: { seller: { id: number; name: string } | null } }).data, staleTime: 0,
  })
  const partners = useApiQuery<{ category: string; seller_id: number; name?: string; status?: string }[]>(['admin', 'home-service', 'partners'], '/api/admin/home-service/partners', {
    select: (raw) => (raw as { data: { category: string; seller_id: number; name?: string; status?: string }[] }).data, staleTime: 0,
  })
  const costs = useApiQuery<Record<string, number>>(['admin', 'home-service', 'credit-costs'], '/api/admin/home-service/credit-costs', {
    select: (raw) => (raw as { data: Record<string, number> }).data, staleTime: 0,
  })
  const [cCat, setCCat] = useState('signage')
  const [cN, setCN] = useState('')
  const [pCat, setPCat] = useState('signage')
  const [pId, setPId] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const detail = useApiQuery<Detail>(['admin', 'home-service', 'request', openId], `/api/admin/home-service/requests/${openId}`, {
    select: (raw) => (raw as { data: Detail }).data, enabled: !!openId, staleTime: 0,
  })
  const [busy, setBusy] = useState(false)
  const [houseId, setHouseId] = useState('')
  const [cat, setCat] = useState('move')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState('')
  const [hqPrice, setHqPrice] = useState('')
  const [hqMsg, setHqMsg] = useState('')

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true)
    try {
      await fn(); toast.success(ok)
      await Promise.all([list.refetch(), house.refetch(), partners.refetch(), costs.refetch(), openId ? detail.refetch() : null])
    } catch (e) { toast.error(errMsg(e, fail)) } finally { setBusy(false) }
  }
  const catDef = list.data?.categories.find((c) => c.key === cat)
  const d = detail.data

  return (
    <AdminLayout title="생활 견적">
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <DashboardPageHeader title="생활 견적" subtitle="영업으로 찾은 실제 손님의 요청을 대신 올리고, 유어딜 직영 견적을 냅니다." />
        {list.isError && <div className="rounded-lg tone-bad-bg p-3 text-[13px] tone-bad">불러오지 못했습니다. <button className="underline" onClick={() => list.refetch()}>다시 시도</button></div>}

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[15px] font-semibold text-gray-900">직영 견적 매장</h2>
          <p className="text-[13px] text-gray-500">지금: {house.data?.seller ? `#${house.data.seller.id} ${house.data.seller.name}` : '아직 없음'}</p>
          <div className="flex gap-2">
            <input className={`${input} max-w-[200px]`} placeholder="매장 번호(sellers.id)" inputMode="numeric" value={houseId} onChange={(e) => setHouseId(e.target.value)} />
            <Button disabled={busy || !houseId} onClick={() => run(() => api.put('/api/admin/home-service/house', { seller_id: Number(houseId) }), '저장했습니다', '저장하지 못했습니다')}>저장</Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[15px] font-semibold text-gray-900">제휴 업체</h2>
          <p className="text-[13px] text-gray-500">카테고리마다 한 곳. 그 카테고리 요청을 지역과 무관하게 받고, 참여권 없이 견적을 냅니다(손님 화면 "유어딜 제휴").</p>
          <ul className="space-y-1 text-[13px] text-gray-700">
            {(partners.data ?? []).length === 0 && <li className="text-gray-500">아직 없음</li>}
            {(partners.data ?? []).map((p) => (
              <li key={p.category} className="flex items-center gap-2">
                <span className="font-semibold">{list.data?.categories.find((c) => c.key === p.category)?.label ?? p.category}</span>
                <span>#{p.seller_id} {p.name ?? '(매장 없음)'}{p.status && !['approved', 'active'].includes(p.status) ? ' · 승인 안 됨' : ''}</span>
                <button className="text-tone-bad underline" disabled={busy} onClick={() => run(() => api.put('/api/admin/home-service/partners', { category: p.category, seller_id: null }), '해제했습니다', '해제하지 못했습니다')}>해제</button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <select className={`${input} max-w-[220px]`} value={pCat} onChange={(e) => setPCat(e.target.value)}>
              {(list.data?.categories ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className={`${input} max-w-[200px]`} placeholder="매장 번호(sellers.id)" inputMode="numeric" value={pId} onChange={(e) => setPId(e.target.value)} />
            <Button disabled={busy || !pId} onClick={() => run(() => api.put('/api/admin/home-service/partners', { category: pCat, seller_id: Number(pId) }), '저장했습니다', '저장하지 못했습니다')}>지정</Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[15px] font-semibold text-gray-900">견적 한 번에 드는 참여권</h2>
          <p className="text-[13px] text-gray-500">기본 1장. 금액이 큰 일(간판·인테리어)은 더 받을 수 있습니다. 업체가 내는 돈이라 대표 결재(<code>docs/decisions/2026-10-25-home-service-credit-cost.md</code>) 뒤에 바꿔 주세요. 반환은 그 견적에 쓴 장수만큼 돌려줍니다.</p>
          <ul className="space-y-1 text-[13px] text-gray-700">
            {Object.keys(costs.data ?? {}).length === 0 && <li className="text-gray-500">전부 1장</li>}
            {Object.entries(costs.data ?? {}).map(([k, n]) => (
              <li key={k}><span className="font-semibold">{list.data?.categories.find((c) => c.key === k)?.label ?? k}</span> {n}장</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <select className={`${input} max-w-[220px]`} value={cCat} onChange={(e) => setCCat(e.target.value)}>
              {(list.data?.categories ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className={`${input} max-w-[160px]`} placeholder="장수(1~20)" inputMode="numeric" value={cN} onChange={(e) => setCN(e.target.value)} />
            <Button disabled={busy || !cN} onClick={() => run(() => api.put('/api/admin/home-service/credit-costs', { category: cCat, count: Number(cN) }), '저장했습니다', '저장하지 못했습니다')}>저장</Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[15px] font-semibold text-gray-900">대리 접수</h2>
          <p className="text-[13px] text-gray-500">손님에게 "업체 견적을 받아 드리고, 고른 업체에 연락처를 전달한다"는 동의를 받은 뒤에 올려 주세요.</p>
          <div className="grid gap-2 lg:grid-cols-2">
            <select className={input} value={cat} onChange={(e) => { setCat(e.target.value); setFields({}) }}>
              {(list.data?.categories ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className={input} placeholder="손님 이름" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} placeholder="손님 휴대폰" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={input} placeholder="동의 기록(예: 10/24 통화로 동의)" value={consent} onChange={(e) => setConsent(e.target.value)} />
            {(catDef?.fields ?? []).filter((f) => f.type !== 'photos').map((f) => (
              <label key={f.key} className="block text-[13px] text-gray-700">
                {f.label}{f.required ? ' *' : ''}
                {f.type === 'select' ? (
                  <select className={`${input} mt-1`} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}>
                    <option value="">선택</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className={`${input} mt-1`} type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    placeholder={f.placeholder ?? (f.unit ? f.unit : '')} value={fields[f.key] ?? ''}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
          <Button disabled={busy} onClick={() => run(async () => {
            await api.post('/api/admin/home-service/requests', { category: cat, fields, contact_name: name, contact_phone: phone, consent_note: consent })
            setFields({}); setName(''); setPhone(''); setConsent('')
          }, '접수했습니다. 맞는 업체에 알림이 갑니다', '접수하지 못했습니다')}>접수</Button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[15px] font-semibold text-gray-900">최근 요청</h2>
          <ul className="divide-y divide-gray-100">
            {(list.data?.requests ?? []).map((r) => (
              <li key={r.id}>
                <button className="w-full py-2 text-left text-[13px] text-gray-900 flex justify-between gap-2" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span>#{r.id} {r.source === 'admin' ? '[대리] ' : ''}{r.summary}{r.contact_name ? ` · ${r.contact_name}` : ''}</span>
                  <span className="text-gray-500 whitespace-nowrap">{STATUS[r.status] || r.status} · 견적 {r.quote_count}/{r.max_quotes} · {formatKSTDate(r.created_at)}</span>
                </button>
                {openId === r.id && d && d.id === r.id && (
                  <div className="mb-3 rounded-lg bg-gray-50 p-3 space-y-3 text-[13px] text-gray-900">
                    <div>손님 {d.contact_name || '-'} · {d.contact_phone} · 희망일 {d.desired_date}{d.consent_note ? ` · 동의: ${d.consent_note}` : ''}</div>
                    {r.share_token && (
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 🔗 2026-10-25 업체 모집 영업 — 커뮤니티에 붙일 링크(이름·연락처·상세 주소·메모·사진은 가려진다) */}
                        <a className="text-blue-600 underline" href={`/life/q/${r.share_token}`} target="_blank" rel="noopener noreferrer">공유 페이지 보기</a>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/life/q/${r.share_token}`).then(() => toast.success('링크를 복사했습니다'), () => window.prompt('링크를 복사해 주세요', `${window.location.origin}/life/q/${r.share_token}`))}>업체 모집 링크 복사</Button>
                      </div>
                    )}
                    <ul className="space-y-2">
                      {d.quotes.map((q) => (
                        <li key={q.id} className="rounded-lg bg-white p-2 flex justify-between gap-2">
                          <span>
                            <b>{q.pro_name}</b>{q.is_house ? (q.partner ? ' (유어딜 제휴)' : ' (유어딜 직영)') : ''} · {q.price == null ? '방문 후 견적' : `${formatNumber(q.price)}원`} · {q.status}
                            <span className="block text-gray-500">{q.message}{q.pro_phone ? ` · ${q.pro_phone}` : ''}</span>
                          </span>
                          {d.source === 'admin' && d.status === 'open' && q.status === 'sent' && (
                            <Button size="sm" disabled={busy} onClick={() => run(() => api.post(`/api/admin/home-service/requests/${d.id}/choose`, { quote_id: q.id }), '선택했습니다. 업체에 손님 연락처가 갑니다', '선택하지 못했습니다')}>손님이 고름</Button>
                          )}
                        </li>
                      ))}
                      {d.quotes.length === 0 && <li className="text-gray-500">아직 견적이 없어요</li>}
                    </ul>
                    {d.status === 'open' && (
                      <div className="flex flex-wrap gap-2">
                        <input className={`${input} max-w-[160px]`} placeholder="직영 금액(비우면 방문 후)" inputMode="numeric" value={hqPrice} onChange={(e) => setHqPrice(e.target.value)} />
                        <input className={`${input} max-w-[320px]`} placeholder="손님에게 한마디" value={hqMsg} onChange={(e) => setHqMsg(e.target.value)} />
                        <Button disabled={busy || !d.houseSellerId} onClick={() => run(async () => {
                          await api.post(`/api/admin/home-service/requests/${d.id}/house-quote`, { price: hqPrice, message: hqMsg })
                          setHqPrice(''); setHqMsg('')
                        }, '직영 견적을 보냈습니다', '보내지 못했습니다')}>직영 견적 보내기</Button>
                        {d.source === 'admin' && (
                          <Button variant="outline" disabled={busy} onClick={() => run(() => api.post(`/api/admin/home-service/requests/${d.id}/cancel`), '취소했습니다. 업체 참여권은 돌려줍니다', '취소하지 못했습니다')}>손님 취소</Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {(list.data?.requests ?? []).length === 0 && <li className="py-2 text-[13px] text-gray-500">아직 없어요</li>}
          </ul>
        </section>
      </div>
    </AdminLayout>
  )
}
