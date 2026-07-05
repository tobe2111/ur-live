/**
 * 파트너 약관-as-계약 시드 (셀러·벤더사 온보딩 clickwrap).
 * 설계: docs/design/partner-terms-as-contract.md · 문안 SSOT: src/shared/legal.
 *
 * body = 실제 약관 전문(SSOT). key_clauses = 약관규제법 §2① "중요조항 개별 동의" 대상 —
 * 가입 UI 에서 요약박스+개별 체크로 노출되고, 전부 체크해야 계약 성립.
 * 문안 개정 시 src/shared/legal 갱신 + 아래 version +1(그러면 신규 가입자는 새 버전에 동의,
 * 기존 동의기록은 자기 버전으로 보존 — §2②).
 */
import { SELLER_TERMS_MD } from '@/shared/legal/seller-terms'
import { AGENCY_TERMS_MD } from '@/shared/legal/agency-terms'

export interface PartnerTermsKeyClause {
  key: string
  title: string
  summary: string
  required: boolean
}

export interface PartnerTermsDoc {
  terms_type: 'seller' | 'agency'
  version: number
  title: string
  body: string
  key_clauses: PartnerTermsKeyClause[]
}

export const PARTNER_TERMS: Record<'seller' | 'agency', PartnerTermsDoc> = {
  seller: {
    terms_type: 'seller',
    version: 1,
    title: '유어딜 판매자 이용약관',
    body: SELLER_TERMS_MD,
    key_clauses: [
      { key: 'commission', required: true, title: '판매 수수료 (제4조)',
        summary: '판매가에서 플랫폼 수수료가 차감되며, 기본 수수료율은 5%(전자결제수수료 포함)입니다. 직판 상품에는 적용되지 않습니다.' },
      { key: 'settlement', required: true, title: '정산 및 원천징수 (제4조)',
        summary: '이용권 사용 확인 시 정산 원장에 적립되고, 회사가 정한 주기(기본 주간)에 등록 계좌로 지급됩니다. 커미션 등 지급 시 세법상 원천징수가 적용될 수 있습니다.' },
      { key: 'clawback', required: true, title: '환불·취소 시 정산 회수 (제4조·제5조)',
        summary: '환불·취소가 발생한 거래는 정산에서 차감되며, 이미 지급된 경우 다음 정산에서 상계하거나 판매자가 반환합니다. 판매자 귀책 환불 비용은 판매자가 부담합니다.' },
      { key: 'termination', required: true, title: '요율 변경 및 해지 (제10조·제11조)',
        summary: '회사는 수수료율·정산 주기 등을 변경할 수 있고 불리한 변경은 시행 30일 전 고지하며, 동의하지 않으면 해지할 수 있습니다. 해지 시에도 기 판매 이용권의 이행·미정산 정산 의무는 존속합니다.' },
    ],
  },
  agency: {
    terms_type: 'agency',
    version: 1,
    title: '유어딜 벤더사 파트너 약관',
    body: AGENCY_TERMS_MD,
    // 약관 서두 명시: 제4조·제5조·제9조·제10조는 요약 고지 및 개별 동의 대상.
    key_clauses: [
      { key: 'commission', required: true, title: '영입 커미션 (제4조)',
        summary: '영입 매장의 확정 거래 결제액의 일정 비율(기본 1%)을 커미션으로 지급하며, 지급 기간은 귀속 등록일로부터 24개월입니다. 소비자 결제액에 추가되거나 판매자에게 전가되지 않습니다.' },
      { key: 'settlement', required: true, title: '정산 및 세금 (제5조)',
        summary: '확정 커미션은 성숙 기간(기본 7일) 후 정산 가능 금액으로 전환되어 등록 계좌로 지급되며, 벤더사는 세금계산서를 발행합니다(미등록 수령자는 원천징수 후 지급).' },
      { key: 'change', required: true, title: '조건의 변경 (제9조)',
        summary: '회사는 커미션 요율·기간·정산 주기를 변경할 수 있고, 불리한 변경은 시행 30일 전 대시보드·이메일로 고지합니다. 동의하지 않으면 해지할 수 있으며, 변경 전 발생 커미션은 종전 조건에 따릅니다.' },
      { key: 'termination', required: true, title: '해지 및 종료 후 처리 (제10조)',
        summary: '각 당사자는 30일 전 통지로 해지할 수 있고, 해지 시점까지 확정된 커미션은 정산 일정에 따라 지급됩니다(부정 취득분 제외).' },
    ],
  },
}
