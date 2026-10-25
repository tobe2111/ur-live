/**
 * 🛡️ 2026-05-16: 매장 소개 정산 페이지 (/influencer/settlement).
 *
 * 본인 잔액 + 사업자번호/계좌 등록 + 최근 attribution 내역.
 * 일반 user 로그인 필요 (referral 받은 사람 = 일반 user).
 *
 * 🧾 2026-10-13 (대표 *"인플루언서 정산이랑 페이지 UI 개선해야겠어 … 전체적으로 이상적이질 못해"*):
 *   종전 화면은 위에서부터 [이모지 타일 셋 · 앰버 순위 상자 · 노랑/파랑/초록 잔액 세 칸 · 입력칸 여섯 개 …]
 *   였다. 매번 보러 오는 것(얼마를 언제 받나)이 입력 폼 아래로 밀려 있었고, 제목엔 쓰지 않기로 한
 *   이름이 박혀 있었고, 뒤로 가는 길이 없었고, 문의는 `prompt()` 세 번이었다.
 *   ⇒ ① 맨 위 = 받을 돈 하나(28px) ② 정산 정보는 **요약 줄 → 시트**(처음 한 번 채우는 폼이다)
 *     ③ 나머지는 마이와 같은 목록 문법(`list-grammar`) ④ 문의는 시트. API·필드·저장 계약은 byte-불변.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { WalletIcon, MedalIcon, ChartIcon, BagIcon, MessageIcon, ReceiptIcon } from '@/components/icons/urdeal-icons'
import BrandLoader from '@/components/brand/BrandLoader'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { SectionTitle, ListPlate, ListRow } from './user-profile/list-grammar'
import SettleInfoSheet, { TAX_LABEL, type SettleForm } from './influencer-settlement/SettleInfoSheet'
import DisputeSheet from './influencer-settlement/DisputeSheet'
import ConditionalDealsSection from './influencer-settlement/ConditionalDealsSection'
import DealsAndCodesSection from './influencer-settlement/DealsAndCodesSection'
import PublicProfileSection from './influencer-settlement/PublicProfileSection'
import { formatKSTDate } from '@/utils/date'

interface Balance {
  pending_amount: number
  available_amount: number
  total_paid_out: number
  business_number: string | null
  tax_type: 'business_income' | 'other_income' | 'unreported' | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  payout_method: 'cash' | 'deal' | null
}

interface Attribution {
  id: number
  order_id: number
  product_id: number
  seller_id: number
  commission_amount: number
  status: 'pending' | 'available' | 'paid' | 'clawed_back'
  created_at: string
  available_at: string | null
  paid_at: string | null
}

/**
 * 🏅 이번 달 순위 — 목록의 한 줄로(종전엔 앰버 상자 + 트로피 이모지 둘). 값이 없으면 줄을 안 그린다.
 */
function useMyRank() {
  const [rank, setRank] = useState<{ national_rank: number | null; national_total_participants: number; my_commission: number } | null>(null)
  useEffect(() => {
    api.get('/api/influencer-settlement/my-rank')
      .then(r => { if (r.data?.success) setRank(r.data.data) })
      .catch(() => { /* 순위는 부가 정보 — 실패해도 화면은 그대로 */ })
  }, [])
  return rank
}

/**
 * 🔒 2026-09-16 — pending 라벨이 **보류 이유를 정확히** 말하게 한다.
 *
 * 종전엔 무조건 "환불기간 (대기)" 였다. 사용 확인 게이트가 켜지면 그 말이 거짓이 된다 —
 * 환불창은 진작 지났는데 **이용권이 아직 안 쓰여서** 묶여 있는 것이기 때문이다. 이유를
 * 틀리게 적으면 소개자는 고장으로 읽는다. 게이트 상태(`requires_voucher_use`)를 받아 고른다.
 */
const statusLabel = (status: string, useGate: boolean): { label: string; color: string } => ({
  pending: { label: useGate ? '사용 확인 대기' : '환불기간 (대기)', color: 'bg-tone-warn-bg text-tone-warn' },
  available: { label: '송금 대기', color: 'bg-tone-info-bg text-tone-info' },
  paid: { label: '송금 완료', color: 'bg-tone-ok-bg text-tone-ok' },
  clawed_back: { label: '회수됨 (환불)', color: 'bg-tone-bad-bg text-tone-bad' },
}[status] ?? { label: status, color: 'bg-tone-warn-bg text-tone-warn' })

const won = (n: number | null | undefined) => `${(n ?? 0).toLocaleString()}원`
const rowIco = (I: typeof WalletIcon) => <I className="w-[18px] h-[18px]" aria-hidden="true" />

export default function InfluencerSettlementPage() {
  const navigate = useNavigate()
  const rank = useMyRank()
  const [sheet, setSheet] = useState<null | 'info' | 'dispute'>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [recent, setRecent] = useState<Attribution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // 💡 2026-07-11 (flip D1 선반영): 재원 게이트 — /me 응답의 funding_source 가 'owner' 일 때만
  // "매장 promo 재원" 프레이밍. 미확인/로딩/platform(현행 기본)은 기존 문구 byte-동일.
  const [ownerFunded, setOwnerFunded] = useState(false)
  /** 사용 확인 게이트가 켜져 있는가 — 보류 문구를 고르는 데만 쓴다. */
  const [useGate, setUseGate] = useState(false)
  const [form, setForm] = useState<SettleForm>({
    business_number: '',
    tax_type: 'other_income',
    bank_name: '',
    bank_account: '',
    account_holder: '',
    payout_method: 'cash',
    ranking_public: true,
  })

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    api.get('/api/influencer-settlement/me')
      .then((r) => {
        if (r.data?.success) {
          const b = r.data.data.balance as Balance
          setBalance(b)
          setRecent(r.data.data.recent || [])
          setOwnerFunded(r.data.data.funding_source === 'owner')
          setUseGate(!!r.data.data.requires_voucher_use)
          setForm({
            business_number: b.business_number || '',
            tax_type: (b.tax_type as 'business_income' | 'other_income' | 'unreported') || 'other_income',
            bank_name: b.bank_name || '',
            bank_account: b.bank_account || '',
            account_holder: b.account_holder || '',
            payout_method: (b.payout_method as 'cash' | 'deal') || 'cash',
            ranking_public: (b as { ranking_public?: number }).ranking_public !== 0,
          })
        }
      })
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.put('/api/influencer-settlement/me', form)
      if (res.data?.success) {
        toast.success('저장했어요')
        setSheet(null)
        load()
      } else {
        toast.error(res.data?.error || '저장 실패')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  if (loading) return <BrandLoader fullScreen />  // 🎯 2026-07-18 로딩 단일화

  const back = () => { if (window.history.length > 1) navigate(-1); else navigate('/u/me/manage') }
  const acct = balance?.bank_account ? `${balance.bank_name || ''} ··${balance.bank_account.replace(/\D/g, '').slice(-4)}`.trim() : ''
  const payoutHint = balance?.payout_method === 'deal' ? '딜 +20%' : '현금'

  return (
    <div className="min-h-[100dvh] bg-warm pb-20">
      <SEO title="매장 소개 정산 - 유어딜" description={ownerFunded ? '매장 몫에서 지급되는 소개 수익의 잔액·송금 내역·세금 정보 관리' : '소개 수익 잔액·송금 내역·세금 정보 관리'} url="/influencer/settlement" />
      <header className="sticky top-0 z-30 bg-warm border-b border-rule px-2 h-12 flex items-center">
        <button type="button" onClick={back} aria-label="뒤로" className="w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 active:opacity-60">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[15px] font-medium text-gray-900 dark:text-white">매장 소개 정산</h1>
      </header>

      <main className="ur-content-narrow mx-auto px-4 pt-4">
        {/* 받을 돈 — 이 화면의 주인공은 숫자 하나다(규칙 ③). 나머지 둘은 그 아래 한 줄. */}
        <section className="rounded-2xl bg-surface shadow-lift p-5">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">송금 대기</p>
          <p className="mt-1 text-[28px] font-bold tracking-[-0.02em] tabular-nums text-gray-900 dark:text-white">{won(balance?.available_amount)}</p>
          <div className="mt-4 pt-4 border-t border-rule grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">{useGate ? '사용 확인 대기' : '환불기간 대기'}</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{won(balance?.pending_amount)}</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">누적 송금</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{won(balance?.total_paid_out)}</p>
            </div>
          </div>
          {ownerFunded && (
            <p className="mt-4 text-[12px] text-gray-500 dark:text-gray-400">소개 수익은 각 매장이 자기 몫에서 지급해요. 유어딜 수수료와는 별개예요.</p>
          )}
        </section>

        {/* 정산 정보 — 처음 한 번 채우는 폼이라 요약 줄만 두고, 고칠 때 시트로 연다. */}
        <div className="mt-8"><SectionTitle>받는 곳</SectionTitle></div>
        <ListPlate className="mt-3">
          <ListRow icon={rowIco(WalletIcon)} label="받는 방법" hint={payoutHint} onClick={() => setSheet('info')} testId="settle-info-open" />
          <ListRow icon={rowIco(ReceiptIcon)} label="계좌" hint={acct || '등록 필요'} onClick={() => setSheet('info')} />
          <ListRow icon={rowIco(ReceiptIcon)} label="세금" hint={TAX_LABEL[balance?.tax_type ?? 'other_income'] ?? '기타소득 8.8%'} onClick={() => setSheet('info')} />
        </ListPlate>

        {/* 협업 코드 입력 · 매장별 링크 · 성과 · 제안 수락 — 일거리는 여기서 받는다 */}
        <div className="mt-8 space-y-3"><DealsAndCodesSection ownerFunded={ownerFunded} /></div>
        <ConditionalDealsSection />

        <div className="mt-8"><SectionTitle>최근 소개 수익</SectionTitle></div>
        <ListPlate className="mt-3">
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">아직 소개 수익이 없어요</p>
          ) : recent.map(r => {
            const st = statusLabel(r.status, useGate)
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 min-h-[56px] py-2 border-b border-rule last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{won(r.commission_amount)}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">{formatKSTDate(r.created_at)} · 상품 {r.product_id}</p>
                </div>
                <span className={`shrink-0 text-[12px] px-2 py-1 rounded-md font-medium ${st.color}`}>{st.label}</span>
              </div>
            )
          })}
        </ListPlate>

        <div className="mt-8"><SectionTitle>더 보기</SectionTitle></div>
        <ListPlate className="mt-3">
          <ListRow icon={rowIco(MedalIcon)} label="이번 달 순위" hint={rank?.national_rank ? `전국 ${rank.national_rank}위` : '집계 전'} to="/influencer/rankings" />
          <ListRow icon={rowIco(ChartIcon)} label="성과표" to="/influencer/analytics" />
          <ListRow icon={rowIco(BagIcon)} label="소개할 매장 찾기" to="/influencer/discover" />
          <ListRow icon={rowIco(MessageIcon)} label="정산 문의" hint="금액·매장 문제" onClick={() => setSheet('dispute')} />
        </ListPlate>

        {/* 공개 프로필 — 매장이 소개자를 고를 때 보는 카드 */}
        <div className="mt-8"><PublicProfileSection /></div>
      </main>

      {sheet === 'info' && (
        <SettleInfoSheet form={form} setForm={setForm} ownerFunded={ownerFunded} saving={saving} onSave={save} onClose={() => setSheet(null)} />
      )}
      {sheet === 'dispute' && <DisputeSheet onClose={() => setSheet(null)} />}
    </div>
  )
}
