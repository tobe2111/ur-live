/**
 * 🏪 입점 랜딩 히어로 — "체험단 말고, 계산하는 손님"
 *
 * 문구는 대표 승인 덱(`urdeal-store-owner-deck.build.mjs` 01 표지)과 **같은 문장**을 쓴다.
 * 오른쪽은 손님이 실제로 받는 이용권을 `TicketCard`(표면 체계 부품)로 그린 것 —
 * 사장님이 "내가 뭘 파는 건지" 를 글이 아니라 물건으로 보게 하는 자리다.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { TicketCard, TicketRow } from '@/components/ticket/TicketCard'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { formatNumber } from '@/utils/format'

const STATS = [
  { n: '0원', d: '미리 내는 돈' },
  { n: F.feeDirect, d: '팔린 뒤에만 내는 수수료' },
  { n: F.storeShareDirect, d: '사장님 몫' },
]

export default function PartnerHero() {
  return (
    <section className="ur-panel-ink text-white">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24 grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
        <div>
          <p className="text-[12px] lg:text-[13px] font-bold tracking-wide text-brand-text mb-4">유어딜 입점 안내</p>
          <h1 className="text-[30px] lg:text-[48px] leading-[1.22] font-extrabold tracking-[-0.02em]">
            체험단 말고,<br />
            <span className="text-brand-text">계산하는 손님</span>을<br className="hidden lg:block" /> 부르는 방법입니다
          </h1>
          <p className="mt-5 lg:mt-7 text-[14.5px] lg:text-[17px] leading-[1.75] text-white/70 max-w-[34em]">
            후기 몇 개를 받으려고 무료 식사를 내드리고 대행비를 먼저 보내는 방식은 이제 안 하셔도 됩니다.
            유어딜은 가게 이용권을 온라인에서 미리 파는 곳입니다. 손님이 먼저 결제하고, 이용권을 들고 가게로 옵니다.
            사장님이 내는 건 팔린 이용권의 수수료 {F.feeDirect}, 그게 전부입니다.
          </p>

          <div className="mt-9 lg:mt-11 grid grid-cols-3 gap-3 lg:gap-6 max-w-[30rem]">
            {STATS.map(({ n, d }) => (
              <div key={d}>
                <p className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] tabular-nums">{n}</p>
                <p className="text-[11px] lg:text-[12.5px] leading-snug text-white/55 mt-1">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 lg:mt-11 flex flex-col sm:flex-row gap-3 max-w-[30rem]">
            <Link to="/store/new"
              className="flex-1 h-[52px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] font-extrabold active:scale-[0.98] transition-transform">
              내 가게 등록하기 <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
              className="flex-1 h-[52px] rounded-2xl border border-white/25 flex items-center justify-center gap-2 text-[15px] font-bold text-white/90">
              <MessageCircle className="w-4 h-4" /> 카카오로 물어보기
            </a>
          </div>
          <p className="mt-3.5 text-[12px] text-white/50">
            가입비와 월 이용료, 선불 광고비가 없습니다. 중개(대행사)를 통해 들어오시면 수수료는 {F.feeBrokered}입니다.
          </p>
        </div>

        {/* 손님이 받는 물건 — 말 대신 실물 */}
        <div className="lg:pl-6">
          <p className="text-[12px] font-bold text-white/55 mb-3">손님 폰에 이렇게 도착합니다</p>
          <div className="max-w-[22rem]">
            <TicketCard bandLeft="2026.10.15 (목)까지" bandRight="D-29">
              <TicketRow left="식사 이용권" right="1매" />
              <div className="px-4 pt-3.5 pb-4">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug">{F.sample.name}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">동네돈까스 방배점</p>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-[12.5px] text-gray-400 line-through tabular-nums">{formatNumber(F.sample.list)}원</span>
                  <span className="text-[22px] font-extrabold text-brand-text tabular-nums">{formatNumber(F.sample.sale)}원</span>
                </div>
                <div className="mt-4 rounded-xl bg-warm py-5 flex flex-col items-center gap-2">
                  <QrGlyph />
                  <p className="text-[11.5px] text-gray-500 dark:text-gray-400">매장에서 이 QR을 보여주세요</p>
                </div>
              </div>
            </TicketCard>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-white/50 max-w-[22rem]">
            사장님은 이 QR을 매장 폰으로 한 번 찍으면 됩니다. 단말기도, 포스 연동도 필요 없습니다.
          </p>
        </div>
      </div>
    </section>
  )
}

/** 장식용 QR 글리프. 실제 코드가 아니므로 라이브러리를 부르지 않는다(첫 화면 비용 0). */
function QrGlyph() {
  const cells = [
    0b1110111, 0b1000101, 0b1011101, 0b0000000, 0b1011101, 0b1000001, 0b1110111,
  ]
  return (
    <div aria-hidden className="grid grid-cols-7 gap-[3px]">
      {cells.flatMap((row, y) =>
        Array.from({ length: 7 }, (_, x) => (
          <span key={`${y}-${x}`}
            className={`w-2.5 h-2.5 ${(row >> (6 - x)) & 1 ? 'bg-gray-900 dark:bg-white' : 'bg-transparent'}`} />
        )),
      )}
    </div>
  )
}
