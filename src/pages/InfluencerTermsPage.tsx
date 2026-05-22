/**
 * 🛡️ 2026-05-16: 인플루언서 이용약관 초안.
 *
 * ⚠️ 법무 검토 필수 — 실제 운영 전 변호사 검토 받으세요.
 * 이 문서는 일반적인 인플루언서 마케팅 약관 패턴 기반 초안입니다.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function InfluencerTermsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title="인플루언서 약관 - 유어딜" description="유어딜 인플루언서 활동 및 정산 약관" url="/terms/influencer" />
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-gray-900 dark:text-white"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">인플루언서 약관</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6 prose prose-sm max-w-none dark:prose-invert">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">최종 수정일: 2026년 5월 16일 (초안 — 법무 검토 전)</p>

        <h2 className="text-lg font-bold mt-4 mb-2">제1조 (목적)</h2>
        <p className="text-sm">본 약관은 유어딜 (이하 "회사") 의 인플루언서 referral 프로그램 (이하 "프로그램") 에 참여하는 회원 (이하 "인플루언서") 의 권리·의무 및 정산 절차를 규정함을 목적으로 합니다.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제2조 (인플루언서 자격)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>유어딜에 회원 가입한 모든 사용자는 인플루언서가 될 수 있습니다.</li>
          <li>별도 가입 절차 없음 — 카탈로그 (<code>/influencer/discover</code>) 진입 후 추천 링크 (?ref=) 생성 시점부터 활동 가능합니다.</li>
          <li>commission 정산 받으려면 정산 페이지 (<code>/influencer/settlement</code>) 에서 계좌/세금 정보 입력이 필요합니다.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제3조 (Commission 정책)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>기본 commission: 매출의 <strong>0.5%</strong> (회사 정책에 따라 변경 가능, 어드민 설정 페이지 참조).</li>
          <li>매장 영입 보너스: 인플이 새 매장을 가입시킨 경우 그 매장의 <strong>가입 후 6개월간</strong> commission 에 <strong>추가 1%</strong>.</li>
          <li>협업 deal: 매장과 별도 합의 시 우대 commission 가능. 단 모든 합산 최대 <strong>2% cap</strong>.</li>
          <li>사용자 referral 보너스 0.5% 는 인플과 별개로 사용자에게 직접 지급됩니다.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제4조 (정산 방식)</h2>
        <p className="text-sm">인플루언서는 다음 두 가지 정산 방식 중 선택할 수 있습니다.</p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><strong>현금 송금</strong>: 매월 정해진 날짜에 원천징수 후 등록 계좌로 입금. 사업자번호 보유 시 사업소득 3.3%, 미보유 시 기타소득 8.8%.</li>
          <li><strong>딜 포인트 (+20% 보너스)</strong>: 즉시 유어딜 user_points 적립. <strong>현금 환불 불가</strong>, 양도 불가, 유어딜 결제 전용.</li>
          <li>최소 송금액 미달 시 다음 정산 주기로 누적됩니다 (default 10만원, 어드민 조정 가능).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제5조 (Clawback — 부당 commission 회수)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>voucher 만료 환불 / 어드민 강제 환불 시 관련 commission 은 <strong>자동 회수</strong>됩니다.</li>
          <li>이미 송금된 commission 도 다음 정산에서 차감될 수 있습니다.</li>
          <li>의도적 부정 (자기 referral, 허위 매출 등) 적발 시 전액 회수 + 계정 정지.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제6조 (매장의 차단 권한)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>매장은 본인 마케팅 페이지에서 특정 인플 차단 가능.</li>
          <li>차단 시점까지 발생한 commission 은 <strong>그대로 지급</strong> 됩니다 (인플 신뢰 보호).</li>
          <li>차단이 부당하다고 판단되면 <strong>분쟁 신고</strong> (<code>/influencer/settlement</code> 헤더 버튼) 가능. 어드민이 조정.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제7조 (콘텐츠 책임)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>인플은 본인 SNS 콘텐츠에 대해 모든 법적 책임을 집니다.</li>
          <li>허위 광고 / 부당비교 / 명예훼손 / 저작권 침해 등은 인플 본인 책임.</li>
          <li>회사는 부적절한 콘텐츠 사용 시 commission 지급 중단 + 계정 정지할 수 있습니다.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제8조 (세금)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>사업자번호 보유: 사업소득 (3.3% 원천징수) 처리. 종합소득세 신고는 인플 본인 책임.</li>
          <li>사업자번호 미보유: 기타소득 (8.8% 원천징수). 연 300만원 이하면 분리과세 가능.</li>
          <li>딜 정산 시에도 세무상 사업소득/기타소득 신고 의무가 있을 수 있음 (세무사 자문 권장).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제9조 (계정 종료)</h2>
        <p className="text-sm">인플은 언제든 계정을 종료할 수 있습니다. 잔액은 등록 계좌로 일괄 송금됩니다.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제10조 (분쟁 해결)</h2>
        <p className="text-sm">본 약관과 관련된 분쟁은 회사와 인플 간 협의로 해결합니다. 협의 불가 시 회사 본점 소재지 관할 법원을 1심 법원으로 합니다.</p>

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-10">⚠️ 본 약관은 초안이며, 실제 시행 전 법무 검토가 필요합니다.</p>
      </div>
    </div>
  )
}
