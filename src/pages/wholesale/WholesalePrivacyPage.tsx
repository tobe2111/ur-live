/**
 * 🏭 2026-06-21 (대표 요청 — 도매몰 전용 개인정보처리방침): 유통스타트(사람과고리) B2B 개인정보처리방침.
 *   소비자몰(/privacy, 리스터코퍼레이션)과 분리 — 도매몰은 사업자(사람과고리)가 다름.
 *   사업자정보는 WholesaleFooter 의 BUSINESS_INFO(SSOT) 재사용 — 한 곳만 고치면 푸터/약관/방침 자동 반영.
 *   ⚠️ 초안 — 실제 시행 전 법무 검토 1회 권장. 라이트 고정(WT).
 */
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { WT } from './wholesale-theme'
import { BUSINESS_INFO } from './WholesaleFooter'

const EFFECTIVE_DATE = '2026년 6월 21일'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '제1조 (총칙)',
    body: [
      `${BUSINESS_INFO.company}(이하 "회사")는 회사가 운영하는 B2B 도매 플랫폼 "유통스타트"(이하 "서비스")를 이용하는 회원(제조사·판매사)의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.`,
      '이 개인정보처리방침은 서비스 이용에 적용되며, 소비자 서비스의 개인정보처리방침과는 별도로 운영됩니다.',
    ],
  },
  {
    title: '제2조 (수집하는 개인정보 항목)',
    body: [
      '① 회원가입·심사: 상호(법인명), 대표자명, 사업자등록번호, 사업장 주소, 담당자 성명·휴대전화번호·이메일, 통신판매업 신고번호, 사업자등록증·통장 사본 등 심사에 필요한 서류.',
      '② 결제·정산: 예치금 입금·환불 계좌 정보(은행/예금주/계좌번호), 세금계산서 발행 정보.',
      '③ 서비스 이용 과정에서 자동 생성·수집되는 정보: 접속 IP, 쿠키, 접속 일시, 주문·거래 기록, 부정 이용 기록.',
    ],
  },
  {
    title: '제3조 (개인정보의 수집·이용 목적)',
    body: [
      '① 회원 자격 심사·승인 및 등급 부여, 본인·사업자 확인.',
      '② 상품 공급·주문·직배송·예치금 결제 및 정산, 세금계산서 발행 등 거래 이행.',
      '③ 고객 문의·분쟁 처리, 공지·거래 관련 통지, 최저가 미준수 등 위반 신고 처리.',
      '④ 부정 이용 방지, 서비스 개선 및 통계 분석.',
    ],
  },
  {
    title: '제4조 (개인정보의 보유 및 이용 기간)',
    body: [
      '① 회사는 원칙적으로 개인정보 수집·이용 목적이 달성되면 지체 없이 파기합니다.',
      '② 다만 관련 법령에 따라 다음 정보는 정해진 기간 동안 보관합니다: 계약·청약철회 기록 5년, 대금결제·재화공급 기록 5년, 소비자 불만·분쟁처리 기록 3년(전자상거래법), 세금계산서 등 거래 증빙 5년(국세기본법).',
      '③ 회원 탈퇴 시에도 위 법정 보존 의무가 있는 정보는 해당 기간 보관 후 파기합니다.',
    ],
  },
  {
    title: '제5조 (개인정보의 제3자 제공)',
    body: [
      '① 회사는 회원의 개인정보를 제3조의 목적 범위를 초과하여 이용하거나 제3자에게 제공하지 않습니다.',
      '② 다만 거래 이행을 위해 필요한 최소한의 범위에서 제공합니다: 직배송을 위해 제조사에게 수령인 정보를, 판매사에게 송장·배송 정보를 제공합니다.',
      '③ 법령에 근거가 있거나 수사기관의 적법한 요청이 있는 경우 관련 법령에 따라 제공할 수 있습니다.',
    ],
  },
  {
    title: '제6조 (개인정보 처리의 위탁)',
    body: [
      '① 회사는 원활한 서비스 제공을 위해 결제대행(PG), 전자세금계산서 발행, 클라우드 인프라 등 일부 업무를 외부에 위탁할 수 있습니다.',
      '② 위탁 계약 시 「개인정보 보호법」 제26조에 따라 목적 외 처리 금지, 안전성 확보조치, 재위탁 제한 등을 계약에 반영하고 수탁자를 관리·감독합니다.',
    ],
  },
  {
    title: '제7조 (정보주체의 권리·의무 및 행사 방법)',
    body: [
      '① 회원은 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있습니다.',
      '② 권리 행사는 이메일·서면 등으로 할 수 있으며, 회사는 지체 없이 조치합니다. 다만 법령상 보존 의무가 있는 정보는 그 범위에서 제한될 수 있습니다.',
    ],
  },
  {
    title: '제8조 (개인정보의 안전성 확보 조치)',
    body: [
      '회사는 개인정보의 안전성 확보를 위해 접근권한 관리, 접근통제, 전송·저장 시 암호화, 접속기록 보관, 보안 프로그램 운영 등 관리적·기술적 보호조치를 시행합니다.',
    ],
  },
  {
    title: '제9조 (개인정보 보호책임자)',
    body: [
      `회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를 지정하고 있으며, 개인정보 관련 문의는 아래로 연락 주시기 바랍니다.`,
      `· 개인정보 보호책임자: ${BUSINESS_INFO.ceo} (${BUSINESS_INFO.company})`,
      `· 이메일: ${BUSINESS_INFO.csEmail}`,
      `· 전화: ${BUSINESS_INFO.tel}`,
    ],
  },
  {
    title: '제10조 (사업자 정보)',
    body: [
      `· 상호: ${BUSINESS_INFO.company}`,
      `· 대표자: ${BUSINESS_INFO.ceo}`,
      `· 사업자등록번호: ${BUSINESS_INFO.bizRegNo}`,
      `· 통신판매업 신고: ${BUSINESS_INFO.mailOrderNo}`,
      `· 사업장 주소: ${BUSINESS_INFO.address}`,
      `· 이메일: ${BUSINESS_INFO.csEmail}`,
    ],
  },
  {
    title: '제11조 (방침의 변경)',
    body: [
      '이 개인정보처리방침은 법령·서비스 정책 변경에 따라 개정될 수 있으며, 변경 시 시행일과 변경 내용을 도매몰 공지사항에 게시합니다.',
    ],
  },
  {
    title: '부칙',
    body: [`이 개인정보처리방침은 ${EFFECTIVE_DATE}부터 시행합니다.`],
  },
]

export default function WholesalePrivacyPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen pb-24" style={{ background: WT.fill }}>
      <SEO title="개인정보처리방침 - 유통스타트" description="유통스타트 B2B 도매몰 개인정보처리방침" url="/wholesale/privacy" noindex />
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-medium px-5 lg:px-8 flex items-center h-14">
          <button onClick={() => navigate(-1)} aria-label="뒤로" className="p-1.5 -ml-1.5">
            <ChevronLeft className="w-5 h-5" style={{ color: WT.ink }} />
          </button>
          <h1 className="ml-1 text-[16px] font-extrabold" style={{ color: WT.ink }}>개인정보처리방침</h1>
        </div>
      </header>
      <main className="ur-content-medium px-5 lg:px-8 pt-5">
        <p className="text-[12.5px] mb-3" style={{ color: WT.ink3 }}>시행일: {EFFECTIVE_DATE} · {BUSINESS_INFO.company}</p>
        <div className="rounded-2xl p-5 lg:p-8 space-y-6" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
          {SECTIONS.map(sec => (
            <section key={sec.title}>
              <h2 className="text-[15px] font-extrabold mb-2" style={{ color: WT.ink }}>{sec.title}</h2>
              {sec.body.map((p, i) => (
                <p key={i} className="text-[13.5px] leading-relaxed mt-1" style={{ color: WT.ink2 }}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
