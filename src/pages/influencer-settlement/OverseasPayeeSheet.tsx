/**
 * 🌍 해외 거주 받는 곳 시트 (2026-11-26) — 해외에 살면 국내 계좌·주민등록번호 대신 여기서 받는 곳을 등록한다.
 * 유어딜이 Wise·은행 해외송금으로 보낸다. 서버가 암호화해 저장하고 화면엔 가린 값만 돌려준다.
 * API `PUT/DELETE /api/influencer-settlement/overseas` (SSOT `worker/utils/overseas-payee.ts`).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import Sheet from '@/pages/user-profile/seller-section/Sheet'

const COUNTRIES: Array<[string, string]> = [
  ['US', '미국'], ['JP', '일본'], ['CN', '중국'], ['TW', '대만'], ['HK', '홍콩'], ['VN', '베트남'], ['TH', '태국'], ['PH', '필리핀'],
  ['ID', '인도네시아'], ['MY', '말레이시아'], ['SG', '싱가포르'], ['AU', '호주'], ['CA', '캐나다'], ['GB', '영국'], ['DE', '독일'], ['FR', '프랑스'],
]
const METHODS: Array<[Method, string]> = [['wise', 'Wise'], ['paypal', 'PayPal'], ['bank', '해외 은행']]
type Method = 'wise' | 'paypal' | 'bank'
export interface OverseasStatus { registered: boolean; country?: string; masked?: string; withholding_pct?: number }

const field = 'w-full h-12 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none'

export default function OverseasPayeeSheet({ status, onClose, onChanged }: { status: OverseasStatus | null; onClose: () => void; onChanged: (s: OverseasStatus) => void }) {
  const [country, setCountry] = useState(status?.country || 'US')
  const [nameEn, setNameEn] = useState('')
  const [method, setMethod] = useState<Method>('wise')
  const [currency, setCurrency] = useState('USD')
  const [email, setEmail] = useState('')
  const [account, setAccount] = useState('')
  const [swift, setSwift] = useState('')
  const [bankName, setBankName] = useState('')
  const [saving, setSaving] = useState(false)
  const ok = /^[A-Z]{2}$/.test(country) && nameEn.trim().length >= 2 && /^[A-Z]{3}$/.test(currency)
    && (method === 'bank' ? account.trim().length >= 6 && swift.trim().length >= 8 && bankName.trim().length >= 2 : email.includes('@'))

  const errOf = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error

  const save = async () => {
    if (!ok || saving) return
    setSaving(true)
    try {
      const destination = method === 'bank' ? { account, swift, bankName } : { email }
      const r = await api.put('/api/influencer-settlement/overseas', { country, legal_name_en: nameEn.trim(), method, currency, destination })
      if (!r.data?.success) { toast.error(r.data?.error || '저장하지 못했어요'); return }
      toast.success('저장했어요')
      onChanged({ ...r.data.data, withholding_pct: status?.withholding_pct })
      onClose()
    } catch (e) { toast.error(errOf(e) || '저장하지 못했어요. 잠시 후 다시 시도해 주세요') } finally { setSaving(false) }
  }

  const remove = async () => {
    if (saving) return
    setSaving(true)
    try {
      await api.delete('/api/influencer-settlement/overseas')
      toast.success('국내로 받기로 바꿨어요')
      onChanged({ registered: false, withholding_pct: status?.withholding_pct })
      onClose()
    } catch (e) { toast.error(errOf(e) || '처리하지 못했어요') } finally { setSaving(false) }
  }

  return (
    <Sheet
      title="해외에서 받기"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <button type="button" onClick={save} disabled={!ok || saving}
            className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold disabled:opacity-40 active:opacity-80">
            {saving ? '저장하는 중…' : '저장'}
          </button>
          {status?.registered && (
            <button type="button" onClick={remove} disabled={saving} className="w-full h-12 rounded-xl text-[15px] font-medium text-gray-600 dark:text-gray-300">
              한국에 살아요(국내로 받기)
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
          해외에 살면 여기서 받는 곳을 등록해 주세요. 매달 정산일에 유어딜이 해외송금으로 보내요.
          {typeof status?.withholding_pct === 'number' && ` 한국 세법에 따라 ${status.withholding_pct}%를 떼고 보낼 수 있어요.`} 암호화해서 보관해요.
        </p>
        <select value={COUNTRIES.some(([c]) => c === country) ? country : ''} onChange={(e) => setCountry(e.target.value)} aria-label="거주 나라" className={field}>
          {COUNTRIES.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          <option value="">다른 나라(코드 입력)</option>
        </select>
        {!COUNTRIES.some(([c]) => c === country) && (
          <input value={country} onChange={(e) => setCountry(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())} placeholder="나라 코드 2자리 (예: NZ)" aria-label="나라 코드" className={field} />
        )}
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="영문 이름 (여권과 같게)" aria-label="영문 이름" autoComplete="name" className={field} />
        <div className="flex gap-2" role="radiogroup" aria-label="받는 방법">
          {METHODS.map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
              className={`flex-1 h-12 rounded-xl text-[15px] font-medium ${method === m ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {method === 'bank' ? (
          <>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="은행 이름" aria-label="은행 이름" className={field} />
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="계좌번호 또는 IBAN" aria-label="계좌번호" autoComplete="off" className={field} />
            <input value={swift} onChange={(e) => setSwift(e.target.value.toUpperCase())} placeholder="SWIFT 코드 (8자리 또는 11자리)" aria-label="SWIFT 코드" autoComplete="off" className={field} />
          </>
        ) : (
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={`${method === 'wise' ? 'Wise' : 'PayPal'} 계정 이메일`} aria-label="이메일" autoComplete="email" className={field} />
        )}
        <input value={currency} onChange={(e) => setCurrency(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase())} placeholder="받을 통화 (예: USD)" aria-label="받을 통화" className={field} />
      </div>
    </Sheet>
  )
}
