/**
 * 🧾 정산 정보 시트 — 받는 방법 · 세금 · 계좌 · 랭킹 공개 (2026-10-13 대표 *"인플루언서 정산이랑 페이지 UI 개선해야겠어"*).
 *
 * 왜 시트인가: 이 폼은 **처음 한 번** 채우고 거의 안 고친다. 그런데 화면 한가운데 입력칸 여섯 개가
 * 늘 펼쳐져 있어서, 정작 매번 보러 오는 것(얼마 받나 · 언제 받나)이 그 아래로 밀려 있었다.
 * 화면엔 요약 줄만 두고, 고칠 때만 아래에서 올라온다(마이 프로필 편집과 같은 손짓).
 *
 * 저장 계약은 종전 그대로다 — `PUT /api/influencer-settlement/me`, 같은 필드.
 */
import Sheet from '@/pages/user-profile/seller-section/Sheet'

export type PayoutMethod = 'cash' | 'deal'
export type TaxType = 'business_income' | 'other_income' | 'unreported'
export interface SettleForm {
  business_number: string
  tax_type: TaxType
  bank_name: string
  bank_account: string
  account_holder: string
  payout_method: PayoutMethod
  ranking_public: boolean
}

export const TAX_LABEL: Record<TaxType, string> = {
  business_income: '사업소득 3.3%',
  other_income: '기타소득 8.8%',
  unreported: '원천징수 안 함',
}

const BANKS = ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', '케이뱅크', '카카오뱅크', '토스뱅크', '새마을금고', '신협', '우체국']
const labelCls = 'block text-[13px] font-medium text-gray-700 dark:text-gray-200 mb-1'
const inputCls = 'w-full h-12 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand/40'

export default function SettleInfoSheet({ form, setForm, ownerFunded, saving, onSave, onClose }: {
  form: SettleForm
  setForm: (f: (prev: SettleForm) => SettleForm) => void
  ownerFunded: boolean
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const choice = (on: boolean) =>
    `p-3 rounded-xl text-left transition-colors ${on ? 'bg-brand-tint ring-2 ring-brand' : 'bg-gray-100 dark:bg-white/[0.06]'}`
  return (
    <Sheet
      title="정산 정보"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold disabled:opacity-50 active:opacity-80"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      }
    >
      <div className="space-y-6 pb-2">
        <div>
          <p className={labelCls}>받는 방법</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm(f => ({ ...f, payout_method: 'cash' }))} className={choice(form.payout_method === 'cash')}>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">현금</p>
              {/* 💎 2026-08-31 대표: 최소 금액은 현금에만 적용된다 — 고르는 자리에 그 차이를 적는다. */}
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">원천징수 후 계좌 입금 · 10만원 이상부터</p>
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, payout_method: 'deal' }))} className={choice(form.payout_method === 'deal')}>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">딜 <span className="text-brand-text">+20%</span></p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{ownerFunded ? '매장 몫에서 지급, 유어딜 결제에 사용' : '유어딜 결제에 사용, 환불 불가'}</p>
              <p className="text-[12px] font-medium text-brand-text mt-1">금액 제한 없음</p>
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="settle-tax">세금</label>
          <select id="settle-tax" value={form.tax_type} onChange={(e) => setForm(f => ({ ...f, tax_type: e.target.value as TaxType }))} className={inputCls}>
            <option value="other_income">기타소득 8.8% (사업자 없어도 됨)</option>
            <option value="business_income">사업소득 3.3% (사업자번호 필요)</option>
            <option value="unreported">원천징수 안 함 (본인 신고)</option>
          </select>
          {form.tax_type === 'business_income' && (
            <input
              value={form.business_number}
              onChange={(e) => setForm(f => ({ ...f, business_number: e.target.value.replace(/[^\d-]/g, '') }))}
              placeholder="사업자번호 000-00-00000"
              inputMode="numeric"
              className={`${inputCls} mt-2 tabular-nums`}
            />
          )}
        </div>

        <div className="space-y-2">
          <p className={labelCls}>받을 계좌</p>
          <select value={form.bank_name} onChange={(e) => setForm(f => ({ ...f, bank_name: e.target.value }))} className={inputCls} aria-label="은행">
            <option value="">은행 선택</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input
            value={form.bank_account}
            onChange={(e) => setForm(f => ({ ...f, bank_account: e.target.value.replace(/[^\d-]/g, '') }))}
            placeholder="계좌번호"
            inputMode="numeric"
            aria-label="계좌번호"
            className={`${inputCls} tabular-nums`}
          />
          <input
            value={form.account_holder}
            onChange={(e) => setForm(f => ({ ...f, account_holder: e.target.value }))}
            placeholder="예금주"
            aria-label="예금주"
            className={inputCls}
          />
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-gray-900 dark:text-white">랭킹에 이름 공개</span>
            <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-1">끄면 랭킹에 익명으로 나와요</span>
          </span>
          <input
            type="checkbox"
            checked={form.ranking_public}
            onChange={() => setForm(f => ({ ...f, ranking_public: !f.ranking_public }))}
            className="w-5 h-5 accent-brand shrink-0"
          />
        </label>
      </div>
    </Sheet>
  )
}
