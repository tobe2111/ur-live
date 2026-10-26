import { useRef, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { TERMS_CURRENT_VERSION } from '@/pages/terms/terms-types'
import { agencyRequest } from './agency-api'

interface Registered { sellerId: number; claimCode: string | null; claimUrl: string | null }

const digits = (v: string) => v.replace(/\D/g, '')
const isMobile = (v: string) => /^01\d{8,9}$/.test(digits(v))
const FIELD_CLS = 'mt-1 w-full rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-brand/30'

/**
 * 🏢 매장 대신 등록(관리자) — 2026-10-11 대표 *"모두 다 하자"*.
 *   아직 유어딜에 없는 매장을 에이전시가 먼저 올리고, 끝나면 나오는 **사장님 코드**를 사장님께 드린다.
 *   사장님이 `/store/find` 에 넣으면 소유권 신청 → 유어딜 승인 → 그때부터 사장님 매장이다(에이전시는 계속 운영).
 *   이미 유어딜에 있는 매장은 이걸 쓰지 말고 위의 초대 링크로 [맡기기]를 받는다.
 */
export function AgencyRegisterStoreCard({ onRegistered }: { onRegistered: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [bno, setBno] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Registered | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const problem = !name.trim() ? '매장명을 입력해주세요'
    : !isMobile(phone) ? '사장님 휴대폰 번호(01x)를 입력해주세요'
      : bno && digits(bno).length !== 10 ? '사업자번호는 숫자 10자리입니다'
        : !agreed ? '판매자 이용약관에 동의해주세요' : ''

  async function submit() {
    if (problem || busy) return
    setBusy(true)
    const r = await agencyRequest<{ data: { seller_id: number; owner_claim_code: string | null; owner_claim_url: string | null } }>(
      '/stores/register', { method: 'POST', body: {
        name: name.trim(), address: address.trim(), manager_phone: digits(phone),
        ...(bno ? { business_number: digits(bno) } : {}), terms_agreed_version: TERMS_CURRENT_VERSION,
      } })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '등록하지 못했어요.'); return }
    const d = r.data.data
    setDone({ sellerId: d.seller_id, claimCode: d.owner_claim_code, claimUrl: d.owner_claim_url })
    setName(''); setAddress(''); setPhone(''); setBno(''); setAgreed(false)
    onRegistered()
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('복사했어요.') } catch { codeRef.current?.select(); toast.info('선택해 두었어요. 길게 눌러 복사해 주세요.') }
  }

  return (
    <div className="mt-3 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">매장 대신 등록</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">아직 유어딜에 없는 매장을 먼저 올리고, 사장님께 코드를 드려요.</p>
        </div>
        {!open && !done && (
          <button type="button" onClick={() => setOpen(true)} className="h-9 shrink-0 rounded-full bg-brand px-4 text-[13px] font-semibold text-white">등록하기</button>
        )}
      </div>

      {done && (
        <div className="mt-4 rounded-xl bg-brand-tint p-4">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">매장(#{done.sellerId})이 접수됐어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">유어딜이 확인한 뒤 승인돼요. 지금부터 [운영하기]로 상품을 준비할 수 있어요.</p>
          {done.claimCode && (
            <>
              <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-300">사장님께 이 링크를 보내 주세요 — 열면 사장님 코드가 채워져 소유권 신청이 돼요.</p>
              <div className="mt-2 flex gap-2">
                <input ref={codeRef} readOnly value={done.claimUrl || done.claimCode} onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl bg-white dark:bg-[#1D1F29] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none" />
                <button type="button" onClick={() => copy(done.claimUrl || done.claimCode || '')} className="h-10 shrink-0 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white">복사</button>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">사장님 코드 {done.claimCode}</p>
            </>
          )}
          <button type="button" onClick={() => { setDone(null); setOpen(true) }} className="mt-3 text-[13px] font-semibold text-brand-text">다른 매장 등록하기</button>
        </div>
      )}

      {open && !done && (
        <div className="mt-4 space-y-3">
          <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200">매장명
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="예: 유어딜 김밥 성수점" className={FIELD_CLS} />
          </label>
          <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200">주소 <span className="font-normal text-gray-400 dark:text-gray-500">(선택)</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="도로명 주소" className={FIELD_CLS} />
          </label>
          <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200">사장님 휴대폰
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="010-0000-0000" className={FIELD_CLS} />
          </label>
          <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200">사업자번호 <span className="font-normal text-gray-400 dark:text-gray-500">(선택 — 사장님 매장 것)</span>
            <input value={bno} onChange={(e) => setBno(e.target.value)} inputMode="numeric" placeholder="000-00-00000" className={FIELD_CLS} />
          </label>
          <label className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand" />
            <span>사장님을 대신해 판매자 이용약관에 동의합니다. <a href="/terms/seller" target="_blank" rel="noopener noreferrer" className="text-gray-500 dark:text-gray-400 underline">약관 보기</a></span>
          </label>
          {problem && <p className="text-[12px] text-gray-500 dark:text-gray-400">{problem}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-4 text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10">닫기</button>
            <button type="button" disabled={!!problem || busy} onClick={submit}
              className="h-10 flex-1 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white disabled:opacity-50">{busy ? '등록 중…' : '등록하기'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
