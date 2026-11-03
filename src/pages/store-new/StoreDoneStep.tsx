/**
 * ③ 등록 완료 — 2026-11-03 대표 확정(*"코레일 이용권 같은 디자인은 변경"* → 유달이 하이파이브).
 *
 * 축하로 끝내지 않고 **판매를 시작하려면 남은 일**을 보여 준다. 셋 다 실제로 있는 길이다:
 *  ① 첫 이용권(`/store/first-voucher`) ② 사업자등록증 ③ 정산 계좌 — ②③ 은 같은 사업자 정보 화면이 맡는다.
 * 사업자등록증은 종전처럼 **선택**이고, 승인되면 메인에 노출된다는 사실도 종전 문구 그대로다.
 * 🎬 유달이가 하이파이브하며 올라오고(`Udal motion`), 할 일 줄이 차례로 올라온다(`ur-rise`).
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Udal from '@/components/mascot/Udal'

interface Props {
  storeName: string
  agencyName: string | null
  onFirstVoucher: () => void
  onLater: () => void
}

const BIZ_INFO = '/seller/business-info?from=my'

export default function StoreDoneStep({ storeName, agencyName, onFirstVoucher, onLater }: Props) {
  const todos = [
    { n: 1, title: '첫 이용권 올리기', desc: agencyName ? `직접 올리거나 ${agencyName}에 맡겨도 돼요` : '이름과 가격만 정하면 돼요', first: true },
    { n: 2, title: '사업자등록증 올리기', desc: '승인되면 메인에 노출돼요', to: BIZ_INFO },
    { n: 3, title: '정산 받을 계좌 등록', desc: '판매 금액이 들어갈 곳이에요', to: BIZ_INFO },
  ]
  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="store-new-done">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
        <div className="flex flex-col items-center text-center pt-2">
          <Udal mood="yay" size={120} motion priority />
          <p className="mt-5 text-[13px] font-medium text-brand-text">{storeName}</p>
          <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] leading-snug text-gray-900 dark:text-white">가게 등록이 끝났어요</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            {agencyName
              ? <>이제 <b className="font-medium text-gray-900 dark:text-white">{agencyName}</b> 에이전시가<br />이 가게의 이용권 판매를 도와요.</>
              : <>승인을 확인하는 동안<br />첫 이용권을 미리 올려 둘 수 있어요.</>}
          </p>
        </div>

        <p className="mt-8 text-[15px] font-medium text-gray-900 dark:text-white">판매를 시작하려면</p>
        <ul className="mt-1">
          {todos.map((t, i) => {
            const inner = (
              <>
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-medium ${t.first ? 'bg-brand text-white' : 'bg-brand-tint text-brand-text'}`}>{t.n}</span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[15px] font-medium text-gray-900 dark:text-white">{t.title}</span>
                  <span className="block mt-1 text-[13px] text-ink-soft">{t.desc}</span>
                </span>
                {t.first ? <span className="text-[13px] font-medium text-brand-text">지금</span> : <ChevronRight size={18} strokeWidth={1.6} className="text-ink-soft" aria-hidden="true" />}
              </>
            )
            const cls = `w-full flex items-center gap-3 py-4 ${i < todos.length - 1 ? 'border-b border-rule' : ''}`
            return (
              <li key={t.n} className="ur-rise" style={{ animationDelay: `${200 + i * 90}ms` }}>
                {t.first ? <button type="button" onClick={onFirstVoucher} className={cls}>{inner}</button> : <Link to={t.to!} className={cls}>{inner}</Link>}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="shrink-0 pt-3 flex flex-col gap-1">
        <button type="button" onClick={onFirstVoucher} className="ur-btn ur-btn-lg ur-btn-primary w-full">첫 이용권 올리기</button>
        <button type="button" onClick={onLater} className="h-11 text-[15px] text-ink-soft">나중에 할게요 · 마이로</button>
      </div>
    </div>
  )
}
