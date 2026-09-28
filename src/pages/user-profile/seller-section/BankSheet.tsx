/**
 * 🏦 정산 계좌 — 마이 안에서 등록·변경 (2026-09-26, 설계 §20-5)
 *   대표: *"모두 마이에서 하도록"*
 *
 * ## 왜 출금 시트가 이걸 부르나
 * 계좌가 없으면 출금 신청 자체를 막는다(§19-3 — 안 보내면 **송금할 계좌가 없는 지급 행**이 생긴다).
 * 그런데 종전엔 막고서 셀러 대시보드로 보냈다. 여기서 넣으면 출금 시트로 그대로 돌아온다.
 *
 * ## 🔴 대시보드 폼을 재사용하지 않는 이유
 * `BankInfoSection` 은 `DashboardCard` 기반 **라이트 고정** 부품이고 `dark:` 가 금지돼 있다
 * (CLAUDE.md 테마 규칙). 마이는 다크를 지원하므로 같은 컴포넌트를 두 표면에 쓸 수 없다.
 * ⚠️ 그래서 **마크업만** 새로 쓴다 — 저장 경로(`PUT /api/seller/profile`)와 은행 목록은 같다.
 *
 * ## 🔴 계좌 변경은 PIN 을 요구한다 (2026-09-26 수리)
 * `PUT /api/seller/profile` 은 계좌 필드가 섞여 있으면 **412 `PIN_REQUIRED`** 를 준다
 * (`seller-profile.routes` — 계좌 탈취 방어). 처음 만들 때 이 분기를 빠뜨려서, 계좌가 없어
 * 출금이 막힌 사장님이 여기 와서 계좌를 넣어도 *"계좌 변경은 PIN 인증이 필요합니다"* 라는
 * 문장만 보고 **막다른 길**에 섰다 — 대시보드로 나가지 않으면 풀 방법이 없었다.
 * 지금은 그 자리에서 `PinSheet` 를 열고, 확인이 끝나면 **이 시트로 돌아온다.**
 * ⚠️ 위임 운영자는 **403** 이다(정산 목적지는 소유자만 바꾼다 — 2026-09-04 대표 확정).
 *   그건 PIN 으로 못 푸는 벽이라 서버 문장을 그대로 보여 주고 멈춘다.
 *
 * ## localStorage 동기화는 하지 않는다
 * 대시보드 폼은 저장 후 `seller_bank_name` 등을 localStorage 에 적는다. 여기서는 **안 적는다** —
 * 그 키들은 **좌석을 안 따라가고**(§19-3), 마이는 가게를 옮길 수 있다. 출금 시트는 계좌를
 * 좌석 인증된 `GET /api/seller/profile` 에서 다시 읽으므로 그 값이 필요 없다.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

/** 대시보드 폼과 같은 목록 — 한쪽에만 은행이 늘면 사장님이 자기 은행을 못 찾는다. */
const BANKS = ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', 'SC제일은행', '한국씨티은행', '케이뱅크', '카카오뱅크', '토스뱅크', '새마을금고', '신협', '우체국', '부산은행', '경남은행', '대구은행', '광주은행', '전북은행', '제주은행', '수협은행', '산업은행']

export default function BankSheet({ sellerId, onClose, onDone, onFixPin }: {
  sellerId: number
  onClose: () => void
  onDone?: () => void
  /** 412 `PIN_REQUIRED` — 그 자리에서 풀게 한다(풀면 이 시트로 돌아온다). */
  onFixPin?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [bank, setBank] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/profile'))
      .then((r) => {
        if (!alive) return
        if (!r.data?.success) { setFailed(true); return }
        const d = r.data.data as { bank_name?: string | null; bank_account?: string | null; account_holder?: string | null; name?: string | null }
        setBank(d?.bank_name || '')
        setAccount(d?.bank_account || '')
        // 예금주가 비어 있으면 매장 이름으로 시작한다 — 대부분 같고, 다르면 고치면 된다.
        setHolder(d?.account_holder || d?.name || '')
        setLoaded(true)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  const canSend = !!bank && account.trim().length >= 6 && holder.trim().length > 0 && !busy

  async function save() {
    if (!canSend) return
    try {
      assertSeat(sellerId)
    } catch (e) {
      if (e instanceof SeatMismatchError) { toast.error('가게가 바뀌었어요. 다시 열어 주세요'); onClose(); return }
      throw e
    }
    setBusy(true)
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.put('/api/seller/profile', {
        bank_name: bank,
        bank_account: account.trim(),
        account_holder: holder.trim(),
      })
      if (!r.data?.success) { toast.error(r.data?.error || '계좌를 저장하지 못했습니다'); return }
      toast.success('정산 계좌를 저장했어요')
      onDone?.()
      onClose()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
      // 🔑 PIN 이 필요하면 **여기서** 푼다 — 돈이 들어올 계좌를 넣다 말고 대시보드로 보내지 않는다.
      if (res?.code === 'PIN_REQUIRED' && onFixPin) {
        toast.error('계좌를 바꾸려면 PIN 확인이 필요해요')
        onFixPin()
        return
      }
      toast.error(res?.error || '계좌를 저장하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <Sheet
      title="정산 계좌"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!canSend}
          onClick={save}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          저장
        </button>
      }
    >
      {!loaded && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {loaded && (
        <div className="px-4 py-4 space-y-3">
          <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            출금한 돈이 들어갈 계좌예요. <span className="text-gray-900 dark:text-white font-semibold">사업자 본인 명의</span> 계좌만 쓸 수 있어요.
          </p>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">은행</span>
            <select value={bank} onChange={(e) => setBank(e.target.value)} className={field}>
              <option value="">은행을 골라 주세요</option>
              {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">계좌번호</span>
            <input
              inputMode="numeric"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="000-0000-0000"
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">예금주</span>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="통장에 적힌 이름 그대로"
              className={field}
            />
          </label>
          <p className="text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400 pt-1">
            계좌를 바꾸면 안전을 위해 관리자 확인을 한 번 거쳐요. 그동안은 출금이 잠깐 멈춰요.
          </p>
        </div>
      )}
    </Sheet>
  )
}
