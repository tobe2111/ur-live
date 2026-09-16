/**
 * 🏪 자주 묻는 질문 + 정직 고지 — 대표 승인 덱 11·12장.
 *
 * 질문 순서는 기획 §2-2 가 정한 "사장님이 실제로 묻는 순서" 그대로다.
 * 정직 고지 문장은 `deck-common.mjs` 의 공통 문구와 같은 내용을 쓴다 —
 * 세 소개서와 랜딩이 **같은 말**을 해야 한다(기획 §1 공통 블록 ③).
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

const FAQS = [
  {
    q: '얼마 떼가나요? 숨은 비용은 없나요?',
    a: `직접 등록하시면 팔린 이용권 금액의 ${F.feeDirect}, 대행사를 통해 들어오시면 ${F.feeBrokered}입니다. 그 밖에는 없습니다. 가입비와 월 이용료, 선불 광고비, 정산 수수료가 전부 0원입니다. ${F.pgNote}`,
  },
  {
    q: '뭘 해야 하나요? 제가 바쁜데요.',
    a: `등록은 네 단계입니다. 카카오맵에서 내 가게 찾기, 담당자 번호 넣기, 누가 운영하는지 고르기, 사업자등록증 사진 올리기. ${F.signupMinutes} 정도 걸립니다. 그다음 매일 하실 일은 손님이 보여주는 QR을 한 번 찍는 것뿐입니다. 폰이 익숙하지 않으시면 카카오톡 채널로 요청하세요. 저희가 대신 만들어 드립니다.`,
  },
  {
    q: '손님이 정말 오나요?',
    a: `유어딜은 아직 초기 서비스입니다. 그래서 "몇 명이 온다" 를 약속하지 않습니다. 대신 구조를 말씀드립니다. 이용권은 손님이 먼저 결제해야 발급되므로, 사장님 화면에 뜨는 숫자는 전부 이미 돈을 낸 사람입니다. 안 팔리면 사장님이 내는 돈도 0원이라 잃을 것이 없습니다.`,
  },
  {
    q: '노쇼가 나거나 손님이 안 쓰면요?',
    a: '정산은 손님이 실제로 사용한 이용권만 대상입니다. 팔렸는데 안 오면 수수료도 발생하지 않습니다. 유효기간은 사장님이 정하고, 기간이 지나면 미사용분은 100% 자동으로 환불됩니다. 환불 처리는 유어딜이 하므로 사장님이 응대하실 일이 없습니다.',
  },
  {
    q: '돈은 언제 들어오나요?',
    a: `사용된 이용권을 주 단위로 모아 등록하신 계좌로 보냅니다. 최소 지급액은 ${F.minPayout}입니다. 보내기 전에 유어딜 담당자가 내역을 확인합니다. 정산 내역은 매장 화면에서 언제든 보실 수 있습니다.`,
  },
  {
    q: '할인을 얼마나 해야 하나요?',
    a: '할인율은 사장님이 정합니다. 유어딜이 최소 할인율을 요구하지 않습니다. 첫 방문을 만드는 메뉴는 크게, 마진이 좋은 세트는 작게처럼 이용권마다 다르게 두셔도 됩니다. 수량과 유효기간도 마찬가지입니다.',
  },
  {
    q: '단말기나 설치가 필요한가요?',
    a: '없습니다. 쓰시던 스마트폰으로 손님 QR을 찍으면 됩니다. 손님 폰이 안 켜지는 상황을 대비해 매장 확인코드 6자리로도 처리할 수 있습니다. 포스 연동과 직원 교육이 필요 없습니다.',
  },
  {
    q: '대행사에 맡기면 뭐가 달라지나요?',
    a: '대행사가 이용권 등록과 운영을 대신하고, 수수료는 5%가 됩니다. 대행사 보수는 유어딜을 거치지 않고 사장님과 대행사가 직접 정합니다. 대행사는 정산 계좌와 사업자 정보를 건드릴 수 없고, 권한은 사장님이 언제든 회수하실 수 있습니다.',
  },
]

export default function PartnerFaq() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <h2 className="text-[25px] lg:text-[42px] xl:text-[48px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
              사장님들이<br className="hidden lg:block" /> 자주 물으시는 것
            </h2>
            <p className="mt-5 lg:mt-7 text-[13.5px] lg:text-[16.5px] leading-[1.8] text-gray-500 dark:text-gray-400">
              여기에 없는 것은 카카오톡 채널로 물어보세요. 사람이 답합니다.
            </p>
          </div>
          <div>
            {FAQS.map(f => <Item key={f.q} {...f} />)}
          </div>
        </div>

        {/* 정직 고지 — 세 소개서와 같은 내용 */}
        <div className="mt-14 lg:mt-20 pt-10 lg:pt-14 border-t border-rule">
          <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-4">숨기지 않고 말씀드립니다</p>
          <p className="text-[15px] lg:text-[22px] leading-[1.75] text-ink max-w-[40em] font-medium">
            유어딜은 초기 서비스입니다. {F.liveMeasuredAt} 기준 판매 중인 이용권 {F.activeVouchers}건 가운데
            실제 매장이 등록한 것은 {F.realStores}건이고, 나머지는 시범 운영을 위한 예시입니다.
            트래픽을 약속하는 대신 조건을 숫자로 먼저 공개합니다.
            지금 들어오시는 매장이 그 지역과 카테고리의 첫 자리를 가져갑니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-rule">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 lg:py-6 text-left">
        <span className="text-[14.5px] lg:text-[18px] font-bold text-ink">{q}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {open && (
        <p className="pb-5 pr-8 text-[13.5px] lg:text-[16px] leading-[1.8] text-gray-600 dark:text-gray-300 max-w-[44em]">{a}</p>
      )}
    </div>
  )
}
