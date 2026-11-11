/**
 * ⑦ 정산 계좌 — 2026-11-03 대표 확정 시안(*"응 모두 해줘"*). `/store/bank`
 *
 * 대시보드 사업자 정보 폼의 **둘째 절반**(은행 · 계좌번호 · 예금주)만. 저장은 종전과 같은 `PUT /api/seller/profile`
 * (서버가 계좌를 가려서 돌려준다 — 그래서 이미 등록된 계좌는 가린 값으로만 보여 주고, 칸을 미리 채우지 않는다).
 * 안내 문구의 정산일(매주 목요일 · 지난주 사용분)은 정산 가이드 SSOT(`guide-seed-settlement.ts`)와 같은 사실이다.
 * 💰 돈이 나가는 규칙은 하나도 안 바꾼다 — 계좌를 적는 화면만 옮겼다.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { toast } from '@/hooks/useToast'
import { MY_PATH } from '@/lib/seller-return'
import StoreStepShell from './StoreStepShell'
import { currentSeatId } from '@/lib/seller-seat'

/**
 * 🔑 2026-11-10 대표 신고(화면: *"계좌 변경은 PIN 인증이 필요합니다"* 토스트에서 멈춤) — 서버는 계좌를 넣을 때
 * 15분 안의 PIN 확인을 요구한다(`seller-profile.routes` 412 `PIN_REQUIRED`, 계좌 탈취 방어). 마이의 `BankSheet` 는
 * 2026-09-26 에 그 자리에서 PIN 을 걸게 고쳤는데 이 등록 2단계 화면은 같은 저장을 부르면서 그 분기가 없어
 * **막다른 길**이었다. 같은 `PinSheet`(없으면 걸고 → 확인)를 열고, 끝나면 **저장을 다시 한다.**
 */
const PinSheet = lazy(() => import('@/pages/user-profile/seller-section/PinSheet'))

/** 자주 쓰는 여덟 개는 바로 누르고, 나머지는 펼친다. 이름은 대시보드 은행 목록(`BankInfoSection`)과 같은 표기. */
export const POPULAR_BANKS = ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', '카카오뱅크', '토스뱅크'] as const
export const OTHER_BANKS = ['SC제일은행', '한국씨티은행', '케이뱅크', '새마을금고', '신협', '우체국', '부산은행', '경남은행', '대구은행', '광주은행', '전북은행', '제주은행', '수협은행', '산업은행'] as const
const shortName = (b: string) => b.replace(/은행$/, '').replace(/^NH농협$/, 'NH농협').replace(/^IBK기업$/, 'IBK기업')

export default function StoreBankPage() {
  const navigate = useNavigate()
  const [bank, setBank] = useState('')
  const [more, setMore] = useState(false)
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pinFor, setPinFor] = useState<number | null>(null)
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  useEffect(() => {
    api.get('/api/seller/profile', { headers })
      .then((r) => {
        const d = r.data?.data || r.data?.seller || {}
        if (d.bank_name && d.bank_account) setSaved(`${d.bank_name} ${d.bank_account}`)
        if (d.account_holder) setHolder(String(d.account_holder))
      })
      .catch(() => { /* 빈 칸으로 시작 */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const digits = account.replace(/[^\d-]/g, '')
  const reason = !bank ? '은행을 골라 주세요' : digits.replace(/-/g, '').length < 8 ? '계좌번호를 적어 주세요' : !holder.trim() ? '예금주를 적어 주세요' : null

  async function submit() {
    if (reason || submitting) return
    setSubmitting(true)
    try {
      const r = await api.put('/api/seller/profile', { bank_name: bank, bank_account: digits, account_holder: holder.trim() }, { headers })
      if (!r.data?.success) throw new Error(r.data?.error)
      try { localStorage.setItem('seller_bank_name', bank); localStorage.setItem('seller_account_holder', holder.trim()) } catch { /* 정산 화면 표시용 캐시일 뿐 */ }
      toast.success('계좌를 저장했어요 — 판매 준비가 끝났어요')
      navigate(MY_PATH, { replace: true })
    } catch (e: any) {
      const res = e?.response?.data as { error?: string; code?: string } | undefined
      const seat = currentSeatId()
      if (res?.code === 'PIN_REQUIRED' && seat) {
        toast.info('정산 계좌는 돈이 들어가는 곳이라 PIN(숫자 비밀번호)으로 한 번 확인해요')
        setPinFor(seat)
        return
      }
      toast.error(res?.error || '계좌를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요')
    } finally { setSubmitting(false) }
  }

  const chip = (b: string) => (
    <button key={b} type="button" onClick={() => setBank(b)} aria-pressed={bank === b}
      className={`h-12 rounded-xl border-[1.5px] text-[13px] font-medium ${bank === b ? 'border-brand bg-brand-tint text-brand-text' : 'border-line'}`}>{shortName(b)}</button>
  )

  return (
    <StoreStepShell step={2} seoTitle="정산 계좌" title="정산 받을 계좌를 알려 주세요" lead="매주 목요일, 지난주에 손님이 사용한 이용권 금액이 들어와요."
      footer={<>
        <button type="button" onClick={() => void submit()} disabled={!!reason || submitting}
          className={`ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40${submitting ? ' ur-busy-ring !opacity-100' : ''}`}>
          {submitting ? '저장하는 중…' : '저장하고 끝내기'}
        </button>
        {reason && <p className="mt-2 text-center text-[12px] text-ink-soft">{reason}</p>}
      </>}>
      {saved && <p className="mt-5 rounded-xl bg-wash px-4 py-3 text-[13px] text-ink-soft">지금 등록된 계좌: <b className="font-medium text-gray-900 dark:text-white">{saved}</b> · 바꾸려면 새로 적어 주세요</p>}
      <p className="mt-5 mb-2 text-[13px] text-ink-soft">은행</p>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="은행">
        {POPULAR_BANKS.map(chip)}
        {more && OTHER_BANKS.map(chip)}
      </div>
      {!more && <button type="button" onClick={() => setMore(true)} className="mt-2 text-[13px] text-ink-soft underline">다른 은행 고르기</button>}

      <label className="mt-5 block">
        <span className="block mb-2 text-[13px] text-ink-soft">계좌번호</span>
        <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" placeholder="숫자만 적어도 돼요" maxLength={30}
          className="w-full h-[52px] px-4 rounded-xl border-[1.5px] border-line bg-transparent text-[16px] tracking-wide text-gray-900 dark:text-white placeholder:text-ink-faint focus:border-brand focus:outline-none" />
      </label>
      <label className="mt-5 block">
        <span className="block mb-2 text-[13px] text-ink-soft">예금주</span>
        <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="통장에 적힌 이름" maxLength={40}
          className="w-full h-[52px] px-4 rounded-xl border-[1.5px] border-line bg-transparent text-[16px] text-gray-900 dark:text-white placeholder:text-ink-faint focus:border-brand focus:outline-none" />
      </label>
      {pinFor != null && (
        <Suspense fallback={null}>
          <PinSheet sellerId={pinFor} onClose={() => setPinFor(null)} onDone={() => { setPinFor(null); void submit() }} />
        </Suspense>
      )}
    </StoreStepShell>
  )
}
