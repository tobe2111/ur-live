/**
 * 🏪 실계산 — 대표 승인 덱 03장.
 *
 * 🩸 이전 랜딩의 계산기는 **빼기만 하는 기계**였다: 정가 → 할인 → 수수료 → 입금.
 *   사장님이 보는 건 자기 돈이 줄어드는 장면뿐이고, 그 대가로 무엇을 얻는지는 화면에 없었다.
 *   그래서 ① 기본값을 라이브 실제 상품(id 2888)으로 앵커하고 ② 카드 수수료 0원을 **줄로 보여주고**
 *   ③ 옆에 "이 구조라서 손해를 볼 수 없다" 세 가지를 붙였다.
 *
 * ⚠️ 가격은 데모 시드가 아니라 실제 판매 중인 상품값이다(기획 §2-5).
 */
import { useMemo, useState } from 'react'
import { CreditCard, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { PARTNER_FACTS as F, FEE_DIRECT_RATE } from '@/shared/partners-facts'
import { formatNumber } from '@/utils/format'

const POINTS = [
  { icon: CreditCard, t: '결제가 먼저입니다', d: '이용권은 후기 약속이 아니라 이미 들어온 매출입니다.' },
  { icon: ShieldCheck, t: '노쇼 손실이 0입니다', d: '손님이 실제로 쓴 이용권만 정산 대상이 됩니다. 안 오면 수수료도 없습니다.' },
  { icon: SlidersHorizontal, t: '손해 보는 구조를 만들 수 없습니다', d: '할인율과 수량, 유효기간을 전부 사장님이 정합니다.' },
]

export default function PartnerMath() {
  const [list, setList] = useState<number>(F.sample.list)
  const [sale, setSale] = useState<number>(F.sample.sale)

  const calc = useMemo(() => {
    const l = Math.max(0, list || 0)
    const s = Math.min(l || Number.MAX_SAFE_INTEGER, Math.max(0, sale || 0))
    const fee = Math.round(s * FEE_DIRECT_RATE)
    return { fee, payout: s - fee, off: l > 0 ? Math.round((1 - s / l) * 100) : 0 }
  }, [list, sale])

  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:items-center">
        <div>
          <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28]">
            여기는 손님이 돈을 내고 옵니다
          </h2>
          <p className="mt-3 text-[14px] lg:text-[16px] text-gray-500 dark:text-gray-400">
            지금 유어딜에서 팔리고 있는 실제 상품으로 계산해 봤습니다. 숫자를 바꿔서 내 가게로 맞춰 보세요.
          </p>

          <div className="mt-8 rounded-2xl bg-warm p-5 lg:p-7">
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500">{F.sample.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="정가 (원)" value={list} onChange={setList} />
              <Field label="이용권 판매가 (원)" value={sale} onChange={setSale} />
            </div>
            <p className="mt-2 text-[11.5px] text-gray-400 dark:text-gray-500">
              할인율 {calc.off}%. 얼마나 깎을지는 사장님이 정합니다.
            </p>

            <dl className="mt-5 space-y-2.5">
              <Row k="손님이 내는 돈" v={`${formatNumber(Math.max(0, sale || 0))}원`} />
              <Row k={`유어딜 수수료 ${F.feeDirect}`} v={`−${formatNumber(calc.fee)}원`} />
              <Row k="카드 수수료" v="0원 (유어딜 부담)" accent />
              <div className="pt-3 border-t border-rule flex items-baseline justify-between">
                <dt className="text-[14px] font-extrabold text-ink">사장님 계좌에</dt>
                <dd className="text-[28px] lg:text-[34px] font-extrabold text-brand-text tabular-nums tracking-[-0.02em]">
                  {formatNumber(calc.payout)}원
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-3.5 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">
            가입비와 월 이용료, 선불 광고비, 정산 수수료가 모두 0원입니다. 중개(대행사)를 통해 들어오시면 수수료는 {F.feeBrokered}입니다.
          </p>
        </div>

        <ul className="space-y-7 lg:space-y-9 lg:pt-6">
          {POINTS.map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex gap-4">
              <span className="w-11 h-11 shrink-0 rounded-2xl bg-brand-tint flex items-center justify-center">
                <Icon className="w-[19px] h-[19px] text-brand-text" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] lg:text-[19px] font-extrabold text-ink tracking-[-0.01em]">{t}</p>
                <p className="mt-1.5 text-[13.5px] lg:text-[14.5px] leading-relaxed text-gray-500 dark:text-gray-400">{d}</p>
              </div>
            </li>
          ))}
          <li className="pt-1 text-[13.5px] lg:text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 border-t border-rule pt-7">
            몇 장이 팔렸고 몇 명이 왔는지, 언제 왔는지가 매장 화면에 그대로 남습니다.{' '}
            <b className="font-bold text-ink">효과가 있었는지를 감으로 판단할 필요가 없습니다.</b>
          </li>
        </ul>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-bold text-gray-500 dark:text-gray-400">{label}</span>
      <input type="number" inputMode="numeric" value={value} min={0} step={500}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full h-11 px-3 rounded-xl bg-surface text-[15px] font-bold text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-brand" />
    </label>
  )
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[13.5px]">
      <dt className="text-gray-600 dark:text-gray-300">{k}</dt>
      <dd className={`tabular-nums font-bold ${accent ? 'text-brand-text' : 'text-gray-900 dark:text-white'}`}>{v}</dd>
    </div>
  )
}
