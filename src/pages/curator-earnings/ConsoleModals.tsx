/**
 * 🎤 소개 콘솔의 **모달 두 벌** — `CuratorEarningsPage` 에서 **그대로 옮긴 것**(마크업·로직 불변).
 *
 * 🧱 왜 나눴나: 2026-09-29 디자인 정리(대표 *"소개콘솔도 일단 변경은 해줘"*) 로 본문이 커지는데
 *    페이지가 596줄로 `check-file-size` 상한(600)에 4줄 남아 있었다. CLAUDE.md 가 요구하는 대로
 *    **rebaseline 이 아니라 분리**로 줄인다. 자를 자리로 이 둘을 고른 이유는 **자기완결**이라서다 —
 *    부모와 상태를 공유하지 않고 `onClose`/`onSuccess` 콜백만 받는다.
 *
 * ⚠️ 이 파일은 **이동만** 했다. 디자인 정리(이모지·테두리·색깔 상자)는 페이지 본문에만 적용했고
 *    모달 폼은 대표 시안에 없던 자리라 손대지 않았다 — 옮기면서 동시에 고치면 무엇 때문에
 *    깨졌는지 못 가린다.
 */
import { useState } from 'react'
import { curatorApi } from '@/features/curator/api/curator-api'
import { formatWon } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import type { WithdrawalInfo } from '../CuratorEarningsPage'

export function ProxyProductModal({ merchant, onClose }: { merchant: { id: number; name: string }; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category: '', image_url: '' })
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    if (!form.name.trim() || !form.price) { toast.error('상품명/가격을 입력하세요'); return }
    setSubmitting(true)
    try {
      const r = await curatorApi.createProxyProduct({
        merchant_seller_id: merchant.id,
        name: form.name.trim(),
        description: form.description || undefined,
        price: Number(form.price),
        stock: form.stock ? Number(form.stock) : undefined,
        category: form.category || undefined,
        image_url: form.image_url || undefined,
      })
      if (r.success) { toast.success(r.message || '대행 등록 완료'); onClose() }
      else toast.error(r.error || '등록 실패')
    } catch {
      toast.error('등록 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">공구 대행 등록</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">{merchant.name} — 등록 후 매장 승인 시 공개됩니다.</p>
        <div className="space-y-2">
          {([
            ['name', '상품명'],
            ['price', '가격 (원)'],
            ['stock', '재고 (선택)'],
            ['category', '카테고리 (선택)'],
            ['image_url', '대표 이미지 URL (선택)'],
          ] as const).map(([k, label]) => (
            <input
              key={k}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              placeholder={label}
              className="w-full px-3 py-2 text-[15px] rounded-lg border border-rule-strong bg-surface text-gray-900 dark:text-white"
            />
          ))}
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-3 py-2 text-[15px] rounded-lg border border-rule-strong bg-surface text-gray-900 dark:text-white"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={submit} disabled={submitting} className="flex-1 py-2 bg-brand text-white text-[15px] font-bold rounded-lg disabled:opacity-50">
              {submitting ? '등록 중…' : '대행 등록'}
            </button>
            <button onClick={onClose} className="px-3 py-2 text-gray-500 dark:text-gray-400 text-[15px]">취소</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 🏁 2026-06-17 — "사업자 등록 → 사업자 유저" 단일 진입 (사용자 명칭 확정: 유저 / 사업자 유저).
 *   일원화: 과거 BusinessSection(현금정산용 사업자등록)과 본 카드(판매 매장등록)가 분리돼 "사업자
 *   등록"이 2군데였고, 현금 출금 게이트(curator.routes:861)가 이미 '연결 승인 매장'을 요구해
 *   BusinessSection-only 등록은 현금정산이 안 되는 오해유발 UI였음 → BusinessSection 은퇴, 본 카드로 통합.
 *   유저 → [사업자 등록 1번 = 판매 승인] → 사업자 유저 (판매 + 추천수익 현금정산 동시).
 *   기존 검증된 매장 등록(/seller/register/supplier → register-from-user store_owner) + 어드민 승인
 *   재활용. 승인되면 /u/{handle} 가 셀러 상점 + 추천 핀(CuratorPinsSection) 통합 페이지가 됨.
 */

export function WithdrawModal({ info, onClose, onSuccess }: { info: WithdrawalInfo; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(info.available)
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const withholding = Math.floor(amount * info.withholding_rate)
  const netAmount = amount - withholding

  async function submit() {
    if (amount < info.min_withdrawal) {
      toast.error(`최소 ${info.min_withdrawal.toLocaleString()}원 부터 출금 가능`)
      return
    }
    if (!bankName || !bankAccount || !accountHolder) {
      toast.error('은행 / 계좌 / 예금주를 모두 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await curatorApi.requestWithdrawal({ amount, bank_name: bankName, bank_account: bankAccount, account_holder: accountHolder })
      if (res.success) {
        toast.success(`출금 신청 완료 — 실 입금 ${res.withdrawal?.net_amount.toLocaleString()}원`)
        onSuccess()
      } else {
        toast.error(res.error || '출금 신청 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '출금 신청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">💰 출금 신청</h2>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1">금액 (최대 {formatWon(info.available)})</label>
            <input
              type="number"
              min={info.min_withdrawal}
              max={info.available}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.min(info.available, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 text-[15px] bg-warm border border-line text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1">은행</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="예: 카카오뱅크"
              className="w-full px-3 py-2 text-[15px] bg-warm border border-line text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1">계좌번호</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="3333-01-1234567"
              className="w-full px-3 py-2 text-[15px] bg-warm border border-line text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1">예금주</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full px-3 py-2 text-[15px] bg-warm border border-line text-gray-900 dark:text-white rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 bg-warm rounded-lg p-3 text-[12px] space-y-1">
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>신청 금액</span><span>{formatWon(amount)}</span></div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>원천징수 ({(info.withholding_rate * 100).toFixed(1)}%)</span><span>-{formatWon(withholding)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-line"><span>실 입금</span><span>{formatWon(netAmount)}</span></div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-wash text-gray-700 dark:text-gray-300 font-bold rounded-lg">취소</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold rounded-lg">
            {submitting ? '신청 중...' : '신청'}
          </button>
        </div>
      </div>
    </div>
  )
}
