/**
 * 🏪 시작하는 세 가지 길 — 대표 승인 덱 14장.
 *
 * 🩸 이전 랜딩에는 길이 **하나뿐**이었다("셀러 가입하기"). 그런데 이 서비스의 대상은
 *   폰으로 가게를 등록해 본 적 없는 사장님도 포함한다. 길이 하나면 그분들은 그냥 닫는다.
 *   덱은 그래서 세 길을 나란히 둔다 — 직접 / 유어딜이 대신 / 대행사와 함께.
 *
 * ■ 2026-09-16 3차 (대표 *"AI 가 만든 디자인, 말투가 아니면"*)
 *   3열 균등 카드 셋이 이 페이지에서 세 번째 같은 그림이었다. 여기는 **진짜 3지 선택**이라
 *   세 칸 자체는 맞지만, 셋을 똑같이 세우면 사장님이 무엇을 고를지 알 수 없다.
 *   ⇒ **'직접' 을 넓게**(비대칭) 두고 나머지 둘을 좁힌다. 제목도 짧게: "시작하는 길, 세 가지".
 *
 * ⚠️ 문구는 덱과 같은 문장을 쓴다. 수수료는 길마다 다르다(직접·대신 10%, 중개 5%).
 * 🔴 **"자동 승인" 이라고 쓰면 안 된다.** `seller-registration.routes.ts:239` 주석이
 *   *"2026-06-12 사용자 결정 — 자동승인 말고 수동 승인 · 모든 사업자 가입은 어드민 수동 승인"* 이고,
 *   국세청 진위확인 결과는 승인 화면의 **참고 신호로만** 저장된다. 자동인 것은 **진위확인**뿐이다.
 *   그래서 세 길 아래에 그 한 단계를 숨기지 않고 적는다 — 첫 화면에서 안 적으면 사장님이
 *   가입 직후에 발견하고, 그때는 거짓말이 된다.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PartnerPhone, { SHOT } from './PartnerPhone'

/** 세 길의 CTA 는 내부 라우트(Link) 또는 외부 카카오 채널(a) 둘 중 하나다. 판별 union 으로 고정. */
type PathCta = { label: string; to: string } | { label: string; href: string }

const PATHS: { title: string; fee: string; hi?: boolean; steps: string[]; note: string; cta: PathCta }[] = [
  {
    title: '사장님이 직접',
    fee: `수수료 ${F.feeDirect}`,
    hi: true,
    steps: ['urdeal.kr 카카오 로그인', '카카오맵에서 내 가게 찾기', '사업자등록증 사진 한 장', '승인 확인하고 첫 이용권 올리기', '손님 오면 QR 한 번 찍기', '매주 정산 확인'],
    note: `${F.signupMinutes}이면 끝납니다. 막히면 카카오톡 채널로 "등록 도와주세요"`,
    cta: { label: '내 가게 등록하기', to: '/store/new' },
  },
  {
    title: '유어딜이 대신',
    fee: `수수료 ${F.feeDirect}`,
    steps: ['카카오톡 채널에 "등록 도와주세요"', '전화로 메뉴와 가격, 사진을 받습니다', '유어딜이 매장과 첫 이용권을 만듭니다', '사장님은 등록증 사진과 승인 확인만', '손님 오면 QR 한 번 찍기', '매주 정산 확인'],
    note: '폰이 익숙하지 않으셔도 됩니다. 사람이 합니다',
    cta: { label: '카카오톡으로 요청하기', href: F.kakaoChannel },
  },
  {
    title: '대행사와 함께',
    fee: `수수료 ${F.feeBrokered}`,
    steps: ['대행사가 매장을 중개로 등록', '대행사가 이용권과 소개를 운영', '사장님은 본인 카카오로 소유자 확인', '정산 계좌는 사장님만 등록', '손님 오면 QR 한 번 찍기', '대행사 보수는 매장과 대행사가 직접'],
    note: '대행사는 계좌를 못 건드립니다. 권한은 언제든 회수하실 수 있습니다',
    cta: { label: '어떤 방식인지 물어보기', href: F.kakaoChannel },
  },
]

export default function PartnerPaths() {
  return (
    <section className="bg-warm">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <div className="lg:grid lg:grid-cols-[1.6fr_0.4fr] lg:gap-16 lg:items-end">
          <div>
            <h2 className="text-[26px] lg:text-[40px] xl:text-[46px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
              시작하는 길, 세 가지
            </h2>
            <p className="mt-4 text-[14px] lg:text-[17px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[28em]">
              어느 길이든 손님이 낸 돈은 사장님 계좌로만 갑니다.
            </p>
          </div>
          {/* 등록의 첫 관문 — 카카오맵에서 내 가게를 찾는 화면. "어렵지 않다" 는 말보다 이게 빠르다 */}
          <div className="hidden lg:block">
            <PartnerPhone src={SHOT('store-new')} alt="카카오맵에서 내 가게를 찾는 등록 화면" className="max-w-[11rem] ml-auto" />
            <p className="mt-4 text-right text-[13px] text-gray-500 dark:text-gray-400">카카오맵에서 내 가게 찾기</p>
          </div>
        </div>

        <div className="mt-12 lg:mt-20 grid gap-5 lg:grid-cols-[1.25fr_1fr_1fr] lg:gap-7 lg:items-start">
          {PATHS.map(({ title, fee, hi, steps, note, cta }) => (
            <article key={title}
              className={`rounded-2xl flex flex-col ${hi ? 'bg-surface shadow-lift p-6 lg:p-10' : 'bg-black/[0.03] dark:bg-white/[0.04] p-6 lg:p-8'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={`font-extrabold text-ink tracking-[-0.02em] ${hi ? 'text-[20px] lg:text-[30px]' : 'text-[18px] lg:text-[23px]'}`}>{title}</h3>
                <span className={`text-[12px] lg:text-[14px] font-bold shrink-0 ${hi ? 'text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>{fee}</span>
              </div>
              <ol className="mt-6 lg:mt-8 space-y-2.5 lg:space-y-3.5 flex-1">
                {steps.map(s => (
                  <li key={s} className="flex gap-2.5 text-[13px] lg:text-[15px] leading-snug text-gray-600 dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 mt-[3px] shrink-0 text-brand-text" strokeWidth={2.4} />
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 pt-5 border-t border-rule text-[12px] lg:text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400">{note}</p>
              {'to' in cta ? (
                <Link to={cta.to}
                  className="mt-6 h-12 lg:h-14 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
                  {cta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <a href={cta.href} target="_blank" rel="noopener noreferrer"
                  className="mt-6 h-12 lg:h-14 rounded-2xl border border-rule-strong flex items-center justify-center gap-1.5 text-[14px] font-bold text-ink">
                  {cta.label} <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </article>
          ))}
        </div>

        <p className="mt-8 lg:mt-14 text-[13px] lg:text-[15.5px] leading-[1.8] text-gray-500 dark:text-gray-400 max-w-[54em]">
          어느 길이든 사업자등록번호는 국세청에 자동으로 조회됩니다. 등록증 사본은 사람이 한 번 보고 승인합니다.
          가짜 매장이 섞이면 먼저 들어오신 사장님이 손해라서, 이 한 단계는 사람이 맡습니다.
        </p>
      </div>
    </section>
  )
}
